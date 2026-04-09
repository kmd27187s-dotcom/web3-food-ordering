package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

var allowedCategories = map[string]string{
	"food":           "food",
	"service":        "service",
	"environment":    "environment",
	"price":          "price",
	"speed":          "speed",
	"recommendation": "recommendation",
	"other":          "other",
}

var floorThresholds = []int{0, 8, 16, 26, 38, 52, 68, 86, 106, 130, 156, 184}

type DemoStore struct {
	mu          sync.RWMutex
	dataFile    string
	nextID      int64
	comments    map[int64]Comment
	logs        map[string][]AchievementLog
	summaries   map[string]*UserAchievementSummary
	badges      map[string]map[string]*UserBadge
	spentPoints map[string]int
	redemptions map[string][]Redemption
}

func NewDemoStore(dataFile string) (*DemoStore, error) {
	store := &DemoStore{
		dataFile:    dataFile,
		nextID:      1,
		comments:    make(map[int64]Comment),
		logs:        make(map[string][]AchievementLog),
		summaries:   make(map[string]*UserAchievementSummary),
		badges:      make(map[string]map[string]*UserBadge),
		spentPoints: make(map[string]int),
		redemptions: make(map[string][]Redemption),
	}

	if err := store.load(); err != nil {
		return nil, err
	}

	return store, nil
}

func (s *DemoStore) CreateComment(req CreateCommentRequest) (map[string]any, error) {
	storeID := strings.TrimSpace(req.StoreID)
	walletAddress := strings.TrimSpace(req.WalletAddress)
	category := normalizeCategory(req.Category)
	content := normalizeContent(req.Content)

	switch {
	case storeID == "" || walletAddress == "" || content == "":
		return nil, errors.New("隢??游‵撖怠?摰嗚?閮??蝔梯?閰??批捆")
	case len([]rune(content)) < minContentLength:
		return nil, fmt.Errorf("閰??批捆?喳??閬?%d ??", minContentLength)
	case req.Rating < 1 || req.Rating > 5:
		return nil, errors.New("??敹?隞 1 ??5 銋?")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.validateNewPostLocked(walletAddress, storeID, content); err != nil {
		return nil, err
	}

	id := s.nextID
	s.nextID++
	now := time.Now().UTC()

	s.comments[id] = Comment{
		ID:            id,
		StoreID:       storeID,
		WalletAddress: walletAddress,
		Category:      category,
		Rating:        req.Rating,
		Content:       content,
		CreatedAt:     now,
	}

	s.addPointsLocked(walletAddress, commentReward, "comment_reward", id, now)
	s.summaryForLocked(walletAddress).CommentCount++

	if err := s.saveLocked(); err != nil {
		return nil, err
	}

	return map[string]any{
		"message":     "評論建立成功",
		"commentId":   id,
		"pointsAdded": commentReward,
		"totalPoints": s.summaries[walletAddress].TotalPoints,
	}, nil
}

func (s *DemoStore) CreateReply(req CreateReplyRequest) (map[string]any, error) {
	walletAddress := strings.TrimSpace(req.WalletAddress)
	content := normalizeContent(req.Content)

	switch {
	case req.CommentID <= 0 || walletAddress == "" || content == "":
		return nil, errors.New("請完整填寫回覆留言所需資料")
	case len([]rune(content)) < minContentLength:
		return nil, fmt.Errorf("???批捆?喳??閬?%d ??", minContentLength)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	parent, ok := s.comments[req.CommentID]
	switch {
	case !ok || parent.ParentID != nil:
		return nil, errors.New("找不到可回覆的原始評論")
	case strings.EqualFold(parent.WalletAddress, walletAddress):
		return nil, errors.New("不能回覆自己的評論來取得互動分數")
	case s.hasRewardedReplyLocked(walletAddress, req.CommentID):
		return nil, errors.New("同一位使用者對同一則評論只能獲得一次回覆獎勵")
	}

	if err := s.validateNewPostLocked(walletAddress, parent.StoreID, content); err != nil {
		return nil, err
	}

	id := s.nextID
	s.nextID++
	now := time.Now().UTC()
	parentID := parent.ID

	s.comments[id] = Comment{
		ID:            id,
		StoreID:       parent.StoreID,
		WalletAddress: walletAddress,
		Category:      parent.Category,
		Content:       content,
		ParentID:      &parentID,
		CreatedAt:     now,
	}

	s.addPointsLocked(walletAddress, replyReward, "reply_reward", id, now)
	s.summaryForLocked(walletAddress).ReplyCount++

	if !s.hasReceivedRewardFromReplierLocked(parent.WalletAddress, walletAddress, req.CommentID) {
		s.addPointsLocked(parent.WalletAddress, replyReceivedReward, "reply_received_reward", id, now)
		s.summaryForLocked(parent.WalletAddress).ReceivedReplyCount++
	}

	if err := s.saveLocked(); err != nil {
		return nil, err
	}

	return map[string]any{
		"message":                 "回覆建立成功",
		"replyId":                 id,
		"replierPointsAdded":      replyReward,
		"commentOwnerPointsAdded": replyReceivedReward,
	}, nil
}

func (s *DemoStore) GetComments(storeID string) []CommentResponse {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var roots []Comment
	repliesByParent := make(map[int64][]Comment)

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

	result := make([]CommentResponse, 0, len(roots))
	for _, root := range roots {
		replies := repliesByParent[root.ID]
		sort.Slice(replies, func(i, j int) bool { return replies[i].ID < replies[j].ID })

		item := CommentResponse{
			ID:            root.ID,
			StoreID:       root.StoreID,
			WalletAddress: root.WalletAddress,
			Category:      normalizeCategory(root.Category),
			Rating:        normalizeRating(root.Rating),
			Content:       root.Content,
			CreatedAt:     root.CreatedAt,
			Replies:       make([]ReplyResponse, 0, len(replies)),
		}

		for _, reply := range replies {
			item.Replies = append(item.Replies, ReplyResponse{
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

func (s *DemoStore) GetUserAchievements(walletAddress string) UserAchievementResponse {
	s.mu.RLock()
	defer s.mu.RUnlock()

	logs := append([]AchievementLog(nil), s.logs[walletAddress]...)
	sort.Slice(logs, func(i, j int) bool { return logs[i].CreatedAt.Before(logs[j].CreatedAt) })

	summary := UserAchievementSummary{WalletAddress: walletAddress}
	if existing, ok := s.summaries[walletAddress]; ok && existing != nil {
		summary = *existing
	}

	return UserAchievementResponse{
		WalletAddress: walletAddress,
		TotalPoints:   summary.TotalPoints,
		Logs:          logs,
		Summary:       summary,
	}
}

func (s *DemoStore) GetRanking(limit int) []RankingEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if limit <= 0 {
		limit = 10
	}

	items := make([]RankingEntry, 0, len(s.summaries))
	for _, summary := range s.summaries {
		if summary == nil {
			continue
		}
		items = append(items, RankingEntry{
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

func (s *DemoStore) ListStores() []StoreResponse {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.listStoresLocked()
}

func (s *DemoStore) GetCityOverview() CityOverview {
	s.mu.RLock()
	defer s.mu.RUnlock()

	buildings := s.listBuildingsLocked()
	participantSet := make(map[string]struct{})
	totalComments := 0
	totalReplies := 0

	for _, comment := range s.comments {
		participantSet[strings.ToLower(comment.WalletAddress)] = struct{}{}
		if comment.ParentID == nil {
			totalComments++
		} else {
			totalReplies++
		}
	}

	return CityOverview{
		GeneratedAt:       time.Now().UTC(),
		StoreCount:        len(buildings),
		TotalComments:     totalComments,
		TotalReplies:      totalReplies,
		TotalParticipants: len(participantSet),
		SkylineSVG:        buildSkylineSVG(buildings),
		Buildings:         buildings,
	}
}

func (s *DemoStore) Reset() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.nextID = 1
	s.comments = make(map[int64]Comment)
	s.logs = make(map[string][]AchievementLog)
	s.summaries = make(map[string]*UserAchievementSummary)
	s.badges = make(map[string]map[string]*UserBadge)
	s.spentPoints = make(map[string]int)
	s.redemptions = make(map[string][]Redemption)

	return s.saveLocked()
}

func (s *DemoStore) validateNewPostLocked(walletAddress, storeID, content string) error {
	now := time.Now().UTC()
	normalized := strings.ToLower(content)

	for _, comment := range s.comments {
		if !strings.EqualFold(comment.WalletAddress, walletAddress) {
			continue
		}

		if now.Sub(comment.CreatedAt) < postCooldownSeconds*time.Second {
			return errors.New("同一個帳號短時間內請勿重複送出留言")
		}

		if comment.StoreID == storeID &&
			strings.ToLower(comment.Content) == normalized &&
			now.Sub(comment.CreatedAt) < duplicateWindowSeconds*time.Second {
			return errors.New("?剜??銝????詨??批捆")
		}
	}

	return nil
}

func (s *DemoStore) hasRewardedReplyLocked(walletAddress string, parentCommentID int64) bool {
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

func (s *DemoStore) hasReceivedRewardFromReplierLocked(parentAuthor, replier string, parentCommentID int64) bool {
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

func (s *DemoStore) summaryForLocked(walletAddress string) *UserAchievementSummary {
	if _, ok := s.summaries[walletAddress]; !ok {
		s.summaries[walletAddress] = &UserAchievementSummary{WalletAddress: walletAddress}
	}
	return s.summaries[walletAddress]
}

func (s *DemoStore) addPointsLocked(walletAddress string, points int, reason string, sourceID int64, createdAt time.Time) {
	summary := s.summaryForLocked(walletAddress)
	summary.TotalPoints += points
	summary.UpdatedAt = createdAt

	s.logs[walletAddress] = append(s.logs[walletAddress], AchievementLog{
		WalletAddress: walletAddress,
		Points:        points,
		Reason:        reason,
		SourceID:      sourceID,
		CreatedAt:     createdAt,
	})
}

func (s *DemoStore) load() error {
	if s.dataFile == "" {
		return nil
	}

	content, err := os.ReadFile(s.dataFile)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}
	if len(content) == 0 {
		return nil
	}

	var state persistentState
	if err := json.Unmarshal(content, &state); err != nil {
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
	if state.Badges != nil {
		s.badges = state.Badges
	}
	if state.SpentPoints != nil {
		s.spentPoints = state.SpentPoints
	}
	if state.Redemptions != nil {
		s.redemptions = state.Redemptions
	}

	for walletAddress, summary := range s.summaries {
		if summary == nil {
			s.summaries[walletAddress] = &UserAchievementSummary{WalletAddress: walletAddress}
		}
	}
	for walletAddress, badgeSet := range s.badges {
		if badgeSet == nil {
			s.badges[walletAddress] = make(map[string]*UserBadge)
		}
	}
	for id, comment := range s.comments {
		comment.Category = normalizeCategory(comment.Category)
		if comment.ParentID == nil {
			comment.Rating = normalizeRating(comment.Rating)
		} else {
			comment.Rating = 0
		}
		s.comments[id] = comment
	}

	s.rebuildSummaryStatsLocked()
	return nil
}

func (s *DemoStore) saveLocked() error {
	if s.dataFile == "" {
		return nil
	}

	state := persistentState{
		NextID:      s.nextID,
		Comments:    s.comments,
		Logs:        s.logs,
		Summaries:   s.summaries,
		Badges:      s.badges,
		SpentPoints: s.spentPoints,
		Redemptions: s.redemptions,
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

func (s *DemoStore) rebuildSummaryStatsLocked() {
	for walletAddress, summary := range s.summaries {
		if summary == nil {
			s.summaries[walletAddress] = &UserAchievementSummary{WalletAddress: walletAddress}
			continue
		}
		summary.CommentCount = 0
		summary.ReplyCount = 0
		summary.ReceivedReplyCount = 0
	}

	for id, comment := range s.comments {
		comment.Category = normalizeCategory(comment.Category)
		if comment.ParentID == nil {
			comment.Rating = normalizeRating(comment.Rating)
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

func (s *DemoStore) listStoresLocked() []StoreResponse {
	type aggregate struct {
		commentCount  int
		replyCount    int
		ratingTotal   int
		ratingCount   int
		breakdown     RatingBreakdown
		latestComment string
		latestTime    time.Time
		participants  map[string]struct{}
		categorySet   map[string]struct{}
	}

	aggregates := make(map[string]*aggregate)
	for _, comment := range s.comments {
		item := aggregates[comment.StoreID]
		if item == nil {
			item = &aggregate{
				participants: make(map[string]struct{}),
				categorySet:  make(map[string]struct{}),
			}
			aggregates[comment.StoreID] = item
		}

		item.participants[strings.ToLower(comment.WalletAddress)] = struct{}{}
		if comment.Category != "" {
			item.categorySet[normalizeCategory(comment.Category)] = struct{}{}
		}

		if comment.ParentID == nil {
			item.commentCount++
			rating := normalizeRating(comment.Rating)
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

	results := make([]StoreResponse, 0, len(aggregates))
	for id, item := range aggregates {
		average := 0.0
		if item.ratingCount > 0 {
			average = math.Round((float64(item.ratingTotal)/float64(item.ratingCount))*10) / 10
		}
		results = append(results, StoreResponse{
			ID:                id,
			CommentCount:      item.commentCount,
			ReplyCount:        item.replyCount,
			ActiveWalletCount: len(item.participants),
			CategoryDiversity: len(item.categorySet),
			AverageRating:     average,
			RatingCount:       item.ratingCount,
			RatingBreakdown:   item.breakdown,
			LatestComment:     item.latestComment,
		})
	}

	sort.Slice(results, func(i, j int) bool { return results[i].ID < results[j].ID })
	return results
}

func (s *DemoStore) listBuildingsLocked() []StoreBuilding {
	stores := s.listStoresLocked()
	buildings := make([]StoreBuilding, 0, len(stores))
	for _, item := range stores {
		buildings = append(buildings, mapStoreToBuilding(item))
	}
	sort.Slice(buildings, func(i, j int) bool {
		if buildings[i].BuildingScore == buildings[j].BuildingScore {
			return buildings[i].ID < buildings[j].ID
		}
		return buildings[i].BuildingScore < buildings[j].BuildingScore
	})
	return buildings
}

func mapStoreToBuilding(store StoreResponse) StoreBuilding {
	buildingScore := (store.CommentCount * 5) + (store.ReplyCount * 2)
	buildingScore += store.ActiveWalletCount * 3
	buildingScore += store.CategoryDiversity * 2
	buildingScore += store.RatingBreakdown.Five * 2
	if store.AverageRating >= 4.5 {
		buildingScore += 8
	} else if store.AverageRating >= 4.0 {
		buildingScore += 4
	} else if store.AverageRating >= 3.0 {
		buildingScore += 2
	}

	floors := 1
	for index, threshold := range floorThresholds {
		if buildingScore >= threshold {
			floors = index + 1
		}
	}
	if floors > len(floorThresholds) {
		floors = len(floorThresholds)
	}

	nextLevelScore := floorThresholds[len(floorThresholds)-1]
	if floors < len(floorThresholds) {
		nextLevelScore = floorThresholds[floors]
	}

	stage := "木屋食堂"
	heightLevel := "起步階段"
	title := "街角木屋"
	district := "社群起步區"
	theme := "#b68c62"
	accent := "#ead1b3"
	window := "#fff4d8"
	glow := "#ffc46f"
	roofStyle := "gable"
	specialFeature := "店家剛起步，透過更多評論與星等累積，建築會逐步升級。"

	switch {
	case floors >= 10:
		stage = "地標高樓"
		heightLevel = "城市地標"
		title = "城市地標塔"
		district = "核心商圈"
		theme = "#d9bb8d"
		accent = "#f7e4bf"
		window = "#fff7dd"
		glow = "#ffd77a"
		roofStyle = "crown"
		specialFeature = "這棟建築已成為高人氣店家地標，象徵穩定口碑與高度互動。"
	case floors >= 7:
		stage = "塔樓建築"
		heightLevel = "高樓階段"
		title = "商圈塔樓"
		district = "繁華商圈"
		theme = "#c5a06e"
		accent = "#edd1aa"
		window = "#fff2d2"
		glow = "#ffc972"
		roofStyle = "spire"
		specialFeature = "建築已進入塔樓階段，顯示這家店擁有穩定評論量與高星表現。"
	case floors >= 4:
		stage = "公寓大樓"
		heightLevel = "成長階段"
		title = "社群公寓"
		district = "生活商街"
		theme = "#b98c64"
		accent = "#e8caab"
		window = "#fff0da"
		glow = "#ffc48a"
		roofStyle = "terrace"
		specialFeature = "建築已升級為公寓大樓，代表店家在社群中開始累積穩定支持。"
	}

	badges := make([]BuildingBadge, 0, 5)
	if store.AverageRating >= 4.5 && store.RatingCount > 0 {
		badges = append(badges, BuildingBadge{Label: "高星口碑", Tone: "gold"})
	}
	if store.ActiveWalletCount >= 4 {
		badges = append(badges, BuildingBadge{Label: "熱絡互動", Tone: "hot"})
	}
	if store.CategoryDiversity >= 3 {
		badges = append(badges, BuildingBadge{Label: "多元評價", Tone: "multi"})
	}
	if store.RatingBreakdown.Five >= 3 {
		badges = append(badges, BuildingBadge{Label: "五星推薦", Tone: "star"})
	}
	if buildingScore >= 130 {
		badges = append(badges, BuildingBadge{Label: "城市地標", Tone: "milestone"})
	}

	return StoreBuilding{
		ID:                store.ID,
		DisplayName:       strings.ToUpper(strings.ReplaceAll(store.ID, "_", " ")),
		Stage:             stage,
		Title:             title,
		District:          district,
		BuildingScore:     buildingScore,
		NextLevelScore:    nextLevelScore,
		Floors:            floors,
		HeightLevel:       heightLevel,
		ThemeColor:        theme,
		AccentColor:       accent,
		WindowColor:       window,
		GlowColor:         glow,
		RoofStyle:         roofStyle,
		SpecialFeature:    specialFeature,
		AverageRating:     store.AverageRating,
		RatingCount:       store.RatingCount,
		CommentCount:      store.CommentCount,
		ReplyCount:        store.ReplyCount,
		ActiveWalletCount: store.ActiveWalletCount,
		CategoryDiversity: store.CategoryDiversity,
		RatingBreakdown:   store.RatingBreakdown,
		Badges:            badges,
	}
}

func buildSkylineSVG(buildings []StoreBuilding) string {
	const width = 1280
	const height = 420
	const groundY = 336
	const baseWidth = 130
	const gap = 30
	const startX = 40

	if len(buildings) == 0 {
		return `<svg viewBox="0 0 1280 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="蝛箇??蝮質汗"><rect width="1280" height="420" fill="#f6f1e8"/><text x="640" y="210" fill="#75654f" font-size="28" text-anchor="middle" font-family="Georgia, Noto Serif TC, serif">撠?Ｙ?摨振撱箇?鞈?</text></svg>`
	}

	var b strings.Builder
	b.WriteString(`<svg viewBox="0 0 1280 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="摨振撱箇?蝮質汗">`)
	b.WriteString(`<rect width="1280" height="420" fill="#f6f1e8"/>`)
	b.WriteString(`<rect x="0" y="0" width="1280" height="94" fill="#f8f4ec"/>`)
	b.WriteString(`<line x1="0" y1="94" x2="1280" y2="94" stroke="#d2c1a9" stroke-width="2"/>`)
	b.WriteString(`<text x="640" y="44" fill="#4c3d2b" font-size="28" text-anchor="middle" font-family="Georgia, Noto Serif TC, serif">摨振撱箇?蝮質汗</text>`)
	b.WriteString(`<text x="640" y="70" fill="#8d7a64" font-size="14" text-anchor="middle" font-family="Segoe UI, Noto Sans TC, sans-serif">敺撅擃?憭批?嚗誑摨振蝝舐??撽?撱箇???</text>`)

	for i, building := range buildings {
		x := startX + i*(baseWidth+gap)
		if x+baseWidth > width-20 {
			break
		}

		bodyHeight := 48 + building.Floors*14
		y := groundY - bodyHeight
		podiumY := groundY - 18

		b.WriteString(fmt.Sprintf(`<g transform="translate(%d,0)">`, x))
		b.WriteString(fmt.Sprintf(`<rect x="12" y="%d" width="%d" height="%d" fill="%s" stroke="#7b6547" stroke-width="2"/>`, y, baseWidth-24, bodyHeight, building.ThemeColor))
		b.WriteString(fmt.Sprintf(`<rect x="0" y="%d" width="%d" height="18" fill="%s" stroke="#7b6547" stroke-width="2"/>`, podiumY, baseWidth, building.AccentColor))

		switch building.RoofStyle {
		case "crown":
			b.WriteString(fmt.Sprintf(`<rect x="%d" y="%d" width="46" height="12" fill="#d6bea1" stroke="#7b6547" stroke-width="2"/>`, baseWidth/2-23, y-12))
			b.WriteString(fmt.Sprintf(`<rect x="%d" y="%d" width="18" height="18" fill="#d6bea1" stroke="#7b6547" stroke-width="2"/>`, baseWidth/2-9, y-28))
		case "spire":
			b.WriteString(fmt.Sprintf(`<polygon points="%d,%d %d,%d %d,%d" fill="#d9c5aa" stroke="#7b6547" stroke-width="2"/>`, baseWidth/2-22, y, baseWidth/2, y-26, baseWidth/2+22, y))
			b.WriteString(fmt.Sprintf(`<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="#7b6547" stroke-width="2"/>`, baseWidth/2, y-26, baseWidth/2, y-44))
		case "terrace":
			b.WriteString(fmt.Sprintf(`<rect x="%d" y="%d" width="58" height="10" fill="#dbc8b0" stroke="#7b6547" stroke-width="2"/>`, baseWidth/2-29, y-10))
		default:
			b.WriteString(fmt.Sprintf(`<polygon points="%d,%d %d,%d %d,%d" fill="#dbc8b0" stroke="#7b6547" stroke-width="2"/>`, 12, y, baseWidth/2, y-24, baseWidth-12, y))
		}

		for floor := 0; floor < building.Floors; floor++ {
			windowY := groundY - 20 - floor*14
			for col := 0; col < 4; col++ {
				windowX := 22 + col*22
				b.WriteString(fmt.Sprintf(`<rect x="%d" y="%d" width="12" height="8" fill="%s" stroke="#8b7150" stroke-width="1"/>`, windowX, windowY, building.WindowColor))
			}
		}

		b.WriteString(fmt.Sprintf(`<text x="%d" y="366" fill="#5a4734" font-size="13" text-anchor="middle" font-family="Georgia, Noto Serif TC, serif">%s</text>`, baseWidth/2, building.ID))
		b.WriteString(fmt.Sprintf(`<text x="%d" y="384" fill="#8d7a64" font-size="11" text-anchor="middle" font-family="Segoe UI, Noto Sans TC, sans-serif">%d ?%d 撅?/text>`, baseWidth/2, building.BuildingScore, building.Floors))
		b.WriteString(`</g>`)
	}

	b.WriteString(`<line x1="0" y1="336" x2="1280" y2="336" stroke="#cab79a" stroke-width="3"/>`)
	b.WriteString(`</svg>`)
	return b.String()
}

func personalBadgeCatalog() []BadgeCatalogItem {
	return []BadgeCatalogItem{
		{BadgeType: "food_explorer", Name: "美食探索者", Description: "累積評論數量，解鎖美食探索勳章。", RequirementMetric: "comment_count", BronzeThreshold: 5, SilverThreshold: 15, GoldThreshold: 30},
		{BadgeType: "five_star_critic", Name: "五星評論家", Description: "累積五星評論，提升評論家等級。", RequirementMetric: "five_star_count", BronzeThreshold: 3, SilverThreshold: 8, GoldThreshold: 15},
		{BadgeType: "interaction_master", Name: "互動達人", Description: "累積收到回覆次數，解鎖互動成就。", RequirementMetric: "received_reply_count", BronzeThreshold: 5, SilverThreshold: 15, GoldThreshold: 30},
		{BadgeType: "building_cultivator", Name: "建築培育師", Description: "參與店家建築升級，解鎖建築培育勳章。", RequirementMetric: "highest_store_floor", BronzeThreshold: 4, SilverThreshold: 7, GoldThreshold: 10},
	}
}

func storeBadgeCatalog() []StoreBadgeCatalogItem {
	return []StoreBadgeCatalogItem{
		{BadgeType: "popular_store", Name: "人氣店家", Description: "依評論數量成長的店家勳章。", RequirementMetric: "comment_count", BronzeThreshold: 5, SilverThreshold: 10, GoldThreshold: 20},
		{BadgeType: "quality_store", Name: "口碑店家", Description: "依平均星等與高星評論累積的店家勳章。", RequirementMetric: "rating_score", BronzeThreshold: 40, SilverThreshold: 45, GoldThreshold: 48},
		{BadgeType: "diverse_store", Name: "多元店家", Description: "依評論分類多樣性成長的店家勳章。", RequirementMetric: "category_diversity", BronzeThreshold: 2, SilverThreshold: 4, GoldThreshold: 6},
		{BadgeType: "landmark_store", Name: "地標店家", Description: "依建築樓層與建築分數達成的店家勳章。", RequirementMetric: "floors", BronzeThreshold: 4, SilverThreshold: 7, GoldThreshold: 10},
	}
}

func rewardCatalog() []RewardCatalogItem {
	return []RewardCatalogItem{
		{RewardID: "frame_bronze", Name: "銅階頭像框", Description: "套用後，留言者名稱會顯示銅色效果。", CostPoints: 20},
		{RewardID: "skin_harbor", Name: "港灣建築主題", Description: "解鎖店家建築的港灣風格展示效果。", CostPoints: 40, RequiredBadgeType: "building_cultivator", RequiredBadgeLevel: 1},
		{RewardID: "title_master", Name: "美食達人稱號", Description: "解鎖個人頁展示的美食達人稱號。", CostPoints: 60, RequiredBadgeType: "food_explorer", RequiredBadgeLevel: 2},
	}
}

func (s *DemoStore) GetPersonalBadgeCatalog() []BadgeCatalogItem {
	return personalBadgeCatalog()
}

func (s *DemoStore) GetBadgeCatalog() []BadgeCatalogItem {
	return s.GetPersonalBadgeCatalog()
}

func (s *DemoStore) GetStoreBadgeCatalog() []StoreBadgeCatalogItem {
	return storeBadgeCatalog()
}

func (s *DemoStore) GetRewardCatalog() []RewardCatalogItem {
	return rewardCatalog()
}

func (s *DemoStore) GetPersonalBadges(walletAddress string) UserBadgeResponse {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.buildUserBadgeResponseLocked(strings.TrimSpace(walletAddress))
}

func (s *DemoStore) GetUserBadges(walletAddress string) UserBadgeResponse {
	return s.GetPersonalBadges(walletAddress)
}

func (s *DemoStore) GetStoreBadges(storeID string) StoreBadgeResponse {
	s.mu.RLock()
	defer s.mu.RUnlock()

	storeID = strings.TrimSpace(storeID)
	stores := s.listStoresLocked()
	var target StoreResponse
	found := false
	for _, item := range stores {
		if item.ID == storeID {
			target = item
			found = true
			break
		}
	}
	if !found {
		return StoreBadgeResponse{StoreID: storeID, DisplayName: strings.ToUpper(strings.ReplaceAll(storeID, "_", " "))}
	}

	building := mapStoreToBuilding(target)
	return StoreBadgeResponse{
		StoreID:           building.ID,
		DisplayName:       building.DisplayName,
		BuildingScore:     building.BuildingScore,
		Floors:            building.Floors,
		AverageRating:     building.AverageRating,
		CommentCount:      building.CommentCount,
		CategoryDiversity: building.CategoryDiversity,
		ActiveWalletCount: building.ActiveWalletCount,
		Badges:            computeStoreBadges(building),
	}
}

func (s *DemoStore) EvolvePersonalBadge(walletAddress, badgeType string) (map[string]any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	walletAddress = strings.TrimSpace(walletAddress)
	badgeType = strings.TrimSpace(badgeType)
	if walletAddress == "" || badgeType == "" {
		return nil, errors.New("請提供錢包地址與勳章類型")
	}

	response := s.buildUserBadgeResponseLocked(walletAddress)
	var target *UserBadge
	for index := range response.Badges {
		if response.Badges[index].BadgeType == badgeType {
			target = &response.Badges[index]
			break
		}
	}
	if target == nil {
		return nil, errors.New("?曆??唳?摰??犖?喟?")
	}
	if target.EligibleLevel <= target.CurrentLevel {
		return nil, errors.New("目前尚未達到可演化的下一階條件")
	}

	badgeSet := s.badgeSetForLocked(walletAddress)
	stored := badgeSet[badgeType]
	if stored == nil {
		stored = &UserBadge{BadgeType: badgeType, Name: target.Name}
		badgeSet[badgeType] = stored
	}
	stored.Name = target.Name
	stored.CurrentLevel = target.EligibleLevel
	stored.EligibleLevel = target.EligibleLevel
	stored.EvolveCount++
	stored.LastEvolvedAt = time.Now().UTC()

	if err := s.saveLocked(); err != nil {
		return nil, err
	}

	return map[string]any{
		"message":      "勳章演化成功",
		"badgeType":    stored.BadgeType,
		"badgeName":    stored.Name,
		"currentLevel": stored.CurrentLevel,
	}, nil
}

func (s *DemoStore) EvolveBadge(walletAddress, badgeType string) (map[string]any, error) {
	return s.EvolvePersonalBadge(walletAddress, badgeType)
}

func (s *DemoStore) RedeemReward(walletAddress, rewardID string) (map[string]any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	walletAddress = strings.TrimSpace(walletAddress)
	rewardID = strings.TrimSpace(rewardID)
	if walletAddress == "" || rewardID == "" {
		return nil, errors.New("請提供錢包地址與獎勵編號")
	}

	var reward *RewardCatalogItem
	for _, item := range rewardCatalog() {
		if item.RewardID == rewardID {
			copy := item
			reward = &copy
			break
		}
	}
	if reward == nil {
		return nil, errors.New("?曆??唳?摰????")
	}

	response := s.buildUserBadgeResponseLocked(walletAddress)
	if response.AvailablePoints < reward.CostPoints {
		return nil, errors.New("可用積分不足，尚無法兌換此獎勵")
	}
	if reward.RequiredBadgeType != "" {
		current := s.badgeSetForLocked(walletAddress)[reward.RequiredBadgeType]
		if current == nil || current.CurrentLevel < reward.RequiredBadgeLevel {
			return nil, errors.New("尚未滿足這個獎勵需要的勳章條件")
		}
	}

	s.spentPoints[walletAddress] += reward.CostPoints
	s.redemptions[walletAddress] = append(s.redemptions[walletAddress], Redemption{
		WalletAddress: walletAddress,
		RewardID:      reward.RewardID,
		RewardName:    reward.Name,
		SpentPoints:   reward.CostPoints,
		CreatedAt:     time.Now().UTC(),
	})

	if err := s.saveLocked(); err != nil {
		return nil, err
	}

	updated := s.buildUserBadgeResponseLocked(walletAddress)
	return map[string]any{
		"message":         "獎勵兌換成功",
		"rewardId":        reward.RewardID,
		"rewardName":      reward.Name,
		"spentPoints":     reward.CostPoints,
		"availablePoints": updated.AvailablePoints,
	}, nil
}

func (s *DemoStore) buildUserBadgeResponseLocked(walletAddress string) UserBadgeResponse {
	summary := UserAchievementSummary{WalletAddress: walletAddress}
	if existing, ok := s.summaries[walletAddress]; ok && existing != nil {
		summary = *existing
	}

	eligibleLevels := s.computeEligibleBadgeLevelsLocked(walletAddress)
	badgeSet := s.badgeSetForLocked(walletAddress)
	items := make([]UserBadge, 0, len(personalBadgeCatalog()))
	evolvable := make([]string, 0)

	for _, catalog := range personalBadgeCatalog() {
		stored := badgeSet[catalog.BadgeType]
		item := UserBadge{
			BadgeType:     catalog.BadgeType,
			Name:          catalog.Name,
			EligibleLevel: eligibleLevels[catalog.BadgeType],
		}
		if stored != nil {
			item.CurrentLevel = stored.CurrentLevel
			item.EvolveCount = stored.EvolveCount
			item.LastEvolvedAt = stored.LastEvolvedAt
		}
		if item.EligibleLevel > item.CurrentLevel {
			evolvable = append(evolvable, item.BadgeType)
		}
		items = append(items, item)
	}

	redemptions := append([]Redemption(nil), s.redemptions[walletAddress]...)
	sort.Slice(redemptions, func(i, j int) bool {
		return redemptions[i].CreatedAt.After(redemptions[j].CreatedAt)
	})
	if len(redemptions) > 5 {
		redemptions = redemptions[:5]
	}

	spent := s.spentPoints[walletAddress]
	available := summary.TotalPoints - spent
	if available < 0 {
		available = 0
	}

	return UserBadgeResponse{
		WalletAddress:     walletAddress,
		TotalPoints:       summary.TotalPoints,
		SpentPoints:       spent,
		AvailablePoints:   available,
		Badges:            items,
		EvolvableBadges:   evolvable,
		RecentRedemptions: redemptions,
	}
}

func (s *DemoStore) computeEligibleBadgeLevelsLocked(walletAddress string) map[string]int {
	summary := s.summaries[walletAddress]
	commentCount := 0
	receivedReplyCount := 0
	if summary != nil {
		commentCount = summary.CommentCount
		receivedReplyCount = summary.ReceivedReplyCount
	}

	fiveStarCount := 0
	highestFloor := 0
	participatedStores := make(map[string]struct{})
	for _, comment := range s.comments {
		if !strings.EqualFold(comment.WalletAddress, walletAddress) {
			continue
		}
		if comment.ParentID == nil && normalizeRating(comment.Rating) == 5 {
			fiveStarCount++
		}
		participatedStores[comment.StoreID] = struct{}{}
	}

	for _, building := range s.listBuildingsLocked() {
		if _, ok := participatedStores[building.ID]; ok && building.Floors > highestFloor {
			highestFloor = building.Floors
		}
	}

	return map[string]int{
		"food_explorer":       levelFromThresholds(commentCount, 5, 15, 30),
		"five_star_critic":    levelFromThresholds(fiveStarCount, 3, 8, 15),
		"interaction_master":  levelFromThresholds(receivedReplyCount, 5, 15, 30),
		"building_cultivator": levelFromThresholds(highestFloor, 4, 7, 10),
	}
}

func (s *DemoStore) badgeSetForLocked(walletAddress string) map[string]*UserBadge {
	if s.badges[walletAddress] == nil {
		s.badges[walletAddress] = make(map[string]*UserBadge)
	}
	return s.badges[walletAddress]
}

func computeStoreBadges(building StoreBuilding) []StoreBadge {
	ratingScore := int(math.Round(building.AverageRating * 10))
	results := make([]StoreBadge, 0, len(storeBadgeCatalog()))
	for _, item := range storeBadgeCatalog() {
		progress := 0
		switch item.RequirementMetric {
		case "comment_count":
			progress = building.CommentCount
		case "rating_score":
			progress = ratingScore
		case "category_diversity":
			progress = building.CategoryDiversity
		case "floors":
			progress = building.Floors
		}
		results = append(results, StoreBadge{
			BadgeType:    item.BadgeType,
			Name:         item.Name,
			CurrentLevel: levelFromThresholds(progress, item.BronzeThreshold, item.SilverThreshold, item.GoldThreshold),
			Progress:     progress,
		})
	}
	return results
}

func levelFromThresholds(value, bronze, silver, gold int) int {
	switch {
	case value >= gold:
		return 3
	case value >= silver:
		return 2
	case value >= bronze:
		return 1
	default:
		return 0
	}
}

func normalizeContent(value string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
}

func normalizeCategory(value string) string {
	category := strings.TrimSpace(strings.ToLower(value))
	if category == "" {
		return "other"
	}
	if normalized, ok := allowedCategories[category]; ok {
		return normalized
	}
	return "other"
}

func normalizeRating(value int) int {
	if value < 1 {
		return 1
	}
	if value > 5 {
		return 5
	}
	return value
}
