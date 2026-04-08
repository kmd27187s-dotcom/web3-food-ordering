package blockchain

import (
	"context"
	"crypto/ecdsa"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"mealvoting/backend/config"
	"mealvoting/backend/internal/models"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

type Client struct {
	privateKey *ecdsa.PrivateKey
	chainID    int64
	governance common.Address
	contract   common.Address
	treasury   common.Address
	signer     common.Address
	signExpiry int64
	rpcURL     string
	batchSize  int64
}

func NewClient(cfg config.ChainConfig) (*Client, error) {
	var (
		privateKey *ecdsa.PrivateKey
		err        error
	)
	if strings.TrimSpace(cfg.SignerPrivateKey) == "" {
		privateKey, err = ecdsa.GenerateKey(crypto.S256(), rand.Reader)
	} else {
		privateKey, err = crypto.HexToECDSA(strings.TrimPrefix(cfg.SignerPrivateKey, "0x"))
	}
	if err != nil {
		return nil, err
	}

	publicKey, ok := privateKey.Public().(*ecdsa.PublicKey)
	if !ok {
		return nil, errors.New("invalid signer public key")
	}

	return &Client{
		privateKey: privateKey,
		chainID:    cfg.ChainID,
		governance: common.HexToAddress(cfg.GovernanceContract),
		contract:   common.HexToAddress(cfg.OrderContract),
		treasury:   common.HexToAddress(cfg.PlatformTreasury),
		signer:     crypto.PubkeyToAddress(*publicKey),
		signExpiry: cfg.SignatureExpirySec,
		rpcURL:     cfg.RPCURL,
		batchSize:  cfg.IndexerBatchSize,
	}, nil
}

func (c *Client) ContractInfo() models.ContractInfo {
	return models.ContractInfo{
		ChainID:             c.chainID,
		GovernanceContract:  c.governance.Hex(),
		OrderEscrowContract: c.contract.Hex(),
		OrderContract:       c.contract.Hex(),
		PlatformTreasury:    c.treasury.Hex(),
		SignerAddress:       c.signer.Hex(),
	}
}

func (c *Client) NewIndexer() (*Indexer, error) {
	return NewIndexer(c.rpcURL, c.contract, c.batchSize)
}

func (c *Client) SendNativeTransfer(ctx context.Context, to string, amountWei string) (string, error) {
	if strings.TrimSpace(c.rpcURL) == "" {
		return "", errors.New("rpc url not configured")
	}
	if !common.IsHexAddress(strings.TrimSpace(to)) {
		return "", fmt.Errorf("invalid recipient wallet: %s", to)
	}
	amount, ok := new(big.Int).SetString(strings.TrimSpace(amountWei), 10)
	if !ok {
		return "", fmt.Errorf("invalid wei amount: %s", amountWei)
	}
	client, err := ethclient.DialContext(ctx, c.rpcURL)
	if err != nil {
		return "", err
	}
	defer client.Close()

	from := c.signer
	nonce, err := client.PendingNonceAt(ctx, from)
	if err != nil {
		return "", err
	}
	gasTipCap, err := client.SuggestGasTipCap(ctx)
	if err != nil {
		return "", err
	}
	head, err := client.HeaderByNumber(ctx, nil)
	if err != nil {
		return "", err
	}
	gasFeeCap := new(big.Int).Add(new(big.Int).Mul(head.BaseFee, big.NewInt(2)), gasTipCap)
	msg := ethereum.CallMsg{
		From:      from,
		To:        ptrAddress(common.HexToAddress(strings.TrimSpace(to))),
		GasFeeCap: gasFeeCap,
		GasTipCap: gasTipCap,
		Value:     amount,
		Data:      nil,
	}
	gasLimit, err := client.EstimateGas(ctx, msg)
	if err != nil {
		gasLimit = 21_000
	}
	tx := types.NewTx(&types.DynamicFeeTx{
		ChainID:   big.NewInt(c.chainID),
		Nonce:     nonce,
		GasTipCap: gasTipCap,
		GasFeeCap: gasFeeCap,
		Gas:       gasLimit,
		To:        ptrAddress(common.HexToAddress(strings.TrimSpace(to))),
		Value:     amount,
		Data:      nil,
	})
	signedTx, err := types.SignTx(tx, types.NewLondonSigner(big.NewInt(c.chainID)), c.privateKey)
	if err != nil {
		return "", err
	}
	if err := client.SendTransaction(ctx, signedTx); err != nil {
		return "", err
	}
	return signedTx.Hash().Hex(), nil
}

func (c *Client) SignOrder(proposalID int64, memberWallet string, orderHash string, amountWei string) (*models.OrderSignature, error) {
	if !common.IsHexAddress(memberWallet) {
		return nil, fmt.Errorf("invalid wallet address: %s", memberWallet)
	}
	amount, ok := new(big.Int).SetString(amountWei, 10)
	if !ok {
		return nil, fmt.Errorf("invalid wei amount: %s", amountWei)
	}
	expiry := time.Now().Add(time.Duration(c.signExpiry) * time.Second).Unix()
	orderDigest, err := c.digestOrder(proposalID, common.HexToAddress(memberWallet), common.HexToHash(orderHash), amount, expiry)
	if err != nil {
		return nil, err
	}

	prefixed := accounts.TextHash(orderDigest.Bytes())
	signature, err := crypto.Sign(prefixed, c.privateKey)
	if err != nil {
		return nil, err
	}
	signature[64] += 27

	return &models.OrderSignature{
		AmountWei:       amountWei,
		Expiry:          expiry,
		OrderHash:       common.HexToHash(orderHash).Hex(),
		Signature:       "0x" + common.Bytes2Hex(signature),
		Digest:          orderDigest.Hex(),
		SignerAddress:   c.signer.Hex(),
		ContractAddress: c.contract.Hex(),
		TokenAddress:    common.Address{}.Hex(),
	}, nil
}

func ptrAddress(value common.Address) *common.Address {
	return &value
}

func (c *Client) digestOrder(proposalID int64, wallet common.Address, orderHash common.Hash, amount *big.Int, expiry int64) (common.Hash, error) {
	uint256Type, _ := abi.NewType("uint256", "", nil)
	addressType, _ := abi.NewType("address", "", nil)
	bytes32Type, _ := abi.NewType("bytes32", "", nil)
	args := abi.Arguments{
		{Type: uint256Type},
		{Type: addressType},
		{Type: bytes32Type},
		{Type: uint256Type},
		{Type: uint256Type},
		{Type: addressType},
		{Type: uint256Type},
	}
	encoded, err := args.Pack(
		big.NewInt(proposalID),
		wallet,
		orderHash,
		amount,
		big.NewInt(expiry),
		c.contract,
		big.NewInt(c.chainID),
	)
	if err != nil {
		return common.Hash{}, err
	}
	return crypto.Keccak256Hash(encoded), nil
}
