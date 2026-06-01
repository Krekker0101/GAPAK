package battles

import (
	"context"

	"github.com/gapak/backend/internal/domain/model"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, userID string, req CreateBattleRequest) (BattleResponse, error) {
	item, err := s.repo.Create(ctx, userID, req)
	if err != nil {
		return BattleResponse{}, err
	}
	return s.hydrate(ctx, item)
}

func (s *Service) List(ctx context.Context, viewerID string, page, limit int) ([]BattleResponse, error) {
	if page == 0 {
		page = 1
	}
	if limit == 0 {
		limit = 20
	}
	items, err := s.repo.ListVisible(ctx, viewerID, page, limit)
	if err != nil {
		return nil, err
	}
	response := make([]BattleResponse, 0, len(items))
	for _, item := range items {
		hydrated, err := s.hydrate(ctx, &item)
		if err != nil {
			return nil, err
		}
		response = append(response, hydrated)
	}
	return response, nil
}

func (s *Service) Get(ctx context.Context, viewerID, battleID string) (BattleResponse, error) {
	item, err := s.repo.GetVisible(ctx, viewerID, battleID)
	if err != nil {
		return BattleResponse{}, err
	}
	return s.hydrate(ctx, item)
}

func (s *Service) Respond(ctx context.Context, userID, battleID string, req RespondBattleRequest) (AcceptedResponse, error) {
	if err := s.repo.Respond(ctx, userID, battleID, req.Accept); err != nil {
		return AcceptedResponse{}, err
	}
	return AcceptedResponse{Accepted: true}, nil
}

func (s *Service) Vote(ctx context.Context, userID, battleID string, req VoteBattleRequest) (AcceptedResponse, error) {
	if _, err := s.repo.GetVisible(ctx, userID, battleID); err != nil {
		return AcceptedResponse{}, err
	}
	if err := s.repo.Vote(ctx, battleID, userID, req); err != nil {
		return AcceptedResponse{}, err
	}
	return AcceptedResponse{Accepted: true}, nil
}

func (s *Service) hydrate(ctx context.Context, item *model.Battle) (BattleResponse, error) {
	participants, err := s.repo.Participants(ctx, item.ID)
	if err != nil {
		return BattleResponse{}, err
	}
	roundCount, err := s.repo.RoundCount(ctx, item.ID)
	if err != nil {
		return BattleResponse{}, err
	}
	response := BattleResponse{
		ID:                item.ID,
		ChallengerUserID:  item.ChallengerUserID,
		OpponentUserID:    item.OpponentUserID,
		TrustRoomID:       item.TrustRoomID,
		LiveStreamID:      item.LiveStreamID,
		Mode:              string(item.Mode),
		Status:            string(item.Status),
		Title:             item.Title,
		InvitationMessage: item.InvitationMessage,
		ScheduledFor:      item.ScheduledFor,
		AcceptedAt:        item.AcceptedAt,
		StartedAt:         item.StartedAt,
		EndedAt:           item.EndedAt,
		RoundDurationSec:  item.RoundDurationSec,
		ScoreHostA:        item.ScoreHostA,
		ScoreHostB:        item.ScoreHostB,
		RoundCount:        roundCount,
		Participants:      make([]BattleParticipantResponse, 0, len(participants)),
		CreatedAt:         item.CreatedAt,
	}
	for _, participant := range participants {
		response.Participants = append(response.Participants, BattleParticipantResponse{
			UserID:    participant.UserID,
			Side:      participant.Side,
			IsCreator: participant.IsCreator,
			JoinedAt:  participant.JoinedAt,
		})
	}
	return response, nil
}
