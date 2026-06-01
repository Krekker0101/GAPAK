package friends

import (
	"context"

	apperrors "github.com/gapak/backend/internal/platform/errors"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, requesterID string, req CreateConnectionRequest) (AcceptedResponse, error) {
	if requesterID == req.TargetUserID {
		return AcceptedResponse{}, apperrors.New(400, "connections.self_request_forbidden", "You cannot create a connection request to yourself")
	}
	if err := s.repo.CreateRequest(ctx, requesterID, req.TargetUserID); err != nil {
		return AcceptedResponse{}, err
	}
	return AcceptedResponse{Accepted: true}, nil
}

func (s *Service) Accept(ctx context.Context, currentUserID, connectionID string) (AcceptedResponse, error) {
	if err := s.repo.Accept(ctx, currentUserID, connectionID); err != nil {
		return AcceptedResponse{}, err
	}
	return AcceptedResponse{Accepted: true}, nil
}

func (s *Service) Remove(ctx context.Context, currentUserID, connectionID string) (AcceptedResponse, error) {
	if err := s.repo.Remove(ctx, currentUserID, connectionID); err != nil {
		return AcceptedResponse{}, err
	}
	return AcceptedResponse{Accepted: true}, nil
}

func (s *Service) SetTrusted(ctx context.Context, currentUserID, connectionID string, req ToggleTrustedCircleRequest) (AcceptedResponse, error) {
	if err := s.repo.SetTrusted(ctx, currentUserID, connectionID, req.Enabled); err != nil {
		return AcceptedResponse{}, err
	}
	return AcceptedResponse{Accepted: true}, nil
}

func (s *Service) List(ctx context.Context, currentUserID string) ([]ConnectionResponse, error) {
	items, err := s.repo.List(ctx, currentUserID)
	if err != nil {
		return nil, err
	}
	response := make([]ConnectionResponse, 0, len(items))
	for _, item := range items {
		response = append(response, ConnectionResponse{
			ID:               item.ID,
			RequesterID:      item.RequesterID,
			AddresseeID:      item.AddresseeID,
			Status:           item.Status,
			AcceptedAt:       item.AcceptedAt,
			TrustedByCurrent: item.TrustedByCurrent,
			CreatedAt:        item.CreatedAt,
			UpdatedAt:        item.UpdatedAt,
		})
	}
	return response, nil
}
