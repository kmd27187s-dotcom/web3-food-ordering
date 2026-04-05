package config

import "os"

type Config struct {
	HTTPAddress    string
	SyncOnStart    bool
	DemoMode       bool
	Storage        StorageConfig
	Chain          ChainConfig
	RateLimit      RateLimitConfig
	InactiveGroups InactiveGroupConfig
}

type StorageConfig struct {
	PostgresDSN string
	AutoMigrate bool
}

type ChainConfig struct {
	ChainID            int64
	SignerPrivateKey   string
	OrderContract      string
	MembershipToken    string
	PlatformTreasury   string
	RPCURL             string
	SignatureExpirySec int64
	IndexerBatchSize   int64
}

type EndpointRateLimit struct {
	MaxRequests   int64
	WindowSeconds int64
}

type RateLimitConfig struct {
	Login      EndpointRateLimit
	Register   EndpointRateLimit
	WalletLink EndpointRateLimit
}

type InactiveGroupConfig struct {
	PruneIntervalMinutes int64
	ThresholdDays        int64
}

func Load() Config {
	return Config{
		HTTPAddress: env("HTTP_ADDR", ":8080"),
		SyncOnStart: env("SYNC_ON_START", "false") == "true",
		DemoMode:    env("DEMO_MODE", "false") == "true",
		Storage: StorageConfig{
			PostgresDSN: env("DATABASE_URL", ""),
			AutoMigrate: env("DB_AUTOMIGRATE", "true") == "true",
		},
		Chain: ChainConfig{
			ChainID:            envInt64("CHAIN_ID", 11155111),
			SignerPrivateKey:   os.Getenv("SIGNER_PRIVATE_KEY"),
			OrderContract:      env("ORDER_CONTRACT_ADDRESS", "0x0000000000000000000000000000000000000000"),
			MembershipToken:    env("MEMBERSHIP_TOKEN_ADDRESS", "0x0000000000000000000000000000000000000000"),
			PlatformTreasury:   env("PLATFORM_TREASURY_ADDRESS", "0x0000000000000000000000000000000000000000"),
			RPCURL:             env("RPC_URL", ""),
			SignatureExpirySec: envInt64("ORDER_SIGNATURE_EXPIRY_SEC", 300),
			IndexerBatchSize:   envInt64("INDEXER_BATCH_SIZE", 2000),
		},
		RateLimit: RateLimitConfig{
			Login: EndpointRateLimit{
				MaxRequests:   envInt64("RATE_LIMIT_LOGIN_MAX", 5),
				WindowSeconds: envInt64("RATE_LIMIT_LOGIN_WINDOW_SEC", 60),
			},
			Register: EndpointRateLimit{
				MaxRequests:   envInt64("RATE_LIMIT_REGISTER_MAX", 3),
				WindowSeconds: envInt64("RATE_LIMIT_REGISTER_WINDOW_SEC", 600),
			},
			WalletLink: EndpointRateLimit{
				MaxRequests:   envInt64("RATE_LIMIT_WALLET_LINK_MAX", 5),
				WindowSeconds: envInt64("RATE_LIMIT_WALLET_LINK_WINDOW_SEC", 60),
			},
		},
		InactiveGroups: InactiveGroupConfig{
			PruneIntervalMinutes: envInt64("INACTIVE_GROUP_PRUNE_INTERVAL_MIN", 60),
			ThresholdDays:        envInt64("INACTIVE_GROUP_THRESHOLD_DAYS", 90),
		},
	}
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func envInt64(key string, fallback int64) int64 {
	if value := os.Getenv(key); value != "" {
		var parsed int64
		for _, ch := range value {
			if ch < '0' || ch > '9' {
				return fallback
			}
			parsed = parsed*10 + int64(ch-'0')
		}
		return parsed
	}
	return fallback
}
