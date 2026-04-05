package blockchain

import (
	"context"
	"encoding/json"
	"errors"
	"math/big"
	"strings"

	"mealvoting/backend/internal/models"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
)

const votingSystemABI = `[
	{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"proposalId","type":"uint256"},{"indexed":true,"internalType":"address","name":"creator","type":"address"},{"indexed":false,"internalType":"uint256","name":"proposalDeadline","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"voteDeadline","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"orderDeadline","type":"uint256"}],"name":"ProposalCreated","type":"event"},
	{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"proposalId","type":"uint256"},{"indexed":true,"internalType":"uint256","name":"optionIndex","type":"uint256"},{"indexed":false,"internalType":"string","name":"merchantId","type":"string"},{"indexed":true,"internalType":"address","name":"proposer","type":"address"},{"indexed":false,"internalType":"uint256","name":"cost","type":"uint256"}],"name":"OptionAdded","type":"event"},
	{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"proposalId","type":"uint256"},{"indexed":true,"internalType":"uint256","name":"optionIndex","type":"uint256"},{"indexed":true,"internalType":"address","name":"voter","type":"address"},{"indexed":false,"internalType":"uint256","name":"tokenAmount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"weight","type":"uint256"}],"name":"Voted","type":"event"},
	{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"proposalId","type":"uint256"},{"indexed":true,"internalType":"uint256","name":"winnerOptionIndex","type":"uint256"},{"indexed":false,"internalType":"string","name":"merchantId","type":"string"},{"indexed":false,"internalType":"uint256","name":"weightedVotes","type":"uint256"}],"name":"VoteFinalized","type":"event"},
	{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"proposalId","type":"uint256"},{"indexed":true,"internalType":"address","name":"member","type":"address"},{"indexed":false,"internalType":"bytes32","name":"orderHash","type":"bytes32"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"OrderPlaced","type":"event"},
	{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"proposalId","type":"uint256"},{"indexed":true,"internalType":"address","name":"member","type":"address"},{"indexed":false,"internalType":"uint256","name":"refundAmount","type":"uint256"}],"name":"OrderCancelled","type":"event"},
	{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"proposalId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"nativeFee","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"nativePayout","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"treasuryTokenGain","type":"uint256"}],"name":"ProposalSettled","type":"event"},
	{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"proposalId","type":"uint256"},{"indexed":true,"internalType":"address","name":"member","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"string","name":"rewardType","type":"string"}],"name":"RewardAllocated","type":"event"}
	,{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"member","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"expiresAt","type":"uint256"}],"name":"SubscriptionPaid","type":"event"}
]`

type Indexer struct {
	client    *ethclient.Client
	contract  common.Address
	batchSize uint64
	abi       abi.ABI
}

func NewIndexer(rpcURL string, contractAddress common.Address, batchSize int64) (*Indexer, error) {
	if strings.TrimSpace(rpcURL) == "" {
		return nil, errors.New("rpc url is empty")
	}
	rpcClient, err := ethclient.Dial(rpcURL)
	if err != nil {
		return nil, err
	}
	parsedABI, err := abi.JSON(strings.NewReader(votingSystemABI))
	if err != nil {
		return nil, err
	}
	if batchSize <= 0 {
		batchSize = 2000
	}
	return &Indexer{
		client:    rpcClient,
		contract:  contractAddress,
		batchSize: uint64(batchSize),
		abi:       parsedABI,
	}, nil
}

func (i *Indexer) LatestBlock(ctx context.Context) (uint64, error) {
	return i.client.BlockNumber(ctx)
}

func (i *Indexer) SyncRange(ctx context.Context, fromBlock uint64) (*models.ChainSyncResult, error) {
	latest, err := i.LatestBlock(ctx)
	if err != nil {
		return nil, err
	}
	if fromBlock > latest {
		return &models.ChainSyncResult{FromBlock: fromBlock, ToBlock: latest, Events: []*models.ChainEvent{}}, nil
	}
	toBlock := latest
	if toBlock-fromBlock+1 > i.batchSize {
		toBlock = fromBlock + i.batchSize - 1
	}

	logs, err := i.client.FilterLogs(ctx, ethereum.FilterQuery{
		FromBlock: new(big.Int).SetUint64(fromBlock),
		ToBlock:   new(big.Int).SetUint64(toBlock),
		Addresses: []common.Address{i.contract},
	})
	if err != nil {
		return nil, err
	}

	events := make([]*models.ChainEvent, 0, len(logs))
	for _, lg := range logs {
		event, err := i.decodeLog(lg)
		if err == nil {
			events = append(events, event)
		}
	}
	return &models.ChainSyncResult{
		FromBlock:    fromBlock,
		ToBlock:      toBlock,
		IndexedCount: len(events),
		Events:       events,
	}, nil
}

func (i *Indexer) decodeLog(lg types.Log) (*models.ChainEvent, error) {
	event, err := i.abi.EventByID(lg.Topics[0])
	if err != nil {
		return nil, err
	}

	payload := map[string]any{}
	if len(lg.Data) > 0 {
		values, err := event.Inputs.Unpack(lg.Data)
		if err == nil {
			nonIndexed := nonIndexedArgs(event.Inputs)
			for idx, arg := range nonIndexed {
				payload[arg.Name] = stringifyABIValue(values[idx])
			}
		}
	}

	proposalID := int64(0)
	indexedPos := 1
	for _, input := range event.Inputs {
		if !input.Indexed || indexedPos >= len(lg.Topics) {
			continue
		}
		switch input.Type.String() {
		case "uint256":
			value := new(big.Int).SetBytes(lg.Topics[indexedPos].Bytes()).Int64()
			payload[input.Name] = value
			if input.Name == "proposalId" {
				proposalID = value
			}
		case "address":
			payload[input.Name] = common.BytesToAddress(lg.Topics[indexedPos].Bytes()).Hex()
		default:
			payload[input.Name] = lg.Topics[indexedPos].Hex()
		}
		indexedPos++
	}

	body, _ := json.Marshal(payload)
	return &models.ChainEvent{
		BlockNumber: lg.BlockNumber,
		BlockHash:   lg.BlockHash.Hex(),
		TxHash:      lg.TxHash.Hex(),
		LogIndex:    lg.Index,
		EventName:   event.Name,
		ProposalID:  proposalID,
		PayloadJSON: string(body),
	}, nil
}

func nonIndexedArgs(args abi.Arguments) []abi.Argument {
	result := make([]abi.Argument, 0, len(args))
	for _, arg := range args {
		if !arg.Indexed {
			result = append(result, arg)
		}
	}
	return result
}

func stringifyABIValue(value any) any {
	switch typed := value.(type) {
	case common.Address:
		return typed.Hex()
	case [32]byte:
		return common.BytesToHash(typed[:]).Hex()
	case *big.Int:
		return typed.String()
	default:
		return value
	}
}
