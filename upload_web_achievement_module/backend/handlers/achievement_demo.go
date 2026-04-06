package handlers

import (
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	defaultAchievementDemoDataFile  = "data/achievement-demo.json"
	achievementCommentReward        = 5
	achievementReplyReward          = 2
	achievementReplyReceivedReward  = 1
	achievementMinContentLength     = 4
	achievementDuplicateWindow      = 60 * time.Second
	achievementPostCooldownDuration = 5 * time.Second
)

var achievementAllowedCategories = map[string]string{
	"餐點":   "餐點",
	"服務":   "服務",
	"環境":   "環境",
	"價格":   "價格",
	"出餐速度": "出餐速度",
	"推薦程度": "推薦程度",
	"其他":   "其他",
}

type achievementDemoComment struct {
	ID            int64     `json:"id"`
	StoreID       string    `json:"storeId"`
	WalletAddress string    `json:"walletAddress"`
	Category      string    `json:"category"`
	Rating        int       `json:"rating,omitempty"`
	Content       string    `json:"content"`
	ParentID      *int64    `json:"parentId,omitempty"`
	CreatedAt     time.Time `json:"createdAt"`
}

type achievementDemoLog struct {
	WalletAddress string    `json:"walletAddress"`
	Points        int       `json:"points"`
	Reason        string    `json:"reason"`
	SourceID      int64     `json:"sourceId"`
	CreatedAt     time.Time `json:"createdAt"`
}

type achievementDemoSummary struct {
	WalletAddress      string    `json:"walletAddress"`
	TotalPoints        int       `json:"totalPoints"`
	CommentCount       int       `json:"commentCount"`
	ReplyCount         int       `json:"replyCount"`
	ReceivedReplyCount int       `json:"receivedReplyCount"`
	UpdatedAt          time.Time `json:"updatedAt"`
}

type achievementDemoReplyResponse struct {
	ID            int64     `json:"id"`
	WalletAddress string    `json:"walletAddress"`
	Content       string    `json:"content"`
	CreatedAt     time.Time `json:"createdAt"`
}

type achievementDemoCommentResponse struct {
	ID            int64                          `json:"id"`
	StoreID       string                         `json:"storeId"`
	WalletAddress string                         `json:"walletAddress"`
	Category      string                         `json:"category"`
	Rating        int                            `json:"rating,omitempty"`
	Content       string                         `json:"content"`
	CreatedAt     time.Time                      `json:"createdAt"`
	Replies       []achievementDemoReplyResponse `json:"replies"`
}

type achievementDemoUserResponse struct {
	WalletAddress string                 `json:"walletAddress"`
	TotalPoints   int                    `json:"totalPoints"`
	Logs          []achievementDemoLog   `json:"logs"`
	Summary       achievementDemoSummary `json:"summary"`
}

type achievementDemoCommentRequest struct {
	StoreID       string `json:"storeId"`
	WalletAddress string `json:"walletAddress"`
	Category      string `json:"category"`
	Rating        int    `json:"rating"`
	Content       string `json:"content"`
}

type achievementDemoReplyRequest struct {
	CommentID     int64  `json:"commentId"`
	WalletAddress string `json:"walletAddress"`
	Content       string `json:"content"`
}

type achievementDemoRankingEntry struct {
	Rank               int    `json:"rank"`
	WalletAddress      string `json:"walletAddress"`
	TotalPoints        int    `json:"totalPoints"`
	CommentCount       int    `json:"commentCount"`
	ReplyCount         int    `json:"replyCount"`
	ReceivedReplyCount int    `json:"receivedReplyCount"`
}

type achievementDemoRatingBreakdown struct {
	Five  int `json:"five"`
	Four  int `json:"four"`
	Three int `json:"three"`
	Two   int `json:"two"`
	One   int `json:"one"`
}

type achievementDemoStoreSummary struct {
	ID              string                         `json:"id"`
	CommentCount    int                            `json:"commentCount"`
	ReplyCount      int                            `json:"replyCount"`
	AverageRating   float64                        `json:"averageRating"`
	RatingCount     int                            `json:"ratingCount"`
	RatingBreakdown achievementDemoRatingBreakdown `json:"ratingBreakdown"`
	LatestComment   string                         `json:"latestComment,omitempty"`
}

type achievementDemoState struct {
	NextID    int64                              `json:"nextId"`
	Comments  map[int64]achievementDemoComment   `json:"comments"`
	Logs      map[string][]achievementDemoLog    `json:"logs"`
	Summaries map[string]*achievementDemoSummary `json:"summaries"`
}

type achievementDemoStore struct {
	mu        sync.RWMutex
	dataFile  string
	nextID    int64
	comments  map[int64]achievementDemoComment
	logs      map[string][]achievementDemoLog
	summaries map[string]*achievementDemoSummary
}

func newAchievementDemoStore(dataFile string) (*achievementDemoStore, error) {
	store := &achievementDemoStore{
		dataFile:  dataFile,
		nextID:    1,
		comments:  make(map[int64]achievementDemoComment),
		logs:      make(map[string][]achievementDemoLog),
		summaries: make(map[string]*achievementDemoSummary),
	}
	if err := store.load(); err != nil {
		return nil, err
	}
	return store, nil
}

func newAchievementDemoStoreWithoutPersistence() *achievementDemoStore {
	return &achievementDemoStore{
		nextID:    1,
		comments:  make(map[int64]achievementDemoComment),
		logs:      make(map[string][]achievementDemoLog),
		summaries: make(map[string]*achievementDemoSummary),
	}
}

func (s *achievementDemoStore) createComment(req achievementDemoCommentRequest) (map[string]any, error) {
	storeID := strings.TrimSpace(req.StoreID)
	walletAddress := strings.TrimSpace(req.WalletAddress)
	category := normalizeAchievementCategory(req.Category)
	content := normalizeAchievementContent(req.Content)

	switch {
	case storeID == "" || walletAddress == "" || content == "":
		return nil, errors.New("請完整填寫店家代號、錢包地址與評論內容")
	case len([]rune(content)) < achievementMinContentLength:
		return nil, errors.New("評論內容至少需要 4 個字")
	case req.Rating < 1 || req.Rating > 5:
		return nil, errors.New("評論星等必須介於 1 到 5 顆星")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.validatePostLocked(walletAddress, storeID, content); err != nil {
		return nil, err
	}

	id := s.nextID
	s.nextID++
	now := time.Now().UTC()

	s.comments[id] = achievementDemoComment{
		ID:            id,
		StoreID:       storeID,
		WalletAddress: walletAddress,
		Category:      category,
		Rating:        req.Rating,
		Content:       content,
		CreatedAt:     now,
	}

	s.addPointsLocked(walletAddress, achievementCommentReward, "comment_reward", id, now)
	s.summaryForLocked(walletAddress).CommentCount++

	if err := s.saveLocked(); err != nil {
		return nil, err
	}

	return map[string]any{
		"message":     "評論建立成功",
		"commentId":   id,
		"pointsAdded": achievementCommentReward,
		"totalPoints": s.summaries[walletAddress].TotalPoints,
	}, nil
}

func (s *achievementDemoStore) createReply(req achievementDemoReplyRequest) (map[string]any, error) {
	walletAddress := strings.TrimSpace(req.WalletAddress)
	content := normalizeAchievementContent(req.Content)

	switch {
	case req.CommentID <= 0 || walletAddress == "" || content == "":
		return nil, errors.New("請完整填寫留言編號、錢包地址與回覆內容")
	case len([]rune(content)) < achievementMinContentLength:
		return nil, errors.New("回覆內容至少需要 4 個字")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	parent, ok := s.comments[req.CommentID]
	switch {
	case !ok || parent.ParentID != nil:
		return nil, errors.New("找不到可回覆的評論")
	case strings.EqualFold(parent.WalletAddress, walletAddress):
		return nil, errors.New("不能回覆自己的評論來獲得互動積分")
	case s.hasRewardedReplyLocked(walletAddress, req.CommentID):
		return nil, errors.New("同一個錢包對同一則評論只能獲得一次回覆積分")
	}

	if err := s.validatePostLocked(walletAddress, parent.StoreID, content); err != nil {
		return nil, err
	}

	id := s.nextID
	s.nextID++
	now := time.Now().UTC()
	parentID := parent.ID

	s.comments[id] = achievementDemoComment{
		ID:            id,
		StoreID:       parent.StoreID,
		WalletAddress: walletAddress,
		Category:      parent.Category,
		Content:       content,
		ParentID:      &parentID,
		CreatedAt:     now,
	}

	s.addPointsLocked(walletAddress, achievementReplyReward, "reply_reward", id, now)
	s.summaryForLocked(walletAddress).ReplyCount++

	if !s.hasReceivedRewardFromReplierLocked(parent.WalletAddress, walletAddress, req.CommentID) {
		s.addPointsLocked(parent.WalletAddress, achievementReplyReceivedReward, "reply_received_reward", id, now)
		s.summaryForLocked(parent.WalletAddress).ReceivedReplyCount++
	}

	if err := s.saveLocked(); err != nil {
		return nil, err
	}

	return map[string]any{
		"message":                 "回覆建立成功",
		"replyId":                 id,
		"replierPointsAdded":      achievementReplyReward,
		"commentOwnerPointsAdded": achievementReplyReceivedReward,
	}, nil
}

func (s *achievementDemoStore) listComments(storeID string) []achievementDemoCommentResponse {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var roots []achievementDemoComment
	repliesByParent := make(map[int64][]achievementDemoComment)

	for _, comment := range s.comments {
		if comment.StoreID != storeID {
			continue
		}
		if comment.ParentID == nil {
			roots = append(roots, comment)
			continue
		}
		repliesByParent[*comment.ParentID] = append(repliesByParent[*comment.ParentID], comment)
	}

	sort.Slice(roots, func(i, j int) bool { return roots[i].ID < roots[j].ID })

	result := make([]achievementDemoCommentResponse, 0, len(roots))
	for _, root := range roots {
		replies := repliesByParent[root.ID]
		sort.Slice(replies, func(i, j int) bool { return replies[i].ID < replies[j].ID })

		item := achievementDemoCommentResponse{
			ID:            root.ID,
			StoreID:       root.StoreID,
			WalletAddress: root.WalletAddress,
			Category:      normalizeAchievementCategory(root.Category),
			Rating:        normalizeAchievementRating(root.Rating),
			Content:       root.Content,
			CreatedAt:     root.CreatedAt,
			Replies:       make([]achievementDemoReplyResponse, 0, len(replies)),
		}
		for _, reply := range replies {
			item.Replies = append(item.Replies, achievementDemoReplyResponse{
				ID:            reply.ID,
				WalletAddress: reply.WalletAddress,
				Content:       reply.Content,
				CreatedAt:     reply.CreatedAt,
			})
		}
		result = append(result, item)
	}
	return result
}

func (s *achievementDemoStore) getUser(walletAddress string) achievementDemoUserResponse {
	s.mu.RLock()
	defer s.mu.RUnlock()

	logs := append([]achievementDemoLog(nil), s.logs[walletAddress]...)
	sort.Slice(logs, func(i, j int) bool { return logs[i].CreatedAt.Before(logs[j].CreatedAt) })

	summary := achievementDemoSummary{WalletAddress: walletAddress}
	if existing, ok := s.summaries[walletAddress]; ok {
		summary = *existing
	}

	return achievementDemoUserResponse{
		WalletAddress: walletAddress,
		TotalPoints:   summary.TotalPoints,
		Logs:          logs,
		Summary:       summary,
	}
}

func (s *achievementDemoStore) getRanking(limit int) []achievementDemoRankingEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if limit <= 0 {
		limit = 10
	}

	items := make([]achievementDemoRankingEntry, 0, len(s.summaries))
	for _, summary := range s.summaries {
		items = append(items, achievementDemoRankingEntry{
			WalletAddress:      summary.WalletAddress,
			TotalPoints:        summary.TotalPoints,
			CommentCount:       summary.CommentCount,
			ReplyCount:         summary.ReplyCount,
			ReceivedReplyCount: summary.ReceivedReplyCount,
		})
	}

	sort.Slice(items, func(i, j int) bool {
		if items[i].TotalPoints == items[j].TotalPoints {
			return items[i].WalletAddress < items[j].WalletAddress
		}
		return items[i].TotalPoints > items[j].TotalPoints
	})

	if len(items) > limit {
		items = items[:limit]
	}
	for i := range items {
		items[i].Rank = i + 1
	}
	return items
}

func (s *achievementDemoStore) listStores() []achievementDemoStoreSummary {
	s.mu.RLock()
	defer s.mu.RUnlock()

	type aggregate struct {
		commentCount  int
		replyCount    int
		ratingTotal   int
		ratingCount   int
		breakdown     achievementDemoRatingBreakdown
		latestComment string
		latestTime    time.Time
	}

	aggregates := make(map[string]*aggregate)
	for _, comment := range s.comments {
		item := aggregates[comment.StoreID]
		if item == nil {
			item = &aggregate{}
			aggregates[comment.StoreID] = item
		}

		if comment.ParentID == nil {
			item.commentCount++
			rating := normalizeAchievementRating(comment.Rating)
			item.ratingTotal += rating
			item.ratingCount++
			switch rating {
			case 5:
				item.breakdown.Five++
			case 4:
				item.breakdown.Four++
			case 3:
				item.breakdown.Three++
			case 2:
				item.breakdown.Two++
			case 1:
				item.breakdown.One++
			}
		} else {
			item.replyCount++
		}

		if comment.CreatedAt.After(item.latestTime) {
			item.latestTime = comment.CreatedAt
			item.latestComment = comment.Content
		}
	}

	results := make([]achievementDemoStoreSummary, 0, len(aggregates))
	for id, item := range aggregates {
		average := 0.0
		if item.ratingCount > 0 {
			average = math.Round((float64(item.ratingTotal)/float64(item.ratingCount))*10) / 10
		}
		results = append(results, achievementDemoStoreSummary{
			ID:              id,
			CommentCount:    item.commentCount,
			ReplyCount:      item.replyCount,
			AverageRating:   average,
			RatingCount:     item.ratingCount,
			RatingBreakdown: item.breakdown,
			LatestComment:   item.latestComment,
		})
	}

	sort.Slice(results, func(i, j int) bool { return results[i].ID < results[j].ID })
	return results
}

func (s *achievementDemoStore) validatePostLocked(walletAddress, storeID, content string) error {
	now := time.Now().UTC()
	normalized := strings.ToLower(content)

	for _, comment := range s.comments {
		if !strings.EqualFold(comment.WalletAddress, walletAddress) {
			continue
		}
		if now.Sub(comment.CreatedAt) < achievementPostCooldownDuration {
			return errors.New("發文太頻繁，請稍後再試")
		}
		if comment.StoreID == storeID &&
			strings.ToLower(comment.Content) == normalized &&
			now.Sub(comment.CreatedAt) < achievementDuplicateWindow {
			return errors.New("短時間內送出了重複內容，請稍後再試")
		}
	}
	return nil
}

func (s *achievementDemoStore) hasRewardedReplyLocked(walletAddress string, parentCommentID int64) bool {
	for _, comment := range s.comments {
		if comment.ParentID == nil {
			continue
		}
		if *comment.ParentID != parentCommentID {
			continue
		}
		if strings.EqualFold(comment.WalletAddress, walletAddress) {
			return true
		}
	}
	return false
}

func (s *achievementDemoStore) hasReceivedRewardFromReplierLocked(parentAuthor, replier string, parentCommentID int64) bool {
	for _, logItem := range s.logs[parentAuthor] {
		if logItem.Reason != "reply_received_reward" {
			continue
		}
		replyComment, ok := s.comments[logItem.SourceID]
		if !ok || replyComment.ParentID == nil {
			continue
		}
		if *replyComment.ParentID != parentCommentID {
			continue
		}
		if strings.EqualFold(replyComment.WalletAddress, replier) {
			return true
		}
	}
	return false
}

func (s *achievementDemoStore) summaryForLocked(walletAddress string) *achievementDemoSummary {
	if _, ok := s.summaries[walletAddress]; !ok {
		s.summaries[walletAddress] = &achievementDemoSummary{WalletAddress: walletAddress}
	}
	return s.summaries[walletAddress]
}

func (s *achievementDemoStore) addPointsLocked(walletAddress string, points int, reason string, sourceID int64, createdAt time.Time) {
	summary := s.summaryForLocked(walletAddress)
	summary.TotalPoints += points
	summary.UpdatedAt = createdAt
	s.logs[walletAddress] = append(s.logs[walletAddress], achievementDemoLog{
		WalletAddress: walletAddress,
		Points:        points,
		Reason:        reason,
		SourceID:      sourceID,
		CreatedAt:     createdAt,
	})
}

func (s *achievementDemoStore) load() error {
	if s.dataFile == "" {
		return nil
	}
	data, err := os.ReadFile(s.dataFile)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}
	if len(data) == 0 {
		return nil
	}
	var state achievementDemoState
	if err := json.Unmarshal(data, &state); err != nil {
		return err
	}
	if state.NextID > 0 {
		s.nextID = state.NextID
	}
	if state.Comments != nil {
		s.comments = state.Comments
	}
	if state.Logs != nil {
		s.logs = state.Logs
	}
	if state.Summaries != nil {
		s.summaries = state.Summaries
	}
	s.rebuildSummaryStatsLocked()
	return nil
}

func (s *achievementDemoStore) saveLocked() error {
	if s.dataFile == "" {
		return nil
	}
	state := achievementDemoState{
		NextID:    s.nextID,
		Comments:  s.comments,
		Logs:      s.logs,
		Summaries: s.summaries,
	}
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(s.dataFile), 0o755); err != nil {
		return err
	}
	tempFile := s.dataFile + ".tmp"
	if err := os.WriteFile(tempFile, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tempFile, s.dataFile)
}

func (s *achievementDemoStore) rebuildSummaryStatsLocked() {
	for walletAddress, summary := range s.summaries {
		if summary == nil {
			s.summaries[walletAddress] = &achievementDemoSummary{WalletAddress: walletAddress}
			continue
		}
		summary.CommentCount = 0
		summary.ReplyCount = 0
		summary.ReceivedReplyCount = 0
	}

	for id, comment := range s.comments {
		comment.Category = normalizeAchievementCategory(comment.Category)
		if comment.ParentID == nil {
			comment.Rating = normalizeAchievementRating(comment.Rating)
		} else {
			comment.Rating = 0
		}
		s.comments[id] = comment

		summary := s.summaryForLocked(comment.WalletAddress)
		if comment.ParentID == nil {
			summary.CommentCount++
		} else {
			summary.ReplyCount++
		}
	}

	for walletAddress, logs := range s.logs {
		summary := s.summaryForLocked(walletAddress)
		for _, logItem := range logs {
			if logItem.Reason == "reply_received_reward" {
				summary.ReceivedReplyCount++
			}
		}
	}
}

func normalizeAchievementContent(value string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
}

func normalizeAchievementCategory(value string) string {
	category := strings.TrimSpace(value)
	if category == "" {
		return "其他"
	}
	if normalized, ok := achievementAllowedCategories[category]; ok {
		return normalized
	}
	return "其他"
}

func normalizeAchievementRating(value int) int {
	if value < 1 || value > 5 {
		return 5
	}
	return value
}

func (s *Server) handleAchievementDemoCreateComment(w http.ResponseWriter, r *http.Request) {
	var req achievementDemoCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "評論請求格式不正確")
		return
	}
	result, err := s.achievementDemo.createComment(req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleAchievementDemoCreateReply(w http.ResponseWriter, r *http.Request) {
	var req achievementDemoReplyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "回覆請求格式不正確")
		return
	}
	result, err := s.achievementDemo.createReply(req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleAchievementDemoGetUser(w http.ResponseWriter, r *http.Request) {
	walletAddress := strings.TrimSpace(r.URL.Query().Get("walletAddress"))
	if walletAddress == "" {
		writeError(w, http.StatusBadRequest, "請提供錢包地址")
		return
	}
	writeJSON(w, http.StatusOK, s.achievementDemo.getUser(walletAddress))
}

func (s *Server) handleAchievementDemoGetRanking(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("limit")))
	writeJSON(w, http.StatusOK, s.achievementDemo.getRanking(limit))
}

func (s *Server) handleAchievementDemoListComments(w http.ResponseWriter, r *http.Request) {
	storeID := strings.TrimSpace(r.URL.Query().Get("storeId"))
	if storeID == "" {
		writeError(w, http.StatusBadRequest, "請提供店家代號")
		return
	}
	writeJSON(w, http.StatusOK, s.achievementDemo.listComments(storeID))
}

func (s *Server) handleAchievementDemoListStores(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, s.achievementDemo.listStores())
}
