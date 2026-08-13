package notifications

import (
	"context"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service { return &Service{repo: repo} }

func (s *Service) List(ctx context.Context, userID string, limit int) ([]NotificationResponse, bool, error) {
	if limit <= 0 {
		limit = 20
	}
	items, hasMore, err := s.repo.List(ctx, userID, limit)
	if err != nil {
		return nil, false, err
	}
	response := make([]NotificationResponse, 0, len(items))
	for _, item := range items {
		response = append(response, NotificationResponse{
			ID: item.ID, Type: item.Type, Title: item.Title, Body: item.Body,
			CreatedAt: item.CreatedAt, ReadAt: item.ReadAt, TargetURL: item.TargetURL,
			Metadata: item.Metadata,
			ActorID:  item.ActorID, EntityType: item.EntityType, EntityID: item.EntityID, EventID: item.EventID,
		})
	}
	return response, hasMore, nil
}

func (s *Service) UnreadCount(ctx context.Context, userID string) (int, error) {
	return s.repo.UnreadCount(ctx, userID)
}

func (s *Service) MarkRead(ctx context.Context, userID, notificationID string) error {
	if err := s.repo.MarkRead(ctx, userID, notificationID); err != nil {
		return err
	}
	return nil
}

func (s *Service) MarkAllRead(ctx context.Context, userID string) (int64, error) {
	count, err := s.repo.MarkAllRead(ctx, userID)
	if err != nil {
		return 0, err
	}
	return count, nil
}
