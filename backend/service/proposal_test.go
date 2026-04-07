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

func (m *mockProposalRepo) CreateProposal(memberID int64, title, description, merchantGroup, mealPeriod, proposalDate string, maxOptions int64, createdByName string, proposalDeadline, voteDeadline, orderDeadline time.Time) (*models.Proposal, error) {
	id := m.nextID
	m.nextID++
	p := &models.Proposal{
		ID: id, Title: title, Description: description,
		MerchantGroup: merchantGroup, MealPeriod: mealPeriod, ProposalDate: proposalDate, MaxOptions: maxOptions, CreatedBy: memberID, CreatedByName: createdByName,
		ProposalDeadline: proposalDeadline, VoteDeadline: voteDeadline, OrderDeadline: orderDeadline,
		Status: "proposing", CreatedAt: time.Now().UTC(),
	}
	m.proposals[id] = p
	return p, nil
}

func (m *mockProposalRepo) CreateProposalWithCredit(memberID int64, title, description, merchantGroup, mealPeriod, proposalDate string, maxOptions int64, createdByName string, proposalDeadline, voteDeadline, orderDeadline time.Time, useTicket bool) (*models.Proposal, error) {
	return m.CreateProposal(memberID, title, description, merchantGroup, mealPeriod, proposalDate, maxOptions, createdByName, proposalDeadline, voteDeadline, orderDeadline)
}

func (m *mockProposalRepo) ListProposals() []*models.Proposal {
	var out []*models.Proposal
	for _, p := range m.proposals {
		out = append(out, p)
	}
	return out
}
func (m *mockProposalRepo) GetProposal(id int64) (*models.Proposal, error) {
	if p, ok := m.proposals[id]; ok {
		return p, nil
	}
	return nil, errors.New("proposal not found")
}
func (m *mockProposalRepo) DeleteProposalByCreator(proposalID, memberID int64) error {
	delete(m.proposals, proposalID)
	return nil
}
func (m *mockProposalRepo) InsertProposalOption(proposalID, memberID int64, merchantID, merchantName, proposerName string, tokenCost int64, useTicket bool) (*models.ProposalOption, error) {
	opt := &models.ProposalOption{ID: 1, MerchantID: merchantID, MerchantName: merchantName, ProposerMember: memberID, TokenStake: tokenCost}
	if p, ok := m.proposals[proposalID]; ok {
		p.Options = append(p.Options, opt)
	}
	return opt, nil
}
func (m *mockProposalRepo) RecordVote(proposalID, memberID, optionID, tokenAmount int64, displayName string, useTicket bool) error {
	return nil
}
func (m *mockProposalRepo) ApplySettlementRewards(proposalID int64, rewards []repository.MemberReward, optionRefunds []repository.OptionRefund) error {
	return nil
}

// mockMerchantRepo
type mockMerchantRepo struct{}

func (m *mockMerchantRepo) GetMerchant(id string) (*models.Merchant, error) {
	if id == "shop-bento" {
		return &models.Merchant{ID: "shop-bento", Name: "便當", Group: "taipei-xinyi"}, nil
	}
	return nil, errors.New("merchant not found")
}

func (m *mockMerchantRepo) ListMerchants() ([]*models.Merchant, error) {
	return []*models.Merchant{
		{ID: "shop-bento", Name: "便當", Group: "taipei-xinyi"},
	}, nil
}

func (m *mockMerchantRepo) UpsertMerchant(merchant *models.Merchant) (*models.Merchant, error) {
	return merchant, nil
}

func (m *mockMerchantRepo) UpsertMenuItem(_ string, _ *models.MenuItem) error {
	return nil
}
func (m *mockMerchantRepo) GetMerchantDetail(id string) (*models.MerchantDetail, error) {
	merchant, err := m.GetMerchant(id)
	if err != nil {
		return nil, err
	}
	return &models.MerchantDetail{Merchant: merchant, Reviews: []*models.MerchantReview{}}, nil
}
func (m *mockMerchantRepo) GetMerchantByOwner(memberID int64, wallet string) (*models.Merchant, error) {
	return nil, errors.New("merchant not found")
}
func (m *mockMerchantRepo) ListMerchantReviews(merchantID string) ([]*models.MerchantReview, error) {
	return []*models.MerchantReview{}, nil
}
func (m *mockMerchantRepo) CreateMerchantReview(review *models.MerchantReview) (*models.MerchantReview, error) {
	return review, nil
}
func (m *mockMerchantRepo) ClaimMerchant(merchantID string, memberID int64, displayName, wallet string) (*models.Merchant, error) {
	return nil, errors.New("not implemented")
}
func (m *mockMerchantRepo) UpsertOwnedMerchantProfile(memberID int64, displayName, wallet string, merchant *models.Merchant) (*models.Merchant, error) {
	return merchant, nil
}
func (m *mockMerchantRepo) UpdateOwnedMerchantWallet(memberID int64, wallet string) (*models.Merchant, error) {
	return nil, errors.New("not implemented")
}
func (m *mockMerchantRepo) UnlinkOwnedMerchant(memberID int64) error {
	return nil
}
func (m *mockMerchantRepo) RequestMerchantDelist(memberID int64) (*models.Merchant, error) {
	return nil, errors.New("not implemented")
}
func (m *mockMerchantRepo) ListMerchantDelistRequests(pendingOnly bool) ([]*models.MerchantDelistRequest, error) {
	return []*models.MerchantDelistRequest{}, nil
}
func (m *mockMerchantRepo) ReviewMerchantDelist(merchantID string, approve bool) (*models.Merchant, error) {
	return nil, errors.New("not implemented")
}
func (m *mockMerchantRepo) ListMerchantOrders(merchantID string) ([]*models.Order, error) {
	return []*models.Order{}, nil
}
func (m *mockMerchantRepo) CreateMenuChangeRequest(req *models.MenuChangeRequest) (*models.MenuChangeRequest, error) {
	return req, nil
}
func (m *mockMerchantRepo) ListMenuChangeRequests(merchantID string, status string) ([]*models.MenuChangeRequest, error) {
	return []*models.MenuChangeRequest{}, nil
}
func (m *mockMerchantRepo) WithdrawMenuChangeRequest(requestID, requesterMemberID int64) (*models.MenuChangeRequest, error) {
	return nil, errors.New("not implemented")
}
func (m *mockMerchantRepo) ReviewMenuChangeRequest(requestID, reviewerMemberID int64, reviewerName string, approved bool, reviewNote string, effectiveAt time.Time) (*models.MenuChangeRequest, error) {
	return nil, errors.New("not implemented")
}
func (m *mockMerchantRepo) ApplyScheduledMenuChangeRequests(now time.Time) error {
	return nil
}
func (m *mockMerchantRepo) CancelMerchantDelist(memberID int64) (*models.Merchant, error) {
	return nil, errors.New("not implemented")
}

func TestAddOption_InsufficientTokens(t *testing.T) {
	memberRepo := newMockMemberRepo()
	proposalRepo := newMockProposalRepo()
	merchantRepo := &mockMerchantRepo{}
	svc := service.NewProposalService(proposalRepo, memberRepo, merchantRepo)
	memberSvc := service.NewMemberService(memberRepo)

	member, _, err := memberSvc.Register("a@b.com", "pass", "Alice")
	if err != nil {
		t.Fatal(err)
	}
	// Force token balance to 0 to test insufficient token check
	member.TokenBalance = 0

	proposal, _ := proposalRepo.CreateProposal(member.ID, "Lunch", "", "all", "lunch", time.Now().In(time.Local).Format("2006-01-02"), 5, "Alice",
		time.Now().Add(time.Hour), time.Now().Add(2*time.Hour), time.Now().Add(3*time.Hour))

	_, err = svc.AddOption(proposal.ID, member.ID, "shop-bento", false)
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

	member, _, err := memberSvc.Register("a@b.com", "pass", "Alice")
	if err != nil {
		t.Fatal(err)
	}
	proposal, _ := proposalRepo.CreateProposal(member.ID, "Lunch", "", "all", "lunch", time.Now().In(time.Local).Format("2006-01-02"), 5, "Alice",
		time.Now().Add(time.Hour), time.Now().Add(2*time.Hour), time.Now().Add(3*time.Hour))
	// proposal.Status is "proposing", not "voting"

	_, err = svc.Vote(proposal.ID, member.ID, 1, 10, false)
	if err == nil {
		t.Error("expected error for wrong proposal status")
	}
}

func TestQuoteVote_InvalidAmount(t *testing.T) {
	memberRepo := newMockMemberRepo()
	proposalRepo := newMockProposalRepo()
	merchantRepo := &mockMerchantRepo{}
	svc := service.NewProposalService(proposalRepo, memberRepo, merchantRepo)

	_, err := svc.QuoteVote(0)
	if err == nil {
		t.Error("expected error for zero tokenAmount")
	}
	if err != nil && err.Error() != "tokenAmount must be greater than zero" {
		t.Fatalf("unexpected zero-token error: %v", err)
	}
	_, err = svc.QuoteVote(-5)
	if err == nil {
		t.Error("expected error for negative tokenAmount")
	}
	if err != nil && err.Error() != "tokenAmount must be greater than zero" {
		t.Fatalf("unexpected negative-token error: %v", err)
	}
	quote, err := svc.QuoteVote(7)
	if err != nil {
		t.Fatalf("expected positive tokenAmount to succeed, got %v", err)
	}
	if quote["voteWeight"] != 7 {
		t.Fatalf("expected vote weight 7, got %d", quote["voteWeight"])
	}
}

func TestCreateWithDeadlines_RejectsInvalidDeadlineOrder(t *testing.T) {
	memberRepo := newMockMemberRepo()
	proposalRepo := newMockProposalRepo()
	merchantRepo := &mockMerchantRepo{}
	svc := service.NewProposalService(proposalRepo, memberRepo, merchantRepo)

	now := time.Now().UTC()
	_, err := svc.CreateWithDeadlines(
		1,
		"Lunch",
		"",
		"all",
		"lunch",
		now.In(time.Local).Format("2006-01-02"),
		5,
		"Alice",
		now.Add(30*time.Minute),
		now.Add(60*time.Minute),
		now.Add(45*time.Minute),
	)
	if err == nil {
		t.Fatal("expected invalid deadline order to fail")
	}
	if err.Error() != "vote deadline must be before order deadline" {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestCreateWithDeadlines_RejectsEqualProposalAndVoteDeadline(t *testing.T) {
	memberRepo := newMockMemberRepo()
	proposalRepo := newMockProposalRepo()
	merchantRepo := &mockMerchantRepo{}
	svc := service.NewProposalService(proposalRepo, memberRepo, merchantRepo)

	now := time.Now().UTC()
	_, err := svc.CreateWithDeadlines(
		1,
		"Lunch",
		"",
		"all",
		"lunch",
		now.In(time.Local).Format("2006-01-02"),
		5,
		"Alice",
		now.Add(30*time.Minute),
		now.Add(30*time.Minute),
		now.Add(60*time.Minute),
	)
	if err == nil {
		t.Fatal("expected equal proposal/vote deadlines to fail")
	}
	if err.Error() != "proposal deadline must be before vote deadline" {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestFinalizeSettlement_AllowsAwaitingSettlementStatus(t *testing.T) {
	memberRepo := newMockMemberRepo()
	proposalRepo := newMockProposalRepo()
	merchantRepo := &mockMerchantRepo{}
	svc := service.NewProposalService(proposalRepo, memberRepo, merchantRepo)

	memberSvc := service.NewMemberService(memberRepo)
	member, _, err := memberSvc.Register("alice@example.com", "pass", "Alice")
	if err != nil {
		t.Fatal(err)
	}
	proposal, _ := proposalRepo.CreateProposal(member.ID, "Lunch", "", "all", "lunch", time.Now().In(time.Local).Format("2006-01-02"), 5, "Alice",
		time.Now().Add(-2*time.Hour), time.Now().Add(-90*time.Minute), time.Now().Add(-30*time.Minute))
	proposal.Status = "awaiting_settlement"
	proposal.WinnerOptionID = 1
	proposal.Options = []*models.ProposalOption{
		{ID: 1, ProposerMember: member.ID},
	}

	if _, err := svc.FinalizeSettlement(proposal.ID); err != nil {
		t.Fatalf("expected finalize settlement to allow awaiting_settlement, got %v", err)
	}
}
