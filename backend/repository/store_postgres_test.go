package repository

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"mealvoting/backend/internal/models"

	"gorm.io/gorm"
)

func memberIDByEmailPG(t *testing.T, s *PostgresStore, email string) int64 {
	t.Helper()
	m, err := s.MemberByEmail(email)
	if err != nil {
		t.Fatalf("lookup member id for %s: %v", email, err)
	}
	return m.ID
}

func localProposalIDByChainPG(t *testing.T, s *PostgresStore, chainProposalID int64) int64 {
	t.Helper()
	var localProposalID int64
	if err := s.db.Raw(`SELECT local_proposal_id FROM proposal_chain_map WHERE chain_proposal_id = ?`, chainProposalID).Scan(&localProposalID).Error; err != nil {
		t.Fatalf("lookup local proposal id for chain proposal %d: %v", chainProposalID, err)
	}
	if localProposalID == 0 {
		t.Fatalf("missing proposal_chain_map row for chain proposal %d", chainProposalID)
	}
	return localProposalID
}

func mustPayloadJSONPG(t *testing.T, payload map[string]any) string {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload json: %v", err)
	}
	return string(body)
}

func TestCreateInviteReturnsStableInviteCodeForGroup(t *testing.T) {
	s := newTestPostgresStore(t)
	aliceID := memberIDByEmailPG(t, s, "alice@example.com")

	group, err := s.CreateGroup(aliceID, "固定邀請碼群組", "固定邀請碼群組")
	if err != nil {
		t.Fatalf("create group: %v", err)
	}

	first, err := s.CreateInvite(group.ID, aliceID, "group-1")
	if err != nil {
		t.Fatalf("create first invite: %v", err)
	}
	second, err := s.CreateInvite(group.ID, aliceID, "group-1")
	if err != nil {
		t.Fatalf("create second invite: %v", err)
	}

	if first.InviteCode != second.InviteCode {
		t.Fatalf("expected stable invite code, got %s and %s", first.InviteCode, second.InviteCode)
	}
	if first.ID != second.ID {
		t.Fatalf("expected invite record reuse, got ids %d and %d", first.ID, second.ID)
	}
}

func TestListMemberGroupsPrunesInactiveGroupsAfterThreeMonths(t *testing.T) {
	s := newTestPostgresStore(t)
	aliceID := memberIDByEmailPG(t, s, "alice@example.com")

	staleGroup, err := s.CreateGroup(aliceID, "過期群組", "超過三個月無活動")
	if err != nil {
		t.Fatalf("create stale group: %v", err)
	}
	activeGroup, err := s.CreateGroup(aliceID, "活躍群組", "近期仍有活動")
	if err != nil {
		t.Fatalf("create active group: %v", err)
	}

	staleCreatedAt := time.Now().UTC().AddDate(0, -4, 0)
	activeCreatedAt := time.Now().UTC().AddDate(0, -1, 0)
	if err := s.db.WithContext(context.Background()).Exec(`UPDATE groups SET created_at = ? WHERE id = ?`, staleCreatedAt, staleGroup.ID).Error; err != nil {
		t.Fatalf("age stale group: %v", err)
	}
	if err := s.db.WithContext(context.Background()).Exec(`UPDATE groups SET created_at = ? WHERE id = ?`, activeCreatedAt, activeGroup.ID).Error; err != nil {
		t.Fatalf("age active group: %v", err)
	}

	groups, err := s.ListMemberGroups(aliceID)
	if err != nil {
		t.Fatalf("list member groups: %v", err)
	}

	if len(groups) != 1 {
		t.Fatalf("expected only one active group after pruning, got %d", len(groups))
	}
	if groups[0].ID != activeGroup.ID {
		t.Fatalf("expected active group %d to remain, got %d", activeGroup.ID, groups[0].ID)
	}

	if _, err := s.GetGroup(staleGroup.ID); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected stale group to be deleted, got %v", err)
	}
}

func TestStoreChainEventsImportsProposalAndConfirmsPendingCreateProposal(t *testing.T) {
	s := newTestPostgresStore(t)

	aliceID := memberIDByEmailPG(t, s, "alice@example.com")
	_, err := s.RegisterPendingTransaction(aliceID, 0, "create_proposal", "0xproposalcreate", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "")
	if err != nil {
		t.Fatalf("register pending create_proposal transaction: %v", err)
	}

	now := time.Now().UTC()
	err = s.StoreChainEvents([]*models.ChainEvent{
		{
			BlockNumber: 77,
			BlockHash:   "0xblockproposal",
			TxHash:      "0xproposalcreate",
			LogIndex:    0,
			EventName:   "ProposalCreated",
			ProposalID:  42,
			PayloadJSON: mustPayloadJSONPG(t, map[string]any{
				"creator":          "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
				"proposalDeadline": now.Add(30 * time.Minute).Unix(),
				"voteDeadline":     now.Add(60 * time.Minute).Unix(),
				"orderDeadline":    now.Add(90 * time.Minute).Unix(),
			}),
		},
	}, 77, "")
	if err != nil {
		t.Fatalf("store chain proposal event: %v", err)
	}

	pending, err := s.GetPendingTransaction(aliceID, "0xproposalcreate")
	if err != nil {
		t.Fatalf("reload pending create_proposal transaction: %v", err)
	}
	if pending.Status != "confirmed" {
		t.Fatalf("expected pending create_proposal transaction to be confirmed, got %s", pending.Status)
	}
	if pending.RelatedEvent != "ProposalCreated" {
		t.Fatalf("expected related event ProposalCreated, got %s", pending.RelatedEvent)
	}
	if pending.ConfirmedBlock != 77 {
		t.Fatalf("expected confirmed block 77, got %d", pending.ConfirmedBlock)
	}

	localProposalID := localProposalIDByChainPG(t, s, 42)
	proposal, err := s.GetProposal(localProposalID)
	if err != nil {
		t.Fatalf("load imported proposal: %v", err)
	}
	if proposal.ChainProposalID == nil || *proposal.ChainProposalID != 42 {
		t.Fatalf("expected imported proposal to carry chain proposal id 42, got %v", proposal.ChainProposalID)
	}
	if proposal.CreatedBy != aliceID {
		t.Fatalf("expected imported proposal creator to map to alice id %d, got %d", aliceID, proposal.CreatedBy)
	}
	if proposal.MerchantGroup != "chain-import" {
		t.Fatalf("expected imported proposal merchant group chain-import, got %s", proposal.MerchantGroup)
	}
}

func TestStoreChainEventsOrderPlacedConfirmsPendingTransactionAndProjectsOrder(t *testing.T) {
	s := newTestPostgresStore(t)

	aliceID := memberIDByEmailPG(t, s, "alice@example.com")
	now := time.Now().UTC()
	err := s.StoreChainEvents([]*models.ChainEvent{
		{
			BlockNumber: 100,
			BlockHash:   "0xblockseed",
			TxHash:      "0xseedproposal",
			LogIndex:    0,
			EventName:   "ProposalCreated",
			ProposalID:  7,
			PayloadJSON: mustPayloadJSONPG(t, map[string]any{
				"creator":          "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
				"proposalDeadline": now.Add(-90 * time.Minute).Unix(),
				"voteDeadline":     now.Add(-60 * time.Minute).Unix(),
				"orderDeadline":    now.Add(30 * time.Minute).Unix(),
			}),
		},
	}, 100, "")
	if err != nil {
		t.Fatalf("seed proposal chain mapping: %v", err)
	}

	localProposalID := localProposalIDByChainPG(t, s, 7)
	_, err = s.RegisterPendingTransaction(aliceID, localProposalID, "place_order", "0xorderplaced", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "0xorderhash")
	if err != nil {
		t.Fatalf("register pending place_order transaction: %v", err)
	}

	err = s.StoreChainEvents([]*models.ChainEvent{
		{
			BlockNumber: 101,
			BlockHash:   "0xblockorder",
			TxHash:      "0xorderplaced",
			LogIndex:    0,
			EventName:   "OrderPlaced",
			ProposalID:  7,
			PayloadJSON: mustPayloadJSONPG(t, map[string]any{
				"member":    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
				"orderHash": "0xorderhash",
				"amount":    "4200000000000000",
			}),
		},
	}, 101, "")
	if err != nil {
		t.Fatalf("store chain order placed event: %v", err)
	}

	pending, err := s.GetPendingTransaction(aliceID, "0xorderplaced")
	if err != nil {
		t.Fatalf("reload pending place_order transaction: %v", err)
	}
	if pending.Status != "confirmed" {
		t.Fatalf("expected pending place_order transaction to be confirmed, got %s", pending.Status)
	}
	if pending.RelatedEvent != "OrderPlaced" {
		t.Fatalf("expected related event OrderPlaced, got %s", pending.RelatedEvent)
	}
	if pending.ConfirmedBlock != 101 {
		t.Fatalf("expected confirmed block 101, got %d", pending.ConfirmedBlock)
	}

	proposal, err := s.GetProposal(localProposalID)
	if err != nil {
		t.Fatalf("load proposal after order placement: %v", err)
	}
	if len(proposal.Orders) != 1 {
		t.Fatalf("expected one projected order, got %d", len(proposal.Orders))
	}
	order := proposal.Orders[0]
	if order.OrderHash != "0xorderhash" {
		t.Fatalf("expected projected order hash 0xorderhash, got %s", order.OrderHash)
	}
	if order.Status != "paid_onchain" {
		t.Fatalf("expected projected order status paid_onchain, got %s", order.Status)
	}
	if order.AmountWei != "4200000000000000" {
		t.Fatalf("expected projected order amount 4200000000000000, got %s", order.AmountWei)
	}
}

func TestChainProposalDoesNotAutoFinalizeWinnerWithoutVoteFinalizedEvent(t *testing.T) {
	s := newTestPostgresStore(t)

	now := time.Now().UTC()
	err := s.StoreChainEvents([]*models.ChainEvent{
		{
			BlockNumber: 88,
			BlockHash:   "0xblockproposal88",
			TxHash:      "0xproposal88",
			LogIndex:    0,
			EventName:   "ProposalCreated",
			ProposalID:  88,
			PayloadJSON: mustPayloadJSONPG(t, map[string]any{
				"creator":          "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
				"proposalDeadline": now.Add(-90 * time.Minute).Unix(),
				"voteDeadline":     now.Add(-60 * time.Minute).Unix(),
				"orderDeadline":    now.Add(30 * time.Minute).Unix(),
			}),
		},
		{
			BlockNumber: 88,
			BlockHash:   "0xblockoption88",
			TxHash:      "0xoption88",
			LogIndex:    1,
			EventName:   "OptionAdded",
			ProposalID:  88,
			PayloadJSON: mustPayloadJSONPG(t, map[string]any{
				"optionIndex": 0,
				"merchantId":  "shop-hotpot",
				"proposer":    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
				"cost":        10,
			}),
		},
	}, 88, "")
	if err != nil {
		t.Fatalf("seed chain proposal without finalization: %v", err)
	}

	localProposalID := localProposalIDByChainPG(t, s, 88)
	proposal, err := s.GetProposal(localProposalID)
	if err != nil {
		t.Fatalf("load chain proposal without finalization: %v", err)
	}
	if proposal.WinnerOptionID != 0 {
		t.Fatalf("expected chain proposal winner to remain unset before VoteFinalized event, got %d", proposal.WinnerOptionID)
	}
	if proposal.Status != "awaiting_finalization" {
		t.Fatalf("expected chain proposal status awaiting_finalization before VoteFinalized event, got %s", proposal.Status)
	}
}

func TestAdvanceProposalStageStoresRFC3339Timestamps(t *testing.T) {
	s := newTestPostgresStore(t)

	aliceID := memberIDByEmailPG(t, s, "alice@example.com")
	now := time.Now().UTC()
	proposal, err := s.CreateProposal(
		aliceID,
		"Advance stage",
		"",
		"all",
		"dinner",
		now.In(time.Local).Format("2006-01-02"),
		5,
		"Alice",
		now.Add(15*time.Minute),
		now.Add(45*time.Minute),
		now.Add(75*time.Minute),
	)
	if err != nil {
		t.Fatalf("create proposal: %v", err)
	}

	if err := s.AdvanceProposalStage(proposal.ID, "voting"); err != nil {
		t.Fatalf("advance proposal stage: %v", err)
	}

	var storedDeadline time.Time
	if err := s.db.Raw(`SELECT proposal_deadline FROM proposals WHERE id = ?`, proposal.ID).Scan(&storedDeadline).Error; err != nil {
		t.Fatalf("read updated proposal deadline: %v", err)
	}
	if storedDeadline.IsZero() {
		t.Fatal("expected non-zero proposal deadline after advance stage")
	}
}

func TestLocalProposalAwaitingSettlementIncludesRoundOrderTotals(t *testing.T) {
	s := newTestPostgresStore(t)

	aliceID := memberIDByEmailPG(t, s, "alice@example.com")
	now := time.Now().UTC()
	proposal, err := s.CreateProposal(
		aliceID,
		"午餐結算測試",
		"",
		"all",
		"lunch",
		now.In(time.Local).Format("2006-01-02"),
		5,
		"Alice",
		now.Add(-90*time.Minute),
		now.Add(-60*time.Minute),
		now.Add(-10*time.Minute),
	)
	if err != nil {
		t.Fatalf("create proposal: %v", err)
	}
	option, err := s.InsertProposalOption(proposal.ID, aliceID, "shop-hotpot", "湯潮火鍋", "Alice", 0, false)
	if err != nil {
		t.Fatalf("insert option: %v", err)
	}
	if err := s.db.WithContext(context.Background()).Exec(`UPDATE proposals SET winner_option_id = ? WHERE id = ?`, option.ID, proposal.ID).Error; err != nil {
		t.Fatalf("set winner option: %v", err)
	}
	if _, err := s.SaveOrder(proposal.ID, aliceID, &models.OrderQuote{
		ProposalID:   proposal.ID,
		MerchantID:   "shop-hotpot",
		MerchantName: "湯潮火鍋",
		Items: []*models.OrderItem{
			{MenuItemID: "hotpot-set", Name: "火鍋套餐", Quantity: 1, PriceWei: 4200000000000000},
		},
		SubtotalWei: "4200000000000000",
	}, &models.OrderSignature{
		OrderHash: "local-order-a",
		AmountWei: "4200000000000000",
	}, "Alice"); err != nil {
		t.Fatalf("save first order: %v", err)
	}
	if _, err := s.SaveOrder(proposal.ID, aliceID, &models.OrderQuote{
		ProposalID:   proposal.ID,
		MerchantID:   "shop-hotpot",
		MerchantName: "湯潮火鍋",
		Items: []*models.OrderItem{
			{MenuItemID: "fish-ball", Name: "魚餃", Quantity: 1, PriceWei: 900000000000000},
		},
		SubtotalWei: "900000000000000",
	}, &models.OrderSignature{
		OrderHash: "local-order-b",
		AmountWei: "900000000000000",
	}, "Alice"); err != nil {
		t.Fatalf("save second order: %v", err)
	}

	reloaded, err := s.GetProposal(proposal.ID)
	if err != nil {
		t.Fatalf("reload proposal: %v", err)
	}
	if reloaded.Status != "settled" {
		t.Fatalf("expected settled after automatic settlement, got %s", reloaded.Status)
	}
	if reloaded.OrderTotalWei != "5100000000000000" {
		t.Fatalf("expected order total 5100000000000000, got %s", reloaded.OrderTotalWei)
	}
	if reloaded.OrderMemberCount != 2 {
		t.Fatalf("expected counted orders 2, got %d", reloaded.OrderMemberCount)
	}
}

func TestLocalProposalAutoSettlesAfterOrderingDeadline(t *testing.T) {
	s := newTestPostgresStore(t)

	aliceID := memberIDByEmailPG(t, s, "alice@example.com")
	bobID := memberIDByEmailPG(t, s, "bob@example.com")
	now := time.Now().UTC()
	proposal, err := s.CreateProposal(
		aliceID,
		"自動結算測試",
		"",
		"all",
		"dinner",
		now.In(time.Local).Format("2006-01-02"),
		5,
		"Alice",
		now.Add(-3*time.Hour),
		now.Add(-2*time.Hour),
		now.Add(-90*time.Minute),
	)
	if err != nil {
		t.Fatalf("create proposal: %v", err)
	}
	option, err := s.InsertProposalOption(proposal.ID, aliceID, "shop-hotpot", "湯潮火鍋", "Alice", 0, false)
	if err != nil {
		t.Fatalf("insert option: %v", err)
	}
	if err := s.RecordVote(proposal.ID, bobID, option.ID, 3, "Bob", false); err != nil {
		t.Fatalf("record vote: %v", err)
	}
	if err := s.db.WithContext(context.Background()).Exec(`UPDATE proposals SET winner_option_id = ? WHERE id = ?`, option.ID, proposal.ID).Error; err != nil {
		t.Fatalf("set winner option: %v", err)
	}

	reloaded, err := s.GetProposal(proposal.ID)
	if err != nil {
		t.Fatalf("reload proposal: %v", err)
	}
	if !reloaded.RewardsApplied {
		t.Fatal("expected rewards to be auto-applied after order deadline")
	}
	if reloaded.Status != "settled" {
		t.Fatalf("expected settled after auto settlement, got %s", reloaded.Status)
	}

	alice, err := s.MemberByID(aliceID)
	if err != nil {
		t.Fatalf("reload alice: %v", err)
	}
	if alice.Points < 120 {
		t.Fatalf("expected winner proposer points to be applied, got %d", alice.Points)
	}
	bob, err := s.MemberByID(bobID)
	if err != nil {
		t.Fatalf("reload bob: %v", err)
	}
	if bob.TokenBalance >= 300 {
		t.Fatalf("expected bob token balance to reflect vote spending, got %d", bob.TokenBalance)
	}
}

func TestChainProposalStatusFollowsFinalizationAndSettlementEvents(t *testing.T) {
	s := newTestPostgresStore(t)

	now := time.Now().UTC()
	err := s.StoreChainEvents([]*models.ChainEvent{
		{
			BlockNumber: 90,
			BlockHash:   "0xblockproposal90",
			TxHash:      "0xproposal90",
			LogIndex:    0,
			EventName:   "ProposalCreated",
			ProposalID:  90,
			PayloadJSON: mustPayloadJSONPG(t, map[string]any{
				"creator":          "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
				"proposalDeadline": now.Add(-90 * time.Minute).Unix(),
				"voteDeadline":     now.Add(-60 * time.Minute).Unix(),
				"orderDeadline":    now.Add(30 * time.Minute).Unix(),
			}),
		},
		{
			BlockNumber: 90,
			BlockHash:   "0xblockoption90",
			TxHash:      "0xoption90",
			LogIndex:    1,
			EventName:   "OptionAdded",
			ProposalID:  90,
			PayloadJSON: mustPayloadJSONPG(t, map[string]any{
				"optionIndex": 0,
				"merchantId":  "shop-hotpot",
				"proposer":    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
				"cost":        10,
			}),
		},
	}, 90, "")
	if err != nil {
		t.Fatalf("seed chain proposal lifecycle: %v", err)
	}

	localProposalID := localProposalIDByChainPG(t, s, 90)
	proposal, err := s.GetProposal(localProposalID)
	if err != nil {
		t.Fatalf("load proposal before finalization: %v", err)
	}
	if proposal.Status != "awaiting_finalization" {
		t.Fatalf("expected awaiting_finalization before VoteFinalized, got %s", proposal.Status)
	}

	err = s.StoreChainEvents([]*models.ChainEvent{
		{
			BlockNumber: 91,
			BlockHash:   "0xblockfinalized90",
			TxHash:      "0xfinalized90",
			LogIndex:    0,
			EventName:   "VoteFinalized",
			ProposalID:  90,
			PayloadJSON: mustPayloadJSONPG(t, map[string]any{
				"winnerOptionIndex": 0,
				"merchantId":        "shop-hotpot",
				"weightedVotes":     11,
			}),
		},
	}, 91, "")
	if err != nil {
		t.Fatalf("store VoteFinalized lifecycle event: %v", err)
	}

	proposal, err = s.GetProposal(localProposalID)
	if err != nil {
		t.Fatalf("load proposal after finalization: %v", err)
	}
	if proposal.Status != "ordering" {
		t.Fatalf("expected ordering after VoteFinalized, got %s", proposal.Status)
	}

	if err := s.db.WithContext(context.Background()).Exec(`UPDATE proposals SET order_deadline = ? WHERE id = ?`,
		now.Add(-5*time.Minute).UTC(), localProposalID).Error; err != nil {
		t.Fatalf("expire chain proposal order window: %v", err)
	}
	proposal, err = s.GetProposal(localProposalID)
	if err != nil {
		t.Fatalf("load proposal after order deadline: %v", err)
	}
	if proposal.Status != "awaiting_settlement" {
		t.Fatalf("expected awaiting_settlement after order deadline, got %s", proposal.Status)
	}

	err = s.StoreChainEvents([]*models.ChainEvent{
		{
			BlockNumber: 92,
			BlockHash:   "0xblocksettled90",
			TxHash:      "0xsettled90",
			LogIndex:    0,
			EventName:   "ProposalSettled",
			ProposalID:  90,
			PayloadJSON: mustPayloadJSONPG(t, map[string]any{
				"nativeFee":         "0",
				"nativePayout":      "0",
				"treasuryTokenGain": "0",
			}),
		},
	}, 92, "")
	if err != nil {
		t.Fatalf("store ProposalSettled lifecycle event: %v", err)
	}

	proposal, err = s.GetProposal(localProposalID)
	if err != nil {
		t.Fatalf("load proposal after settlement: %v", err)
	}
	if proposal.Status != "settled" {
		t.Fatalf("expected settled after ProposalSettled event, got %s", proposal.Status)
	}
}
