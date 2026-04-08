package service_test

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"mealvoting/backend/internal/models"
	"mealvoting/backend/service"
)

// mockMemberRepo is a minimal in-memory stub for testing MemberService.
type mockMemberRepo struct {
	members    map[string]*models.Member
	sessions   map[string]int64
	challenges map[string]*models.WalletAuthChallenge
	nextID     int64
}

func newMockMemberRepo() *mockMemberRepo {
	return &mockMemberRepo{
		members:    make(map[string]*models.Member),
		sessions:   make(map[string]int64),
		challenges: make(map[string]*models.WalletAuthChallenge),
		nextID:     1,
	}
}

func (m *mockMemberRepo) CreateMember(email, passwordHash, displayName string, isAdmin bool, tokenBalance int64, avatarURL string) (int64, error) {
	id := m.nextID
	m.nextID++
	m.members[email] = &models.Member{ID: id, Email: email, PasswordHash: passwordHash, DisplayName: displayName, IsAdmin: isAdmin, TokenBalance: tokenBalance, AvatarURL: avatarURL, RegistrationInviteCode: fmt.Sprintf("member-%d", id)}
	return id, nil
}
func (m *mockMemberRepo) MemberCount() (int64, error) { return int64(len(m.members)), nil }
func (m *mockMemberRepo) MemberByEmail(email string) (*models.Member, error) {
	if mem, ok := m.members[email]; ok {
		return mem, nil
	}
	return nil, errors.New("member not found")
}
func (m *mockMemberRepo) MemberByWallet(wallet string) (*models.Member, error) {
	for _, mem := range m.members {
		if mem.WalletAddress == wallet {
			return mem, nil
		}
	}
	return nil, errors.New("member not found")
}
func (m *mockMemberRepo) MemberByRegistrationInviteCode(code string) (*models.Member, error) {
	for _, mem := range m.members {
		if mem.RegistrationInviteCode == code {
			return mem, nil
		}
	}
	return nil, errors.New("member not found")
}
func (m *mockMemberRepo) MemberBySession(token string) (*models.Member, error) {
	id, ok := m.sessions[token]
	if !ok {
		return nil, errors.New("invalid session")
	}
	for _, mem := range m.members {
		if mem.ID == id {
			return mem, nil
		}
	}
	return nil, errors.New("invalid session")
}
func (m *mockMemberRepo) MemberByID(id int64) (*models.Member, error) {
	for _, mem := range m.members {
		if mem.ID == id {
			return mem, nil
		}
	}
	return nil, errors.New("member not found")
}
func (m *mockMemberRepo) ListMemberOrders(memberID int64) ([]*models.Order, error) { return []*models.Order{}, nil }
func (m *mockMemberRepo) MemberReviewCount(memberID int64) (int64, error) { return 0, nil }
func (m *mockMemberRepo) ListRegistrationInviteUsages(memberID int64) ([]*models.RegistrationInviteUsage, error) {
	return []*models.RegistrationInviteUsage{}, nil
}
func (m *mockMemberRepo) RecordRegistrationInviteUsage(inviteCode string, inviterMemberID, usedByMemberID int64) error {
	return nil
}
func (m *mockMemberRepo) UpgradePasswordHash(memberID int64, hash string) error { return nil }
func (m *mockMemberRepo) CreateSession(memberID int64, token string) error {
	m.sessions[token] = memberID
	return nil
}
func (m *mockMemberRepo) UpdateMemberWallet(memberID int64, wallet string) error {
	for _, mem := range m.members {
		if mem.ID == memberID {
			mem.WalletAddress = wallet
			return nil
		}
	}
	return errors.New("member not found")
}
func (m *mockMemberRepo) SetSubscriptionExpiry(memberID int64, expiresAt time.Time) error {
	for _, mem := range m.members {
		if mem.ID == memberID {
			mem.SubscriptionExpiresAt = expiresAt
			mem.SubscriptionActive = expiresAt.After(time.Now().UTC())
			return nil
		}
	}
	return errors.New("member not found")
}
func (m *mockMemberRepo) AddClaimableTickets(memberID, proposalTickets int64) error {
	for _, mem := range m.members {
		if mem.ID == memberID {
			mem.ClaimableProposalTickets += proposalTickets
			mem.ClaimableVoteTickets += proposalTickets
			mem.ClaimableCreateOrderTickets += proposalTickets
			return nil
		}
	}
	return errors.New("member not found")
}
func (m *mockMemberRepo) ClaimTickets(memberID int64) (int64, int64, int64, error) {
	for _, mem := range m.members {
		if mem.ID == memberID {
			proposalTickets := mem.ClaimableProposalTickets
			voteTickets := mem.ClaimableVoteTickets
			createTickets := mem.ClaimableCreateOrderTickets
			if proposalTickets == 0 && voteTickets == 0 && createTickets == 0 {
				return 0, 0, 0, errors.New("no claimable tickets")
			}
			mem.ProposalTicketCount += proposalTickets
			mem.VoteTicketCount += voteTickets
			mem.CreateOrderTicketCount += createTickets
			mem.ClaimableProposalTickets = 0
			mem.ClaimableVoteTickets = 0
			mem.ClaimableCreateOrderTickets = 0
			return proposalTickets, voteTickets, createTickets, nil
		}
	}
	return 0, 0, 0, errors.New("member not found")
}
func (m *mockMemberRepo) GrantDailyLoginProposalTicket(memberID int64, now time.Time) (bool, error) {
	for _, mem := range m.members {
		if mem.ID == memberID {
			mem.ClaimableProposalTickets += 1
			return true, nil
		}
	}
	return false, errors.New("member not found")
}
func (m *mockMemberRepo) SaveWalletAuthChallenge(walletAddress, nonce, message string, expiresAt time.Time) error {
	m.challenges[walletAddress] = &models.WalletAuthChallenge{
		WalletAddress: walletAddress,
		Nonce:         nonce,
		Message:       message,
		ExpiresAt:     expiresAt,
	}
	return nil
}
func (m *mockMemberRepo) WalletAuthChallengeByWallet(walletAddress string) (*models.WalletAuthChallenge, error) {
	challenge, ok := m.challenges[walletAddress]
	if !ok {
		return nil, errors.New("wallet auth challenge not found")
	}
	return challenge, nil
}
func (m *mockMemberRepo) DeleteWalletAuthChallenge(walletAddress string) error {
	delete(m.challenges, walletAddress)
	return nil
}
func (m *mockMemberRepo) RawLeaderboard() ([]*models.LeaderboardEntry, error) { return nil, nil }
func (m *mockMemberRepo) MemberStats(memberID int64) (int64, int64, int64, error) { return 0, 0, 0, nil }

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

	if _, _, err := svc.Register("", "pass", "Name"); err == nil {
		t.Error("expected error for empty email")
	}
	if _, _, err := svc.Register("a@b.com", "", "Name"); err == nil {
		t.Error("expected error for empty password")
	}
	if _, _, err := svc.Register("a@b.com", "pass", ""); err == nil {
		t.Error("expected error for empty displayName")
	}
}

func TestLogin_Success(t *testing.T) {
	repo := newMockMemberRepo()
	svc := service.NewMemberService(repo)
	if _, _, err := svc.Register("a@b.com", "secret", "Alice"); err != nil {
		t.Fatal(err)
	}

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
