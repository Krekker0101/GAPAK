package trustrooms

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

func (s *Service) Create(ctx context.Context, ownerID string, req CreateTrustRoomRequest) (TrustRoomResponse, error) {
	room, err := s.repo.Create(ctx, ownerID, req)
	if err != nil {
		return TrustRoomResponse{}, err
	}
	return toResponse(room), nil
}

func (s *Service) List(ctx context.Context, userID string) ([]TrustRoomResponse, error) {
	items, err := s.repo.ListByMember(ctx, userID)
	if err != nil {
		return nil, err
	}
	response := make([]TrustRoomResponse, 0, len(items))
	for _, item := range items {
		copy := item
		response = append(response, toResponse(&copy))
	}
	return response, nil
}

func (s *Service) AddMember(ctx context.Context, actorUserID, roomID string, req AddMemberRequest) (AcceptedResponse, error) {
	if err := s.repo.AddMember(ctx, actorUserID, roomID, req); err != nil {
		return AcceptedResponse{}, err
	}
	return AcceptedResponse{Accepted: true}, nil
}

func toResponse(room *model.TrustRoom) TrustRoomResponse {
	return TrustRoomResponse{
		ID:                   room.ID,
		OwnerID:              room.OwnerID,
		Name:                 room.Name,
		Description:          deref(room.Description),
		Visibility:           string(room.Visibility),
		AccessMode:           string(room.AccessMode),
		RequireTwoFactor:     room.RequireTwoFactor,
		MinAccountAgeDays:    room.MinAccountAgeDays,
		MessageRetentionDays: room.MessageRetentionDays,
		CreatedAt:            room.CreatedAt,
		UpdatedAt:            room.UpdatedAt,
	}
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
