package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

const defaultAchievementDemoDataFile = "data/achievement-demo.json"

func newDemoStoreWithoutPersistence() *DemoStore {
	return &DemoStore{
		nextID:      1,
		comments:    make(map[int64]Comment),
		logs:        make(map[string][]AchievementLog),
		summaries:   make(map[string]*UserAchievementSummary),
		badges:      make(map[string]map[string]*UserBadge),
		spentPoints: make(map[string]int),
		redemptions: make(map[string][]Redemption),
	}
}

func (s *Server) handleAchievementDemoCreateComment(w http.ResponseWriter, r *http.Request) {
	var req CreateCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "評論請求格式錯誤")
		return
	}

	result, err := s.achievementDemo.CreateComment(req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleAchievementDemoCreateReply(w http.ResponseWriter, r *http.Request) {
	var req CreateReplyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "回覆請求格式錯誤")
		return
	}

	result, err := s.achievementDemo.CreateReply(req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleAchievementDemoGetUser(w http.ResponseWriter, r *http.Request) {
	walletAddress := strings.TrimSpace(r.URL.Query().Get("walletAddress"))
	if walletAddress == "" {
		writeError(w, http.StatusBadRequest, "缺少錢包地址")
		return
	}
	writeJSON(w, http.StatusOK, s.achievementDemo.GetUserAchievements(walletAddress))
}

func (s *Server) handleAchievementDemoGetRanking(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("limit")))
	writeJSON(w, http.StatusOK, s.achievementDemo.GetRanking(limit))
}

func (s *Server) handleAchievementDemoListComments(w http.ResponseWriter, r *http.Request) {
	storeID := strings.TrimSpace(r.URL.Query().Get("storeId"))
	if storeID == "" {
		writeError(w, http.StatusBadRequest, "缺少店家編號")
		return
	}
	writeJSON(w, http.StatusOK, s.achievementDemo.GetComments(storeID))
}

func (s *Server) handleAchievementDemoListStores(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, s.achievementDemo.ListStores())
}

func (s *Server) handleAchievementDemoCityOverview(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, s.achievementDemo.GetCityOverview())
}

func (s *Server) handleAchievementDemoBadgeCatalog(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, s.achievementDemo.GetBadgeCatalog())
}

func (s *Server) handleAchievementDemoPersonalBadgeCatalog(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, s.achievementDemo.GetPersonalBadgeCatalog())
}

func (s *Server) handleAchievementDemoStoreBadgeCatalog(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, s.achievementDemo.GetStoreBadgeCatalog())
}

func (s *Server) handleAchievementDemoUserBadges(w http.ResponseWriter, r *http.Request) {
	walletAddress := strings.TrimSpace(r.URL.Query().Get("walletAddress"))
	if walletAddress == "" {
		writeError(w, http.StatusBadRequest, "缺少錢包地址")
		return
	}
	writeJSON(w, http.StatusOK, s.achievementDemo.GetUserBadges(walletAddress))
}

func (s *Server) handleAchievementDemoPersonalBadges(w http.ResponseWriter, r *http.Request) {
	walletAddress := strings.TrimSpace(r.URL.Query().Get("walletAddress"))
	if walletAddress == "" {
		writeError(w, http.StatusBadRequest, "缺少錢包地址")
		return
	}
	writeJSON(w, http.StatusOK, s.achievementDemo.GetPersonalBadges(walletAddress))
}

func (s *Server) handleAchievementDemoStoreBadges(w http.ResponseWriter, r *http.Request) {
	storeID := strings.TrimSpace(r.URL.Query().Get("storeId"))
	if storeID == "" {
		writeError(w, http.StatusBadRequest, "缺少店家編號")
		return
	}
	writeJSON(w, http.StatusOK, s.achievementDemo.GetStoreBadges(storeID))
}

func (s *Server) handleAchievementDemoEvolveBadge(w http.ResponseWriter, r *http.Request) {
	var req EvolveBadgeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "勳章演化請求格式錯誤")
		return
	}

	result, err := s.achievementDemo.EvolveBadge(req.WalletAddress, req.BadgeType)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleAchievementDemoPersonalEvolveBadge(w http.ResponseWriter, r *http.Request) {
	var req EvolveBadgeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "勳章演化請求格式錯誤")
		return
	}

	result, err := s.achievementDemo.EvolvePersonalBadge(req.WalletAddress, req.BadgeType)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleAchievementDemoRewardCatalog(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, s.achievementDemo.GetRewardCatalog())
}

func (s *Server) handleAchievementDemoRedeemReward(w http.ResponseWriter, r *http.Request) {
	var req RedeemRewardRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "獎勵兌換請求格式錯誤")
		return
	}

	result, err := s.achievementDemo.RedeemReward(req.WalletAddress, req.RewardID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}
