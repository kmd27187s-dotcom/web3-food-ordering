package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port            string
	RPCURL          string
	ContractAddress string
}

func Load() (*Config, error) {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	rpcURL := os.Getenv("RPC_URL")
	if rpcURL == "" {
		rpcURL = "http://127.0.0.1:8545"
	}

	contractAddr := os.Getenv("CONTRACT_ADDRESS")
	if contractAddr == "" {
		return nil, fmt.Errorf("CONTRACT_ADDRESS is required")
	}

	return &Config{
		Port:            port,
		RPCURL:          rpcURL,
		ContractAddress: contractAddr,
	}, nil
}
