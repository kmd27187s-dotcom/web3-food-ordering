package handlers

import "time"

const (
	commentReward          = 5
	replyReward            = 2
	replyReceivedReward    = 1
	minContentLength       = 4
	duplicateWindowSeconds = 60
	postCooldownSeconds    = 5
)

type Comment struct {
	ID            int64     `json:"id"`
	StoreID       string    `json:"storeId"`
	WalletAddress string    `json:"walletAddress"`
	Category      string    `json:"category"`
	Rating        int       `json:"rating,omitempty"`
	Content       string    `json:"content"`
	ParentID      *int64    `json:"parentId,omitempty"`
	CreatedAt     time.Time `json:"createdAt"`
}

type AchievementLog struct {
	WalletAddress string    `json:"walletAddress"`
	Points        int       `json:"points"`
	Reason        string    `json:"reason"`
	SourceID      int64     `json:"sourceId"`
	CreatedAt     time.Time `json:"createdAt"`
}

type UserAchievementSummary struct {
	WalletAddress      string    `json:"walletAddress"`
	TotalPoints        int       `json:"totalPoints"`
	CommentCount       int       `json:"commentCount"`
	ReplyCount         int       `json:"replyCount"`
	ReceivedReplyCount int       `json:"receivedReplyCount"`
	UpdatedAt          time.Time `json:"updatedAt"`
}

type RankingEntry struct {
	Rank               int    `json:"rank"`
	WalletAddress      string `json:"walletAddress"`
	TotalPoints        int    `json:"totalPoints"`
	CommentCount       int    `json:"commentCount"`
	ReplyCount         int    `json:"replyCount"`
	ReceivedReplyCount int    `json:"receivedReplyCount"`
}

type RatingBreakdown struct {
	Five  int `json:"five"`
	Four  int `json:"four"`
	Three int `json:"three"`
	Two   int `json:"two"`
	One   int `json:"one"`
}

type BuildingBadge struct {
	Label string `json:"label"`
	Tone  string `json:"tone"`
}

type StoreBuilding struct {
	ID                string          `json:"id"`
	DisplayName       string          `json:"displayName"`
	Stage             string          `json:"stage"`
	Title             string          `json:"title"`
	District          string          `json:"district"`
	BuildingScore     int             `json:"buildingScore"`
	NextLevelScore    int             `json:"nextLevelScore"`
	Floors            int             `json:"floors"`
	HeightLevel       string          `json:"heightLevel"`
	ThemeColor        string          `json:"themeColor"`
	AccentColor       string          `json:"accentColor"`
	WindowColor       string          `json:"windowColor"`
	GlowColor         string          `json:"glowColor"`
	RoofStyle         string          `json:"roofStyle"`
	SpecialFeature    string          `json:"specialFeature"`
	AverageRating     float64         `json:"averageRating"`
	RatingCount       int             `json:"ratingCount"`
	CommentCount      int             `json:"commentCount"`
	ReplyCount        int             `json:"replyCount"`
	ActiveWalletCount int             `json:"activeWalletCount"`
	CategoryDiversity int             `json:"categoryDiversity"`
	RatingBreakdown   RatingBreakdown `json:"ratingBreakdown"`
	Badges            []BuildingBadge `json:"badges"`
}

type CityOverview struct {
	GeneratedAt       time.Time       `json:"generatedAt"`
	StoreCount        int             `json:"storeCount"`
	TotalComments     int             `json:"totalComments"`
	TotalReplies      int             `json:"totalReplies"`
	TotalParticipants int             `json:"totalParticipants"`
	SkylineSVG        string          `json:"skylineSvg"`
	Buildings         []StoreBuilding `json:"buildings"`
}

type StoreResponse struct {
	ID                string          `json:"id"`
	CommentCount      int             `json:"commentCount"`
	ReplyCount        int             `json:"replyCount"`
	ActiveWalletCount int             `json:"activeWalletCount"`
	CategoryDiversity int             `json:"categoryDiversity"`
	AverageRating     float64         `json:"averageRating"`
	RatingCount       int             `json:"ratingCount"`
	RatingBreakdown   RatingBreakdown `json:"ratingBreakdown"`
	LatestComment     string          `json:"latestComment,omitempty"`
}

type CommentResponse struct {
	ID            int64           `json:"id"`
	StoreID       string          `json:"storeId"`
	WalletAddress string          `json:"walletAddress"`
	Category      string          `json:"category"`
	Rating        int             `json:"rating,omitempty"`
	Content       string          `json:"content"`
	CreatedAt     time.Time       `json:"createdAt"`
	Replies       []ReplyResponse `json:"replies"`
}

type ReplyResponse struct {
	ID            int64     `json:"id"`
	WalletAddress string    `json:"walletAddress"`
	Content       string    `json:"content"`
	CreatedAt     time.Time `json:"createdAt"`
}

type UserAchievementResponse struct {
	WalletAddress string                 `json:"walletAddress"`
	TotalPoints   int                    `json:"totalPoints"`
	Logs          []AchievementLog       `json:"logs"`
	Summary       UserAchievementSummary `json:"summary"`
}

type CreateCommentRequest struct {
	StoreID       string `json:"storeId"`
	WalletAddress string `json:"walletAddress"`
	Category      string `json:"category"`
	Rating        int    `json:"rating"`
	Content       string `json:"content"`
}

type CreateReplyRequest struct {
	CommentID     int64  `json:"commentId"`
	WalletAddress string `json:"walletAddress"`
	Content       string `json:"content"`
}

type BadgeCatalogItem struct {
	BadgeType         string `json:"badgeType"`
	Name              string `json:"name"`
	Description       string `json:"description"`
	RequirementMetric string `json:"requirementMetric"`
	BronzeThreshold   int    `json:"bronzeThreshold"`
	SilverThreshold   int    `json:"silverThreshold"`
	GoldThreshold     int    `json:"goldThreshold"`
}

type StoreBadgeCatalogItem struct {
	BadgeType         string `json:"badgeType"`
	Name              string `json:"name"`
	Description       string `json:"description"`
	RequirementMetric string `json:"requirementMetric"`
	BronzeThreshold   int    `json:"bronzeThreshold"`
	SilverThreshold   int    `json:"silverThreshold"`
	GoldThreshold     int    `json:"goldThreshold"`
}

type UserBadge struct {
	BadgeType     string    `json:"badgeType"`
	Name          string    `json:"name"`
	CurrentLevel  int       `json:"currentLevel"`
	EligibleLevel int       `json:"eligibleLevel"`
	EvolveCount   int       `json:"evolveCount"`
	LastEvolvedAt time.Time `json:"lastEvolvedAt,omitempty"`
}

type StoreBadge struct {
	BadgeType    string `json:"badgeType"`
	Name         string `json:"name"`
	CurrentLevel int    `json:"currentLevel"`
	Progress     int    `json:"progress"`
}

type UserBadgeResponse struct {
	WalletAddress     string       `json:"walletAddress"`
	TotalPoints       int          `json:"totalPoints"`
	SpentPoints       int          `json:"spentPoints"`
	AvailablePoints   int          `json:"availablePoints"`
	Badges            []UserBadge  `json:"badges"`
	EvolvableBadges   []string     `json:"evolvableBadges"`
	RecentRedemptions []Redemption `json:"recentRedemptions"`
}

type StoreBadgeResponse struct {
	StoreID           string       `json:"storeId"`
	DisplayName       string       `json:"displayName"`
	BuildingScore     int          `json:"buildingScore"`
	Floors            int          `json:"floors"`
	AverageRating     float64      `json:"averageRating"`
	CommentCount      int          `json:"commentCount"`
	CategoryDiversity int          `json:"categoryDiversity"`
	ActiveWalletCount int          `json:"activeWalletCount"`
	Badges            []StoreBadge `json:"badges"`
}

type EvolveBadgeRequest struct {
	WalletAddress string `json:"walletAddress"`
	BadgeType     string `json:"badgeType"`
}

type RewardCatalogItem struct {
	RewardID           string `json:"rewardId"`
	Name               string `json:"name"`
	Description        string `json:"description"`
	CostPoints         int    `json:"costPoints"`
	RequiredBadgeType  string `json:"requiredBadgeType,omitempty"`
	RequiredBadgeLevel int    `json:"requiredBadgeLevel,omitempty"`
}

type RedeemRewardRequest struct {
	WalletAddress string `json:"walletAddress"`
	RewardID      string `json:"rewardId"`
}

type Redemption struct {
	WalletAddress string    `json:"walletAddress"`
	RewardID      string    `json:"rewardId"`
	RewardName    string    `json:"rewardName"`
	SpentPoints   int       `json:"spentPoints"`
	CreatedAt     time.Time `json:"createdAt"`
}

type persistentState struct {
	NextID      int64                              `json:"nextId"`
	Comments    map[int64]Comment                  `json:"comments"`
	Logs        map[string][]AchievementLog        `json:"logs"`
	Summaries   map[string]*UserAchievementSummary `json:"summaries"`
	Badges      map[string]map[string]*UserBadge   `json:"badges"`
	SpentPoints map[string]int                     `json:"spentPoints"`
	Redemptions map[string][]Redemption            `json:"redemptions"`
}
