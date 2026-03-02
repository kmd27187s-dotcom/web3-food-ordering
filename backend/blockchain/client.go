package blockchain

import (
	"context"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
)

const contractABI = `[
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "proposalId", "type": "uint256"},
      {"indexed": true, "name": "creator", "type": "address"},
      {"indexed": false, "name": "title", "type": "string"},
      {"indexed": false, "name": "deadline", "type": "uint256"}
    ],
    "name": "ProposalCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "proposalId", "type": "uint256"},
      {"indexed": true, "name": "voter", "type": "address"},
      {"indexed": false, "name": "support", "type": "bool"}
    ],
    "name": "Voted",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "proposalCount",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{"name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "proposalId", "type": "uint256"}],
    "name": "getProposal",
    "outputs": [
      {
        "components": [
          {"name": "title", "type": "string"},
          {"name": "description", "type": "string"},
          {"name": "creator", "type": "address"},
          {"name": "yesVotes", "type": "uint256"},
          {"name": "noVotes", "type": "uint256"},
          {"name": "deadline", "type": "uint256"},
          {"name": "exists", "type": "bool"}
        ],
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAllProposals",
    "outputs": [
      {
        "components": [
          {"name": "title", "type": "string"},
          {"name": "description", "type": "string"},
          {"name": "creator", "type": "address"},
          {"name": "yesVotes", "type": "uint256"},
          {"name": "noVotes", "type": "uint256"},
          {"name": "deadline", "type": "uint256"},
          {"name": "exists", "type": "bool"}
        ],
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "proposalId", "type": "uint256"},
      {"name": "voter", "type": "address"}
    ],
    "name": "hasVoted",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  }
]`

type Proposal struct {
	ID          uint64 `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Creator     string `json:"creator"`
	YesVotes    uint64 `json:"yesVotes"`
	NoVotes     uint64 `json:"noVotes"`
	Deadline    uint64 `json:"deadline"`
	Exists      bool   `json:"exists"`
}

type ContractInfo struct {
	Address       string `json:"address"`
	Owner         string `json:"owner"`
	ProposalCount uint64 `json:"proposalCount"`
	BalanceWei    string `json:"balanceWei"`
	BalanceETH    string `json:"balanceETH"`
}

type Client struct {
	eth      *ethclient.Client
	abi      abi.ABI
	contract common.Address
}

func NewClient(rpcURL, contractAddr string) (*Client, error) {
	eth, err := ethclient.Dial(rpcURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RPC: %w", err)
	}

	parsed, err := abi.JSON(strings.NewReader(contractABI))
	if err != nil {
		return nil, fmt.Errorf("failed to parse ABI: %w", err)
	}

	return &Client{
		eth:      eth,
		abi:      parsed,
		contract: common.HexToAddress(contractAddr),
	}, nil
}

func (c *Client) call(ctx context.Context, method string, args ...interface{}) ([]byte, error) {
	data, err := c.abi.Pack(method, args...)
	if err != nil {
		return nil, fmt.Errorf("pack %s: %w", method, err)
	}

	msg := ethereum.CallMsg{
		To:   &c.contract,
		Data: data,
	}

	result, err := c.eth.CallContract(ctx, msg, nil)
	if err != nil {
		return nil, fmt.Errorf("call %s: %w", method, err)
	}

	return result, nil
}

func (c *Client) GetContractInfo(ctx context.Context) (*ContractInfo, error) {
	countData, err := c.call(ctx, "proposalCount")
	if err != nil {
		return nil, err
	}
	countResult, err := c.abi.Unpack("proposalCount", countData)
	if err != nil {
		return nil, err
	}
	count := countResult[0].(*big.Int).Uint64()

	ownerData, err := c.call(ctx, "owner")
	if err != nil {
		return nil, err
	}
	ownerResult, err := c.abi.Unpack("owner", ownerData)
	if err != nil {
		return nil, err
	}
	ownerAddr := ownerResult[0].(common.Address).Hex()

	balance, err := c.eth.BalanceAt(ctx, c.contract, nil)
	if err != nil {
		return nil, fmt.Errorf("get balance: %w", err)
	}

	balanceETH := new(big.Float).Quo(
		new(big.Float).SetInt(balance),
		new(big.Float).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)),
	)

	return &ContractInfo{
		Address:       c.contract.Hex(),
		Owner:         ownerAddr,
		ProposalCount: count,
		BalanceWei:    balance.String(),
		BalanceETH:    balanceETH.Text('f', 6),
	}, nil
}

func (c *Client) GetAllProposals(ctx context.Context) ([]Proposal, error) {
	data, err := c.call(ctx, "getAllProposals")
	if err != nil {
		return nil, err
	}

	result, err := c.abi.Unpack("getAllProposals", data)
	if err != nil {
		return nil, err
	}

	type rawProposal struct {
		Title       string
		Description string
		Creator     common.Address
		YesVotes    *big.Int
		NoVotes     *big.Int
		Deadline    *big.Int
		Exists      bool
	}

	rawSlice, ok := result[0].([]struct {
		Title       string         `json:"title"`
		Description string         `json:"description"`
		Creator     common.Address `json:"creator"`
		YesVotes    *big.Int       `json:"yesVotes"`
		NoVotes     *big.Int       `json:"noVotes"`
		Deadline    *big.Int       `json:"deadline"`
		Exists      bool           `json:"exists"`
	})
	if !ok {
		return nil, fmt.Errorf("unexpected return type from getAllProposals")
	}

	proposals := make([]Proposal, len(rawSlice))
	for i, r := range rawSlice {
		proposals[i] = Proposal{
			ID:          uint64(i),
			Title:       r.Title,
			Description: r.Description,
			Creator:     r.Creator.Hex(),
			YesVotes:    r.YesVotes.Uint64(),
			NoVotes:     r.NoVotes.Uint64(),
			Deadline:    r.Deadline.Uint64(),
			Exists:      r.Exists,
		}
	}
	return proposals, nil
}

func (c *Client) GetProposal(ctx context.Context, id uint64) (*Proposal, error) {
	data, err := c.call(ctx, "getProposal", new(big.Int).SetUint64(id))
	if err != nil {
		return nil, err
	}

	result, err := c.abi.Unpack("getProposal", data)
	if err != nil {
		return nil, err
	}

	raw, ok := result[0].(struct {
		Title       string         `json:"title"`
		Description string         `json:"description"`
		Creator     common.Address `json:"creator"`
		YesVotes    *big.Int       `json:"yesVotes"`
		NoVotes     *big.Int       `json:"noVotes"`
		Deadline    *big.Int       `json:"deadline"`
		Exists      bool           `json:"exists"`
	})
	if !ok {
		return nil, fmt.Errorf("unexpected return type from getProposal")
	}

	return &Proposal{
		ID:          id,
		Title:       raw.Title,
		Description: raw.Description,
		Creator:     raw.Creator.Hex(),
		YesVotes:    raw.YesVotes.Uint64(),
		NoVotes:     raw.NoVotes.Uint64(),
		Deadline:    raw.Deadline.Uint64(),
		Exists:      raw.Exists,
	}, nil
}

func (c *Client) HasVoted(ctx context.Context, proposalId uint64, voter string) (bool, error) {
	voterAddr := common.HexToAddress(voter)
	data, err := c.call(ctx, "hasVoted", new(big.Int).SetUint64(proposalId), voterAddr)
	if err != nil {
		return false, err
	}

	result, err := c.abi.Unpack("hasVoted", data)
	if err != nil {
		return false, err
	}

	return result[0].(bool), nil
}
