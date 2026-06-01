package subscriptions

import (
	"context"
	"errors"
	"time"

	"github.com/gapak/backend/internal/domain/enums"
	"github.com/gapak/backend/internal/domain/model"
	"github.com/gapak/backend/internal/platform/logger"
	"github.com/google/uuid"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// Subscribe подписать пользователя
func (s *Service) Subscribe(ctx context.Context, subscriberID, creatorID string) (*SubscriptionResponse, error) {
	if subscriberID == creatorID {
		return nil, errors.New("cannot subscribe to yourself")
	}

	// Проверить не заблокирован ли подписчик
	blocked, err := s.repo.IsBlocked(ctx, subscriberID, creatorID)
	if err != nil {
		logger.Error().Err(err).Msg("failed to check if blocked")
		return nil, err
	}
	if blocked {
		return nil, errors.New("you are blocked from subscribing to this user")
	}

	// Проверить уже ли подписан
	existing, err := s.repo.GetSubscriptionByUsers(ctx, subscriberID, creatorID)
	if err != nil {
		logger.Error().Err(err).Msg("failed to check existing subscription")
		return nil, err
	}
	if existing != nil {
		// Если уже подписан с активным статусом
		if existing.Status == enums.SubscriptionStatusActive {
			return mapSubscriptionToResponse(existing), nil
		}
		// Если был заблокирован, удалить старую запись
		err = s.repo.DeleteSubscription(ctx, existing.ID)
		if err != nil {
			logger.Error().Err(err).Msg("failed to delete old subscription")
			return nil, err
		}
	}

	// Создать новую подписку
	subscription := &model.Subscription{
		ID:               uuid.NewString(),
		SubscriberID:     subscriberID,
		CreatorID:        creatorID,
		Status:           enums.SubscriptionStatusActive,
		SubscriptionType: enums.SubscriptionTypeVisible,
		SubscribedAt:     time.Now(),
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	err = s.repo.CreateSubscription(ctx, subscription)
	if err != nil {
		logger.Error().Err(err).Msg("failed to create subscription")
		return nil, err
	}

	// Создать настройки уведомлений по умолчанию
	prefs := &model.SubscriptionNotificationPreferences{
		SubscriberID:  subscriberID,
		CreatorID:     creatorID,
		NotifyOnPost:  true,
		NotifyOnStory: true,
		NotifyOnLive:  true,
		NotifyOnClip:  true,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
	_ = s.repo.SetNotificationPreference(ctx, prefs)

	return mapSubscriptionToResponse(subscription), nil
}

// Unsubscribe отписать пользователя
func (s *Service) Unsubscribe(ctx context.Context, subscriberID, creatorID string) error {
	subscription, err := s.repo.GetSubscriptionByUsers(ctx, subscriberID, creatorID)
	if err != nil {
		logger.Error().Err(err).Msg("failed to get subscription")
		return err
	}
	if subscription == nil {
		return errors.New("subscription not found")
	}

	err = s.repo.DeleteSubscription(ctx, subscription.ID)
	if err != nil {
		logger.Error().Err(err).Msg("failed to delete subscription")
		return err
	}

	return nil
}

// ChangeSubscriptionType изменить тип подписки (VISIBLE или SILENT)
func (s *Service) ChangeSubscriptionType(ctx context.Context, subscriberID, creatorID string, subType enums.SubscriptionType) (*SubscriptionResponse, error) {
	subscription, err := s.repo.GetSubscriptionByUsers(ctx, subscriberID, creatorID)
	if err != nil {
		logger.Error().Err(err).Msg("failed to get subscription")
		return nil, err
	}
	if subscription == nil {
		return nil, errors.New("subscription not found")
	}

	err = s.repo.UpdateSubscriptionType(ctx, subscription.ID, subType)
	if err != nil {
		logger.Error().Err(err).Msg("failed to update subscription type")
		return nil, err
	}

	subscription.SubscriptionType = subType
	return mapSubscriptionToResponse(subscription), nil
}

// GetSubscribers получить подписчиков пользователя
func (s *Service) GetSubscribers(ctx context.Context, creatorID string, limit, offset int) ([]SubscribersListResponse, int, error) {
	subscriptions, total, err := s.repo.GetSubscribers(ctx, creatorID, limit, offset)
	if err != nil {
		logger.Error().Err(err).Msg("failed to get subscribers")
		return nil, 0, err
	}

	var result []SubscribersListResponse
	for _, sub := range subscriptions {
		resp := SubscribersListResponse{
			ID:           sub.SubscriberID,
			Username:     "", // Нужно получить из users таблицы
			DisplayName:  "", // Нужно получить из users таблицы
			AvatarFileID: "", // Нужно получить из users таблицы
			Bio:          "", // Нужно получить из users таблицы
		}
		result = append(result, resp)
	}

	return result, total, nil
}

// GetSubscriptions получить авторов на которых подписан пользователь
func (s *Service) GetSubscriptions(ctx context.Context, subscriberID string, limit, offset int) ([]CreatorsListResponse, int, error) {
	subscriptions, total, err := s.repo.GetSubscriptions(ctx, subscriberID, limit, offset)
	if err != nil {
		logger.Error().Err(err).Msg("failed to get subscriptions")
		return nil, 0, err
	}

	var result []CreatorsListResponse
	for _, sub := range subscriptions {
		resp := CreatorsListResponse{
			ID:               sub.CreatorID,
			Username:         "", // Нужно получить из users таблицы
			DisplayName:      "", // Нужно получить из users таблицы
			AvatarFileID:     "", // Нужно получить из users таблицы
			Bio:              "", // Нужно получить из users таблицы
			SubscriptionType: string(sub.SubscriptionType),
		}
		result = append(result, resp)
	}

	return result, total, nil
}

// IsSubscribed проверить подписан ли пользователь
func (s *Service) IsSubscribed(ctx context.Context, subscriberID, creatorID string) (bool, error) {
	return s.repo.IsSubscribed(ctx, subscriberID, creatorID)
}

// RequestSubscription создать запрос на подписку (для приватных аккаунтов)
func (s *Service) RequestSubscription(ctx context.Context, subscriberID, creatorID, message string) (*SubscriptionRequestResponse, error) {
	if subscriberID == creatorID {
		return nil, errors.New("cannot request subscription from yourself")
	}

	// Проверить не заблокирован ли подписчик
	blocked, err := s.repo.IsBlocked(ctx, subscriberID, creatorID)
	if err != nil {
		logger.Error().Err(err).Msg("failed to check if blocked")
		return nil, err
	}
	if blocked {
		return nil, errors.New("you are blocked from requesting subscription")
	}

	// Проверить уже ли есть активная подписка или запрос
	sub, err := s.repo.GetSubscriptionByUsers(ctx, subscriberID, creatorID)
	if err != nil {
		logger.Error().Err(err).Msg("failed to check subscription")
		return nil, err
	}
	if sub != nil && sub.Status == enums.SubscriptionStatusActive {
		return nil, errors.New("already subscribed")
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
		logger.Error().Err(err).Msg("failed to create subscription request")
		return nil, err
	}

	return mapSubscriptionRequestToResponse(req), nil
}

// ApproveSubscriptionRequest одобрить запрос на подписку
func (s *Service) ApproveSubscriptionRequest(ctx context.Context, requestID string) (*SubscriptionResponse, error) {
	req, err := s.repo.GetSubscriptionRequest(ctx, requestID)
	if err != nil {
		logger.Error().Err(err).Msg("failed to get subscription request")
		return nil, err
	}
	if req == nil {
		return nil, errors.New("subscription request not found")
	}

	// Обновить статус запроса
	err = s.repo.RespondSubscriptionRequest(ctx, requestID, true)
	if err != nil {
		logger.Error().Err(err).Msg("failed to approve subscription request")
		return nil, err
	}

	// Создать подписку
	subscription := &model.Subscription{
		ID:               uuid.NewString(),
		SubscriberID:     req.SubscriberID,
		CreatorID:        req.CreatorID,
		Status:           enums.SubscriptionStatusActive,
		SubscriptionType: enums.SubscriptionTypeVisible,
		SubscribedAt:     time.Now(),
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	err = s.repo.CreateSubscription(ctx, subscription)
	if err != nil {
		logger.Error().Err(err).Msg("failed to create subscription after approval")
		return nil, err
	}

	return mapSubscriptionToResponse(subscription), nil
}

// RejectSubscriptionRequest отклонить запрос на подписку
func (s *Service) RejectSubscriptionRequest(ctx context.Context, requestID string) error {
	err := s.repo.RespondSubscriptionRequest(ctx, requestID, false)
	if err != nil {
		logger.Error().Err(err).Msg("failed to reject subscription request")
		return err
	}

	return nil
}

// GetPendingRequests получить ожидающие запросы
func (s *Service) GetPendingRequests(ctx context.Context, creatorID string, limit, offset int) ([]SubscriptionRequestResponse, int, error) {
	reqs, total, err := s.repo.GetPendingSubscriptionRequests(ctx, creatorID, limit, offset)
	if err != nil {
		logger.Error().Err(err).Msg("failed to get pending requests")
		return nil, 0, err
	}

	var result []SubscriptionRequestResponse
	for _, req := range reqs {
		result = append(result, *mapSubscriptionRequestToResponse(&req))
	}

	return result, total, nil
}

// BlockUser заблокировать пользователя
func (s *Service) BlockUser(ctx context.Context, userID, blockedUserID string) error {
	if userID == blockedUserID {
		return errors.New("cannot block yourself")
	}

	// Удалить подписку если была
	sub, err := s.repo.GetSubscriptionByUsers(ctx, userID, blockedUserID)
	if err == nil && sub != nil {
		_ = s.repo.DeleteSubscription(ctx, sub.ID)
	}

	// Удалить подписку в обратном направлении
	sub, err = s.repo.GetSubscriptionByUsers(ctx, blockedUserID, userID)
	if err == nil && sub != nil {
		_ = s.repo.DeleteSubscription(ctx, sub.ID)
	}

	// Добавить в blocklist
	err = s.repo.BlockUser(ctx, userID, blockedUserID)
	if err != nil {
		logger.Error().Err(err).Msg("failed to block user")
		return err
	}

	return nil
}

// UnblockUser разблокировать пользователя
func (s *Service) UnblockUser(ctx context.Context, userID, blockedUserID string) error {
	err := s.repo.UnblockUser(ctx, userID, blockedUserID)
	if err != nil {
		logger.Error().Err(err).Msg("failed to unblock user")
		return err
	}

	return nil
}

// SetNotificationPreference установить настройки уведомлений
func (s *Service) SetNotificationPreference(ctx context.Context, subscriberID, creatorID string, notify map[string]bool, muteUntil *time.Time) error {
	pref := &model.SubscriptionNotificationPreferences{
		SubscriberID:  subscriberID,
		CreatorID:     creatorID,
		NotifyOnPost:  notify["post"],
		NotifyOnStory: notify["story"],
		NotifyOnLive:  notify["live"],
		NotifyOnClip:  notify["clip"],
		MuteUntil:     muteUntil,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	err := s.repo.SetNotificationPreference(ctx, pref)
	if err != nil {
		logger.Error().Err(err).Msg("failed to set notification preference")
		return err
	}

	return nil
}

// GetNotificationPreference получить настройки уведомлений
func (s *Service) GetNotificationPreference(ctx context.Context, subscriberID, creatorID string) (*SubscriptionNotificationPreferencesResponse, error) {
	pref, err := s.repo.GetNotificationPreference(ctx, subscriberID, creatorID)
	if err != nil {
		logger.Error().Err(err).Msg("failed to get notification preference")
		return nil, err
	}

	// Если нет настроек, создать дефолтные
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

// GetSubscriptionStats получить статистику подписок
func (s *Service) GetSubscriptionStats(ctx context.Context, userID string) (*SubscriptionStatsResponse, error) {
	followers, following, pendingRequests, err := s.repo.GetSubscriptionStats(ctx, userID)
	if err != nil {
		logger.Error().Err(err).Msg("failed to get subscription stats")
		return nil, err
	}

	// TODO: получить количество visible/silent подписок
	return &SubscriptionStatsResponse{
		FollowersCount:       followers,
		FollowingCount:       following,
		PendingRequestsCount: pendingRequests,
	}, nil
}

// Helper functions

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
