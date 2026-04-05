// Package testpg 提供 handler 等跨套件測試用的隔離 PostgreSQL schema（需環境變數 TEST_POSTGRES_DSN）。
package testpg

import (
	"fmt"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"mealvoting/backend/config"
	"mealvoting/backend/internal/models"
	"mealvoting/backend/repository"

	gormpostgres "gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func dsnWithSearchPath(baseDSN, schema string) string {
	if strings.HasPrefix(baseDSN, "postgres://") || strings.HasPrefix(baseDSN, "postgresql://") {
		parsed, err := url.Parse(baseDSN)
		if err != nil {
			return baseDSN
		}
		query := parsed.Query()
		query.Set("search_path", schema)
		parsed.RawQuery = query.Encode()
		return parsed.String()
	}
	if strings.Contains(baseDSN, "search_path=") {
		return baseDSN
	}
	return strings.TrimSpace(baseDSN) + " search_path=" + schema
}

// OpenStore 建立獨立 schema 的 repository.Store；未設定 TEST_POSTGRES_DSN 時跳過測試。
func OpenStore(t *testing.T, info models.ContractInfo) repository.Store {
	t.Helper()

	baseDSN := strings.TrimSpace(os.Getenv("TEST_POSTGRES_DSN"))
	if baseDSN == "" {
		t.Skip("set TEST_POSTGRES_DSN to run PostgreSQL-backed tests")
	}

	rootDB, err := gorm.Open(gormpostgres.Open(baseDSN), &gorm.Config{})
	if err != nil {
		t.Fatalf("open root postgres connection: %v", err)
	}

	schema := fmt.Sprintf("test_%d", time.Now().UTC().UnixNano())
	if err := rootDB.Exec(`CREATE SCHEMA "` + schema + `"`).Error; err != nil {
		t.Fatalf("create test schema %s: %v", schema, err)
	}

	cfg := config.StorageConfig{
		PostgresDSN: dsnWithSearchPath(baseDSN, schema),
		AutoMigrate: true,
	}
	store, err := repository.NewPostgresStore(cfg, info)
	if err != nil {
		_ = rootDB.Exec(`DROP SCHEMA IF EXISTS "` + schema + `" CASCADE`).Error
		if sqlDB, e := rootDB.DB(); e == nil {
			_ = sqlDB.Close()
		}
		t.Fatalf("create postgres store: %v", err)
	}

	t.Cleanup(func() {
		if sqlDB, err := store.TestGorm().DB(); err == nil {
			_ = sqlDB.Close()
		}
		_ = rootDB.Exec(`DROP SCHEMA IF EXISTS "` + schema + `" CASCADE`).Error
		if sqlDB, err := rootDB.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})

	return store
}
