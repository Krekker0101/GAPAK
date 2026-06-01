package live

import (
	"context"
	"encoding/json"

	"github.com/gapak/backend/internal/domain/enums"
	"github.com/gapak/backend/internal/domain/model"
)

type Service struct {
	repo             *Repository
	eventChannelBase string
}

func NewService(repo *Repository, eventChannelBase string) *Service {
	return &Service{
		repo:             repo,
		eventChannelBase: eventChannelBase,
	}
}

func (s *Service) Create(ctx context.Context, userID string, req CreateLiveStreamRequest) (LiveStreamResponse, error) {
	item, err := s.repo.Create(ctx, userID, req)
	if err != nil {
		return LiveStreamResponse{}, err
	}
	return s.toResponse(item), nil
}

func (s *Service) List(ctx context.Context, viewerID string, page, limit int) ([]LiveStreamResponse, error) {
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
	response := make([]LiveStreamResponse, 0, len(items))
	for _, item := range items {
		response = append(response, s.toResponse(&item))
	}
	return response, nil
}

func (s *Service) Get(ctx context.Context, viewerID, streamID string) (LiveStreamResponse, error) {
	item, err := s.repo.GetVisible(ctx, viewerID, streamID)
	if err != nil {
		return LiveStreamResponse{}, err
	}
	return s.toResponse(item), nil
}

func (s *Service) Start(ctx context.Context, userID, streamID string) (AcceptedResponse, error) {
	if err := s.repo.Start(ctx, userID, streamID); err != nil {
		return AcceptedResponse{}, err
	}
	return AcceptedResponse{Accepted: true}, nil
}

func (s *Service) End(ctx context.Context, userID, streamID string) (AcceptedResponse, error) {
	if err := s.repo.End(ctx, userID, streamID); err != nil {
		return AcceptedResponse{}, err
	}
	return AcceptedResponse{Accepted: true}, nil
}

func (s *Service) Join(ctx context.Context, userID, streamID string, req JoinLiveRequest) (AcceptedResponse, error) {
	if _, err := s.repo.GetVisible(ctx, userID, streamID); err != nil {
		return AcceptedResponse{}, err
	}
	if err := s.repo.UpsertParticipant(ctx, streamID, userID, enums.LiveParticipantRole(req.Role), req.IsGhostMode); err != nil {
		return AcceptedResponse{}, err
	}
	return AcceptedResponse{Accepted: true}, nil
}

func (s *Service) PostChatMessage(ctx context.Context, userID, streamID string, req LiveChatMessageRequest) (LiveChatMessageResponse, error) {
	if _, err := s.repo.GetVisible(ctx, userID, streamID); err != nil {
		return LiveChatMessageResponse{}, err
	}
	item, err := s.repo.CreateChatMessage(ctx, streamID, userID, req.Body)
	if err != nil {
		return LiveChatMessageResponse{}, err
	}
	return LiveChatMessageResponse{
		ID:        item.ID,
		StreamID:  item.StreamID,
		SenderID:  item.SenderID,
		Body:      item.Body,
		CreatedAt: item.CreatedAt,
		DeletedAt: item.DeletedAt,
	}, nil
}

func (s *Service) Chat(ctx context.Context, userID, streamID string) ([]LiveChatMessageResponse, error) {
	if _, err := s.repo.GetVisible(ctx, userID, streamID); err != nil {
		return nil, err
	}
	items, err := s.repo.ListChatMessages(ctx, streamID)
	if err != nil {
		return nil, err
	}
	response := make([]LiveChatMessageResponse, 0, len(items))
	for _, item := range items {
		response = append(response, LiveChatMessageResponse{
			ID:        item.ID,
			StreamID:  item.StreamID,
			SenderID:  item.SenderID,
			Body:      item.Body,
			CreatedAt: item.CreatedAt,
			DeletedAt: item.DeletedAt,
		})
	}
	return response, nil
}

func (s *Service) Events(ctx context.Context, userID, streamID string, after int64, limit int) ([]LiveEventResponse, map[string]any, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}
	if _, err := s.repo.GetVisible(ctx, userID, streamID); err != nil {
		return nil, nil, err
	}

	items, err := s.repo.ListEvents(ctx, streamID, after, limit+1)
	if err != nil {
		return nil, nil, err
	}

	hasMore := len(items) > limit
	if hasMore {
		items = items[:limit]
	}

	response := make([]LiveEventResponse, 0, len(items))
	for _, item := range items {
		payload := map[string]any{}
		if len(item.PayloadJSON) > 0 {
			if err := json.Unmarshal(item.PayloadJSON, &payload); err != nil {
				return nil, nil, err
			}
		}
		response = append(response, LiveEventResponse{
			ID:        item.ID,
			Sequence:  item.Sequence,
			Channel:   item.Channel,
			StreamID:  item.AggregateID,
			EventType: item.EventType,
			Payload:   payload,
			CreatedAt: item.CreatedAt,
			RelayedAt: item.RelayedAt,
		})
	}

	pagination := map[string]any{
		"after":   after,
		"limit":   limit,
		"hasMore": hasMore,
	}
	if len(response) > 0 {
		pagination["nextCursor"] = response[len(response)-1].Sequence
	}
	return response, pagination, nil
}

func (s *Service) toResponse(item *model.LiveStream) LiveStreamResponse {
	return LiveStreamResponse{
		ID:                  item.ID,
		HostUserID:          item.HostUserID,
		TrustRoomID:         item.TrustRoomID,
		Title:               item.Title,
		Description:         item.Description,
		Visibility:          string(item.Visibility),
		Status:              string(item.Status),
		ScheduledFor:        item.ScheduledFor,
		StartedAt:           item.StartedAt,
		EndedAt:             item.EndedAt,
		PlaybackManifestKey: item.PlaybackManifestKey,
		ReplayMediaFileID:   item.ReplayMediaFileID,
		ViewerCount:         item.ViewerCount,
		AllowReplay:         item.AllowReplay,
		EventChannel:        s.eventChannel(item.ID),
		CreatedAt:           item.CreatedAt,
	}
}

func (s *Service) eventChannel(streamID string) string {
	return s.eventChannelBase + ":" + streamID
}
