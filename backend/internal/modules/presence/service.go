package presence

import (
	"context"
	"time"
)

const activeWindow = 35 * time.Second

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Heartbeat(ctx context.Context, userID, sessionID string, req HeartbeatRequest) (PresenceResponse, error) {
	now := time.Now().UTC().Truncate(time.Second)
	if err := s.repo.UpsertHeartbeat(ctx, userID, sessionID, req, now); err != nil {
		return PresenceResponse{}, err
	}
	return s.Get(ctx, userID, userID)
}

func (s *Service) Disconnect(ctx context.Context, userID, sessionID string, req DisconnectRequest) (PresenceResponse, error) {
	now := time.Now().UTC().Truncate(time.Second)
	if err := s.repo.Disconnect(ctx, userID, sessionID, req, now); err != nil {
		return PresenceResponse{}, err
	}
	return s.Get(ctx, userID, userID)
}

func (s *Service) Me(ctx context.Context, userID string) (PresenceResponse, error) {
	return s.Get(ctx, userID, userID)
}

func (s *Service) Get(ctx context.Context, viewerID, targetUserID string) (PresenceResponse, error) {
	record, err := s.repo.FindStatus(ctx, viewerID, targetUserID, time.Now().UTC().Add(-activeWindow))
	if err != nil {
		return PresenceResponse{}, err
	}
	return toPresenceResponse(viewerID, record), nil
}

func (s *Service) Query(ctx context.Context, viewerID string, userIDs []string) ([]PresenceResponse, error) {
	seen := make(map[string]struct{}, len(userIDs))
	response := make([]PresenceResponse, 0, len(userIDs))
	for _, userID := range userIDs {
		if _, ok := seen[userID]; ok {
			continue
		}
		seen[userID] = struct{}{}
		item, err := s.Get(ctx, viewerID, userID)
		if err != nil {
			return nil, err
		}
		response = append(response, item)
	}
	return response, nil
}

func toPresenceResponse(viewerID string, item *PresenceStatusRecord) PresenceResponse {
	canViewLastSeen := viewerID == item.UserID
	if !canViewLastSeen {
		switch item.LastSeenScope {
		case "EVERYONE":
			canViewLastSeen = true
		case "CONNECTIONS":
			canViewLastSeen = item.IsConnection
		default:
			canViewLastSeen = false
		}
	}

	canViewOnline := viewerID == item.UserID || (item.ShowOnline && canViewLastSeen)
	state := "OFFLINE"
	isOnline := false
	if item.HasActive {
		state = "ONLINE"
		isOnline = true
	} else if item.HasIdle {
		state = "IDLE"
	}
	if !canViewOnline {
		state = "HIDDEN"
		isOnline = false
	}

	lastSeenAt := item.LastSeenAt
	if !canViewLastSeen {
		lastSeenAt = nil
	}
	lastHeartbeatAt := item.LastHeartbeatAt
	if !canViewOnline {
		lastHeartbeatAt = nil
	}

	return PresenceResponse{
		UserID:              item.UserID,
		State:               state,
		IsOnline:            isOnline,
		LastSeenAt:          lastSeenAt,
		LastHeartbeatAt:     lastHeartbeatAt,
		CanViewOnlineStatus: canViewOnline,
		CanViewLastSeen:     canViewLastSeen,
	}
}
