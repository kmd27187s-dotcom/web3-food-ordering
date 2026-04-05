package repository

import (
	"fmt"

	"mealvoting/backend/config"
	"mealvoting/backend/internal/models"
)

type InactiveGroupThresholdSetter interface {
	SetInactiveGroupThresholdDays(days int64)
}

func OpenStore(cfg config.StorageConfig, info models.ContractInfo) (Store, error) {
	if cfg.PostgresDSN == "" {
		return nil, fmt.Errorf("DATABASE_URL is required (PostgreSQL only)")
	}
	return NewPostgresStore(cfg, info)
}
