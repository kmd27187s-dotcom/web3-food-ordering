package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"mealvoting/backend/config"
)

func newAchievementTestServer(t *testing.T) *Server {
	t.Helper()

	store, err := newAchievementDemoStore(filepath.Join(t.TempDir(), "achievement-demo.json"))
	if err != nil {
		t.Fatalf("new achievement demo store: %v", err)
	}

	return &Server{
		cfg:             config.Config{DemoMode: true},
		achievementDemo: store,
		rateLimiter:     newRateLimiter(),
	}
}

func TestAchievementCommentAndStatsFlow(t *testing.T) {
	server := newAchievementTestServer(t)
	handler := server.Routes()

	commentBody := []byte(`{"storeId":"store_001","walletAddress":"0xabc123","category":"餐點","rating":5,"content":"這家餐點很好吃"}`)
	commentReq := httptest.NewRequest(http.MethodPost, "/api/achievements/comment", bytes.NewReader(commentBody))
	commentReq.Header.Set("Content-Type", "application/json")
	commentRes := httptest.NewRecorder()
	handler.ServeHTTP(commentRes, commentReq)

	if commentRes.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", commentRes.Code)
	}

	server.achievementDemo.mu.Lock()
	comment := server.achievementDemo.comments[1]
	comment.CreatedAt = comment.CreatedAt.Add(-6 * time.Second)
	server.achievementDemo.comments[1] = comment
	server.achievementDemo.mu.Unlock()

	replyBody := []byte(`{"commentId":1,"walletAddress":"0xdef456","content":"我也覺得不錯"}`)
	replyReq := httptest.NewRequest(http.MethodPost, "/api/achievements/reply", bytes.NewReader(replyBody))
	replyReq.Header.Set("Content-Type", "application/json")
	replyRes := httptest.NewRecorder()
	handler.ServeHTTP(replyRes, replyReq)

	if replyRes.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", replyRes.Code)
	}

	commentsReq := httptest.NewRequest(http.MethodGet, "/api/comments?storeId=store_001", nil)
	commentsRes := httptest.NewRecorder()
	handler.ServeHTTP(commentsRes, commentsReq)

	var comments []achievementDemoCommentResponse
	if err := json.Unmarshal(commentsRes.Body.Bytes(), &comments); err != nil {
		t.Fatalf("unmarshal comments: %v", err)
	}

	if len(comments) != 1 || len(comments[0].Replies) != 1 {
		t.Fatalf("expected 1 comment with 1 reply, got %+v", comments)
	}
	if comments[0].Rating != 5 {
		t.Fatalf("expected rating 5, got %d", comments[0].Rating)
	}

	storesReq := httptest.NewRequest(http.MethodGet, "/api/stores", nil)
	storesRes := httptest.NewRecorder()
	handler.ServeHTTP(storesRes, storesReq)

	var stores []achievementDemoStoreSummary
	if err := json.Unmarshal(storesRes.Body.Bytes(), &stores); err != nil {
		t.Fatalf("unmarshal stores: %v", err)
	}
	if len(stores) != 1 {
		t.Fatalf("expected 1 store summary, got %d", len(stores))
	}
	if stores[0].AverageRating != 5.0 {
		t.Fatalf("expected average rating 5.0, got %.1f", stores[0].AverageRating)
	}
	if stores[0].RatingBreakdown.Five != 1 {
		t.Fatalf("expected five-star count 1, got %+v", stores[0].RatingBreakdown)
	}
}

func TestAchievementRankingEndpoint(t *testing.T) {
	server := newAchievementTestServer(t)
	handler := server.Routes()

	_, _ = server.achievementDemo.createComment(achievementDemoCommentRequest{
		StoreID:       "store_001",
		WalletAddress: "0xabc123",
		Category:      "餐點",
		Rating:        5,
		Content:       "第一則評論內容",
	})

	server.achievementDemo.mu.Lock()
	comment := server.achievementDemo.comments[1]
	comment.CreatedAt = comment.CreatedAt.Add(-6 * time.Second)
	server.achievementDemo.comments[1] = comment
	server.achievementDemo.mu.Unlock()

	_, _ = server.achievementDemo.createComment(achievementDemoCommentRequest{
		StoreID:       "store_002",
		WalletAddress: "0xdef456",
		Category:      "服務",
		Rating:        4,
		Content:       "第二則評論內容",
	})

	req := httptest.NewRequest(http.MethodGet, "/api/achievements/ranking?limit=10", nil)
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)

	var ranking []achievementDemoRankingEntry
	if err := json.Unmarshal(res.Body.Bytes(), &ranking); err != nil {
		t.Fatalf("unmarshal ranking: %v", err)
	}
	if len(ranking) != 2 {
		t.Fatalf("expected 2 ranking entries, got %d", len(ranking))
	}
}
