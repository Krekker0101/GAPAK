package subscriptions

import (
	"context"
	"time"

	"github.com/gapak/backend/internal/domain/enums"
	"github.com/gapak/backend/internal/domain/model"
	apperrors "github.com/gapak/backend/internal/platform/errors"
	"github.com/google/uuid"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Subscribe(ctx context.Context, subscriberID, creatorID string) (*SubscriptionResponse, error) {
	if subscriberID == creatorID {
		return nil, apperrors.New(400, "subscriptions.self_subscribe_forbidden", "cannot subscribe to yourself")
	}

	blocked, err := s.repo.IsBlocked(ctx, subscriberID, creatorID)
	if err != nil {
		return nil, err
	}
	if blocked {
		return nil, apperrors.New(403, "subscriptions.blocked", "you are blocked from subscribing to this user")
	}

	subscription := &model.Subscription{
		ID:               uuid.NewString(),
		SubscriberID:     subscriberID,
		CreatorID:        creatorID,
		Status:           enums.SubscriptionStatusActive,
		SubscriptionType: enums.SubscriptionTypeVisible,
	}
	if err := s.repo.UpsertActiveSubscription(ctx, subscription); err != nil {
		return nil, err
	}

	prefs := &model.SubscriptionNotificationPreferences{
		SubscriberID:  subscriberID,
		CreatorID:     creatorID,
		NotifyOnPost:  true,
		NotifyOnStory: true,
		NotifyOnLive:  true,
		NotifyOnClip:  true,
	}
	if err := s.repo.SetNotificationPreference(ctx, prefs); err != nil {
		return nil, err
	}

	return mapSubscriptionToResponse(subscription), nil
}

func (s *Service) Unsubscribe(ctx context.Context, subscriberID, creatorID string) error {
	subscription, err := s.repo.GetSubscriptionByUsers(ctx, subscriberID, creatorID)
	if err != nil {
		return err
	}
	if subscription == nil {
		return apperrors.New(404, "subscriptions.not_found", "subscription not found")
	}

	return s.repo.DeleteSubscription(ctx, subscription.ID)
}

func (s *Service) ChangeSubscriptionType(ctx context.Context, subscriberID, creatorID, subType string) (*SubscriptionResponse, error) {
	subscription, err := s.repo.GetSubscriptionByUsers(ctx, subscriberID, creatorID)
	if err != nil {
		return nil, err
	}
	if subscription == nil {
		return nil, apperrors.New(404, "subscriptions.not_found", "subscription not found")
	}

	subscription.SubscriptionType = enums.SubscriptionType(subType)
	err = s.repo.UpdateSubscriptionType(ctx, subscription.ID, subscription.SubscriptionType)
	if err != nil {
		return nil, err
	}

	return mapSubscriptionToResponse(subscription), nil
}

func (s *Service) GetSubscribers(ctx context.Context, creatorID string, limit, offset int) ([]SubscribersListResponse, int, error) {
	subscribers, total, err := s.repo.GetSubscribers(ctx, creatorID, limit, offset)
	if err != nil {
		return nil, 0, err
	}

	result := make([]SubscribersListResponse, 0, len(subscribers))
	for _, row := range subscribers {
		result = append(result, SubscribersListResponse{
			ID:           row.Subscription.SubscriberID,
			Username:     row.Username,
			DisplayName:  row.DisplayName,
			AvatarFileID: valueOrEmpty(row.AvatarFileID),
			Bio:          valueOrEmpty(row.Bio),
		})
	}

	return result, total, nil
}

func (s *Service) GetSubscriptions(ctx context.Context, subscriberID string, limit, offset int) ([]CreatorsListResponse, int, error) {
	subscriptions, total, err := s.repo.GetSubscriptions(ctx, subscriberID, limit, offset)
	if err != nil {
		return nil, 0, err
	}

	result := make([]CreatorsListResponse, 0, len(subscriptions))
	for _, row := range subscriptions {
		result = append(result, CreatorsListResponse{
			ID:               row.Subscription.CreatorID,
			Username:         row.Username,
			DisplayName:      row.DisplayName,
			AvatarFileID:     valueOrEmpty(row.AvatarFileID),
			Bio:              valueOrEmpty(row.Bio),
			SubscriptionType: string(row.Subscription.SubscriptionType),
		})
	}

	return result, total, nil
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func (s *Service) IsSubscribed(ctx context.Context, subscriberID, creatorID string) (bool, error) {
	return s.repo.IsSubscribed(ctx, subscriberID, creatorID)
}

func (s *Service) RequestSubscription(ctx context.Context, subscriberID, creatorID, message string) (*SubscriptionRequestResponse, error) {
	if subscriberID == creatorID {
		return nil, apperrors.New(400, "subscriptions.self_request_forbidden", "cannot request subscription from yourself")
	}

	blocked, err := s.repo.IsBlocked(ctx, subscriberID, creatorID)
	if err != nil {
		return nil, err
	}
	if blocked {
		return nil, apperrors.New(403, "subscriptions.blocked", "you are blocked from requesting subscription")
	}

	sub, err := s.repo.GetSubscriptionByUsers(ctx, subscriberID, creatorID)
	if err != nil {
		return nil, err
	}
	if sub != nil && sub.Status == enums.SubscriptionStatusActive {
		return nil, apperrors.New(409, "subscriptions.already_subscribed", "already subscribed")
	}

	req := &model.SubscriptionRequest{
		ID:           uuid.NewString(),
		SubscriberID: subscriberID,
		CreatorID:    creatorID,
		Status:       enums.SubscriptionStatusPending,
		Message:      &message,
		RequestedAt:  time.Now(),
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	err = s.repo.CreateSubscriptionRequest(ctx, req)
	if err != nil {
		return nil, err
	}

	return mapSubscriptionRequestToResponse(req), nil
}

func (s *Service) ApproveSubscriptionRequest(ctx context.Context, creatorID, requestID string) (*SubscriptionResponse, error) {
	subscription, err := s.repo.ApproveSubscriptionRequest(ctx, creatorID, requestID)
	if err != nil {
		return nil, err
	}
	return mapSubscriptionToResponse(subscription), nil
}

func (s *Service) RejectSubscriptionRequest(ctx context.Context, creatorID, requestID string) error {
	return s.repo.RejectSubscriptionRequest(ctx, creatorID, requestID)
}

func (s *Service) GetPendingRequests(ctx context.Context, creatorID string, limit, offset int) ([]SubscriptionRequestResponse, int, error) {
	reqs, total, err := s.repo.GetPendingSubscriptionRequests(ctx, creatorID, limit, offset)
	if err != nil {
		return nil, 0, err
	}

	var result []SubscriptionRequestResponse
	for _, req := range reqs {
		result = append(result, *mapSubscriptionRequestToResponse(&req))
	}

	return result, total, nil
}

func (s *Service) BlockUser(ctx context.Context, userID, blockedUserID string) error {
	if userID == blockedUserID {
		return apperrors.New(400, "subscriptions.self_block_forbidden", "cannot block yourself")
	}

	sub, err := s.repo.GetSubscriptionByUsers(ctx, userID, blockedUserID)
	if err == nil && sub != nil {
		_ = s.repo.DeleteSubscription(ctx, sub.ID)
	}

	sub, err = s.repo.GetSubscriptionByUsers(ctx, blockedUserID, userID)
	if err == nil && sub != nil {
		_ = s.repo.DeleteSubscription(ctx, sub.ID)
	}

	return s.repo.BlockUser(ctx, userID, blockedUserID)
}

func (s *Service) UnblockUser(ctx context.Context, userID, blockedUserID string) error {
	return s.repo.UnblockUser(ctx, userID, blockedUserID)
}

func (s *Service) SetNotificationPreference(ctx context.Context, subscriberID, creatorID string, req UpdateSubscriptionNotificationPreferencesRequest) error {
	var muteUntil *time.Time
	if req.MuteMinutes != nil && *req.MuteMinutes > 0 {
		t := time.Now().Add(time.Duration(*req.MuteMinutes) * time.Minute)
		muteUntil = &t
	}

	pref := &model.SubscriptionNotificationPreferences{
		SubscriberID:  subscriberID,
		CreatorID:     creatorID,
		NotifyOnPost:  req.NotifyOnPost == nil || *req.NotifyOnPost,
		NotifyOnStory: req.NotifyOnStory == nil || *req.NotifyOnStory,
		NotifyOnLive:  req.NotifyOnLive == nil || *req.NotifyOnLive,
		NotifyOnClip:  req.NotifyOnClip == nil || *req.NotifyOnClip,
		MuteUntil:     muteUntil,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	return s.repo.SetNotificationPreference(ctx, pref)
}

func (s *Service) GetNotificationPreference(ctx context.Context, subscriberID, creatorID string) (*SubscriptionNotificationPreferencesResponse, error) {
	pref, err := s.repo.GetNotificationPreference(ctx, subscriberID, creatorID)
	if err != nil {
		return nil, err
	}

	if pref == nil {
		pref = &model.SubscriptionNotificationPreferences{
			SubscriberID:  subscriberID,
			CreatorID:     creatorID,
			NotifyOnPost:  true,
			NotifyOnStory: true,
			NotifyOnLive:  true,
			NotifyOnClip:  true,
		}
	}

	isMuted := pref.MuteUntil != nil && pref.MuteUntil.After(time.Now())

	return &SubscriptionNotificationPreferencesResponse{
		CreatorID:     creatorID,
		NotifyOnPost:  pref.NotifyOnPost,
		NotifyOnStory: pref.NotifyOnStory,
		NotifyOnLive:  pref.NotifyOnLive,
		NotifyOnClip:  pref.NotifyOnClip,
		IsMuted:       isMuted,
	}, nil
}

func (s *Service) GetSubscriptionStats(ctx context.Context, userID string) (*SubscriptionStatsResponse, error) {
	followers, following, pendingRequests, err := s.repo.GetSubscriptionStats(ctx, userID)
	if err != nil {
		return nil, err
	}

	return &SubscriptionStatsResponse{
		FollowersCount:       followers,
		FollowingCount:       following,
		PendingRequestsCount: pendingRequests,
	}, nil
}

func mapSubscriptionToResponse(sub *model.Subscription) *SubscriptionResponse {
	return &SubscriptionResponse{
		ID:               sub.ID,
		SubscriberID:     sub.SubscriberID,
		CreatorID:        sub.CreatorID,
		Status:           string(sub.Status),
		SubscriptionType: string(sub.SubscriptionType),
		SubscribedAt:     sub.SubscribedAt,
		CreatedAt:        sub.CreatedAt,
	}
}

func mapSubscriptionRequestToResponse(req *model.SubscriptionRequest) *SubscriptionRequestResponse {
	return &SubscriptionRequestResponse{
		ID:           req.ID,
		SubscriberID: req.SubscriberID,
		CreatorID:    req.CreatorID,
		Status:       string(req.Status),
		Message:      req.Message,
		RequestedAt:  req.RequestedAt,
		RespondedAt:  req.RespondedAt,
		CreatedAt:    req.CreatedAt,
	}
}
