package service

import (
	"sort"

	"mealvoting/backend/internal/models"
	"mealvoting/backend/repository"
)

// LeaderboardService owns ranking logic and achievement building calculation.
type LeaderboardService struct {
	members repository.MemberRepo
}

func NewLeaderboardService(members repository.MemberRepo) *LeaderboardService {
	return &LeaderboardService{members: members}
}

func (s *LeaderboardService) List() ([]*models.LeaderboardEntry, error) {
	entries, err := s.members.RawLeaderboard()
	if err != nil {
		return nil, err
	}
	for _, e := range entries {
		e.BuildingName = buildingForPoints(e.Points).Name
	}
	rankEntries(entries)
	return entries, nil
}

func (s *LeaderboardService) Profile(memberID int64) (*models.MemberProfile, error) {
	member, err := s.members.MemberByID(memberID)
	if err != nil {
		return nil, err
	}
	entries, err := s.List()
	if err != nil {
		return nil, err
	}
	rank := len(entries)
	for _, e := range entries {
		if e.MemberID == memberID {
			rank = e.Rank
			break
		}
	}
	created, orders, votes, err := s.members.MemberStats(memberID)
	if err != nil {
		return nil, err
	}
	return &models.MemberProfile{
		Member:    member,
		Rank:      rank,
		Buildings: []models.AchievementBuilding{buildingForPoints(member.Points)},
		RecentBadges: []string{"店家策展人", "鏈上投票手"},
		History: map[string]int64{
			"proposalsCreated": created,
			"ordersSubmitted":  orders,
			"votesCast":        votes,
		},
		Stats: map[string]int64{
			"points":       member.Points,
			"tokenBalance": member.TokenBalance,
		},
	}, nil
}

func buildingForPoints(points int64) models.AchievementBuilding {
	switch {
	case points >= 600:
		return models.AchievementBuilding{Level: 4, Name: "雲端塔樓", Skin: "glass"}
	case points >= 300:
		return models.AchievementBuilding{Level: 3, Name: "港口商會", Skin: "copper"}
	case points >= 120:
		return models.AchievementBuilding{Level: 2, Name: "石砌食堂", Skin: "sand"}
	default:
		return models.AchievementBuilding{Level: 1, Name: "木造小屋", Skin: "oak"}
	}
}

func rankEntries(entries []*models.LeaderboardEntry) {
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Points == entries[j].Points {
			return entries[i].MemberID < entries[j].MemberID
		}
		return entries[i].Points > entries[j].Points
	})
	for i := range entries {
		entries[i].Rank = i + 1
	}
}
