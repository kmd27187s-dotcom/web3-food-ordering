package app

import (
	"context"
	"errors"
	"log"
	"time"

	"mealvoting/backend/blockchain"
	"mealvoting/backend/config"
	"mealvoting/backend/handlers"
	"mealvoting/backend/repository"
)

const defaultInactiveGroupPruneInterval = time.Hour

type inactiveGroupPruner interface {
	PruneInactiveGroups(ctx context.Context) error
}

type Runtime struct {
	Config  config.Config
	Chain   *blockchain.Client
	Store   repository.Store
	Handler *handlers.Server
}

func NewRuntime(cfg config.Config) (*Runtime, error) {
	chainClient, err := blockchain.NewClient(cfg.Chain)
	if err != nil {
		return nil, err
	}

	store, err := repository.OpenStore(cfg.Storage, chainClient.ContractInfo())
	if err != nil {
		return nil, err
	}
	if thresholdSetter, ok := store.(repository.InactiveGroupThresholdSetter); ok {
		thresholdSetter.SetInactiveGroupThresholdDays(cfg.InactiveGroups.ThresholdDays)
	}

	return &Runtime{
		Config:  cfg,
		Chain:   chainClient,
		Store:   store,
		Handler: handlers.NewServer(cfg, store, chainClient),
	}, nil
}

func (r *Runtime) StartInactiveGroupPruner(ctx context.Context, logger *log.Logger) {
	interval := time.Duration(r.Config.InactiveGroups.PruneIntervalMinutes) * time.Minute
	go RunInactiveGroupPruner(ctx, logger, r.Store, interval)
}

func (r *Runtime) SyncChainOnStart(ctx context.Context, logger *log.Logger) {
	if !r.Config.SyncOnStart {
		return
	}
	if logger == nil {
		logger = log.Default()
	}

	indexer, err := r.Chain.NewIndexer()
	if err != nil {
		logger.Printf("indexer disabled: %v", err)
		return
	}

	status, err := r.Store.ChainSyncStatus()
	if err != nil {
		logger.Printf("read sync status: %v", err)
		return
	}

	fromBlock := status.LastSyncedBlock + 1
	if fromBlock == 1 {
		fromBlock = 0
	}

	result, err := indexer.SyncRange(ctx, fromBlock)
	if err != nil {
		_ = r.Store.StoreChainEvents(nil, status.LastSeenBlock, err.Error())
		logger.Printf("index sync failed: %v", err)
		return
	}
	if err := r.Store.StoreChainEvents(result.Events, result.ToBlock, ""); err != nil {
		logger.Printf("store synced events: %v", err)
		return
	}
	logger.Printf("indexed %d events from block %d to %d", result.IndexedCount, result.FromBlock, result.ToBlock)
}

func RunInactiveGroupPruner(ctx context.Context, logger *log.Logger, store inactiveGroupPruner, interval time.Duration) {
	if logger == nil {
		logger = log.Default()
	}
	if interval <= 0 {
		interval = defaultInactiveGroupPruneInterval
	}

	run := func() {
		if err := store.PruneInactiveGroups(ctx); err != nil && !errors.Is(ctx.Err(), context.Canceled) {
			logger.Printf("prune inactive groups: %v", err)
		}
	}

	run()

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			run()
		}
	}
}
