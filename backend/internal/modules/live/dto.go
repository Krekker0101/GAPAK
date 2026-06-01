package live

import "time"

type ListQuery struct {
	Page  int `query:"page" validate:"omitempty,min=1,max=10000"`
	Limit int `query:"limit" validate:"omitempty,min=1,max=50"`
}

type ListEventsQuery struct {
	After int64 `query:"after" validate:"omitempty,min=0"`
	Limit int   `query:"limit" validate:"omitempty,min=1,max=100"`
}

type CreateLiveStreamRequest struct {
	TrustRoomID  *string    `json:"trustRoomId,omitempty" validate:"omitempty,uuid4"`
	Title        string     `json:"title" validate:"required,min=3,max=120"`
	Description  *string    `json:"description,omitempty" validate:"omitempty,max=1000"`
	Visibility   string     `json:"visibility" validate:"required,oneof=PUBLIC FRIENDS TRUSTED_CIRCLE PRIVATE TRUST_ROOM"`
	ScheduledFor *time.Time `json:"scheduledFor,omitempty"`
	AllowReplay  bool       `json:"allowReplay"`
}

type JoinLiveRequest struct {
	Role        string `json:"role" validate:"required,oneof=HOST CO_HOST GUEST MODERATOR VIEWER"`
	IsGhostMode bool   `json:"isGhostMode"`
}

type LiveChatMessageRequest struct {
	Body string `json:"body" validate:"required,min=1,max=500"`
}

type LiveStreamResponse struct {
	ID                  string     `json:"id"`
	HostUserID          string     `json:"hostUserId"`
	TrustRoomID         *string    `json:"trustRoomId,omitempty"`
	Title               string     `json:"title"`
	Description         *string    `json:"description,omitempty"`
	Visibility          string     `json:"visibility"`
	Status              string     `json:"status"`
	ScheduledFor        *time.Time `json:"scheduledFor,omitempty"`
	StartedAt           *time.Time `json:"startedAt,omitempty"`
	EndedAt             *time.Time `json:"endedAt,omitempty"`
	PlaybackManifestKey *string    `json:"playbackManifestKey,omitempty"`
	ReplayMediaFileID   *string    `json:"replayMediaFileId,omitempty"`
	ViewerCount         int        `json:"viewerCount"`
	AllowReplay         bool       `json:"allowReplay"`
	EventChannel        string     `json:"eventChannel"`
	CreatedAt           time.Time  `json:"createdAt"`
}

type LiveChatMessageResponse struct {
	ID        string     `json:"id"`
	StreamID  string     `json:"streamId"`
	SenderID  string     `json:"senderId"`
	Body      string     `json:"body"`
	CreatedAt time.Time  `json:"createdAt"`
	DeletedAt *time.Time `json:"deletedAt,omitempty"`
}

type LiveEventResponse struct {
	ID        string         `json:"id"`
	Sequence  int64          `json:"sequence"`
	Channel   string         `json:"channel"`
	StreamID  string         `json:"streamId"`
	EventType string         `json:"eventType"`
	Payload   map[string]any `json:"payload"`
	CreatedAt time.Time      `json:"createdAt"`
	RelayedAt *time.Time     `json:"relayedAt,omitempty"`
}

type AcceptedResponse struct {
	Accepted bool `json:"accepted"`
}
