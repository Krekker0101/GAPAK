package notifications

import "time"

type ListQuery struct {
	Limit int `query:"limit" validate:"omitempty,min=1,max=50"`
}

type NotificationResponse struct {
	ID         string         `json:"id"`
	Type       string         `json:"type"`
	Title      string         `json:"title"`
	Body       string         `json:"body,omitempty"`
	CreatedAt  time.Time      `json:"createdAt"`
	ReadAt     *time.Time     `json:"readAt,omitempty"`
	TargetURL  *string        `json:"targetUrl,omitempty"`
	Metadata   map[string]any `json:"metadata,omitempty"`
	ActorID    string         `json:"actorId,omitempty"`
	EntityType *string        `json:"entityType,omitempty"`
	EntityID   *string        `json:"entityId,omitempty"`
	EventID    *string        `json:"eventId,omitempty"`
}

type NotificationListResponse struct {
	Notifications []NotificationResponse `json:"notifications"`
}

type UnreadCountResponse struct {
	Count int `json:"count"`
}
