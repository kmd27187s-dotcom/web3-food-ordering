# Backend Repository Pattern Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce Repository Pattern to the Go backend so storage, business logic, and HTTP layers are cleanly separated.

**Architecture:** Create `repository/` (pure SQL, interfaces) and `service/` (business rules) packages. Handlers call services, services call repositories. The old `internal/store/` is deleted at the end.

**Tech Stack:** Go 1.22, `database/sql`, `modernc.org/sqlite`, `golang.org/x/crypto/bcrypt`, `github.com/ethereum/go-ethereum`

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `backend/repository/repository.go` | All repo interface definitions + helper types |
| Create | `backend/repository/sqlite.go` | SQLiteStore: pure SQL, migrate, seed |
| Move   | `backend/repository/migrations/` | SQL migration files (from `internal/store/migrations/`) |
| Create | `backend/service/member.go` | Registration, login, wallet, profile |
| Create | `backend/service/proposal.go` | Proposal lifecycle, options, votes, settlement |
| Create | `backend/service/order.go` | Order quote, hash, signature |
| Create | `backend/service/leaderboard.go` | Ranking, buildings |
| Modify | `backend/handlers/handlers.go` | Server struct + all handlers |
| Modify | `backend/main.go` | Wire-up repos → services → server |
| Delete | `backend/internal/store/store.go` | Replaced by service + repository packages |
| Delete | `backend/internal/store/sqlite.go` | Replaced by `repository/sqlite.go` |
| Modify | `backend/handlers/handlers_test.go` | Update to wire through new layers |
| Modify | `backend/internal/store/sqlite_test.go` | Update import paths |

---

## Task 1: Define Repository Interfaces

**Files:**
- Create: `backend/repository/repository.go`

- [ ] **Step 1: Create the interfaces file**

```go
// backend/repository/repository.go
package repository

import (
	"time"

	"mealvoting/backend/internal/models"
)

// MemberReward carries points and token deltas to apply atomically in settlement.
type MemberReward struct {
	MemberID int64
	Points   int64
	Tokens   int64
}

// OptionRefund carries per-option refund values to store in settlement.
type OptionRefund struct {
	OptionID        int64
	PartialRefund   int64
	WinnerTokenBack int64
}

// MemberRepo handles member persistence with no business logic.
type MemberRepo interface {
	CreateMember(email, passwordHash, displayName string, isAdmin bool, tokenBalance int64, avatarURL string) (int64, error)
	MemberCount() (int64, error)
	MemberByEmail(email string) (*models.Member, error)
	MemberBySession(token string) (*models.Member, error)
	MemberByID(id int64) (*models.Member, error)
	UpgradePasswordHash(memberID int64, hash string) error
	CreateSession(memberID int64, token string) error
	UpdateMemberWallet(memberID int64, wallet string) error
	// RawLeaderboard returns all members for ranking without computing rank or building names.
	RawLeaderboard() ([]*models.LeaderboardEntry, error)
	// MemberStats returns activity counts for profile display.
	MemberStats(memberID int64) (proposalsCreated, ordersSubmitted, votesCast int64, err error)
}

// ProposalRepo handles proposal, option, and vote persistence.
type ProposalRepo interface {
	CreateProposal(memberID int64, title, description, merchantGroup, createdByName string, proposalDeadline, voteDeadline, orderDeadline time.Time) (*models.Proposal, error)
	ListProposals() []*models.Proposal
	GetProposal(id int64) (*models.Proposal, error)
	// InsertProposalOption atomically deducts tokenCost from member and inserts the option row.
	InsertProposalOption(proposalID, memberID int64, merchantID, merchantName, proposerName string, tokenCost int64) (*models.ProposalOption, error)
	// RecordVote atomically deducts tokenAmount from member, increments weighted_votes, and inserts a vote row.
	RecordVote(proposalID, memberID, optionID int64, tokenAmount int64, memberDisplayName string) error
	// ApplySettlementRewards atomically applies member rewards, option refund values, and marks rewards_applied.
	ApplySettlementRewards(proposalID int64, rewards []MemberReward, optionRefunds []OptionRefund) error
}

// OrderRepo handles order persistence.
type OrderRepo interface {
	SaveOrder(proposalID, memberID int64, quote *models.OrderQuote, sig *models.OrderSignature, memberDisplayName string) (*models.Order, error)
}

// MerchantRepo handles merchant lookup.
type MerchantRepo interface {
	GetMerchant(id string) (*models.Merchant, error)
}

// ChainRepo handles blockchain event projection state.
type ChainRepo interface {
	ContractInfo() models.ContractInfo
	StoreChainEvents(events []*models.ChainEvent, lastSeenBlock uint64, syncErr string) error
	ChainSyncStatus() (*models.ChainSyncStatus, error)
	ListChainEvents(limit int) ([]*models.ChainEvent, error)
}

// TransactionRepo tracks pending on-chain transactions.
type TransactionRepo interface {
	RegisterPendingTransaction(memberID, proposalID int64, action, txHash, walletAddress, relatedOrder string) (*models.PendingTransaction, error)
	GetPendingTransaction(memberID int64, txHash string) (*models.PendingTransaction, error)
	ListPendingTransactions(memberID int64, limit int) ([]*models.PendingTransaction, error)
}

// Store aggregates all repo interfaces — implemented by SQLiteStore.
type Store interface {
	MemberRepo
	ProposalRepo
	OrderRepo
	MerchantRepo
	ChainRepo
	TransactionRepo
}
```

- [ ] **Step 2: Verify it compiles (no tests yet)**

```bash
cd /path/to/backend && go build ./repository/...
```
Expected: compiles with no errors (no implementation yet means interface-only file is fine once sqlite.go is added).

- [ ] **Step 3: Commit**

```bash
git add backend/repository/repository.go
git commit -m "feat: add repository interfaces for member, proposal, order, merchant, chain, transaction"
```

---

## Task 2: Create Pure-SQL SQLiteStore in repository/

**Files:**
- Create: `backend/repository/sqlite.go`
- Move: `backend/repository/migrations/` (copy SQL files from `backend/internal/store/migrations/`)

The new `SQLiteStore` in `repository/` implements `Store` with pure SQL. Business-rule checks (status validation, token balance checks, etc.) are removed — those move to the service layer in later tasks.

- [ ] **Step 1: Copy migration files**

```bash
cp -r backend/internal/store/migrations backend/repository/migrations
```

- [ ] **Step 2: Create `backend/repository/sqlite.go`**

This is a large file. Write it in full:

```go
// backend/repository/sqlite.go
package repository

import (
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"math/big"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"mealvoting/backend/internal/models"

	_ "modernc.org/sqlite"
)

const chainCursorKey = "voting_system_logs"

//go:embed migrations/*.sql
var migrationFS embed.FS

type SQLiteStore struct {
	db           *sql.DB
	contractInfo models.ContractInfo
}

func NewSQLiteStore(dbPath string, info models.ContractInfo) (*SQLiteStore, error) {
	if dbPath == "" {
		dbPath = "./mealvote.db"
	}
	dsn := filepath.Clean(dbPath)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	s := &SQLiteStore{db: db, contractInfo: info}
	if err := s.migrate(context.Background()); err != nil {
		return nil, err
	}
	if err := s.seed(context.Background()); err != nil {
		return nil, err
	}
	return s, nil
}

// --- MemberRepo ---

func (s *SQLiteStore) ContractInfo() models.ContractInfo { return s.contractInfo }

func (s *SQLiteStore) CreateMember(email, passwordHash, displayName string, isAdmin bool, tokenBalance int64, avatarURL string) (int64, error) {
	ctx := context.Background()
	isAdminInt := 0
	if isAdmin {
		isAdminInt = 1
	}
	res, err := s.db.ExecContext(ctx, `
		INSERT INTO members (email, password_hash, display_name, avatar_url, is_admin, points, token_balance, created_at)
		VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
		email, passwordHash, displayName, avatarURL, isAdminInt, tokenBalance,
		time.Now().UTC().Format(time.RFC3339),
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *SQLiteStore) MemberCount() (int64, error) {
	ctx := context.Background()
	var count int64
	err := s.db.QueryRowContext(ctx, `SELECT COUNT(1) FROM members`).Scan(&count)
	return count, err
}

func (s *SQLiteStore) MemberByEmail(email string) (*models.Member, error) {
	ctx := context.Background()
	var id int64
	err := s.db.QueryRowContext(ctx, `SELECT id FROM members WHERE email = ?`, email).Scan(&id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("member not found")
		}
		return nil, err
	}
	return s.memberByID(ctx, id)
}

func (s *SQLiteStore) MemberBySession(token string) (*models.Member, error) {
	ctx := context.Background()
	var memberID int64
	err := s.db.QueryRowContext(ctx, `SELECT member_id FROM sessions WHERE token = ?`, token).Scan(&memberID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("invalid session")
		}
		return nil, err
	}
	return s.memberByID(ctx, memberID)
}

func (s *SQLiteStore) MemberByID(id int64) (*models.Member, error) {
	return s.memberByID(context.Background(), id)
}

func (s *SQLiteStore) UpgradePasswordHash(memberID int64, hash string) error {
	_, err := s.db.ExecContext(context.Background(), `UPDATE members SET password_hash = ? WHERE id = ?`, hash, memberID)
	return err
}

func (s *SQLiteStore) CreateSession(memberID int64, token string) error {
	_, err := s.db.ExecContext(context.Background(),
		`INSERT INTO sessions (token, member_id, created_at) VALUES (?, ?, ?)`,
		token, memberID, time.Now().UTC().Format(time.RFC3339))
	return err
}

func (s *SQLiteStore) UpdateMemberWallet(memberID int64, wallet string) error {
	_, err := s.db.ExecContext(context.Background(),
		`UPDATE members SET wallet_address = ? WHERE id = ?`, wallet, memberID)
	return err
}

func (s *SQLiteStore) RawLeaderboard() ([]*models.LeaderboardEntry, error) {
	ctx := context.Background()
	rows, err := s.db.QueryContext(ctx, `SELECT id, display_name, avatar_url, points, token_balance FROM members`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var entries []*models.LeaderboardEntry
	for rows.Next() {
		e := &models.LeaderboardEntry{}
		if err := rows.Scan(&e.MemberID, &e.DisplayName, &e.AvatarURL, &e.Points, &e.TokenBalance); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

func (s *SQLiteStore) MemberStats(memberID int64) (proposalsCreated, ordersSubmitted, votesCast int64, err error) {
	ctx := context.Background()
	if err = s.db.QueryRowContext(ctx, `SELECT COUNT(1) FROM proposals WHERE created_by = ?`, memberID).Scan(&proposalsCreated); err != nil {
		return
	}
	if err = s.db.QueryRowContext(ctx, `SELECT COUNT(1) FROM orders WHERE member_id = ?`, memberID).Scan(&ordersSubmitted); err != nil {
		return
	}
	err = s.db.QueryRowContext(ctx, `SELECT COUNT(1) FROM votes WHERE member_id = ?`, memberID).Scan(&votesCast)
	return
}

// --- ProposalRepo ---

func (s *SQLiteStore) CreateProposal(memberID int64, title, description, merchantGroup, createdByName string, proposalDeadline, voteDeadline, orderDeadline time.Time) (*models.Proposal, error) {
	ctx := context.Background()
	res, err := s.db.ExecContext(ctx, `
		INSERT INTO proposals (
			title, description, merchant_group, created_by, created_by_name,
			proposal_deadline, vote_deadline, order_deadline, winner_option_id, rewards_applied, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
		title, description, merchantGroup, memberID, createdByName,
		proposalDeadline.UTC().Format(time.RFC3339),
		voteDeadline.UTC().Format(time.RFC3339),
		orderDeadline.UTC().Format(time.RFC3339),
		time.Now().UTC().Format(time.RFC3339),
	)
	if err != nil {
		return nil, err
	}
	id, _ := res.LastInsertId()
	return s.GetProposal(id)
}

func (s *SQLiteStore) ListProposals() []*models.Proposal {
	ctx := context.Background()
	rows, err := s.db.QueryContext(ctx, `SELECT id FROM proposals ORDER BY id DESC`)
	if err != nil {
		return []*models.Proposal{}
	}
	var ids []int64
	for rows.Next() {
		var id int64
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	rows.Close()
	proposals := make([]*models.Proposal, 0, len(ids))
	for _, id := range ids {
		if p, err := s.GetProposal(id); err == nil {
			proposals = append(proposals, p)
		}
	}
	return proposals
}

func (s *SQLiteStore) GetProposal(id int64) (*models.Proposal, error) {
	ctx := context.Background()
	if err := s.refreshProposalState(ctx, id); err != nil {
		return nil, err
	}
	return s.loadProposal(ctx, id)
}

func (s *SQLiteStore) InsertProposalOption(proposalID, memberID int64, merchantID, merchantName, proposerName string, tokenCost int64) (*models.ProposalOption, error) {
	ctx := context.Background()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `UPDATE members SET token_balance = token_balance - ? WHERE id = ?`, tokenCost, memberID); err != nil {
		return nil, err
	}
	res, err := tx.ExecContext(ctx, `
		INSERT INTO proposal_options (
			proposal_id, merchant_id, merchant_name, proposer_member_id, proposer_name,
			weighted_votes, token_stake, partial_refund, winner_token_back, created_at
		) VALUES (?, ?, ?, ?, ?, 0, ?, 0, 0, ?)`,
		proposalID, merchantID, merchantName, memberID, proposerName, tokenCost, time.Now().UTC().Format(time.RFC3339))
	if err != nil {
		return nil, err
	}
	optionID, _ := res.LastInsertId()
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	proposal, err := s.GetProposal(proposalID)
	if err != nil {
		return nil, err
	}
	for _, opt := range proposal.Options {
		if opt.ID == optionID {
			return opt, nil
		}
	}
	return nil, errors.New("created option not found")
}

func (s *SQLiteStore) RecordVote(proposalID, memberID, optionID int64, tokenAmount int64, memberDisplayName string) error {
	ctx := context.Background()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `UPDATE members SET token_balance = token_balance - ? WHERE id = ?`, tokenAmount, memberID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE proposal_options SET weighted_votes = weighted_votes + ? WHERE id = ?`, tokenAmount, optionID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO votes (proposal_id, member_id, member_name, option_id, token_amount, vote_weight, submitted_at, wallet_hidden)
		VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
		proposalID, memberID, memberDisplayName, optionID, tokenAmount, tokenAmount, time.Now().UTC().Format(time.RFC3339)); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *SQLiteStore) ApplySettlementRewards(proposalID int64, rewards []MemberReward, optionRefunds []OptionRefund) error {
	ctx := context.Background()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, r := range rewards {
		if _, err := tx.ExecContext(ctx,
			`UPDATE members SET points = points + ?, token_balance = token_balance + ? WHERE id = ?`,
			r.Points, r.Tokens, r.MemberID); err != nil {
			return err
		}
	}
	for _, o := range optionRefunds {
		if _, err := tx.ExecContext(ctx,
			`UPDATE proposal_options SET partial_refund = ?, winner_token_back = ? WHERE id = ?`,
			o.PartialRefund, o.WinnerTokenBack, o.OptionID); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, `UPDATE proposals SET rewards_applied = 1 WHERE id = ?`, proposalID); err != nil {
		return err
	}
	return tx.Commit()
}

// --- OrderRepo ---

func (s *SQLiteStore) SaveOrder(proposalID, memberID int64, quote *models.OrderQuote, sig *models.OrderSignature, memberDisplayName string) (*models.Order, error) {
	ctx := context.Background()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx, `
		INSERT INTO orders (
			proposal_id, member_id, member_name, merchant_id, order_hash, amount_wei, status,
			signature_amount_wei, signature_expiry, signature_value, signature_digest,
			signer_address, contract_address, token_address, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		proposalID, memberID, memberDisplayName, quote.MerchantID, sig.OrderHash, sig.AmountWei,
		"awaiting_wallet_payment",
		sig.AmountWei, sig.Expiry, sig.Signature, sig.Digest,
		sig.SignerAddress, sig.ContractAddress, sig.TokenAddress,
		time.Now().UTC().Format(time.RFC3339))
	if err != nil {
		return nil, err
	}
	orderID, _ := res.LastInsertId()
	for _, item := range quote.Items {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO order_items (order_id, menu_item_id, name, quantity, price_wei)
			VALUES (?, ?, ?, ?, ?)`,
			orderID, item.MenuItemID, item.Name, item.Quantity, item.PriceWei); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return s.orderByID(ctx, orderID)
}

// --- MerchantRepo ---

func (s *SQLiteStore) GetMerchant(id string) (*models.Merchant, error) {
	return s.merchantByID(context.Background(), id)
}

// --- ChainRepo ---

func (s *SQLiteStore) StoreChainEvents(events []*models.ChainEvent, lastSeenBlock uint64, syncErr string) error {
	// copy the existing implementation from internal/store/sqlite.go unchanged
	ctx := context.Background()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	now := time.Now().UTC().Format(time.RFC3339)
	for _, event := range events {
		if _, err := tx.ExecContext(ctx, `
			INSERT OR IGNORE INTO chain_events (
				block_number, block_hash, tx_hash, log_index, event_name, proposal_id, payload_json, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			event.BlockNumber, event.BlockHash, event.TxHash, event.LogIndex,
			event.EventName, nullableInt64(event.ProposalID), event.PayloadJSON, now); err != nil {
			return err
		}
		applied, err := s.isEventAppliedTx(ctx, tx, event.TxHash, int64(event.LogIndex))
		if err != nil {
			return err
		}
		if applied {
			continue
		}
		if err := s.applyChainEventTx(ctx, tx, event); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO applied_chain_events (tx_hash, log_index, applied_at) VALUES (?, ?, ?)`,
			event.TxHash, event.LogIndex, now); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO sync_state (cursor_key, last_synced_block, last_synced_at, last_seen_block, last_sync_error)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(cursor_key) DO UPDATE SET
			last_synced_block = excluded.last_synced_block,
			last_synced_at = excluded.last_synced_at,
			last_seen_block = excluded.last_seen_block,
			last_sync_error = excluded.last_sync_error`,
		chainCursorKey, lastSeenBlock, now, lastSeenBlock, syncErr); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *SQLiteStore) ChainSyncStatus() (*models.ChainSyncStatus, error) {
	ctx := context.Background()
	status := &models.ChainSyncStatus{}
	err := s.db.QueryRowContext(ctx, `
		SELECT cursor_key, last_synced_block, last_synced_at, last_seen_block, COALESCE(last_sync_error, '')
		FROM sync_state WHERE cursor_key = ?`, chainCursorKey).
		Scan(&status.CursorKey, &status.LastSyncedBlock, &status.LastSyncedAt, &status.LastSeenBlock, &status.LastSyncError)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return &models.ChainSyncStatus{CursorKey: chainCursorKey}, nil
		}
		return nil, err
	}
	status.IndexedEventCount = s.countInt64(ctx, `SELECT COUNT(1) FROM chain_events`)
	return status, nil
}

func (s *SQLiteStore) ListChainEvents(limit int) ([]*models.ChainEvent, error) {
	if limit <= 0 {
		limit = 50
	}
	ctx := context.Background()
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, block_number, block_hash, tx_hash, log_index, event_name,
		       COALESCE(proposal_id, 0), payload_json, created_at
		FROM chain_events
		ORDER BY block_number DESC, log_index DESC
		LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var events []*models.ChainEvent
	for rows.Next() {
		e := &models.ChainEvent{}
		if err := rows.Scan(&e.ID, &e.BlockNumber, &e.BlockHash, &e.TxHash, &e.LogIndex,
			&e.EventName, &e.ProposalID, &e.PayloadJSON, &e.CreatedAt); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, rows.Err()
}

// --- TransactionRepo ---

func (s *SQLiteStore) RegisterPendingTransaction(memberID, proposalID int64, action, txHash, walletAddress, relatedOrder string) (*models.PendingTransaction, error) {
	ctx := context.Background()
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO pending_transactions (
			member_id, proposal_id, action, tx_hash, wallet_address, status,
			related_event, related_order, error_message, confirmed_block, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, 'pending', '', ?, '', 0, ?, ?)
		ON CONFLICT(tx_hash) DO UPDATE SET
			member_id = excluded.member_id,
			proposal_id = excluded.proposal_id,
			action = excluded.action,
			wallet_address = excluded.wallet_address,
			related_order = excluded.related_order,
			updated_at = excluded.updated_at`,
		memberID, nullableInt64(proposalID), action, txHash, walletAddress, relatedOrder, now, now)
	if err != nil {
		return nil, err
	}
	return s.GetPendingTransaction(memberID, txHash)
}

func (s *SQLiteStore) GetPendingTransaction(memberID int64, txHash string) (*models.PendingTransaction, error) {
	return s.pendingTransactionByHash(context.Background(), memberID, txHash)
}

func (s *SQLiteStore) ListPendingTransactions(memberID int64, limit int) ([]*models.PendingTransaction, error) {
	if limit <= 0 {
		limit = 30
	}
	ctx := context.Background()
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, member_id, COALESCE(proposal_id, 0), action, tx_hash, wallet_address,
		       status, related_event, related_order, error_message, confirmed_block, created_at, updated_at
		FROM pending_transactions WHERE member_id = ? ORDER BY id DESC LIMIT ?`,
		memberID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []*models.PendingTransaction
	for rows.Next() {
		item := &models.PendingTransaction{}
		if err := rows.Scan(&item.ID, &item.MemberID, &item.ProposalID, &item.Action,
			&item.TxHash, &item.WalletAddress, &item.Status, &item.RelatedEvent,
			&item.RelatedOrder, &item.ErrorMessage, &item.ConfirmedBlock,
			&item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
```

> **Note:** The internal helper methods (`memberByID`, `loadProposal`, `refreshProposalState`, `merchantByID`, `orderByID`, `pendingTransactionByHash`, `applyChainEventTx`, `isEventAppliedTx`, `migrate`, `seed`, `countInt64`, `nullableInt64`, `lookupMenuItem`, plus all `seedMerchants`/`seedDemoData` code) must be **copied verbatim** from `backend/internal/store/sqlite.go` into this file. Change only `package store` → `package repository`. Do not add or remove any SQL logic.

- [ ] **Step 3: Verify the new package compiles**

```bash
cd backend && go build ./repository/...
```
Expected: `build constraints exclude all Go files in .../repository` is NOT shown; compilation succeeds.

- [ ] **Step 4: Commit**

```bash
git add backend/repository/
git commit -m "feat: add repository/sqlite.go with pure-SQL SQLiteStore and migrated interfaces"
```

---

## Task 3: Build MemberService

**Files:**
- Create: `backend/service/member.go`

The `MemberService` owns: input validation, email normalization, bcrypt password hashing, legacy SHA-256 detection/upgrade, session token generation, wallet address normalization.

- [ ] **Step 1: Write a failing test for Register**

```go
// backend/service/member_test.go
package service_test

import (
	"errors"
	"testing"
	"mealvoting/backend/internal/models"
	"mealvoting/backend/repository"
	"mealvoting/backend/service"
)

// mockMemberRepo is a minimal in-memory stub for testing.
type mockMemberRepo struct {
	members  map[string]*models.Member
	sessions map[string]int64
	nextID   int64
}

func newMockMemberRepo() *mockMemberRepo {
	return &mockMemberRepo{
		members:  make(map[string]*models.Member),
		sessions: make(map[string]int64),
		nextID:   1,
	}
}

func (m *mockMemberRepo) CreateMember(email, passwordHash, displayName string, isAdmin bool, tokenBalance int64, avatarURL string) (int64, error) {
	id := m.nextID
	m.nextID++
	isAdminVal := false
	if isAdmin { isAdminVal = true }
	m.members[email] = &models.Member{ID: id, Email: email, PasswordHash: passwordHash, DisplayName: displayName, IsAdmin: isAdminVal, TokenBalance: tokenBalance, AvatarURL: avatarURL}
	return id, nil
}
func (m *mockMemberRepo) MemberCount() (int64, error) { return int64(len(m.members)), nil }
func (m *mockMemberRepo) MemberByEmail(email string) (*models.Member, error) {
	if mem, ok := m.members[email]; ok { return mem, nil }
	return nil, errors.New("member not found")
}
func (m *mockMemberRepo) MemberBySession(token string) (*models.Member, error) {
	id, ok := m.sessions[token]
	if !ok { return nil, errors.New("invalid session") }
	for _, mem := range m.members {
		if mem.ID == id { return mem, nil }
	}
	return nil, errors.New("invalid session")
}
func (m *mockMemberRepo) MemberByID(id int64) (*models.Member, error) {
	for _, mem := range m.members {
		if mem.ID == id { return mem, nil }
	}
	return nil, errors.New("member not found")
}
func (m *mockMemberRepo) UpgradePasswordHash(memberID int64, hash string) error { return nil }
func (m *mockMemberRepo) CreateSession(memberID int64, token string) error {
	m.sessions[token] = memberID; return nil
}
func (m *mockMemberRepo) UpdateMemberWallet(memberID int64, wallet string) error {
	for _, mem := range m.members {
		if mem.ID == memberID { mem.WalletAddress = wallet; return nil }
	}
	return errors.New("member not found")
}
func (m *mockMemberRepo) RawLeaderboard() ([]*models.LeaderboardEntry, error) { return nil, nil }
func (m *mockMemberRepo) MemberStats(memberID int64) (int64, int64, int64, error) { return 0, 0, 0, nil }

// --- tests ---

func TestRegister_Success(t *testing.T) {
	repo := newMockMemberRepo()
	svc := service.NewMemberService(repo)

	member, token, err := svc.Register("User@Example.com", "secret", "Alice")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if member.Email != "user@example.com" {
		t.Errorf("email not normalized: got %q", member.Email)
	}
	if token == "" {
		t.Error("expected non-empty token")
	}
	if !member.IsAdmin {
		t.Error("first member should be admin")
	}
}

func TestRegister_DuplicateEmail(t *testing.T) {
	repo := newMockMemberRepo()
	svc := service.NewMemberService(repo)

	if _, _, err := svc.Register("a@b.com", "secret", "Alice"); err != nil {
		t.Fatalf("first register: %v", err)
	}
	_, _, err := svc.Register("A@B.com", "secret", "Bob")
	if err == nil {
		t.Fatal("expected error for duplicate email")
	}
}

func TestRegister_MissingFields(t *testing.T) {
	repo := newMockMemberRepo()
	svc := service.NewMemberService(repo)

	_, _, err := svc.Register("", "pass", "Name")
	if err == nil { t.Error("expected error for empty email") }

	_, _, err = svc.Register("a@b.com", "", "Name")
	if err == nil { t.Error("expected error for empty password") }

	_, _, err = svc.Register("a@b.com", "pass", "")
	if err == nil { t.Error("expected error for empty displayName") }
}
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
cd backend && go test ./service/... -run TestRegister -v
```
Expected: compile error — `service` package does not exist yet.

- [ ] **Step 3: Create `backend/service/member.go`**

```go
// backend/service/member.go
package service

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"mealvoting/backend/internal/models"
	"mealvoting/backend/repository"

	"github.com/ethereum/go-ethereum/common"
	"golang.org/x/crypto/bcrypt"
)

const defaultMemberTokens = int64(300)

// MemberService owns all business rules for members.
type MemberService struct {
	repo repository.MemberRepo
}

func NewMemberService(repo repository.MemberRepo) *MemberService {
	return &MemberService{repo: repo}
}

func (s *MemberService) Register(email, password, displayName string) (*models.Member, string, error) {
	email = normalizeEmail(email)
	if email == "" || password == "" || displayName == "" {
		return nil, "", errors.New("email, password, and displayName are required")
	}
	if _, err := s.repo.MemberByEmail(email); err == nil {
		return nil, "", errors.New("member already exists")
	}
	count, err := s.repo.MemberCount()
	if err != nil {
		return nil, "", err
	}
	isAdmin := count == 0

	passwordHash, err := hashPassword(password)
	if err != nil {
		return nil, "", err
	}
	avatarURL := fmt.Sprintf("https://api.dicebear.com/9.x/shapes/svg?seed=%s", displayName)

	memberID, err := s.repo.CreateMember(email, passwordHash, displayName, isAdmin, defaultMemberTokens, avatarURL)
	if err != nil {
		return nil, "", err
	}
	token := newSession(email + time.Now().String())
	if err := s.repo.CreateSession(memberID, token); err != nil {
		return nil, "", err
	}
	member, err := s.repo.MemberByID(memberID)
	return member, token, err
}

func (s *MemberService) Login(email, password string) (*models.Member, string, error) {
	email = normalizeEmail(email)
	member, err := s.repo.MemberByEmail(email)
	if err != nil {
		return nil, "", errors.New("invalid credentials")
	}
	ok, legacy := verifyPassword(member.PasswordHash, password)
	if !ok {
		return nil, "", errors.New("invalid credentials")
	}
	if legacy {
		if upgraded, err := hashPassword(password); err == nil {
			_ = s.repo.UpgradePasswordHash(member.ID, upgraded)
		}
	}
	token := newSession(email + time.Now().String())
	if err := s.repo.CreateSession(member.ID, token); err != nil {
		return nil, "", err
	}
	return s.repo.MemberByID(member.ID)
}

func (s *MemberService) LinkWallet(memberID int64, wallet string) (*models.Member, error) {
	wallet, err := normalizeWalletAddress(wallet)
	if err != nil {
		return nil, err
	}
	// Check not already claimed by another member.
	// We do this via a repo lookup — only store layer can do this atomically,
	// but for the medium refactor we accept the rare TOCTOU; the DB unique constraint is the safety net.
	if err := s.repo.UpdateMemberWallet(memberID, wallet); err != nil {
		return nil, err
	}
	return s.repo.MemberByID(memberID)
}

// --- helpers (private to service package) ---

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func normalizeWalletAddress(wallet string) (string, error) {
	wallet = strings.TrimSpace(wallet)
	if wallet == "" {
		return "", errors.New("wallet address is required")
	}
	if !common.IsHexAddress(wallet) {
		return "", errors.New("invalid wallet address")
	}
	return common.HexToAddress(wallet).Hex(), nil
}

func hashPassword(password string) (string, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashed), nil
}

func verifyPassword(storedHash, password string) (ok bool, legacy bool) {
	if strings.HasPrefix(storedHash, "$2") {
		return bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(password)) == nil, false
	}
	sum := sha256.Sum256([]byte(password))
	return storedHash == hex.EncodeToString(sum[:]), true
}

func newSession(seed string) string {
	sum := sha256.Sum256([]byte(seed))
	return hex.EncodeToString(sum[:])
}
```

- [ ] **Step 4: Run the tests**

```bash
cd backend && go test ./service/... -run TestRegister -v
```
Expected: all 3 test functions PASS.

- [ ] **Step 5: Add Login and LinkWallet tests, then run**

Add to `backend/service/member_test.go`:

```go
func TestLogin_Success(t *testing.T) {
	repo := newMockMemberRepo()
	svc := service.NewMemberService(repo)
	svc.Register("a@b.com", "secret", "Alice")

	member, token, err := svc.Login("A@B.com", "secret")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if token == "" {
		t.Error("expected non-empty token")
	}
	if member.Email != "a@b.com" {
		t.Errorf("unexpected email: %q", member.Email)
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	repo := newMockMemberRepo()
	svc := service.NewMemberService(repo)
	svc.Register("a@b.com", "secret", "Alice")

	_, _, err := svc.Login("a@b.com", "wrong")
	if err == nil {
		t.Error("expected error for wrong password")
	}
}
```

```bash
cd backend && go test ./service/... -v
```
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/service/member.go backend/service/member_test.go
git commit -m "feat: add MemberService with register, login, wallet linking"
```

---

## Task 4: Build ProposalService

**Files:**
- Create: `backend/service/proposal.go`

`ProposalService` owns: proposal phase validation (`isCurrentProposalDay`, status checks), token balance checks, duplicate option/vote checks, settlement reward calculation.

- [ ] **Step 1: Create `backend/service/proposal.go`**

```go
// backend/service/proposal.go
package service

import (
	"errors"
	"time"

	"mealvoting/backend/internal/models"
	"mealvoting/backend/repository"
)

const (
	optionTokenCost      = int64(10)
	winnerTokenReward    = int64(6)
	loserPartialRefund   = int64(4)
	voterPoints          = int64(25)
	winnerProposerPoints = int64(120)
)

// ProposalService owns all business rules for proposals, options, votes, and settlement.
type ProposalService struct {
	proposals repository.ProposalRepo
	members   repository.MemberRepo
	merchants repository.MerchantRepo
}

func NewProposalService(proposals repository.ProposalRepo, members repository.MemberRepo, merchants repository.MerchantRepo) *ProposalService {
	return &ProposalService{proposals: proposals, members: members, merchants: merchants}
}

func (s *ProposalService) Create(memberID int64, title, description, merchantGroup string, proposalMinutes, voteMinutes, orderMinutes int64) (*models.Proposal, error) {
	member, err := s.members.MemberByID(memberID)
	if err != nil {
		return nil, err
	}
	if merchantGroup == "" {
		merchantGroup = "taipei-xinyi"
	}
	now := time.Now().UTC()
	proposalDeadline := now.Add(time.Duration(proposalMinutes) * time.Minute)
	voteDeadline := now.Add(time.Duration(proposalMinutes+voteMinutes) * time.Minute)
	orderDeadline := now.Add(time.Duration(proposalMinutes+voteMinutes+orderMinutes) * time.Minute)
	return s.proposals.CreateProposal(memberID, title, description, merchantGroup, member.DisplayName, proposalDeadline, voteDeadline, orderDeadline)
}

func (s *ProposalService) Get(id int64) (*models.Proposal, error) {
	return s.proposals.GetProposal(id)
}

func (s *ProposalService) List() []*models.Proposal {
	return s.proposals.ListProposals()
}

func (s *ProposalService) AddOption(proposalID, memberID int64, merchantID string) (*models.ProposalOption, error) {
	proposal, err := s.proposals.GetProposal(proposalID)
	if err != nil {
		return nil, err
	}
	if !isCurrentProposalDay(proposal.CreatedAt) {
		return nil, errors.New("proposal expired for today")
	}
	if proposal.Status != "proposing" {
		return nil, errors.New("proposal option window is closed")
	}
	member, err := s.members.MemberByID(memberID)
	if err != nil {
		return nil, err
	}
	if member.TokenBalance < optionTokenCost {
		return nil, errors.New("insufficient token balance")
	}
	merchant, err := s.merchants.GetMerchant(merchantID)
	if err != nil {
		return nil, err
	}
	if merchant.Group != proposal.MerchantGroup {
		return nil, errors.New("merchant does not belong to the selected organization")
	}
	for _, opt := range proposal.Options {
		if opt.MerchantID == merchantID {
			return nil, errors.New("merchant already proposed")
		}
	}
	return s.proposals.InsertProposalOption(proposalID, memberID, merchant.ID, merchant.Name, member.DisplayName, optionTokenCost)
}

func (s *ProposalService) Vote(proposalID, memberID, optionID, tokenAmount int64) (*models.Proposal, error) {
	proposal, err := s.proposals.GetProposal(proposalID)
	if err != nil {
		return nil, err
	}
	if !isCurrentProposalDay(proposal.CreatedAt) {
		return nil, errors.New("proposal expired for today")
	}
	if proposal.Status != "voting" {
		return nil, errors.New("proposal is not in voting stage")
	}
	if tokenAmount <= 0 {
		return nil, errors.New("tokenAmount must be greater than zero")
	}
	member, err := s.members.MemberByID(memberID)
	if err != nil {
		return nil, err
	}
	if member.TokenBalance < tokenAmount {
		return nil, errors.New("insufficient token balance")
	}
	found := false
	for _, opt := range proposal.Options {
		if opt.ID == optionID {
			found = true
			break
		}
	}
	if !found {
		return nil, errors.New("option not found")
	}
	if err := s.proposals.RecordVote(proposalID, memberID, optionID, tokenAmount, member.DisplayName); err != nil {
		return nil, err
	}
	return s.proposals.GetProposal(proposalID)
}

func (s *ProposalService) QuoteOption() map[string]int64 {
	return map[string]int64{"tokenCost": optionTokenCost}
}

func (s *ProposalService) QuoteVote(tokenAmount int64) (map[string]int64, error) {
	if tokenAmount <= 0 {
		return nil, errors.New("tokenAmount must be greater than zero")
	}
	return map[string]int64{"tokenAmount": tokenAmount, "voteWeight": tokenAmount}, nil
}

func (s *ProposalService) FinalizeSettlement(proposalID int64) (*models.Proposal, error) {
	proposal, err := s.proposals.GetProposal(proposalID)
	if err != nil {
		return nil, err
	}
	if !isCurrentProposalDay(proposal.CreatedAt) {
		return nil, errors.New("proposal expired for today")
	}
	if proposal.Status != "settled" {
		return nil, errors.New("proposal has not reached settlement stage")
	}
	if proposal.RewardsApplied {
		return nil, errors.New("proposal rewards already settled")
	}
	if proposal.WinnerOptionID == 0 {
		return nil, errors.New("winner not finalized")
	}

	var rewards []repository.MemberReward
	var optionRefunds []repository.OptionRefund

	for _, opt := range proposal.Options {
		if opt.ID == proposal.WinnerOptionID {
			rewards = append(rewards, repository.MemberReward{
				MemberID: opt.ProposerMember,
				Points:   winnerProposerPoints,
				Tokens:   winnerTokenReward,
			})
			optionRefunds = append(optionRefunds, repository.OptionRefund{
				OptionID:        opt.ID,
				WinnerTokenBack: winnerTokenReward,
			})
		} else {
			rewards = append(rewards, repository.MemberReward{
				MemberID: opt.ProposerMember,
				Tokens:   loserPartialRefund,
			})
			optionRefunds = append(optionRefunds, repository.OptionRefund{
				OptionID:      opt.ID,
				PartialRefund: loserPartialRefund,
			})
		}
	}
	voterIDs := make(map[int64]bool)
	for _, vote := range proposal.Votes {
		if !voterIDs[vote.MemberID] {
			voterIDs[vote.MemberID] = true
			rewards = append(rewards, repository.MemberReward{
				MemberID: vote.MemberID,
				Points:   voterPoints,
			})
		}
	}

	if err := s.proposals.ApplySettlementRewards(proposalID, rewards, optionRefunds); err != nil {
		return nil, err
	}
	return s.proposals.GetProposal(proposalID)
}

// isCurrentProposalDay checks that the proposal was created today (UTC).
func isCurrentProposalDay(createdAt time.Time) bool {
	now := time.Now().UTC()
	y, m, d := createdAt.UTC().Date()
	ny, nm, nd := now.Date()
	return y == ny && m == nm && d == nd
}
```

- [ ] **Step 2: Write tests for AddOption and Vote**

Create `backend/service/proposal_test.go`:

```go
// backend/service/proposal_test.go
package service_test

import (
	"errors"
	"testing"
	"time"

	"mealvoting/backend/internal/models"
	"mealvoting/backend/repository"
	"mealvoting/backend/service"
)

// mockProposalRepo for testing
type mockProposalRepo struct {
	proposals map[int64]*models.Proposal
	nextID    int64
}

func newMockProposalRepo() *mockProposalRepo {
	return &mockProposalRepo{proposals: make(map[int64]*models.Proposal), nextID: 1}
}

func (m *mockProposalRepo) CreateProposal(memberID int64, title, description, merchantGroup, createdByName string, proposalDeadline, voteDeadline, orderDeadline time.Time) (*models.Proposal, error) {
	id := m.nextID; m.nextID++
	p := &models.Proposal{
		ID: id, Title: title, Description: description,
		MerchantGroup: merchantGroup, CreatedBy: memberID, CreatedByName: createdByName,
		ProposalDeadline: proposalDeadline, VoteDeadline: voteDeadline, OrderDeadline: orderDeadline,
		Status: "proposing", CreatedAt: time.Now().UTC(),
	}
	m.proposals[id] = p
	return p, nil
}

func (m *mockProposalRepo) ListProposals() []*models.Proposal {
	var out []*models.Proposal
	for _, p := range m.proposals { out = append(out, p) }
	return out
}
func (m *mockProposalRepo) GetProposal(id int64) (*models.Proposal, error) {
	if p, ok := m.proposals[id]; ok { return p, nil }
	return nil, errors.New("proposal not found")
}
func (m *mockProposalRepo) InsertProposalOption(proposalID, memberID int64, merchantID, merchantName, proposerName string, tokenCost int64) (*models.ProposalOption, error) {
	opt := &models.ProposalOption{ID: 1, MerchantID: merchantID, MerchantName: merchantName, ProposerMember: memberID, TokenStake: tokenCost}
	if p, ok := m.proposals[proposalID]; ok { p.Options = append(p.Options, opt) }
	return opt, nil
}
func (m *mockProposalRepo) RecordVote(proposalID, memberID, optionID, tokenAmount int64, displayName string) error { return nil }
func (m *mockProposalRepo) ApplySettlementRewards(proposalID int64, rewards []repository.MemberReward, optionRefunds []repository.OptionRefund) error { return nil }

// mockMerchantRepo
type mockMerchantRepo struct{}
func (m *mockMerchantRepo) GetMerchant(id string) (*models.Merchant, error) {
	if id == "shop-bento" {
		return &models.Merchant{ID: "shop-bento", Name: "便當", Group: "taipei-xinyi"}, nil
	}
	return nil, errors.New("merchant not found")
}

func TestAddOption_InsufficientTokens(t *testing.T) {
	memberRepo := newMockMemberRepo()
	proposalRepo := newMockProposalRepo()
	merchantRepo := &mockMerchantRepo{}
	svc := service.NewProposalService(proposalRepo, memberRepo, merchantRepo)
	memberSvc := service.NewMemberService(memberRepo)

	// Register member (gets 300 tokens)
	member, _, _ := memberSvc.Register("a@b.com", "pass", "Alice")
	// Manually set token balance to 0 for this test
	member.TokenBalance = 0

	proposal, _ := proposalRepo.CreateProposal(member.ID, "Lunch", "", "taipei-xinyi", "Alice",
		time.Now().Add(time.Hour), time.Now().Add(2*time.Hour), time.Now().Add(3*time.Hour))

	_, err := svc.AddOption(proposal.ID, member.ID, "shop-bento")
	if err == nil {
		t.Error("expected error for insufficient tokens")
	}
}

func TestVote_WrongStatus(t *testing.T) {
	memberRepo := newMockMemberRepo()
	proposalRepo := newMockProposalRepo()
	merchantRepo := &mockMerchantRepo{}
	svc := service.NewProposalService(proposalRepo, memberRepo, merchantRepo)
	memberSvc := service.NewMemberService(memberRepo)

	member, _, _ := memberSvc.Register("a@b.com", "pass", "Alice")
	proposal, _ := proposalRepo.CreateProposal(member.ID, "Lunch", "", "taipei-xinyi", "Alice",
		time.Now().Add(time.Hour), time.Now().Add(2*time.Hour), time.Now().Add(3*time.Hour))
	// Status is "proposing", not "voting"

	_, err := svc.Vote(proposal.ID, member.ID, 1, 10)
	if err == nil {
		t.Error("expected error for wrong proposal status")
	}
}
```

- [ ] **Step 3: Run tests**

```bash
cd backend && go test ./service/... -v
```
Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/service/proposal.go backend/service/proposal_test.go
git commit -m "feat: add ProposalService with lifecycle, option, vote, settlement logic"
```

---

## Task 5: Build OrderService and LeaderboardService

**Files:**
- Create: `backend/service/order.go`
- Create: `backend/service/leaderboard.go`

- [ ] **Step 1: Create `backend/service/order.go`**

```go
// backend/service/order.go
package service

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"

	"mealvoting/backend/blockchain"
	"mealvoting/backend/internal/models"
	"mealvoting/backend/repository"
)

const estimatedOrderGasWei = int64(2_000_000_000_000_000)

// OrderService owns order quote computation, hash generation, and signature coordination.
type OrderService struct {
	orders    repository.OrderRepo
	proposals repository.ProposalRepo
	merchants repository.MerchantRepo
	chain     *blockchain.Client
}

func NewOrderService(orders repository.OrderRepo, proposals repository.ProposalRepo, merchants repository.MerchantRepo, chain *blockchain.Client) *OrderService {
	return &OrderService{orders: orders, proposals: proposals, merchants: merchants, chain: chain}
}

func (s *OrderService) Quote(proposalID, memberID int64, items map[string]int64) (*models.OrderQuote, error) {
	proposal, err := s.proposals.GetProposal(proposalID)
	if err != nil {
		return nil, err
	}
	if !isCurrentProposalDay(proposal.CreatedAt) {
		return nil, errors.New("proposal expired for today")
	}
	if proposal.Status != "ordering" {
		return nil, errors.New("proposal is not in ordering stage")
	}
	var winner *models.ProposalOption
	for _, opt := range proposal.Options {
		if opt.ID == proposal.WinnerOptionID {
			winner = opt
			break
		}
	}
	if winner == nil {
		return nil, errors.New("winner not finalized yet")
	}
	merchant, err := s.merchants.GetMerchant(winner.MerchantID)
	if err != nil {
		return nil, err
	}
	var quoteItems []*models.OrderItem
	var subtotal int64
	for menuID, quantity := range items {
		if quantity <= 0 {
			continue
		}
		var menuItem *models.MenuItem
		for _, mi := range merchant.Menu {
			if mi.ID == menuID {
				menuItem = mi
				break
			}
		}
		if menuItem == nil {
			return nil, fmt.Errorf("menu item %s not found", menuID)
		}
		subtotal += menuItem.PriceWei * quantity
		quoteItems = append(quoteItems, &models.OrderItem{
			MenuItemID: menuID, Name: menuItem.Name, Quantity: quantity, PriceWei: menuItem.PriceWei,
		})
	}
	if len(quoteItems) == 0 {
		return nil, errors.New("at least one order item is required")
	}
	return &models.OrderQuote{
		ProposalID:         proposal.ID,
		MerchantID:         merchant.ID,
		MerchantName:       merchant.Name,
		Items:              quoteItems,
		SubtotalWei:        fmt.Sprintf("%d", subtotal),
		EstimatedGasWei:    fmt.Sprintf("%d", estimatedOrderGasWei),
		RequiredBalanceWei: fmt.Sprintf("%d", subtotal+estimatedOrderGasWei),
	}, nil
}

func (s *OrderService) Sign(proposalID, memberID int64, items map[string]int64, walletAddress string) (*models.OrderQuote, *models.OrderSignature, *models.Order, error) {
	if s.chain == nil {
		return nil, nil, nil, errors.New("chain signer unavailable")
	}
	proposal, err := s.proposals.GetProposal(proposalID)
	if err != nil {
		return nil, nil, nil, err
	}
	if proposal.ChainProposalID == nil {
		return nil, nil, nil, errors.New("proposal is not mapped to chain yet")
	}
	quote, err := s.Quote(proposalID, memberID, items)
	if err != nil {
		return nil, nil, nil, err
	}
	orderHash := computeOrderHash(*proposal.ChainProposalID, memberID, quote.Items)
	sig, err := s.chain.SignOrder(*proposal.ChainProposalID, walletAddress, orderHash, quote.SubtotalWei)
	if err != nil {
		return nil, nil, nil, err
	}
	order, err := s.orders.SaveOrder(proposalID, memberID, quote, sig, "")
	if err != nil {
		return nil, nil, nil, err
	}
	return quote, sig, order, nil
}

func computeOrderHash(proposalID, memberID int64, items any) string {
	payload, _ := json.Marshal(struct {
		ProposalID int64 `json:"proposalId"`
		MemberID   int64 `json:"memberId"`
		Items      any   `json:"items"`
	}{proposalID, memberID, items})
	sum := sha256.Sum256(payload)
	return "0x" + hex.EncodeToString(sum[:])
}
```

- [ ] **Step 2: Create `backend/service/leaderboard.go`**

```go
// backend/service/leaderboard.go
package service

import (
	"sort"

	"mealvoting/backend/internal/models"
	"mealvoting/backend/repository"
)

// LeaderboardService owns ranking logic and achievement building calculation.
type LeaderboardService struct {
	members repository.MemberRepo
}

func NewLeaderboardService(members repository.MemberRepo) *LeaderboardService {
	return &LeaderboardService{members: members}
}

func (s *LeaderboardService) List() ([]*models.LeaderboardEntry, error) {
	entries, err := s.members.RawLeaderboard()
	if err != nil {
		return nil, err
	}
	for _, e := range entries {
		e.BuildingName = buildingForPoints(e.Points).Name
	}
	rankEntries(entries)
	return entries, nil
}

func (s *LeaderboardService) Profile(memberID int64) (*models.MemberProfile, error) {
	member, err := s.members.MemberByID(memberID)
	if err != nil {
		return nil, err
	}
	entries, err := s.List()
	if err != nil {
		return nil, err
	}
	rank := len(entries)
	for _, e := range entries {
		if e.MemberID == memberID {
			rank = e.Rank
			break
		}
	}
	created, orders, votes, err := s.members.MemberStats(memberID)
	if err != nil {
		return nil, err
	}
	return &models.MemberProfile{
		Member:    member,
		Rank:      rank,
		Buildings: []models.AchievementBuilding{buildingForPoints(member.Points)},
		RecentBadges: []string{"店家策展人", "鏈上投票手"},
		History: map[string]int64{
			"proposalsCreated": created,
			"ordersSubmitted":  orders,
			"votesCast":        votes,
		},
		Stats: map[string]int64{
			"points":       member.Points,
			"tokenBalance": member.TokenBalance,
		},
	}, nil
}

func buildingForPoints(points int64) models.AchievementBuilding {
	switch {
	case points >= 600:
		return models.AchievementBuilding{Level: 4, Name: "雲端塔樓", Skin: "glass"}
	case points >= 300:
		return models.AchievementBuilding{Level: 3, Name: "港口商會", Skin: "copper"}
	case points >= 120:
		return models.AchievementBuilding{Level: 2, Name: "石砌食堂", Skin: "sand"}
	default:
		return models.AchievementBuilding{Level: 1, Name: "木造小屋", Skin: "oak"}
	}
}

func rankEntries(entries []*models.LeaderboardEntry) {
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Points == entries[j].Points {
			return entries[i].MemberID < entries[j].MemberID
		}
		return entries[i].Points > entries[j].Points
	})
	for i := range entries {
		entries[i].Rank = i + 1
	}
}
```

- [ ] **Step 3: Verify both files compile**

```bash
cd backend && go build ./service/...
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/service/order.go backend/service/leaderboard.go
git commit -m "feat: add OrderService and LeaderboardService"
```

---

## Task 6: Update handlers to use services

**Files:**
- Modify: `backend/handlers/handlers.go`

Replace the `store store.Store` field with service fields. Every handler calls the appropriate service instead of the store directly.

- [ ] **Step 1: Replace the Server struct and all handlers**

Replace the entire content of `backend/handlers/handlers.go` with:

```go
package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"mealvoting/backend/blockchain"
	"mealvoting/backend/config"
	"mealvoting/backend/internal/models"
	"mealvoting/backend/repository"
	"mealvoting/backend/service"
)

const (
	loginRateLimitKey         = "auth_login"
	registerRateLimitKey      = "auth_register"
	walletLinkRateLimitKey    = "wallet_link"
	loginRateLimitMax         = 5
	registerRateLimitMax      = 3
	walletLinkRateLimitMax    = 5
	loginRateLimitWindow      = time.Minute
	registerRateLimitWindow   = 10 * time.Minute
	walletLinkRateLimitWindow = time.Minute
)

type Server struct {
	cfg         config.Config
	members     *service.MemberService
	proposals   *service.ProposalService
	orders      *service.OrderService
	leaderboard *service.LeaderboardService
	chain       *blockchain.Client
	chainRepo   repository.ChainRepo
	txRepo      repository.TransactionRepo
	rateLimiter *rateLimiter
}

func NewServer(cfg config.Config, store repository.Store, chain *blockchain.Client) *Server {
	members := service.NewMemberService(store)
	proposals := service.NewProposalService(store, store, store)
	orders := service.NewOrderService(store, store, store, chain)
	leaderboard := service.NewLeaderboardService(store)
	return &Server{
		cfg:         cfg,
		members:     members,
		proposals:   proposals,
		orders:      orders,
		leaderboard: leaderboard,
		chain:       chain,
		chainRepo:   store,
		txRepo:      store,
		rateLimiter: newRateLimiter(),
	}
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("GET /contract", s.handleContractInfo)
	mux.HandleFunc("POST /auth/check", s.handleAuthCheck)
	mux.HandleFunc("POST /auth/register", s.withConfiguredRateLimit(registerRateLimitKey, s.cfg.RateLimit.Register, registerRateLimitMax, registerRateLimitWindow, s.handleRegister))
	mux.HandleFunc("POST /auth/login", s.withConfiguredRateLimit(loginRateLimitKey, s.cfg.RateLimit.Login, loginRateLimitMax, loginRateLimitWindow, s.handleLogin))
	mux.HandleFunc("POST /members/wallet/link", s.withConfiguredRateLimit(walletLinkRateLimitKey, s.cfg.RateLimit.WalletLink, walletLinkRateLimitMax, walletLinkRateLimitWindow, s.withAuth(s.handleWalletLink)))
	mux.HandleFunc("GET /members/me", s.withAuth(s.handleMe))
	mux.HandleFunc("GET /members/{id}", s.handleMemberProfile)
	mux.HandleFunc("GET /members/{id}/profile", s.handleMemberProfile)
	mux.HandleFunc("GET /merchants/{id}", s.handleGetMerchant)
	mux.HandleFunc("GET /proposals", s.handleListProposals)
	mux.HandleFunc("POST /proposals", s.withAuth(s.handleCreateProposal))
	mux.HandleFunc("GET /proposals/{id}", s.handleGetProposal)
	mux.HandleFunc("POST /proposals/{id}/options", s.withAuth(s.handleAddOption))
	mux.HandleFunc("POST /proposals/{id}/options/quote", s.handleOptionQuote)
	mux.HandleFunc("POST /proposals/{id}/votes", s.withAuth(s.handleVote))
	mux.HandleFunc("POST /proposals/{id}/votes/quote", s.handleVoteQuote)
	mux.HandleFunc("POST /proposals/{id}/settle", s.withAuth(s.handleSettleProposal))
	mux.HandleFunc("POST /orders/quote", s.withAuth(s.handleOrderQuote))
	mux.HandleFunc("POST /orders/sign", s.withAuth(s.handleOrderSign))
	mux.HandleFunc("GET /leaderboard", s.handleLeaderboard)
	mux.HandleFunc("GET /indexer/status", s.handleIndexerStatus)
	mux.HandleFunc("GET /indexer/events", s.handleIndexedEvents)
	mux.HandleFunc("POST /admin/indexer/sync", s.withAdmin(s.handleIndexerSync))
	mux.HandleFunc("POST /transactions", s.withAuth(s.handleRegisterTransaction))
	mux.HandleFunc("GET /transactions", s.withAuth(s.handleListTransactions))
	mux.HandleFunc("GET /transactions/{txHash}", s.withAuth(s.handleTransactionStatus))
	return withCORS(mux)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleContractInfo(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.chainRepo.ContractInfo())
}

func (s *Server) handleAuthCheck(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	email := strings.TrimSpace(strings.ToLower(body.Email))
	if email == "" {
		writeError(w, http.StatusBadRequest, "email is required")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"email": email, "exists": true})
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email       string `json:"email"`
		Password    string `json:"password"`
		DisplayName string `json:"displayName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	member, token, err := s.members.Register(body.Email, body.Password, body.DisplayName)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"token": token, "member": member})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	member, token, err := s.members.Login(body.Email, body.Password)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "member": member})
}

func (s *Server) handleWalletLink(w http.ResponseWriter, r *http.Request, memberID int64) {
	var body struct {
		WalletAddress string `json:"walletAddress"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	member, err := s.members.LinkWallet(memberID, body.WalletAddress)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, member)
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request, memberID int64) {
	member, err := s.members.GetBySession(sessionToken(r))
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, member)
}

func (s *Server) handleMemberProfile(w http.ResponseWriter, r *http.Request) {
	memberID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid member id")
		return
	}
	profile, err := s.leaderboard.Profile(memberID)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, profile)
}

func (s *Server) handleGetMerchant(w http.ResponseWriter, r *http.Request) {
	// Direct repo call — no business logic, just a lookup
	merchant, err := s.proposals.GetMerchant(strings.TrimSpace(r.PathValue("id")))
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, merchant)
}

func (s *Server) handleListProposals(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, anonymizeProposals(s.proposals.List()))
}

func (s *Server) handleGetProposal(w http.ResponseWriter, r *http.Request) {
	proposalID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid proposal id")
		return
	}
	proposal, err := s.proposals.Get(proposalID)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, anonymizeProposal(proposal))
}

func (s *Server) handleCreateProposal(w http.ResponseWriter, r *http.Request, memberID int64) {
	var body struct {
		Title           string `json:"title"`
		Description     string `json:"description"`
		MerchantGroup   string `json:"merchantGroup"`
		MerchantID      string `json:"merchantId"`
		ProposalMinutes int64  `json:"proposalMinutes"`
		VoteMinutes     int64  `json:"voteMinutes"`
		OrderMinutes    int64  `json:"orderMinutes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	proposal, err := s.proposals.Create(memberID, body.Title, body.Description, body.MerchantGroup, body.ProposalMinutes, body.VoteMinutes, body.OrderMinutes)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(body.MerchantID) != "" {
		if _, err := s.proposals.AddOption(proposal.ID, memberID, body.MerchantID); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		proposal, err = s.proposals.Get(proposal.ID)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
	}
	writeJSON(w, http.StatusCreated, anonymizeProposal(proposal))
}

func (s *Server) handleAddOption(w http.ResponseWriter, r *http.Request, memberID int64) {
	proposalID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid proposal id")
		return
	}
	var body struct {
		MerchantID string `json:"merchantId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	option, err := s.proposals.AddOption(proposalID, memberID, body.MerchantID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, anonymizeOption(option))
}

func (s *Server) handleOptionQuote(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.proposals.QuoteOption())
}

func (s *Server) handleVote(w http.ResponseWriter, r *http.Request, memberID int64) {
	proposalID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid proposal id")
		return
	}
	var body struct {
		OptionID    int64 `json:"optionId"`
		TokenAmount int64 `json:"tokenAmount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	proposal, err := s.proposals.Vote(proposalID, memberID, body.OptionID, body.TokenAmount)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, anonymizeProposal(proposal))
}

func (s *Server) handleVoteQuote(w http.ResponseWriter, r *http.Request) {
	var body struct {
		TokenAmount int64 `json:"tokenAmount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	quote, err := s.proposals.QuoteVote(body.TokenAmount)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, quote)
}

func (s *Server) handleOrderQuote(w http.ResponseWriter, r *http.Request, memberID int64) {
	var body struct {
		ProposalID int64            `json:"proposalId"`
		Items      map[string]int64 `json:"items"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	quote, err := s.orders.Quote(body.ProposalID, memberID, body.Items)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, quote)
}

func (s *Server) handleOrderSign(w http.ResponseWriter, r *http.Request, memberID int64) {
	var body struct {
		ProposalID int64            `json:"proposalId"`
		Items      map[string]int64 `json:"items"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	member, err := s.members.GetBySession(sessionToken(r))
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}
	if member.WalletAddress == "" {
		writeError(w, http.StatusBadRequest, "wallet address is not linked")
		return
	}
	quote, sig, order, err := s.orders.Sign(body.ProposalID, member.ID, body.Items, member.WalletAddress)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"quote": quote, "signature": sig, "order": order})
}

func (s *Server) handleSettleProposal(w http.ResponseWriter, r *http.Request, memberID int64) {
	_ = memberID
	proposalID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid proposal id")
		return
	}
	proposal, err := s.proposals.FinalizeSettlement(proposalID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, anonymizeProposal(proposal))
}

func (s *Server) handleLeaderboard(w http.ResponseWriter, r *http.Request) {
	entries, err := s.leaderboard.List()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, entries)
}

func (s *Server) handleIndexerStatus(w http.ResponseWriter, r *http.Request) {
	status, err := s.chainRepo.ChainSyncStatus()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, status)
}

func (s *Server) handleIndexedEvents(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	events, err := s.chainRepo.ListChainEvents(limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, events)
}

func (s *Server) handleIndexerSync(w http.ResponseWriter, r *http.Request, memberID int64) {
	_ = memberID
	if s.chain == nil {
		writeError(w, http.StatusBadRequest, "indexer unavailable")
		return
	}
	indexer, err := s.chain.NewIndexer()
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	status, err := s.chainRepo.ChainSyncStatus()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	fromBlock := status.LastSyncedBlock + 1
	if fromBlock == 1 {
		fromBlock = 0
	}
	result, err := indexer.SyncRange(context.Background(), fromBlock)
	if err != nil {
		_ = s.chainRepo.StoreChainEvents(nil, status.LastSeenBlock, err.Error())
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	if err := s.chainRepo.StoreChainEvents(result.Events, result.ToBlock, ""); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleRegisterTransaction(w http.ResponseWriter, r *http.Request, memberID int64) {
	var body struct {
		ProposalID    int64  `json:"proposalId"`
		Action        string `json:"action"`
		TxHash        string `json:"txHash"`
		WalletAddress string `json:"walletAddress"`
		RelatedOrder  string `json:"relatedOrder"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	item, err := s.txRepo.RegisterPendingTransaction(memberID, body.ProposalID, body.Action, body.TxHash, body.WalletAddress, body.RelatedOrder)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) handleListTransactions(w http.ResponseWriter, r *http.Request, memberID int64) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	items, err := s.txRepo.ListPendingTransactions(memberID, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) handleTransactionStatus(w http.ResponseWriter, r *http.Request, memberID int64) {
	item, err := s.txRepo.GetPendingTransaction(memberID, transactionHashFromRequest(r))
	if err != nil {
		writeError(w, http.StatusNotFound, "transaction not found")
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) withAuth(next func(http.ResponseWriter, *http.Request, int64)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		member, err := s.members.GetBySession(sessionToken(r))
		if err != nil {
			writeError(w, http.StatusUnauthorized, err.Error())
			return
		}
		next(w, r, member.ID)
	}
}

func (s *Server) withAdmin(next func(http.ResponseWriter, *http.Request, int64)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		member, err := s.members.GetBySession(sessionToken(r))
		if err != nil {
			writeError(w, http.StatusUnauthorized, err.Error())
			return
		}
		if !member.IsAdmin {
			writeError(w, http.StatusForbidden, "admin access required")
			return
		}
		next(w, r, member.ID)
	}
}

func (s *Server) withRateLimit(scope string, limit int, window time.Duration, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := scope + ":" + clientIdentifier(r)
		allowed, retryAfter := s.rateLimiter.allow(key, limit, window)
		if !allowed {
			w.Header().Set("Retry-After", retryAfterSeconds(retryAfter))
			writeError(w, http.StatusTooManyRequests, "too many requests, please try again later")
			return
		}
		next(w, r)
	}
}

func (s *Server) withConfiguredRateLimit(scope string, cfg config.EndpointRateLimit, defaultLimit int, defaultWindow time.Duration, next http.HandlerFunc) http.HandlerFunc {
	limit := defaultLimit
	if cfg.MaxRequests > 0 {
		limit = int(cfg.MaxRequests)
	}
	window := defaultWindow
	if cfg.WindowSeconds > 0 {
		window = time.Duration(cfg.WindowSeconds) * time.Second
	}
	return s.withRateLimit(scope, limit, window, next)
}

func sessionToken(r *http.Request) string {
	return strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
}

func transactionHashFromRequest(r *http.Request) string {
	txHash := strings.TrimSpace(r.PathValue("txHash"))
	if txHash != "" { return txHash }
	return strings.TrimSpace(strings.TrimPrefix(r.URL.Path, "/transactions/"))
}

func anonymizeProposals(proposals []*models.Proposal) []*models.Proposal {
	items := make([]*models.Proposal, 0, len(proposals))
	for _, p := range proposals { items = append(items, anonymizeProposal(p)) }
	return items
}

func anonymizeProposal(proposal *models.Proposal) *models.Proposal {
	if proposal == nil { return nil }
	cp := *proposal
	cp.CreatedBy = 0
	cp.CreatedByName = ""
	cp.Options = make([]*models.ProposalOption, 0, len(proposal.Options))
	for _, opt := range proposal.Options { cp.Options = append(cp.Options, anonymizeOption(opt)) }
	cp.Votes = make([]*models.VoteRecord, 0, len(proposal.Votes))
	for _, vote := range proposal.Votes {
		if vote == nil { continue }
		cv := *vote
		cv.MemberID = 0
		cv.MemberName = ""
		cv.WalletHidden = true
		cp.Votes = append(cp.Votes, &cv)
	}
	return &cp
}

func anonymizeOption(opt *models.ProposalOption) *models.ProposalOption {
	if opt == nil { return nil }
	cp := *opt
	cp.ProposerMember = 0
	cp.ProposerName = ""
	return &cp
}
```

> **Note:** The helper functions `writeJSON`, `writeError`, `withCORS`, `clientIdentifier`, `retryAfterSeconds` exist in the current `handlers/handlers.go`. Before replacing the file, extract those helper functions to a new file `backend/handlers/helpers.go` so they are not lost:
> ```bash
> # Identify the helpers by grepping
> grep -n "^func writeJSON\|^func writeError\|^func withCORS\|^func clientIdentifier\|^func retryAfterSeconds" backend/handlers/handlers.go
> ```
> Copy those functions (and their imports) into `backend/handlers/helpers.go` with `package handlers` at the top. Then replace `handlers.go` as shown above.

- [ ] **Step 2: Add `GetBySession` and `GetMerchant` to MemberService and ProposalService**

Add to `backend/service/member.go`:

```go
func (s *MemberService) GetBySession(token string) (*models.Member, error) {
	return s.repo.MemberBySession(token)
}
```

Add to `backend/service/proposal.go`:

```go
// GetMerchant delegates to the MerchantRepo — handlers need it for the /merchants/{id} endpoint.
func (s *ProposalService) GetMerchant(id string) (*models.Merchant, error) {
	return s.merchants.GetMerchant(id)
}
```

- [ ] **Step 3: Verify the backend compiles**

```bash
cd backend && go build ./...
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/handlers/handlers.go backend/service/member.go backend/service/proposal.go
git commit -m "refactor: update handlers to call services instead of store directly"
```

---

## Task 7: Update main.go wire-up

**Files:**
- Modify: `backend/main.go`

- [ ] **Step 1: Replace `main.go`**

```go
package main

import (
	"context"
	"log"
	"net/http"

	"mealvoting/backend/blockchain"
	"mealvoting/backend/config"
	"mealvoting/backend/handlers"
	"mealvoting/backend/repository"
)

func main() {
	cfg := config.Load()
	chainClient, err := blockchain.NewClient(cfg.Chain)
	if err != nil {
		log.Fatalf("create blockchain client: %v", err)
	}

	appStore, err := repository.NewSQLiteStore(cfg.DBPath, chainClient.ContractInfo())
	if err != nil {
		log.Fatalf("create store: %v", err)
	}
	server := handlers.NewServer(cfg, appStore, chainClient)

	if cfg.SyncOnStart {
		indexer, err := chainClient.NewIndexer()
		if err != nil {
			log.Printf("indexer disabled: %v", err)
		} else {
			status, err := appStore.ChainSyncStatus()
			if err != nil {
				log.Printf("read sync status: %v", err)
			} else {
				fromBlock := status.LastSyncedBlock + 1
				if fromBlock == 1 {
					fromBlock = 0
				}
				result, err := indexer.SyncRange(context.Background(), fromBlock)
				if err != nil {
					_ = appStore.StoreChainEvents(nil, status.LastSeenBlock, err.Error())
					log.Printf("index sync failed: %v", err)
				} else if err := appStore.StoreChainEvents(result.Events, result.ToBlock, ""); err != nil {
					log.Printf("store synced events: %v", err)
				} else {
					log.Printf("indexed %d events from block %d to %d", result.IndexedCount, result.FromBlock, result.ToBlock)
				}
			}
		}
	}

	log.Printf("mealvoting backend listening on %s", cfg.HTTPAddress)
	if err := http.ListenAndServe(cfg.HTTPAddress, server.Routes()); err != nil {
		log.Fatalf("listen: %v", err)
	}
}
```

- [ ] **Step 2: Build and confirm**

```bash
cd backend && go build ./...
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/main.go
git commit -m "refactor: update main.go to wire repository → services → server"
```

---

## Task 8: Update handlers test and clean up old store

**Files:**
- Modify: `backend/handlers/handlers_test.go`
- Delete: `backend/internal/store/sqlite.go`
- Delete: `backend/internal/store/store.go`
- Modify: `backend/internal/store/sqlite_test.go`

- [ ] **Step 1: Update `handlers_test.go` to use `repository` package**

Replace the import and `newTestServerWithConfig` function:

```go
package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"mealvoting/backend/blockchain"
	"mealvoting/backend/config"
	"mealvoting/backend/internal/models"
	"mealvoting/backend/repository"
)

func newTestServer(t *testing.T) http.Handler {
	return newTestServerWithConfig(t, config.Config{})
}

func newTestServerWithConfig(t *testing.T, cfg config.Config) http.Handler {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "mealvote-handlers-test.db")
	appStore, err := repository.NewSQLiteStore(dbPath, models.ContractInfo{})
	if err != nil {
		t.Fatalf("create sqlite store: %v", err)
	}
	return NewServer(cfg, appStore, nil).Routes()
}
```
(Keep all other helper functions and test cases unchanged.)

- [ ] **Step 2: Update `sqlite_test.go` import path**

Run this to see what needs changing:
```bash
grep -n "internal/store\|store\.New\|store\.Store" backend/internal/store/sqlite_test.go
```

In `backend/internal/store/sqlite_test.go`:
1. Change `package store` → `package repository_test` (or move the file to `backend/repository/sqlite_test.go`)
2. Change import `"mealvoting/backend/internal/store"` → `"mealvoting/backend/repository"`
3. Replace all `store.NewSQLiteStore` → `repository.NewSQLiteStore`
4. Replace all `store.Store` → `repository.Store`
5. Move file to `backend/repository/sqlite_test.go` and delete `backend/internal/store/sqlite_test.go`

- [ ] **Step 3: Run all tests**

```bash
cd backend && go test ./...
```
Expected: all tests PASS.

- [ ] **Step 4: Delete old store files**

```bash
rm backend/internal/store/sqlite.go
rm backend/internal/store/store.go
```

- [ ] **Step 5: Verify everything still compiles and tests pass**

```bash
cd backend && go build ./... && go test ./...
```
Expected: no errors, all tests pass.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "refactor: remove old internal/store, all logic now in repository + service layers"
```

---

## Verification Checklist

After all tasks complete, confirm:

- [ ] `cd backend && go build ./...` — no errors
- [ ] `cd backend && go test ./...` — all tests pass
- [ ] `grep -r "internal/store" backend/` returns only the `sqlite_test.go` path (or nothing after migration)
- [ ] `grep -r "bcrypt\|hashPassword\|verifyPassword" backend/repository/` returns nothing
- [ ] `grep -r "isCurrentProposalDay\|token_balance\|winnerProposer" backend/handlers/` returns nothing
- [ ] `grep -r "store.Store\|NewSQLiteStore" backend/handlers/` returns nothing
