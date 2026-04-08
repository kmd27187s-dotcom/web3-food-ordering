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

func (m *mockOrderProposalRepo) CreateProposal(memberID int64, title, description, merchantGroup, mealPeriod, proposalDate string, maxOptions int64, createdByName string, proposalDeadline, voteDeadline, orderDeadline time.Time, params *models.GovernanceParams) (*models.Proposal, error) {
	return nil, nil
}

func (m *mockOrderProposalRepo) CreateProposalWithCredit(memberID int64, title, description, merchantGroup, mealPeriod, proposalDate string, maxOptions int64, createdByName string, proposalDeadline, voteDeadline, orderDeadline time.Time, params *models.GovernanceParams, useTicket bool) (*models.Proposal, error) {
	return nil, nil
}

func (m *mockOrderProposalRepo) DeleteProposalByCreator(proposalID, memberID int64) error { return nil }
func (m *mockOrderProposalRepo) ListProposals() []*models.Proposal { return nil }

func (m *mockOrderProposalRepo) GetProposal(id int64) (*models.Proposal, error) {
	return m.proposal, nil
}

func (m *mockOrderProposalRepo) InsertProposalOption(proposalID, memberID int64, merchantID, merchantName, proposerName string, tokenCost int64, useTicket bool) (*models.ProposalOption, error) {
	return nil, nil
}

func (m *mockOrderProposalRepo) RecordVote(proposalID, memberID, optionID int64, voteCount, feeAmountWei int64, memberDisplayName string, useTicket bool) error {
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
func (m *mockOrderMerchantRepo) ApplyScheduledMenuChangeRequests(now time.Time) error { return nil }
func (m *mockOrderMerchantRepo) GetMerchantDetail(id string) (*models.MerchantDetail, error) {
	return nil, nil
}
func (m *mockOrderMerchantRepo) GetMerchantByOwner(memberID int64, wallet string) (*models.Merchant, error) {
	return nil, nil
}
func (m *mockOrderMerchantRepo) ListMerchantReviews(merchantID string) ([]*models.MerchantReview, error) {
	return []*models.MerchantReview{}, nil
}
func (m *mockOrderMerchantRepo) CreateMerchantReview(review *models.MerchantReview) (*models.MerchantReview, error) {
	return review, nil
}
func (m *mockOrderMerchantRepo) ClaimMerchant(merchantID string, memberID int64, displayName, wallet string) (*models.Merchant, error) {
	return nil, nil
}
func (m *mockOrderMerchantRepo) UpsertOwnedMerchantProfile(memberID int64, displayName, wallet string, merchant *models.Merchant) (*models.Merchant, error) {
	return merchant, nil
}
func (m *mockOrderMerchantRepo) UpdateOwnedMerchantWallet(memberID int64, wallet string) (*models.Merchant, error) {
	return m.merchant, nil
}
func (m *mockOrderMerchantRepo) UnlinkOwnedMerchant(memberID int64) error { return nil }
func (m *mockOrderMerchantRepo) RequestMerchantDelist(memberID int64) (*models.Merchant, error) {
	return m.merchant, nil
}
func (m *mockOrderMerchantRepo) ListMerchantDelistRequests(pendingOnly bool) ([]*models.MerchantDelistRequest, error) {
	return []*models.MerchantDelistRequest{}, nil
}
func (m *mockOrderMerchantRepo) ReviewMerchantDelist(merchantID string, approve bool) (*models.Merchant, error) {
	return m.merchant, nil
}
func (m *mockOrderMerchantRepo) CreateMenuChangeRequest(req *models.MenuChangeRequest) (*models.MenuChangeRequest, error) {
	return req, nil
}
func (m *mockOrderMerchantRepo) ListMenuChangeRequests(merchantID string, status string) ([]*models.MenuChangeRequest, error) {
	return []*models.MenuChangeRequest{}, nil
}
func (m *mockOrderMerchantRepo) WithdrawMenuChangeRequest(requestID, requesterMemberID int64) (*models.MenuChangeRequest, error) {
	return nil, nil
}
func (m *mockOrderMerchantRepo) ReviewMenuChangeRequest(requestID, reviewerMemberID int64, reviewerName string, approved bool, reviewNote string, effectiveAt time.Time) (*models.MenuChangeRequest, error) {
	return nil, nil
}
func (m *mockOrderMerchantRepo) CancelMerchantDelist(memberID int64) (*models.Merchant, error) {
	return m.merchant, nil
}
func (m *mockOrderMerchantRepo) ListMerchantOrders(merchantID string) ([]*models.Order, error) {
	return []*models.Order{}, nil
}

type mockOrderRepo struct{}

func (m *mockOrderRepo) SaveOrder(proposalID, memberID int64, quote *models.OrderQuote, sig *models.OrderSignature, memberDisplayName string, escrowOrderID *int64) (*models.Order, error) {
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
func (m *mockOrderRepo) UpdateOrderStatus(orderID int64, merchantID, status string) (*models.Order, error) {
	return &models.Order{ID: orderID, MerchantID: merchantID, Status: status}, nil
}
func (m *mockOrderRepo) UpdateMemberOrderStatus(orderID, memberID int64, status string) (*models.Order, error) {
	return &models.Order{ID: orderID, MemberID: memberID, Status: status}, nil
}
func (m *mockOrderRepo) UpdateAdminOrderStatus(orderID int64, status string) (*models.Order, error) {
	return &models.Order{ID: orderID, Status: status}, nil
}
func (m *mockOrderRepo) UpdateAdminOrderStatuses(orderIDs []int64, status string) ([]*models.Order, error) {
	orders := make([]*models.Order, 0, len(orderIDs))
	for _, orderID := range orderIDs {
		orders = append(orders, &models.Order{ID: orderID, Status: status})
	}
	return orders, nil
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

	quote, sig, err := svc.Sign(7, 3, map[string]int64{"hotpot-set": 1}, "")
	if err != nil {
		t.Fatalf("expected local sign flow to succeed: %v", err)
	}
	if quote == nil || sig == nil {
		t.Fatal("expected local sign flow to return quote and signature")
	}
	if sig.OrderHash == "" {
		t.Fatal("expected local sign flow to generate an order hash")
	}
	if sig.AmountWei != quote.SubtotalWei {
		t.Fatalf("expected local amount %s to match quote subtotal %s", sig.AmountWei, quote.SubtotalWei)
	}
}
