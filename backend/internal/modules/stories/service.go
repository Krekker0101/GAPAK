package stories

import (
	"context"
	"strings"
	"time"

	"github.com/gapak/backend/internal/domain/enums"
	"github.com/gapak/backend/internal/domain/model"
	apperrors "github.com/gapak/backend/internal/platform/errors"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, userID string, req CreateStoryRequest) (StoryResponse, error) {
	normalized, err := s.normalizeCreateRequest(req)
	if err != nil {
		return StoryResponse{}, err
	}
	if err := s.repo.EnsureOwnedMedia(ctx, userID, normalized.MediaFileID); err != nil {
		return StoryResponse{}, err
	}
	req = normalized
	story, err := s.repo.Create(ctx, userID, req)
	if err != nil {
		return StoryResponse{}, err
	}
	return s.hydrate(ctx, userID, story)
}

func (s *Service) Feed(ctx context.Context, viewerID string, page, limit int) ([]StoryResponse, error) {
	if page == 0 {
		page = 1
	}
	if limit == 0 {
		limit = 20
	}
	items, err := s.repo.Feed(ctx, viewerID, page, limit)
	if err != nil {
		return nil, err
	}
	response := make([]StoryResponse, 0, len(items))
	for _, item := range items {
		hydrated, err := s.hydrate(ctx, viewerID, &item)
		if err != nil {
			return nil, err
		}
		response = append(response, hydrated)
	}
	return response, nil
}

func (s *Service) Get(ctx context.Context, viewerID, storyID string) (StoryResponse, error) {
	story, err := s.repo.GetVisible(ctx, viewerID, storyID)
	if err != nil {
		return StoryResponse{}, err
	}
	if viewerID != story.AuthorID {
		if err := s.repo.MarkViewed(ctx, storyID, viewerID); err != nil {
			return StoryResponse{}, err
		}
	}
	return s.hydrate(ctx, viewerID, story)
}

func (s *Service) React(ctx context.Context, viewerID, storyID string, req ReactStoryRequest) (AcceptedResponse, error) {
	story, err := s.repo.GetVisible(ctx, viewerID, storyID)
	if err != nil {
		return AcceptedResponse{}, err
	}
	if !story.AllowReactions {
		return AcceptedResponse{}, apperrors.New(403, "stories.reactions_disabled", "Story reactions are disabled")
	}
	if err := s.repo.React(ctx, storyID, viewerID, enums.StoryReactionType(req.ReactionType)); err != nil {
		return AcceptedResponse{}, err
	}
	return AcceptedResponse{Accepted: true}, nil
}

func (s *Service) Highlight(ctx context.Context, userID, storyID string, req HighlightStoryRequest) (AcceptedResponse, error) {
	if err := s.repo.Highlight(ctx, userID, storyID, req.Title); err != nil {
		return AcceptedResponse{}, err
	}
	return AcceptedResponse{Accepted: true}, nil
}

func (s *Service) Viewers(ctx context.Context, userID, storyID string) ([]StoryViewerResponse, error) {
	items, err := s.repo.ListViewers(ctx, userID, storyID)
	if err != nil {
		return nil, err
	}
	response := make([]StoryViewerResponse, 0, len(items))
	for _, item := range items {
		var reaction *string
		if item.ReactionType != nil {
			value := string(*item.ReactionType)
			reaction = &value
		}
		response = append(response, StoryViewerResponse{
			ViewerUserID: item.ViewerUserID,
			ReactionType: reaction,
			ViewedAt:     item.ViewedAt,
			ReactedAt:    item.ReactedAt,
		})
	}
	return response, nil
}

func (s *Service) hydrate(ctx context.Context, viewerID string, story *model.Story) (StoryResponse, error) {
	audience, err := s.repo.AudienceUserIDs(ctx, story.ID)
	if err != nil {
		return StoryResponse{}, err
	}
	viewerCount, err := s.repo.ViewerCount(ctx, story.ID)
	if err != nil {
		return StoryResponse{}, err
	}
	if viewerID != story.AuthorID {
		audience = nil
		viewerCount = 0
	}
	return StoryResponse{
		ID:              story.ID,
		AuthorID:        story.AuthorID,
		MediaFileID:     story.MediaFileID,
		VideoAssetID:    story.VideoAssetID,
		TrustRoomID:     story.TrustRoomID,
		Caption:         story.Caption,
		Privacy:         string(story.Privacy),
		Status:          string(story.Status),
		AllowReplies:    story.AllowReplies,
		AllowReactions:  story.AllowReactions,
		HighlightTitle:  story.HighlightTitle,
		AudienceUserIDs: audience,
		ViewerCount:     viewerCount,
		ExpiresAt:       story.ExpiresAt,
		PublishedAt:     story.PublishedAt,
	}, nil
}

func (s *Service) normalizeCreateRequest(req CreateStoryRequest) (CreateStoryRequest, error) {
	req.Privacy = strings.ToUpper(strings.TrimSpace(req.Privacy))
	req.CustomAudienceUserIDs = uniqueStrings(req.CustomAudienceUserIDs)
	now := time.Now().UTC()
	if req.ExpiresAt != nil {
		value := req.ExpiresAt.UTC()
		req.ExpiresAt = &value
		if !value.After(now) {
			return CreateStoryRequest{}, apperrors.New(400, "stories.expires_at_invalid", "Story expiration must be in the future")
		}
	}

	switch enums.PostPrivacy(req.Privacy) {
	case enums.PostPrivacyPrivate, enums.PostPrivacyOneTime:
		if len(req.CustomAudienceUserIDs) == 0 {
			return CreateStoryRequest{}, apperrors.New(400, "stories.audience_required", "Private, one-time, and timed stories require an explicit audience")
		}
	case enums.PostPrivacyTimed:
		if len(req.CustomAudienceUserIDs) == 0 {
			return CreateStoryRequest{}, apperrors.New(400, "stories.audience_required", "Private, one-time, and timed stories require an explicit audience")
		}
		if req.ExpiresAt == nil {
			return CreateStoryRequest{}, apperrors.New(400, "stories.expires_at_required", "Timed stories require an explicit expiration time")
		}
	default:
		req.CustomAudienceUserIDs = nil
	}

	if req.Caption != nil {
		value := strings.TrimSpace(*req.Caption)
		req.Caption = &value
	}
	if req.HighlightTitle != nil {
		value := strings.TrimSpace(*req.HighlightTitle)
		req.HighlightTitle = &value
	}
	return req, nil
}

func uniqueStrings(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	if len(result) == 0 {
		return nil
	}
	return result
}
