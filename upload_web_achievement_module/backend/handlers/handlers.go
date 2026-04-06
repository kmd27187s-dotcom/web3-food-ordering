package handlers

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/ethereum/go-ethereum/common"

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
	subscriptionTokenCost     = int64(99)
	subscriptionDuration      = 30 * 24 * time.Hour
	defaultUsageLimit         = 50
	maxUsageLimit             = 200
)

var (
	errProposalAccessRequiresGroup = errors.New("join a group first")
	errProposalAccessForbidden     = errors.New("forbidden")
)

type Server struct {
	cfg             config.Config
	members         *service.MemberService
	proposals       *service.ProposalService
	orders          *service.OrderService
	leaderboard     *service.LeaderboardService
	achievementDemo *achievementDemoStore
	chain           *blockchain.Client
	merchantRepo    repository.MerchantRepo
	chainRepo       repository.ChainRepo
	txRepo          repository.TransactionRepo
	usageRepo       repository.UsageRepo
	groupRepo       repository.GroupRepo
	faucetRepo      repository.FaucetRepo
	adminRepo       repository.AdminRepo
	rateLimiter     *rateLimiter
}

func NewServer(cfg config.Config, store repository.Store, chain *blockchain.Client) *Server {
	members := service.NewMemberService(store)
	proposals := service.NewProposalService(store, store, store)
	orders := service.NewOrderService(store, store, store, store, chain)
	leaderboard := service.NewLeaderboardService(store)
	achievementDemo, err := newAchievementDemoStore(defaultAchievementDemoDataFile)
	if err != nil {
		log.Printf("achievement demo storage fallback to memory: %v", err)
		achievementDemo = newAchievementDemoStoreWithoutPersistence()
	}
	return &Server{
		cfg:             cfg,
		members:         members,
		proposals:       proposals,
		orders:          orders,
		leaderboard:     leaderboard,
		achievementDemo: achievementDemo,
		chain:           chain,
		merchantRepo:    store,
		chainRepo:       store,
		txRepo:          store,
		usageRepo:       store,
		groupRepo:       store,
		faucetRepo:      store,
		adminRepo:       store,
		rateLimiter:     newRateLimiter(),
	}
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("GET /contract", s.handleContractInfo)
	mux.HandleFunc("POST /auth/wallet/challenge", s.withConfiguredRateLimit(registerRateLimitKey, s.cfg.RateLimit.Register, registerRateLimitMax, registerRateLimitWindow, s.handleWalletChallenge))
	mux.HandleFunc("POST /auth/wallet/verify", s.withConfiguredRateLimit(loginRateLimitKey, s.cfg.RateLimit.Login, loginRateLimitMax, loginRateLimitWindow, s.handleWalletVerify))
	mux.HandleFunc("POST /api/auth/wallet-connect/challenge", s.withConfiguredRateLimit(registerRateLimitKey, s.cfg.RateLimit.Register, registerRateLimitMax, registerRateLimitWindow, s.handleWalletChallenge))
	mux.HandleFunc("POST /api/auth/wallet-connect", s.withConfiguredRateLimit(loginRateLimitKey, s.cfg.RateLimit.Login, loginRateLimitMax, loginRateLimitWindow, s.handleWalletVerify))
	mux.HandleFunc("GET /members/me", s.withAuth(s.handleMe))
	mux.HandleFunc("GET /members/{id}", s.handleMemberProfile)
	mux.HandleFunc("GET /members/{id}/profile", s.handleMemberProfile)
	mux.HandleFunc("GET /api/members/profile", s.withAuth(s.handleMemberProfileByWallet))
	mux.HandleFunc("POST /api/members/invite", s.handleRegistrationInviteInfo)
	mux.HandleFunc("POST /members/tickets/claim", s.withAuth(s.handleClaimTickets))
	mux.HandleFunc("POST /api/achievements/comment", s.handleAchievementDemoCreateComment)
	mux.HandleFunc("POST /api/achievements/reply", s.handleAchievementDemoCreateReply)
	mux.HandleFunc("GET /api/achievements/user", s.handleAchievementDemoGetUser)
	mux.HandleFunc("GET /api/achievements/ranking", s.handleAchievementDemoGetRanking)
	mux.HandleFunc("GET /api/comments", s.handleAchievementDemoListComments)
	mux.HandleFunc("GET /api/stores", s.handleAchievementDemoListStores)
	mux.HandleFunc("GET /merchants", s.handleListMerchants)
	mux.HandleFunc("GET /merchants/{id}", s.handleGetMerchant)
	mux.HandleFunc("POST /admin/merchants", s.withAdmin(s.handleAdminUpsertMerchant))
	mux.HandleFunc("POST /admin/merchants/{id}/menu", s.withAdmin(s.handleAdminUpsertMenuItem))
	mux.HandleFunc("POST /admin/merchants/import", s.withAdmin(s.handleAdminImportMerchantCSV))
	mux.HandleFunc("GET /proposals", s.withSubscribed(s.handleListProposals))
	mux.HandleFunc("POST /proposals", s.withSubscribed(s.handleCreateProposal))
	mux.HandleFunc("GET /proposals/{id}", s.withSubscribed(s.handleGetProposal))
	mux.HandleFunc("POST /proposals/{id}/options", s.withSubscribed(s.handleAddOption))
	mux.HandleFunc("POST /proposals/{id}/options/quote", s.withSubscribed(s.handleOptionQuote))
	mux.HandleFunc("POST /proposals/{id}/votes", s.withSubscribed(s.handleVote))
	mux.HandleFunc("POST /proposals/{id}/votes/quote", s.withSubscribed(s.handleVoteQuote))
	mux.HandleFunc("POST /proposals/{id}/settle", s.withSubscribed(s.handleSettleProposal))
	mux.HandleFunc("POST /proposals/{id}/claim", s.withSubscribed(s.handleClaimReward))
	mux.HandleFunc("POST /orders/quote", s.withSubscribed(s.handleOrderQuote))
	mux.HandleFunc("POST /orders/sign", s.withSubscribed(s.handleOrderSign))
	mux.HandleFunc("GET /leaderboard", s.handleLeaderboard)
	mux.HandleFunc("GET /indexer/status", s.handleIndexerStatus)
	mux.HandleFunc("GET /indexer/events", s.handleIndexedEvents)
	mux.HandleFunc("POST /admin/indexer/sync", s.withAdmin(s.handleIndexerSync))
	mux.HandleFunc("POST /transactions", s.withSubscribed(s.handleRegisterTransaction))
	mux.HandleFunc("GET /transactions", s.withSubscribed(s.handleListTransactions))
	mux.HandleFunc("GET /transactions/{txHash}", s.withSubscribed(s.handleTransactionStatus))
	mux.HandleFunc("GET /members/me/usage", s.withSubscribed(s.handleListUsage))
	mux.HandleFunc("GET /records/usage", s.withSubscribed(s.handleListUsage))
	mux.HandleFunc("POST /groups", s.withSubscribed(s.handleCreateGroup))
	mux.HandleFunc("GET /groups", s.withSubscribed(s.handleListGroups))
	mux.HandleFunc("GET /groups/{id}", s.withSubscribed(s.handleGetGroup))
	mux.HandleFunc("POST /groups/{id}/invite", s.withSubscribed(s.handleCreateGroupInvite))
	mux.HandleFunc("POST /groups/{id}/leave", s.withSubscribed(s.handleLeaveGroup))
	mux.HandleFunc("POST /join/{code}", s.withSubscribed(s.handleJoinGroup))
	mux.HandleFunc("POST /tokens/claim", s.withAuth(s.handleClaimFaucet))
	mux.HandleFunc("POST /subscription/pay", s.withAuth(s.handleSubscriptionPay))
	mux.HandleFunc("POST /api/members/subscribe", s.withAuth(s.handleSubscriptionPay))
	mux.HandleFunc("POST /demo/seed", s.handleDemoSeed)
	mux.HandleFunc("POST /admin/proposals/{id}/advance", s.withAdmin(s.handleAdvanceProposalStage))
	return withCORS(mux)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleContractInfo(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.chainRepo.ContractInfo())
}

func (s *Server) handleWalletChallenge(w http.ResponseWriter, r *http.Request) {
	var body struct {
		WalletAddress string `json:"walletAddress"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	challenge, err := s.members.StartWalletAuth(body.WalletAddress)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, challenge)
}

func (s *Server) handleWalletVerify(w http.ResponseWriter, r *http.Request) {
	var body struct {
		WalletAddress string `json:"walletAddress"`
		Signature     string `json:"signature"`
		DisplayName   string `json:"displayName"`
		InviteCode    string `json:"inviteCode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	member, token, created, dailyLoginRewardGranted, err := s.members.VerifyWalletAuth(body.WalletAddress, body.Signature, body.DisplayName, body.InviteCode)
	if err != nil {
		status, message := walletVerifyErrorResponse(err)
		writeError(w, status, message)
		return
	}
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	writeJSON(w, status, map[string]any{
		"token":                   token,
		"member":                  member,
		"created":                 created,
		"dailyLoginRewardGranted": dailyLoginRewardGranted,
	})
}

func (s *Server) handleClaimTickets(w http.ResponseWriter, r *http.Request, memberID int64) {
	member, proposalTickets, err := s.members.ClaimTickets(memberID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"member":                 member,
		"claimedProposalTickets": proposalTickets,
	})
}

func (s *Server) handleListMerchants(w http.ResponseWriter, r *http.Request) {
	merchants, err := s.proposals.ListMerchants()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, merchants)
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request, memberID int64) {
	member := authenticatedMember(r)
	if member == nil || member.ID != memberID {
		writeError(w, http.StatusUnauthorized, "invalid session")
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

func (s *Server) handleMemberProfileByWallet(w http.ResponseWriter, r *http.Request, memberID int64) {
	member := authenticatedMember(r)
	if member == nil || member.ID != memberID {
		writeError(w, http.StatusUnauthorized, "invalid session")
		return
	}
	wallet := strings.TrimSpace(r.URL.Query().Get("walletAddress"))
	if wallet != "" {
		normalizedWallet, err := normalizeWalletAddressForProfileLookup(wallet)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid wallet address")
			return
		}
		if !strings.EqualFold(member.WalletAddress, normalizedWallet) {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}
	}
	profile, err := s.leaderboard.Profile(member.ID)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	groups, err := s.groupRepo.ListMemberGroups(member.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"member":       profile.Member,
		"rank":         profile.Rank,
		"buildings":    profile.Buildings,
		"recentBadges": profile.RecentBadges,
		"history":      profile.History,
		"stats":        profile.Stats,
		"groups":       groups,
	})
}

func (s *Server) handleRegistrationInviteInfo(w http.ResponseWriter, r *http.Request) {
	var body struct {
		WalletAddress string `json:"walletAddress"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)

	var (
		member *models.Member
		err    error
	)
	if token := sessionToken(r); token != "" {
		member, err = s.members.GetBySession(token)
	} else {
		member, err = s.members.GetByWallet(body.WalletAddress)
	}
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"walletAddress":            member.WalletAddress,
		"inviteCode":               member.RegistrationInviteCode,
		"proposalTicketCount":      member.ProposalTicketCount,
		"claimableProposalTickets": member.ClaimableProposalTickets,
		"subscriptionActive":       member.SubscriptionActive,
		"subscriptionExpiresAt":    member.SubscriptionExpiresAt,
	})
}

func (s *Server) handleGetMerchant(w http.ResponseWriter, r *http.Request) {
	merchant, err := s.proposals.GetMerchant(strings.TrimSpace(r.PathValue("id")))
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, merchant)
}

func (s *Server) handleAdminUpsertMerchant(w http.ResponseWriter, r *http.Request, memberID int64) {
	var body struct {
		ID            string `json:"id"`
		Name          string `json:"name"`
		Group         string `json:"group"`
		PayoutAddress string `json:"payoutAddress"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	merchant, err := s.merchantRepo.UpsertMerchant(&models.Merchant{
		ID:            strings.TrimSpace(body.ID),
		Name:          strings.TrimSpace(body.Name),
		Group:         strings.TrimSpace(body.Group),
		PayoutAddress: strings.TrimSpace(body.PayoutAddress),
		Menu:          []*models.MenuItem{},
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, merchant)
}

func (s *Server) handleAdminUpsertMenuItem(w http.ResponseWriter, r *http.Request, memberID int64) {
	merchantID := strings.TrimSpace(r.PathValue("id"))
	var body struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		PriceWei    int64  `json:"priceWei"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := s.merchantRepo.UpsertMenuItem(merchantID, &models.MenuItem{
		ID:          strings.TrimSpace(body.ID),
		Name:        strings.TrimSpace(body.Name),
		PriceWei:    body.PriceWei,
		Description: strings.TrimSpace(body.Description),
	}); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	merchant, err := s.merchantRepo.GetMerchant(merchantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, merchant)
}

func (s *Server) handleAdminImportMerchantCSV(w http.ResponseWriter, r *http.Request, memberID int64) {
	var body struct {
		CSV string `json:"csv"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	reader := csv.NewReader(strings.NewReader(body.CSV))
	reader.TrimLeadingSpace = true
	rows, err := reader.ReadAll()
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid csv format")
		return
	}
	if len(rows) <= 1 {
		writeError(w, http.StatusBadRequest, "csv must include header and at least one row")
		return
	}
	headers := make(map[string]int)
	for index, header := range rows[0] {
		headers[strings.ToLower(strings.TrimSpace(header))] = index
	}
	requiredColumns := []string{"merchant_id", "merchant_name", "merchant_group", "payout_address", "item_id", "item_name", "price_wei", "description"}
	for _, column := range requiredColumns {
		if _, ok := headers[column]; !ok {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("missing csv column: %s", column))
			return
		}
	}

	merchantCount := 0
	itemCount := 0
	seenMerchants := map[string]bool{}
	for _, row := range rows[1:] {
		if len(row) == 0 {
			continue
		}
		merchantID := csvValue(row, headers, "merchant_id")
		merchantName := csvValue(row, headers, "merchant_name")
		merchantGroup := csvValue(row, headers, "merchant_group")
		payoutAddress := csvValue(row, headers, "payout_address")
		itemID := csvValue(row, headers, "item_id")
		itemName := csvValue(row, headers, "item_name")
		description := csvValue(row, headers, "description")
		priceWei, err := strconv.ParseInt(csvValue(row, headers, "price_wei"), 10, 64)
		if err != nil || priceWei <= 0 {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("invalid price_wei for item %s", itemID))
			return
		}

		if _, err := s.merchantRepo.UpsertMerchant(&models.Merchant{
			ID:            merchantID,
			Name:          merchantName,
			Group:         merchantGroup,
			PayoutAddress: payoutAddress,
			Menu:          []*models.MenuItem{},
		}); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		if !seenMerchants[merchantID] {
			seenMerchants[merchantID] = true
			merchantCount++
		}
		if err := s.merchantRepo.UpsertMenuItem(merchantID, &models.MenuItem{
			ID:          itemID,
			Name:        itemName,
			PriceWei:    priceWei,
			Description: description,
		}); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		itemCount++
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"message":       "menu import completed",
		"merchantCount": merchantCount,
		"menuItemCount": itemCount,
		"importedBy":    memberID,
	})
}

func (s *Server) requireProposalAccess(memberID int64, proposalID int64) (*models.Proposal, error) {
	proposal, err := s.proposals.Get(proposalID)
	if err != nil {
		return nil, err
	}
	if proposal.GroupID <= 0 {
		return nil, errProposalAccessRequiresGroup
	}
	isMember, err := s.groupRepo.IsMember(proposal.GroupID, memberID)
	if err != nil {
		return nil, err
	}
	if !isMember {
		return nil, errProposalAccessForbidden
	}
	return proposal, nil
}

func (s *Server) handleListProposals(w http.ResponseWriter, r *http.Request, memberID int64) {
	groups, err := s.groupRepo.ListMemberGroups(memberID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	allowed := make(map[int64]struct{}, len(groups))
	for _, group := range groups {
		allowed[group.ID] = struct{}{}
	}
	filtered := make([]*models.Proposal, 0)
	for _, proposal := range s.proposals.List() {
		if proposal.GroupID <= 0 {
			continue
		}
		if _, ok := allowed[proposal.GroupID]; ok {
			filtered = append(filtered, proposal)
		}
	}
	writeJSON(w, http.StatusOK, anonymizeProposals(filtered, memberID))
}

func (s *Server) handleGetProposal(w http.ResponseWriter, r *http.Request, memberID int64) {
	proposalID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid proposal id")
		return
	}
	proposal, err := s.requireProposalAccess(memberID, proposalID)
	if err != nil {
		if isProposalAccessError(err) {
			writeError(w, http.StatusForbidden, err.Error())
			return
		}
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, anonymizeProposal(proposal, memberID))
}

func (s *Server) handleCreateProposal(w http.ResponseWriter, r *http.Request, memberID int64) {
	var body struct {
		Title           string `json:"title"`
		Description     string `json:"description"`
		MaxOptions      int64  `json:"maxOptions"`
		MerchantID      string `json:"merchantId"`
		ProposalMinutes int64  `json:"proposalMinutes"`
		VoteMinutes     int64  `json:"voteMinutes"`
		OrderMinutes    int64  `json:"orderMinutes"`
		GroupID         int64  `json:"groupId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.GroupID <= 0 {
		writeError(w, http.StatusBadRequest, "join a group first")
		return
	}
	isMember, err := s.groupRepo.IsMember(body.GroupID, memberID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !isMember {
		writeError(w, http.StatusForbidden, "not a member of this group")
		return
	}
	now := time.Now().In(handlerBusinessLocation())
	mealPeriod := currentLocalMealPeriod(now)
	proposalDate := now.Format("2006-01-02")
	for _, existing := range s.proposals.List() {
		if existing.GroupID != body.GroupID {
			continue
		}
		if normalizedMealPeriod(existing.MealPeriod) != mealPeriod {
			continue
		}
		if normalizedProposalDate(existing.ProposalDate, now) != proposalDate {
			continue
		}
		writeError(w, http.StatusBadRequest, "this group already has a proposer for the current round")
		return
	}
	consumeProposalToken := strings.TrimSpace(body.MerchantID) == ""
	proposal, err := s.proposals.Create(memberID, body.Title, body.Description, "all", mealPeriod, proposalDate, body.MaxOptions, body.ProposalMinutes, body.VoteMinutes, body.OrderMinutes, consumeProposalToken)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if body.GroupID > 0 {
		if err := s.adminRepo.SetProposalGroupID(proposal.ID, body.GroupID); err != nil {
			if errors.Is(err, repository.ErrDuplicateProposalRound) {
				writeError(w, http.StatusBadRequest, "this group already has a proposer for the current round")
				return
			}
			writeError(w, http.StatusInternalServerError, "failed to link proposal to group")
			return
		}
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
	writeJSON(w, http.StatusCreated, anonymizeProposal(proposal, memberID))
}

func normalizedMealPeriod(mealPeriod string) string {
	value := strings.TrimSpace(strings.ToLower(mealPeriod))
	if value == "dinner" {
		return "dinner"
	}
	return "lunch"
}

func currentLocalMealPeriod(now time.Time) string {
	localNow := now.In(handlerBusinessLocation())
	if localNow.Hour() < 12 {
		return "lunch"
	}
	if localNow.Hour() == 12 && localNow.Minute() == 0 && localNow.Second() == 0 {
		return "dinner"
	}
	return "dinner"
}

func normalizedProposalDate(proposalDate string, reference time.Time) string {
	value := strings.TrimSpace(proposalDate)
	if value != "" {
		return value
	}
	return reference.In(handlerBusinessLocation()).Format("2006-01-02")
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
	if _, err := s.requireProposalAccess(memberID, proposalID); err != nil {
		if isProposalAccessError(err) {
			writeError(w, http.StatusForbidden, err.Error())
			return
		}
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	option, err := s.proposals.AddOption(proposalID, memberID, body.MerchantID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, anonymizeOption(option))
}

func (s *Server) handleOptionQuote(w http.ResponseWriter, r *http.Request, memberID int64) {
	proposalID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid proposal id")
		return
	}
	if _, err := s.requireProposalAccess(memberID, proposalID); err != nil {
		if isProposalAccessError(err) {
			writeError(w, http.StatusForbidden, err.Error())
			return
		}
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
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
	if body.TokenAmount == 0 {
		body.TokenAmount = 1
	}
	if _, err := s.requireProposalAccess(memberID, proposalID); err != nil {
		if isProposalAccessError(err) {
			writeError(w, http.StatusForbidden, err.Error())
			return
		}
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	proposal, err := s.proposals.Vote(proposalID, memberID, body.OptionID, body.TokenAmount)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, anonymizeProposal(proposal, memberID))
}

func (s *Server) handleVoteQuote(w http.ResponseWriter, r *http.Request, memberID int64) {
	proposalID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid proposal id")
		return
	}
	if _, err := s.requireProposalAccess(memberID, proposalID); err != nil {
		if isProposalAccessError(err) {
			writeError(w, http.StatusForbidden, err.Error())
			return
		}
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	var body struct {
		TokenAmount int64 `json:"tokenAmount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.TokenAmount == 0 {
		body.TokenAmount = 1
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
	if _, err := s.requireProposalAccess(memberID, body.ProposalID); err != nil {
		if isProposalAccessError(err) {
			writeError(w, http.StatusForbidden, err.Error())
			return
		}
		writeError(w, http.StatusNotFound, err.Error())
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
	if _, err := s.requireProposalAccess(memberID, body.ProposalID); err != nil {
		if isProposalAccessError(err) {
			writeError(w, http.StatusForbidden, err.Error())
			return
		}
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	member := authenticatedMember(r)
	if member == nil || member.ID != memberID {
		writeError(w, http.StatusUnauthorized, "invalid session")
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
	writeJSON(w, http.StatusOK, map[string]any{
		"quote":     quote,
		"signature": sig,
		"order":     order,
	})
}

func (s *Server) handleSettleProposal(w http.ResponseWriter, r *http.Request, memberID int64) {
	proposalID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid proposal id")
		return
	}
	if _, err := s.requireProposalAccess(memberID, proposalID); err != nil {
		if isProposalAccessError(err) {
			writeError(w, http.StatusForbidden, err.Error())
			return
		}
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	proposal, err := s.proposals.FinalizeSettlement(proposalID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, anonymizeProposal(proposal, memberID))
}

func (s *Server) handleClaimReward(w http.ResponseWriter, r *http.Request, memberID int64) {
	proposalID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid proposal id")
		return
	}
	if _, err := s.requireProposalAccess(memberID, proposalID); err != nil {
		if isProposalAccessError(err) {
			writeError(w, http.StatusForbidden, err.Error())
			return
		}
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	member, err := s.members.GetByID(memberID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "member not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"success":    true,
		"newBalance": member.TokenBalance,
	})
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

func (s *Server) handleListUsage(w http.ResponseWriter, r *http.Request, memberID int64) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = defaultUsageLimit
	}
	if limit > maxUsageLimit {
		limit = maxUsageLimit
	}
	items, err := s.usageRepo.ListUsage(memberID, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) withAuth(next func(http.ResponseWriter, *http.Request, int64)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		member, err := s.members.GetBySession(sessionToken(r))
		if err != nil {
			writeError(w, http.StatusUnauthorized, err.Error())
			return
		}
		next(w, withAuthenticatedMember(r, member), member.ID)
	}
}

func (s *Server) withSubscribed(next func(http.ResponseWriter, *http.Request, int64)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		member, err := s.members.GetBySession(sessionToken(r))
		if err != nil {
			writeError(w, http.StatusUnauthorized, err.Error())
			return
		}
		if !member.SubscriptionActive {
			writeError(w, http.StatusForbidden, "subscription required")
			return
		}
		next(w, withAuthenticatedMember(r, member), member.ID)
	}
}

func (s *Server) withAdmin(next func(http.ResponseWriter, *http.Request, int64)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		member, err := s.members.GetBySession(sessionToken(r))
		if err != nil {
			writeError(w, http.StatusUnauthorized, err.Error())
			return
		}
		if !member.IsAdmin && !s.cfg.DemoMode {
			writeError(w, http.StatusForbidden, "admin access required")
			return
		}
		next(w, withAuthenticatedMember(r, member), member.ID)
	}
}

func isProposalAccessError(err error) bool {
	return errors.Is(err, errProposalAccessForbidden) || errors.Is(err, errProposalAccessRequiresGroup)
}

func walletVerifyErrorResponse(err error) (int, string) {
	switch {
	case errors.Is(err, service.ErrDisplayNameRequired),
		errors.Is(err, service.ErrInvalidRegistrationInviteCode),
		errors.Is(err, service.ErrSelfRegistrationInviteCode):
		return http.StatusBadRequest, err.Error()
	case errors.Is(err, service.ErrWalletAuthChallengeNotFound),
		errors.Is(err, service.ErrWalletAuthChallengeExpired),
		errors.Is(err, service.ErrWalletVerificationFailed):
		return http.StatusUnauthorized, service.ErrWalletVerificationFailed.Error()
	default:
		return http.StatusInternalServerError, "wallet verification failed"
	}
}

func handlerBusinessLocation() *time.Location {
	location, err := time.LoadLocation("Asia/Taipei")
	if err != nil {
		return time.Local
	}
	return location
}

func normalizeWalletAddressForProfileLookup(wallet string) (string, error) {
	wallet = strings.TrimSpace(wallet)
	if wallet == "" {
		return "", errors.New("wallet address is required")
	}
	if !common.IsHexAddress(wallet) {
		return "", errors.New("invalid wallet address")
	}
	return common.HexToAddress(wallet).Hex(), nil
}

func csvValue(row []string, headers map[string]int, column string) string {
	index, ok := headers[column]
	if !ok || index >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[index])
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
	if cfg.MaxRequests == 0 {
		return next
	}
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

// ── Group handlers ────────────────────────────────────────────────────────────

func (s *Server) handleCreateGroup(w http.ResponseWriter, r *http.Request, memberID int64) {
	var body struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(body.Name) == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	group, err := s.groupRepo.CreateGroup(memberID, body.Name, body.Description)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	inviteCode, err := generateGroupInviteCode()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	invite, err := s.groupRepo.CreateInvite(group.ID, memberID, inviteCode)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	group.InviteCode = invite.InviteCode
	writeJSON(w, http.StatusCreated, group)
}

func (s *Server) handleListGroups(w http.ResponseWriter, r *http.Request, memberID int64) {
	groups, err := s.groupRepo.ListMemberGroups(memberID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if groups == nil {
		groups = []*models.Group{}
	}
	writeJSON(w, http.StatusOK, groups)
}

func (s *Server) handleGetGroup(w http.ResponseWriter, r *http.Request, memberID int64) {
	groupID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid group id")
		return
	}
	isMember, err := s.groupRepo.IsMember(groupID, memberID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !isMember {
		writeError(w, http.StatusForbidden, "not a member of this group")
		return
	}
	group, err := s.groupRepo.GetGroup(groupID)
	if err != nil {
		writeError(w, http.StatusNotFound, "group not found")
		return
	}
	writeJSON(w, http.StatusOK, group)
}

func (s *Server) handleCreateGroupInvite(w http.ResponseWriter, r *http.Request, memberID int64) {
	groupID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid group id")
		return
	}
	isMember, err := s.groupRepo.IsMember(groupID, memberID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !isMember {
		writeError(w, http.StatusForbidden, "not a member of this group")
		return
	}
	inviteCode, err := generateGroupInviteCode()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	invite, err := s.groupRepo.CreateInvite(groupID, memberID, inviteCode)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, invite)
}

// generateGroupInviteCode returns 8 cryptographically random hex characters.
func generateGroupInviteCode() (string, error) {
	buf := make([]byte, 4) // 4 bytes = 8 hex characters
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("failed to generate invite code: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

func (s *Server) handleJoinGroup(w http.ResponseWriter, r *http.Request, memberID int64) {
	code := strings.TrimSpace(r.PathValue("code"))
	if code == "" {
		writeError(w, http.StatusBadRequest, "invite code is required")
		return
	}
	invite, err := s.groupRepo.GetInviteByCode(code)
	if err != nil {
		writeError(w, http.StatusNotFound, "invite not found")
		return
	}
	if err := s.groupRepo.AddMember(invite.GroupID, memberID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	group, err := s.groupRepo.GetGroup(invite.GroupID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, group)
}

func (s *Server) handleLeaveGroup(w http.ResponseWriter, r *http.Request, memberID int64) {
	groupID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid group id")
		return
	}
	isMember, err := s.groupRepo.IsMember(groupID, memberID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !isMember {
		writeError(w, http.StatusForbidden, "not a member of this group")
		return
	}
	group, err := s.groupRepo.GetGroup(groupID)
	if err != nil {
		writeError(w, http.StatusNotFound, "group not found")
		return
	}
	if group.OwnerMemberID == memberID {
		if len(group.Members) == 1 {
			if err := s.groupRepo.DeleteGroup(groupID); err != nil {
				writeError(w, http.StatusInternalServerError, err.Error())
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{
				"success": true,
				"groupId": groupID,
				"deleted": true,
			})
			return
		}
		writeError(w, http.StatusBadRequest, "group owner cannot leave while other members remain")
		return
	}
	if err := s.groupRepo.RemoveMember(groupID, memberID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"groupId": groupID,
	})
}

// ── Faucet handler ────────────────────────────────────────────────────────────

func (s *Server) handleClaimFaucet(w http.ResponseWriter, r *http.Request, memberID int64) {
	member, err := s.members.GetByID(memberID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "member not found")
		return
	}
	newBalance, err := s.faucetRepo.ClaimFaucet(memberID, member.WalletAddress)
	if err != nil {
		if errors.Is(err, repository.ErrAlreadyClaimed) {
			writeError(w, http.StatusConflict, "already claimed")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"tokensAdded": 100,
		"newBalance":  newBalance,
	})
}

func (s *Server) handleSubscriptionPay(w http.ResponseWriter, r *http.Request, memberID int64) {
	var body struct {
		TokenAmount int64 `json:"tokenAmount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.TokenAmount != subscriptionTokenCost {
		writeError(w, http.StatusBadRequest, "subscription requires exactly 99 tokens")
		return
	}
	member, err := s.members.GetByID(memberID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	base := time.Now().UTC()
	if member.SubscriptionExpiresAt.After(base) {
		base = member.SubscriptionExpiresAt
	}
	nextExpiry := base.Add(subscriptionDuration)
	if err := s.faucetRepo.DeductTokensAndSubscribe(memberID, subscriptionTokenCost, nextExpiry); err != nil {
		log.Printf("CRITICAL: atomic subscription payment failed for member %d: %v", memberID, err)
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := s.usageRepo.LogUsage(memberID, 0, "subscribe", "token", "debit", fmt.Sprintf("%d", subscriptionTokenCost), "本地月訂閱", "local"); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	member, err = s.members.GetByID(memberID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"message":             "subscription activated",
		"tokenBalance":        member.TokenBalance,
		"subscriptionActive":  member.SubscriptionActive,
		"subscriptionExpires": member.SubscriptionExpiresAt,
	})
}

// ── Demo seed handler ─────────────────────────────────────────────────────────

func (s *Server) handleDemoSeed(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.DemoMode {
		writeError(w, http.StatusForbidden, "demo mode not enabled")
		return
	}

	type demoUser struct {
		email       string
		displayName string
	}
	demoUsers := []demoUser{
		{"alice@demo.local", "Alice"},
		{"bob@demo.local", "Bob"},
		{"carol@demo.local", "Carol"},
		{"dan@demo.local", "Dan"},
		{"eve@demo.local", "Eve"},
	}

	hash, err := bcrypt.GenerateFromPassword([]byte("demo123"), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to hash password")
		return
	}
	passwordHash := string(hash)

	memberIDs := make([]int64, 0, len(demoUsers))
	memberNames := make([]string, 0, len(demoUsers))

	for _, u := range demoUsers {
		existing, lookupErr := s.members.GetByEmail(u.email)
		if lookupErr == nil {
			memberIDs = append(memberIDs, existing.ID)
			memberNames = append(memberNames, existing.DisplayName)
			continue
		}
		avatarURL := fmt.Sprintf("https://api.dicebear.com/9.x/shapes/svg?seed=%s", u.displayName)
		id, createErr := s.members.CreateMember(u.email, passwordHash, u.displayName, false, 100, avatarURL)
		if createErr != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to create member %s: %v", u.email, createErr))
			return
		}
		memberIDs = append(memberIDs, id)
		memberNames = append(memberNames, u.displayName)
	}

	aliceID := memberIDs[0]

	// Get or create group owned by Alice
	group, err := s.groupRepo.GetGroupByOwnerAndName(aliceID, "Acme Office")
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to look up group: %v", err))
			return
		}
		// Group does not exist yet — create it
		group, err = s.groupRepo.CreateGroup(aliceID, "Acme Office", "Demo office group")
		if err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to create group: %v", err))
			return
		}

		inviteCode, err := generateGroupInviteCode()
		if err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to generate invite code: %v", err))
			return
		}
		invite, err := s.groupRepo.CreateInvite(group.ID, aliceID, inviteCode)
		if err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to create invite: %v", err))
			return
		}
		group.InviteCode = invite.InviteCode

		// Add Bob, Carol, Dan, Eve to the group
		for _, id := range memberIDs[1:] {
			if addErr := s.groupRepo.AddMember(group.ID, id); addErr != nil {
				writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to add member to group: %v", addErr))
				return
			}
		}
	}

	// Get or create a proposal in the group
	var proposal *models.Proposal
	existingProposalID, err := s.adminRepo.GetProposalIDByGroupAndTitle(group.ID, "Friday Office Lunch")
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to look up proposal: %v", err))
		return
	}
	if errors.Is(err, sql.ErrNoRows) {
		now := time.Now().UTC()
		proposal, err = s.proposals.CreateWithDeadlines(
			aliceID,
			"Friday Office Lunch",
			"Demo proposal for the Acme Office group",
			"all",
			"lunch",
			"",
			5,
			memberNames[0],
			now.Add(5*time.Minute),
			now.Add(10*time.Minute),
			now.Add(20*time.Minute),
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to create proposal: %v", err))
			return
		}
		if err := s.adminRepo.SetProposalGroupID(proposal.ID, group.ID); err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to link proposal to group: %v", err))
			return
		}
	} else {
		proposal, err = s.proposals.Get(existingProposalID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to get existing proposal: %v", err))
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"group":    group,
		"proposal": proposal,
		"members":  memberNames,
	})
}

// ── Admin proposal stage advance handler ─────────────────────────────────────

func (s *Server) handleAdvanceProposalStage(w http.ResponseWriter, r *http.Request, memberID int64) {
	_ = memberID
	proposalID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid proposal id")
		return
	}
	var body struct {
		Stage string `json:"stage"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := s.adminRepo.AdvanceProposalStage(proposalID, body.Stage); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	proposal, err := s.proposals.Get(proposalID)
	if err != nil {
		writeError(w, http.StatusNotFound, "proposal not found")
		return
	}
	writeJSON(w, http.StatusOK, proposal)
}
