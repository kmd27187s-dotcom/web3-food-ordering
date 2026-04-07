package service

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"mealvoting/backend/internal/models"
	"mealvoting/backend/repository"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
	"golang.org/x/crypto/bcrypt"
)

const defaultMemberTokens = int64(300)
const walletAuthChallengeTTL = 5 * time.Minute

var (
	ErrWalletAuthChallengeNotFound   = errors.New("wallet auth challenge not found")
	ErrWalletAuthChallengeExpired    = errors.New("wallet auth challenge expired")
	ErrWalletVerificationFailed      = errors.New("wallet verification failed")
	ErrDisplayNameRequired           = errors.New("displayName is required for first-time wallet registration")
	ErrInvalidRegistrationInviteCode = errors.New("invalid registration invite code")
	ErrSelfRegistrationInviteCode    = errors.New("cannot use your own registration invite code")
)

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
	token, err := newSession()
	if err != nil {
		return nil, "", err
	}
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
	token, err := newSession()
	if err != nil {
		return nil, "", err
	}
	if err := s.repo.CreateSession(member.ID, token); err != nil {
		return nil, "", err
	}
	member, err = s.repo.MemberByID(member.ID)
	return member, token, err
}

func (s *MemberService) LinkWallet(memberID int64, wallet string) (*models.Member, error) {
	wallet, err := normalizeWalletAddress(wallet)
	if err != nil {
		return nil, err
	}
	if err := s.repo.UpdateMemberWallet(memberID, wallet); err != nil {
		return nil, err
	}
	return s.repo.MemberByID(memberID)
}

func (s *MemberService) UnlinkWallet(memberID int64) (*models.Member, error) {
	if memberID <= 0 {
		return nil, errors.New("member id is required")
	}
	if err := s.repo.UpdateMemberWallet(memberID, ""); err != nil {
		return nil, err
	}
	return s.repo.MemberByID(memberID)
}

func (s *MemberService) GetBySession(token string) (*models.Member, error) {
	return s.repo.MemberBySession(token)
}

func (s *MemberService) GetByID(id int64) (*models.Member, error) {
	return s.repo.MemberByID(id)
}

func (s *MemberService) GetByWallet(wallet string) (*models.Member, error) {
	wallet, err := normalizeWalletAddress(wallet)
	if err != nil {
		return nil, err
	}
	return s.repo.MemberByWallet(wallet)
}

func (s *MemberService) GetByEmail(email string) (*models.Member, error) {
	return s.repo.MemberByEmail(normalizeEmail(email))
}

func (s *MemberService) ListMemberOrders(memberID int64) ([]*models.Order, error) {
	return s.repo.ListMemberOrders(memberID)
}

func (s *MemberService) CreateMember(email, passwordHash, displayName string, isAdmin bool, tokenBalance int64, avatarURL string) (int64, error) {
	return s.repo.CreateMember(normalizeEmail(email), passwordHash, displayName, isAdmin, tokenBalance, avatarURL)
}

func (s *MemberService) SetSubscriptionExpiry(memberID int64, expiresAt time.Time) error {
	return s.repo.SetSubscriptionExpiry(memberID, expiresAt)
}

func (s *MemberService) CancelSubscription(memberID int64) (*models.Member, error) {
	if err := s.repo.SetSubscriptionExpiry(memberID, time.Now().UTC().Add(-time.Minute)); err != nil {
		return nil, err
	}
	return s.repo.MemberByID(memberID)
}

func (s *MemberService) StartWalletAuth(wallet string) (*models.WalletAuthChallenge, error) {
	wallet, err := normalizeWalletAddress(wallet)
	if err != nil {
		return nil, err
	}
	nonce, err := randomHex(16)
	if err != nil {
		return nil, err
	}
	expiresAt := time.Now().UTC().Add(walletAuthChallengeTTL)
	message := buildWalletAuthMessage(wallet, nonce, expiresAt)
	if err := s.repo.SaveWalletAuthChallenge(wallet, nonce, message, expiresAt); err != nil {
		return nil, err
	}
	return &models.WalletAuthChallenge{
		WalletAddress: wallet,
		Nonce:         nonce,
		Message:       message,
		ExpiresAt:     expiresAt,
	}, nil
}

func (s *MemberService) VerifyWalletAuth(wallet, signature, displayName, inviteCode string) (*models.Member, string, bool, bool, error) {
	wallet, err := normalizeWalletAddress(wallet)
	if err != nil {
		return nil, "", false, false, err
	}
	challenge, err := s.repo.WalletAuthChallengeByWallet(wallet)
	if err != nil {
		return nil, "", false, false, ErrWalletAuthChallengeNotFound
	}
	if time.Now().UTC().After(challenge.ExpiresAt) {
		_ = s.repo.DeleteWalletAuthChallenge(wallet)
		return nil, "", false, false, ErrWalletAuthChallengeExpired
	}
	if err := verifyWalletSignature(wallet, challenge.Message, signature); err != nil {
		return nil, "", false, false, err
	}
	if err := s.repo.DeleteWalletAuthChallenge(wallet); err != nil {
		return nil, "", false, false, err
	}

	member, err := s.repo.MemberByWallet(wallet)
	created := false
	if err != nil {
		if strings.TrimSpace(displayName) == "" {
			return nil, "", false, false, ErrDisplayNameRequired
		}
		count, countErr := s.repo.MemberCount()
		if countErr != nil {
			return nil, "", false, false, countErr
		}
		isAdmin := count == 0
		avatarURL := fmt.Sprintf("https://api.dicebear.com/9.x/shapes/svg?seed=%s", displayName)
		memberID, createErr := s.repo.CreateMember(walletIdentityEmail(wallet), "", strings.TrimSpace(displayName), isAdmin, defaultMemberTokens, avatarURL)
		if createErr != nil {
			return nil, "", false, false, createErr
		}
		if updateErr := s.repo.UpdateMemberWallet(memberID, wallet); updateErr != nil {
			return nil, "", false, false, updateErr
		}
		if strings.TrimSpace(inviteCode) != "" {
			inviter, inviteErr := s.repo.MemberByRegistrationInviteCode(strings.TrimSpace(inviteCode))
			if inviteErr != nil {
				return nil, "", false, false, ErrInvalidRegistrationInviteCode
			}
			if inviter.ID == memberID {
				return nil, "", false, false, ErrSelfRegistrationInviteCode
			}
			if rewardErr := s.repo.AddClaimableTickets(inviter.ID, 1); rewardErr != nil {
				return nil, "", false, false, rewardErr
			}
			if rewardErr := s.repo.AddClaimableTickets(memberID, 1); rewardErr != nil {
				return nil, "", false, false, rewardErr
			}
			if usageErr := s.repo.RecordRegistrationInviteUsage(strings.TrimSpace(inviteCode), inviter.ID, memberID); usageErr != nil {
				return nil, "", false, false, usageErr
			}
		}
		member, err = s.repo.MemberByID(memberID)
		if err != nil {
			return nil, "", false, false, err
		}
		created = true
	}

	dailyLoginRewardGranted, err := s.repo.GrantDailyLoginProposalTicket(member.ID, time.Now().UTC())
	if err != nil {
		return nil, "", false, false, err
	}
	token, err := newSession()
	if err != nil {
		return nil, "", false, false, err
	}
	if err := s.repo.CreateSession(member.ID, token); err != nil {
		return nil, "", false, false, err
	}
	member, err = s.repo.MemberByID(member.ID)
	return member, token, created, dailyLoginRewardGranted, err
}

func (s *MemberService) ClaimTickets(memberID int64) (*models.Member, int64, int64, int64, error) {
	proposalTickets, voteTickets, createOrderTickets, err := s.repo.ClaimTickets(memberID)
	if err != nil {
		return nil, 0, 0, 0, err
	}
	member, err := s.repo.MemberByID(memberID)
	if err != nil {
		return nil, 0, 0, 0, err
	}
	return member, proposalTickets, voteTickets, createOrderTickets, nil
}

func (s *MemberService) ListRegistrationInviteUsages(memberID int64) ([]*models.RegistrationInviteUsage, error) {
	return s.repo.ListRegistrationInviteUsages(memberID)
}

// --- private helpers ---

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

func walletIdentityEmail(wallet string) string {
	return "wallet:" + strings.ToLower(strings.TrimSpace(wallet))
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

func newSession() (string, error) {
	return randomHex(32)
}

func randomHex(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func buildWalletAuthMessage(wallet, nonce string, expiresAt time.Time) string {
	return fmt.Sprintf(
		"MealVote wallet sign-in\nWallet: %s\nNonce: %s\nExpires At: %s",
		wallet,
		nonce,
		expiresAt.UTC().Format(time.RFC3339),
	)
}

func verifyWalletSignature(wallet, message, signature string) error {
	sigBytes, err := hexutil.Decode(signature)
	if err != nil {
		return ErrWalletVerificationFailed
	}
	if len(sigBytes) != 65 {
		return ErrWalletVerificationFailed
	}
	if sigBytes[64] >= 27 {
		sigBytes[64] -= 27
	}
	hash := accounts.TextHash([]byte(message))
	pubKey, err := crypto.SigToPub(hash, sigBytes)
	if err != nil {
		return ErrWalletVerificationFailed
	}
	recovered := crypto.PubkeyToAddress(*pubKey).Hex()
	if !strings.EqualFold(recovered, wallet) {
		return ErrWalletVerificationFailed
	}
	return nil
}
