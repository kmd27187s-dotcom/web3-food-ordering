package service_test

import (
	"testing"
	"time"

	"mealvoting/backend/internal/models"
	"mealvoting/backend/repository"
	"mealvoting/backend/service"
)

type mockOrderProposalRepo struct {
	proposal *models.Proposal
}

func (m *mockOrderProposalRepo) CreateProposal(memberID int64, title, description, merchantGroup, mealPeriod, proposalDate string, maxOptions int64, createdByName string, proposalDeadline, voteDeadline, orderDeadline time.Time) (*models.Proposal, error) {
	return nil, nil
}

func (m *mockOrderProposalRepo) CreateProposalWithCredit(memberID int64, title, description, merchantGroup, mealPeriod, proposalDate string, maxOptions int64, createdByName string, proposalDeadline, voteDeadline, orderDeadline time.Time) (*models.Proposal, error) {
	return nil, nil
}

func (m *mockOrderProposalRepo) ListProposals() []*models.Proposal { return nil }

func (m *mockOrderProposalRepo) GetProposal(id int64) (*models.Proposal, error) {
	return m.proposal, nil
}

func (m *mockOrderProposalRepo) InsertProposalOption(proposalID, memberID int64, merchantID, merchantName, proposerName string, tokenCost int64) (*models.ProposalOption, error) {
	return nil, nil
}

func (m *mockOrderProposalRepo) RecordVote(proposalID, memberID, optionID int64, tokenAmount int64, memberDisplayName string) error {
	return nil
}

func (m *mockOrderProposalRepo) ApplySettlementRewards(proposalID int64, rewards []repository.MemberReward, optionRefunds []repository.OptionRefund) error {
	return nil
}

type mockOrderMerchantRepo struct {
	merchant *models.Merchant
}

func (m *mockOrderMerchantRepo) GetMerchant(id string) (*models.Merchant, error) {
	return m.merchant, nil
}

func (m *mockOrderMerchantRepo) ListMerchants() ([]*models.Merchant, error) {
	if m.merchant == nil {
		return []*models.Merchant{}, nil
	}
	return []*models.Merchant{m.merchant}, nil
}

func (m *mockOrderMerchantRepo) UpsertMerchant(merchant *models.Merchant) (*models.Merchant, error) {
	if merchant != nil {
		m.merchant = merchant
	}
	return merchant, nil
}

func (m *mockOrderMerchantRepo) UpsertMenuItem(merchantID string, item *models.MenuItem) error {
	if m.merchant == nil {
		m.merchant = &models.Merchant{ID: merchantID}
	}
	if m.merchant.ID == "" {
		m.merchant.ID = merchantID
	}
	if item != nil {
		m.merchant.Menu = append(m.merchant.Menu, item)
	}
	return nil
}

type mockOrderRepo struct{}

func (m *mockOrderRepo) SaveOrder(proposalID, memberID int64, quote *models.OrderQuote, sig *models.OrderSignature, memberDisplayName string) (*models.Order, error) {
	return &models.Order{
		ID:         1,
		ProposalID: proposalID,
		MemberID:   memberID,
		MerchantID: quote.MerchantID,
		OrderHash:  sig.OrderHash,
		AmountWei:  sig.AmountWei,
		Status:     "paid_local",
		Items:      quote.Items,
		Signature:  sig,
	}, nil
}

func TestQuoteRejectsWinningMerchantWithoutMenu(t *testing.T) {
	proposal := &models.Proposal{
		ID:             1,
		Status:         "ordering",
		ProposalDate:   time.Now().In(time.Local).Format("2006-01-02"),
		WinnerOptionID: 11,
		Options: []*models.ProposalOption{
			{ID: 11, MerchantID: "shop-empty", MerchantName: "空菜單店家"},
		},
	}

	svc := service.NewOrderService(
		&mockOrderRepo{},
		&mockOrderProposalRepo{proposal: proposal},
		&mockOrderMerchantRepo{merchant: &models.Merchant{
			ID:   "shop-empty",
			Name: "空菜單店家",
			Menu: []*models.MenuItem{},
		}},
		nil,
		nil,
	)

	_, err := svc.Quote(1, 1, map[string]int64{"item-a": 1})
	if err == nil {
		t.Fatal("expected quote to fail when winning merchant has no menu")
	}
	if err.Error() != "winning merchant has no menu; ordering is unavailable" {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestSignAllowsLocalProposalWithoutChainMapping(t *testing.T) {
	proposal := &models.Proposal{
		ID:             7,
		Status:         "ordering",
		ProposalDate:   time.Now().In(time.Local).Format("2006-01-02"),
		WinnerOptionID: 11,
		Options: []*models.ProposalOption{
			{ID: 11, MerchantID: "shop-hotpot", MerchantName: "火鍋店"},
		},
	}

	svc := service.NewOrderService(
		&mockOrderRepo{},
		&mockOrderProposalRepo{proposal: proposal},
		&mockOrderMerchantRepo{merchant: &models.Merchant{
			ID:   "shop-hotpot",
			Name: "火鍋店",
			Menu: []*models.MenuItem{
				{ID: "hotpot-set", Name: "火鍋套餐", PriceWei: 4200000000000000},
			},
		}},
		newMockMemberRepo(),
		nil,
	)

	quote, sig, order, err := svc.Sign(7, 3, map[string]int64{"hotpot-set": 1}, "")
	if err != nil {
		t.Fatalf("expected local sign flow to succeed: %v", err)
	}
	if quote == nil || sig == nil || order == nil {
		t.Fatal("expected local sign flow to return quote, signature, and order")
	}
	if sig.OrderHash == "" {
		t.Fatal("expected local sign flow to generate an order hash")
	}
	if sig.AmountWei != quote.SubtotalWei {
		t.Fatalf("expected local amount %s to match quote subtotal %s", sig.AmountWei, quote.SubtotalWei)
	}
	if order.Status != "paid_local" {
		t.Fatalf("expected local order status paid_local, got %s", order.Status)
	}
}
