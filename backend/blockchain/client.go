package blockchain

import (
	"crypto/ecdsa"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"mealvoting/backend/config"
	"mealvoting/backend/internal/models"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

type Client struct {
	privateKey *ecdsa.PrivateKey
	chainID    int64
	governance common.Address
	contract   common.Address
	token      common.Address
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
		token:      common.HexToAddress(cfg.MembershipToken),
		treasury:   common.HexToAddress(cfg.PlatformTreasury),
		signer:     crypto.PubkeyToAddress(*publicKey),
		signExpiry: cfg.SignatureExpirySec,
		rpcURL:     cfg.RPCURL,
		batchSize:  cfg.IndexerBatchSize,
	}, nil
}

func (c *Client) ContractInfo() models.ContractInfo {
	return models.ContractInfo{
		ChainID:            c.chainID,
		GovernanceContract: c.governance.Hex(),
		OrderEscrowContract: c.contract.Hex(),
		OrderContract:      c.contract.Hex(),
		TokenContract:      c.token.Hex(),
		PlatformTreasury:   c.treasury.Hex(),
		SignerAddress:      c.signer.Hex(),
	}
}

func (c *Client) NewIndexer() (*Indexer, error) {
	return NewIndexer(c.rpcURL, c.contract, c.batchSize)
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
		TokenAddress:    c.token.Hex(),
	}, nil
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
