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

	store, err := NewDemoStore(filepath.Join(t.TempDir(), "achievement-demo.json"))
	if err != nil {
		t.Fatalf("new demo store: %v", err)
	}

	return &Server{
		cfg:             config.Config{DemoMode: true},
		achievementDemo: store,
		rateLimiter:     newRateLimiter(),
	}
}

func TestAchievementCommentCityAndBadgesFlow(t *testing.T) {
	server := newAchievementTestServer(t)
	handler := server.Routes()

	contents := []string{
		"餐點份量充足而且味道穩定，會想再來。",
		"服務速度很快，取餐流程也很順。",
		"環境整理得不錯，用餐起來很舒服。",
		"價格算合理，整體體驗有超過預期。",
		"推薦給第一次來這個商圈找餐點的人。",
	}

	for i, content := range contents {
		commentBody := []byte(`{"storeId":"store_001","walletAddress":"0xabc123","category":"餐點","rating":5,"content":"` + content + `"}`)
		commentReq := httptest.NewRequest(http.MethodPost, "/api/achievements/comment", bytes.NewReader(commentBody))
		commentReq.Header.Set("Content-Type", "application/json")
		commentRes := httptest.NewRecorder()
		handler.ServeHTTP(commentRes, commentReq)
		if commentRes.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", commentRes.Code, commentRes.Body.String())
		}

		if i < len(contents)-1 {
			server.achievementDemo.mu.Lock()
			comment := server.achievementDemo.comments[int64(i+1)]
			comment.CreatedAt = comment.CreatedAt.Add(-(postCooldownSeconds*time.Second + time.Second))
			server.achievementDemo.comments[int64(i+1)] = comment
			server.achievementDemo.mu.Unlock()
		}
	}

	cityReq := httptest.NewRequest(http.MethodGet, "/api/city", nil)
	cityRes := httptest.NewRecorder()
	handler.ServeHTTP(cityRes, cityReq)
	if cityRes.Code != http.StatusOK {
		t.Fatalf("expected city 200, got %d", cityRes.Code)
	}

	var city CityOverview
	if err := json.Unmarshal(cityRes.Body.Bytes(), &city); err != nil {
		t.Fatalf("unmarshal city: %v", err)
	}
	if city.StoreCount != 1 || len(city.Buildings) != 1 {
		t.Fatalf("unexpected city overview: %+v", city)
	}
	if city.Buildings[0].Floors < 4 {
		t.Fatalf("expected upgraded building, got %+v", city.Buildings[0])
	}

	userReq := httptest.NewRequest(http.MethodGet, "/api/personal-badges/user?walletAddress=0xabc123", nil)
	userRes := httptest.NewRecorder()
	handler.ServeHTTP(userRes, userReq)
	if userRes.Code != http.StatusOK {
		t.Fatalf("expected badge user 200, got %d", userRes.Code)
	}

	var badgeState UserBadgeResponse
	if err := json.Unmarshal(userRes.Body.Bytes(), &badgeState); err != nil {
		t.Fatalf("unmarshal badge state: %v", err)
	}
	if len(badgeState.Badges) == 0 {
		t.Fatal("expected badge entries")
	}
}

func TestAchievementCatalogAndRedeem(t *testing.T) {
	server := newAchievementTestServer(t)
	store := server.achievementDemo

	store.summaries["0xabc123"] = &UserAchievementSummary{
		WalletAddress: "0xabc123",
		TotalPoints:   40,
		CommentCount:  8,
	}

	catalog := store.GetBadgeCatalog()
	if len(catalog) == 0 {
		t.Fatal("expected badge catalog")
	}

	response := store.GetUserBadges("0xabc123")
	if len(response.Badges) == 0 {
		t.Fatal("expected user badges")
	}

	result, err := store.EvolveBadge("0xabc123", "food_explorer")
	if err != nil {
		t.Fatalf("evolve badge: %v", err)
	}
	if result["currentLevel"] == 0 {
		t.Fatalf("expected evolved level, got %#v", result)
	}

	redeemResult, err := store.RedeemReward("0xabc123", "frame_bronze")
	if err != nil {
		t.Fatalf("redeem reward: %v", err)
	}
	if redeemResult["rewardId"] != "frame_bronze" {
		t.Fatalf("unexpected reward result: %#v", redeemResult)
	}
}
