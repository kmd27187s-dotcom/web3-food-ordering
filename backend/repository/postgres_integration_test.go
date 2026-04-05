package repository

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"mealvoting/backend/config"
	"mealvoting/backend/internal/models"

	gormpostgres "gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func testPostgresDSN(t *testing.T) string {
	t.Helper()
	dsn := strings.TrimSpace(os.Getenv("TEST_POSTGRES_DSN"))
	if dsn == "" {
		t.Skip("set TEST_POSTGRES_DSN to run Postgres integration tests")
	}
	return dsn
}

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

func newTestPostgresStore(t *testing.T) *PostgresStore {
	t.Helper()

	baseDSN := testPostgresDSN(t)
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
	store, err := NewPostgresStore(cfg, models.ContractInfo{})
	if err != nil {
		t.Fatalf("create postgres store: %v", err)
	}

	t.Cleanup(func() {
		if sqlDB, err := store.db.DB(); err == nil {
			_ = sqlDB.Close()
		}
		_ = rootDB.Exec(`DROP SCHEMA IF EXISTS "` + schema + `" CASCADE`).Error
		if sqlDB, err := rootDB.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return store
}

func mustPostgresPayloadJSON(t *testing.T, payload map[string]any) string {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload json: %v", err)
	}
	return string(body)
}

func TestPostgresStoreMemberAndGroupFlow(t *testing.T) {
	s := newTestPostgresStore(t)

	aliceID, err := s.CreateMember("alice@example.com", "", "Alice", false, 300, "https://example.com/alice.png")
	if err != nil {
		t.Fatalf("create alice: %v", err)
	}
	bobID, err := s.CreateMember("bob@example.com", "", "Bob", false, 200, "https://example.com/bob.png")
	if err != nil {
		t.Fatalf("create bob: %v", err)
	}

	alice, err := s.MemberByID(aliceID)
	if err != nil {
		t.Fatalf("reload alice: %v", err)
	}
	if alice.RegistrationInviteCode == "" {
		t.Fatal("expected deterministic registration invite code")
	}

	group, err := s.CreateGroup(aliceID, "Postgres 整合群組", "")
	if err != nil {
		t.Fatalf("create group: %v", err)
	}
	invite, err := s.CreateInvite(group.ID, aliceID, "group-1")
	if err != nil {
		t.Fatalf("create invite: %v", err)
	}
	if invite.InviteCode != "group-1" {
		t.Fatalf("expected stable invite code group-1, got %s", invite.InviteCode)
	}
	if err := s.AddMember(group.ID, bobID); err != nil {
		t.Fatalf("add bob to group: %v", err)
	}

	memberGroups, err := s.ListMemberGroups(bobID)
	if err != nil {
		t.Fatalf("list bob groups: %v", err)
	}
	if len(memberGroups) != 1 || memberGroups[0].ID != group.ID {
		t.Fatalf("expected bob to belong to group %d, got %+v", group.ID, memberGroups)
	}

	hasClaimed, err := s.HasClaimed(aliceID)
	if err != nil {
		t.Fatalf("check faucet claimed before claim: %v", err)
	}
	if hasClaimed {
		t.Fatal("expected alice to be unclaimed before faucet claim")
	}
	newBalance, err := s.ClaimFaucet(aliceID, "0x0000000000000000000000000000000000000A11")
	if err != nil {
		t.Fatalf("claim faucet: %v", err)
	}
	if newBalance != 400 {
		t.Fatalf("expected faucet to bring balance to 400, got %d", newBalance)
	}
	hasClaimed, err = s.HasClaimed(aliceID)
	if err != nil {
		t.Fatalf("check faucet claimed after claim: %v", err)
	}
	if !hasClaimed {
		t.Fatal("expected alice to be marked claimed after faucet claim")
	}
}

func TestPostgresStoreProjectsChainEventsAndConfirmsPendingTransactions(t *testing.T) {
	s := newTestPostgresStore(t)

	aliceID, err := s.CreateMember("alice@example.com", "", "Alice", false, 300, "https://example.com/alice.png")
	if err != nil {
		t.Fatalf("create alice: %v", err)
	}
	if err := s.UpdateMemberWallet(aliceID, "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"); err != nil {
		t.Fatalf("link alice wallet: %v", err)
	}

	if _, err := s.RegisterPendingTransaction(aliceID, 0, "create_proposal", "0xproposalcreate", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", ""); err != nil {
		t.Fatalf("register pending proposal tx: %v", err)
	}

	now := time.Now().UTC()
	err = s.StoreChainEvents([]*models.ChainEvent{
		{
			BlockNumber: 88,
			BlockHash:   "0xblockproposal",
			TxHash:      "0xproposalcreate",
			LogIndex:    0,
			EventName:   "ProposalCreated",
			ProposalID:  42,
			PayloadJSON: mustPostgresPayloadJSON(t, map[string]any{
				"creator":          "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
				"proposalDeadline": now.Add(-90 * time.Minute).Unix(),
				"voteDeadline":     now.Add(-60 * time.Minute).Unix(),
				"orderDeadline":    now.Add(30 * time.Minute).Unix(),
			}),
		},
		{
			BlockNumber: 88,
			BlockHash:   "0xblockoption",
			TxHash:      "0xoptioncreate",
			LogIndex:    1,
			EventName:   "OptionAdded",
			ProposalID:  42,
			PayloadJSON: mustPostgresPayloadJSON(t, map[string]any{
				"optionIndex": 0,
				"merchantId":  "shop-hotpot",
				"proposer":    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
				"cost":        1,
			}),
		},
		{
			BlockNumber: 88,
			BlockHash:   "0xblockvote",
			TxHash:      "0xvotecreate",
			LogIndex:    2,
			EventName:   "Voted",
			ProposalID:  42,
			PayloadJSON: mustPostgresPayloadJSON(t, map[string]any{
				"optionIndex": 0,
				"voter":       "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
				"merchantId":  "shop-hotpot",
				"tokenAmount": 3,
				"weight":      3,
			}),
		},
	}, 88, "")
	if err != nil {
		t.Fatalf("store chain events: %v", err)
	}

	pending, err := s.GetPendingTransaction(aliceID, "0xproposalcreate")
	if err != nil {
		t.Fatalf("reload pending tx: %v", err)
	}
	if pending.Status != "confirmed" || pending.RelatedEvent != "ProposalCreated" {
		t.Fatalf("expected confirmed ProposalCreated pending tx, got %+v", pending)
	}

	proposals := s.ListProposals()
	if len(proposals) != 1 {
		t.Fatalf("expected one imported proposal, got %d", len(proposals))
	}
	proposal := proposals[0]
	if proposal.ChainProposalID == nil || *proposal.ChainProposalID != 42 {
		t.Fatalf("expected chain proposal id 42, got %v", proposal.ChainProposalID)
	}
	if len(proposal.Options) != 1 {
		t.Fatalf("expected one imported option, got %d", len(proposal.Options))
	}
	if proposal.Options[0].ChainOptionIndex == nil || *proposal.Options[0].ChainOptionIndex != 0 {
		t.Fatalf("expected chain option index 0, got %v", proposal.Options[0].ChainOptionIndex)
	}
	if proposal.Options[0].WeightedVotes != 3 {
		t.Fatalf("expected weighted votes 3, got %d", proposal.Options[0].WeightedVotes)
	}
	if len(proposal.Votes) != 1 || proposal.Votes[0].TokenAmount != 3 {
		t.Fatalf("expected one imported vote with tokenAmount 3, got %+v", proposal.Votes)
	}
}
