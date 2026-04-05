# Backend Repository Pattern Refactor — Design Spec

**Date:** 2026-03-26
**Scope:** Go backend only (`backend/`)
**Goal:** Introduce Repository Pattern to separate storage, business logic, and HTTP layers, making it easy to swap databases or add features in the future.

---

## Problem Statement

The current backend conflates three concerns:

- `internal/store/sqlite.go` contains both raw SQL queries and business logic (password hashing, points calculation, ranking, state validation).
- `handlers/handlers.go` contains HTTP parsing and some business rules (e.g., default merchant group assignment).
- `store.Store` is a single large interface that makes it hard to inject only what a component needs.

This makes the codebase difficult to extend, test in isolation, or replace the storage backend.

---

## Target Architecture

Three clearly separated layers:

```
HTTP Request
     ↓
handlers/        — parse input, call service, write JSON response
     ↓
service/         — all business rules and orchestration
     ↓
repository/      — pure CRUD, no business logic
     ↓
SQLite / future DB
```

### Directory Structure

```
backend/
  handlers/
    handlers.go       # HTTP in/out only
    rate_limit.go     # unchanged
  service/
    member.go         # registration, login, wallet linking
    proposal.go       # proposal lifecycle, voting, settlement
    order.go          # order quote, signature
    leaderboard.go    # points and ranking
  repository/
    repository.go     # interface definitions
    sqlite.go         # SQLite implementation (pure queries)
    migrations/       # unchanged
  internal/
    models/           # unchanged
  blockchain/         # unchanged
  config/             # unchanged
  main.go             # updated wire-up
```

---

## Interface Design

### Repository Interfaces (`repository/repository.go`)

```go
type MemberRepo interface {
    CreateMember(email, passwordHash, displayName string) (*models.Member, error)
    MemberByEmail(email string) (*models.Member, error)
    MemberBySession(token string) (*models.Member, error)
    MemberByID(id int64) (*models.Member, error)
    UpdateMemberSession(memberID int64, token string) error
    UpdateMemberWallet(memberID int64, wallet string) (*models.Member, error)
    MemberProfile(memberID int64) (*models.MemberProfile, error)
    Leaderboard() []*models.LeaderboardEntry
}

type ProposalRepo interface {
    CreateProposal(memberID int64, title, description, merchantGroup string, proposalMinutes, voteMinutes, orderMinutes int64) (*models.Proposal, error)
    ListProposals() []*models.Proposal
    GetProposal(id int64) (*models.Proposal, error)
    AddOption(proposalID, memberID int64, merchantID string) (*models.ProposalOption, error)
    RecordVote(proposalID, memberID, optionID, tokenAmount int64) error
    FinalizeSettlement(proposalID int64) (*models.Proposal, error)
}

type OrderRepo interface {
    SaveOrder(proposalID, memberID int64, quote *models.OrderQuote, sig *models.OrderSignature) (*models.Order, error)
}

type MerchantRepo interface {
    GetMerchant(id string) (*models.Merchant, error)
}

type ChainRepo interface {
    ContractInfo() models.ContractInfo
    StoreChainEvents(events []*models.ChainEvent, lastSeenBlock uint64, syncErr string) error
    ChainSyncStatus() (*models.ChainSyncStatus, error)
    ListChainEvents(limit int) ([]*models.ChainEvent, error)
}

type TransactionRepo interface {
    RegisterPendingTransaction(memberID, proposalID int64, action, txHash, walletAddress, relatedOrder string) (*models.PendingTransaction, error)
    GetPendingTransaction(memberID int64, txHash string) (*models.PendingTransaction, error)
    ListPendingTransactions(memberID int64, limit int) ([]*models.PendingTransaction, error)
}
```

### Service Layer (`service/`)

Each service is injected with only the repository interfaces it needs:

```go
// service/member.go
type MemberService struct {
    members MemberRepo
    cfg     config.Config
}
// Owns: password hashing, session generation, wallet validation, bcrypt

// service/proposal.go
type ProposalService struct {
    proposals ProposalRepo
    members   MemberRepo
    merchants MerchantRepo
}
// Owns: phase window checks, token balance validation, duplicate vote prevention, settlement logic

// service/order.go
type OrderService struct {
    orders    OrderRepo
    proposals ProposalRepo
    chain     *blockchain.Client  // uses Client.SignOrder; extract Signer interface if needed later
}
// Owns: order quote calculation, signature generation, gas estimation

// service/leaderboard.go
type LeaderboardService struct {
    members MemberRepo
}
// Owns: ranking sort, achievement building calculation
```

### Handler Layer (`handlers/handlers.go`)

```go
type Server struct {
    members     *service.MemberService
    proposals   *service.ProposalService
    orders      *service.OrderService
    leaderboard *service.LeaderboardService
    chain       *blockchain.Client
    rateLimiter *rateLimiter
}
```

Handlers only: decode request → call service method → encode response. No business logic.

---

## Migration Strategy

Phased approach — the server stays runnable after each phase.

### Phase 1 — Extract repository layer
- Create `repository/` directory with interface definitions.
- Move raw SQL queries from `internal/store/sqlite.go` to `repository/sqlite.go`.
- Business logic helpers in `store.go` stay temporarily — not moved yet.
- `handlers.go` and `main.go` still compile against `store.Store`; no consumer changes in this phase.
- Move `internal/store/migrations/` to `repository/migrations/`.

### Phase 2 — Build service layer
- Create `service/` with one file per domain.
- Move business logic from `store.go` and `handlers.go` into services, in order:
  1. `MemberService`
  2. `ProposalService`
  3. `OrderService`
  4. `LeaderboardService`

### Phase 3 — Slim down handlers
- Update `handlers.go` to call service methods instead of store directly.
- Remove all business logic from handlers.
- Update `main.go` wire-up: construct repos → construct services → construct server.

### Phase 4 — Clean up
- Delete `internal/store/store.go` business logic.
- Remove old `store.Store` interface.
- Update existing tests; add service-layer unit tests.

---

## Out of Scope

- No changes to `blockchain/`, `config/`, `internal/models/`
- No API changes (routes, JSON shapes, status codes remain identical)
- No changes to Solidity contracts or frontend
- No new features

---

## Success Criteria

- All existing tests pass after each phase
- `repository/sqlite.go` contains no business logic (no bcrypt, no point calculations, no state checks)
- `handlers/handlers.go` contains no business logic (no token math, no time window checks)
- `service/` layer can be unit-tested by injecting mock repositories
- Replacing SQLite with another database requires only a new `repository/` implementation
