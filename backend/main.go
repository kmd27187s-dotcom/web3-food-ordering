package main

import (
	"fmt"
	"log"
	"net/http"

	"voting-backend/blockchain"
	"voting-backend/config"
	"voting-backend/handlers"

	"github.com/joho/godotenv"
	"github.com/rs/cors"
)

func main() {
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	bc, err := blockchain.NewClient(cfg.RPCURL, cfg.ContractAddress)
	if err != nil {
		log.Fatalf("blockchain client error: %v", err)
	}

	h := handlers.New(bc)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", h.Health)
	mux.HandleFunc("GET /api/contract", h.GetContractInfo)
	mux.HandleFunc("GET /api/proposals", h.GetAllProposals)
	mux.HandleFunc("GET /api/proposals/{id}", h.GetProposal)
	mux.HandleFunc("GET /api/proposals/{id}/voted", h.HasVoted)

	c := cors.New(cors.Options{
		AllowedOrigins: []string{"http://localhost:5173", "http://127.0.0.1:5173"},
		AllowedMethods: []string{"GET", "OPTIONS"},
		AllowedHeaders: []string{"Content-Type"},
	})

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Backend listening on %s", addr)
	log.Printf("RPC: %s | Contract: %s", cfg.RPCURL, cfg.ContractAddress)

	if err := http.ListenAndServe(addr, c.Handler(mux)); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
