package subscriptions

import "time"

// CreateSubscriptionRequest создает подписку
type CreateSubscriptionRequest struct {
	CreatorID        string `json:"creatorId" validate:"required,uuid4"`
	SubscriptionType string `json:"subscriptionType" validate:"required,oneof=VISIBLE SILENT"`
}

// UpdateSubscriptionTypeRequest изменяет тип подписки (тихая или заметная)
type UpdateSubscriptionTypeRequest struct {
	SubscriptionType string `json:"subscriptionType" validate:"required,oneof=VISIBLE SILENT"`
}

// SubscriptionResponse DTO для ответа
type SubscriptionResponse struct {
	ID               string    `json:"id"`
	SubscriberID     string    `json:"subscriberId"`
	CreatorID        string    `json:"creatorId"`
	Status           string    `json:"status"`
	SubscriptionType string    `json:"subscriptionType"`
	SubscribedAt     time.Time `json:"subscribedAt"`
	CreatedAt        time.Time `json:"createdAt"`
}

// SubscriptionRequestResponse для запросов на подписку
type SubscriptionRequestResponse struct {
	ID           string     `json:"id"`
	SubscriberID string     `json:"subscriberId"`
	CreatorID    string     `json:"creatorId"`
	Status       string     `json:"status"`
	Message      *string    `json:"message,omitempty"`
	RequestedAt  time.Time  `json:"requestedAt"`
	RespondedAt  *time.Time `json:"respondedAt,omitempty"`
	CreatedAt    time.Time  `json:"createdAt"`
}

// SubscribersListResponse список подписчиков
type SubscribersListResponse struct {
	ID           string `json:"id"`
	Username     string `json:"username"`
	DisplayName  string `json:"displayName"`
	AvatarFileID string `json:"avatarFileId,omitempty"`
	Bio          string `json:"bio,omitempty"`
	IsFollowing  bool   `json:"isFollowing"`
	IsFriend     bool   `json:"isFriend"`
}

// CreatorsListResponse список авторов на которых подписан пользователь
type CreatorsListResponse struct {
	ID               string `json:"id"`
	Username         string `json:"username"`
	DisplayName      string `json:"displayName"`
	AvatarFileID     string `json:"avatarFileId,omitempty"`
	Bio              string `json:"bio,omitempty"`
	SubscriptionType string `json:"subscriptionType"`
	AccountType      string `json:"accountType"`
	IsFollowing      bool   `json:"isFollowing"`
	IsFriend         bool   `json:"isFriend"`
}

// CreateSubscriptionRequestRequest запрос на подписку (для приватных аккаунтов)
type CreateSubscriptionRequestRequest struct {
	CreatorID string `json:"creatorId" validate:"required,uuid4"`
	Message   string `json:"message" validate:"omitempty,max=500"`
}

// RespondSubscriptionRequestRequest ответ на запрос подписки
type RespondSubscriptionRequestRequest struct {
	Accept bool `json:"accept"`
}

// SubscriptionNotificationPreferencesResponse настройки уведомлений
type SubscriptionNotificationPreferencesResponse struct {
	CreatorID     string `json:"creatorId"`
	NotifyOnPost  bool   `json:"notifyOnPost"`
	NotifyOnStory bool   `json:"notifyOnStory"`
	NotifyOnLive  bool   `json:"notifyOnLive"`
	NotifyOnClip  bool   `json:"notifyOnClip"`
	IsMuted       bool   `json:"isMuted"`
}

// UpdateSubscriptionNotificationPreferencesRequest обновить настройки уведомлений
type UpdateSubscriptionNotificationPreferencesRequest struct {
	NotifyOnPost  *bool `json:"notifyOnPost"`
	NotifyOnStory *bool `json:"notifyOnStory"`
	NotifyOnLive  *bool `json:"notifyOnLive"`
	NotifyOnClip  *bool `json:"notifyOnClip"`
	MuteMinutes   *int  `json:"muteMinutes"` // 0 = unmute, null/positive = mute for N minutes
}

// PagedSubscriptionsResponse для пагинированного списка
type PagedSubscriptionsResponse struct {
	Items    []SubscribersListResponse `json:"items"`
	Total    int                       `json:"total"`
	Page     int                       `json:"page"`
	PageSize int                       `json:"pageSize"`
	HasMore  bool                      `json:"hasMore"`
}

// PendingRequestsResponse для списка ожидающих запросов
type PendingRequestsResponse struct {
	Items    []SubscriptionRequestResponse `json:"items"`
	Total    int                           `json:"total"`
	Page     int                           `json:"page"`
	PageSize int                           `json:"pageSize"`
	HasMore  bool                          `json:"hasMore"`
}

// SubscriptionStatsResponse статистика подписок
type SubscriptionStatsResponse struct {
	FollowersCount       int `json:"followersCount"`
	FollowingCount       int `json:"followingCount"`
	PendingRequestsCount int `json:"pendingRequestsCount"`
	VisibleSubscriptions int `json:"visibleSubscriptions"`
	SilentSubscriptions  int `json:"silentSubscriptions"`
}

// BlockUserRequest заблокировать пользователя
type BlockUserRequest struct {
	UserID string `json:"userId" validate:"required,uuid4"`
}

// AcceptedResponse базовый ответ
type AcceptedResponse struct {
	Accepted bool `json:"accepted"`
}
