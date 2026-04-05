# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MealVote is a decentralized meal voting and ordering system. Users vote on meal proposals using ERC20 membership tokens, place orders during voting windows, and outcomes are recorded on-chain (Ethereum testnets: Sepolia/Holesky). The Go backend syncs on-chain events to a local SQLite database and serves a REST API to a vanilla JS SPA frontend.

## Commands

### Smart Contracts (Hardhat)
```bash
npm run compile                      # Compile Solidity contracts
npm run deploy:sepolia               # Deploy to Sepolia testnet
npm run deploy:holesky               # Deploy to Holesky testnet
npm run export:contracts             # Sync deployed ABIs to frontend/src/generated/contracts.json
```

### Backend (Go)
```bash
cd backend
go run .                             # Start API server (default :8080)
go test ./...                        # Run all tests
go test ./handlers/... -run TestName # Run a single test
go mod tidy                          # Sync dependencies
```

### Frontend
```bash
cd frontend
python3 -m http.server 4173          # Serve static files at localhost:4173
```

To point the frontend at a different backend, run in browser console:
```js
localStorage.setItem("mealvote.apiBase", "http://your-backend-url:8080")
```

## Architecture

```
Frontend (HTML/JS) ──→ Backend REST API (Go) ──→ SQLite DB
        │                      │
        └──→ MetaMask ─────→ Solidity Contracts (Ethereum)
                                      │
                          ←── Event Indexer (Go) ──┘
```

### Three-Layer Design

1. **Smart Contracts** (`contract/VotingSystem-v3.sol`) — authoritative on-chain state. Key functions: `createProposal`, `addOption`, `vote`, `finalizeVote`, `placeOrder`, `settleProposal`, `claimReward`. Also includes `MembershipToken` (ERC20).

2. **Backend** (`backend/`) — Go REST API using `net/http` (no framework). Responsible for:
   - Session management and bcrypt auth
   - Generating EIP-712-style signatures for on-chain order transactions
   - Projecting blockchain events into SQLite via `blockchain/indexer.go`
   - Tracking pending tx hashes until confirmed

3. **Frontend** (`frontend/`) — Vanilla JS SPA. Two modes per proposal:
   - **Local mode**: proposals without a `chainProposalId` are purely off-chain
   - **On-chain mode**: MetaMask signs transactions; frontend polls `/transactions/{txHash}` for confirmation

### Backend Package Structure

| Package | Role |
|---------|------|
| `handlers/` | HTTP route handlers (proposals, voting, ordering, auth, admin) |
| `blockchain/` | Ethereum client, event indexer, tx signing |
| `internal/store/` | SQLite layer — queries and schema migrations |
| `internal/models/` | Shared data structs |
| `config/` | Env-var-based configuration with defaults |

### Database Migrations

Applied in order from `backend/internal/store/migrations/`:
- `001_init.sql` — base schema (members, proposals, orders, votes)
- `002_event_projection.sql` — chain event tracking
- `003_pending_transactions.sql` — tx status polling
- `004_wallet_constraints.sql` — wallet uniqueness
- `005_admin_roles.sql` — admin flag
- `006_menu_items_unique.sql` — menu item uniqueness

### Environment Variables

See `.env.example` for full list. Key runtime vars for the backend:

```
HTTP_ADDR=:8080
DB_PATH=./mealvote.db
CHAIN_ID=11155111
SIGNER_PRIVATE_KEY=<hex>
ORDER_CONTRACT_ADDRESS=<0x...>
MEMBERSHIP_TOKEN_ADDRESS=<0x...>
PLATFORM_TREASURY_ADDRESS=<0x...>
ORDER_SIGNATURE_EXPIRY_SEC=300
INDEXER_BATCH_SIZE=2000
SYNC_ON_START=false
```

After deployment, `scripts/deploy-mealvote.js` writes `backend/.env.deployment` and `frontend/src/generated/contracts.json` automatically.

### First-Run Behavior

On first startup with an empty database, the backend auto-seeds demo members, merchants, menu items, and an initial proposal. The first registered user is automatically assigned admin role. Admin-only endpoints (e.g. `POST /admin/indexer/sync`) require this role.
