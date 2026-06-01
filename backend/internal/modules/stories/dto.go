package stories

import "time"

type FeedQuery struct {
	Page  int `query:"page" validate:"omitempty,min=1,max=10000"`
	Limit int `query:"limit" validate:"omitempty,min=1,max=50"`
}

type CreateStoryRequest struct {
	MediaFileID           string     `json:"mediaFileId" validate:"required,uuid4"`
	TrustRoomID           *string    `json:"trustRoomId,omitempty" validate:"omitempty,uuid4"`
	Caption               *string    `json:"caption,omitempty" validate:"omitempty,max=600"`
	Privacy               string     `json:"privacy" validate:"required,oneof=PUBLIC FRIENDS TRUSTED_CIRCLE PRIVATE ONE_TIME TIMED"`
	AllowReplies          bool       `json:"allowReplies"`
	AllowReactions        bool       `json:"allowReactions"`
	ExpiresAt             *time.Time `json:"expiresAt,omitempty"`
	CustomAudienceUserIDs []string   `json:"customAudienceUserIds,omitempty" validate:"omitempty,dive,uuid4"`
	HighlightTitle        *string    `json:"highlightTitle,omitempty" validate:"omitempty,max=80"`
}

type ReactStoryRequest struct {
	ReactionType string `json:"reactionType" validate:"required,oneof=LIKE FIRE SUPPORT"`
}

type HighlightStoryRequest struct {
	Title string `json:"title" validate:"required,min=1,max=80"`
}

type StoryResponse struct {
	ID              string    `json:"id"`
	AuthorID        string    `json:"authorId"`
	MediaFileID     string    `json:"mediaFileId"`
	VideoAssetID    *string   `json:"videoAssetId,omitempty"`
	TrustRoomID     *string   `json:"trustRoomId,omitempty"`
	Caption         *string   `json:"caption,omitempty"`
	Privacy         string    `json:"privacy"`
	Status          string    `json:"status"`
	AllowReplies    bool      `json:"allowReplies"`
	AllowReactions  bool      `json:"allowReactions"`
	HighlightTitle  *string   `json:"highlightTitle,omitempty"`
	AudienceUserIDs []string  `json:"audienceUserIds,omitempty"`
	ViewerCount     int       `json:"viewerCount"`
	ExpiresAt       time.Time `json:"expiresAt"`
	PublishedAt     time.Time `json:"publishedAt"`
}

type StoryViewerResponse struct {
	ViewerUserID string     `json:"viewerUserId"`
	ReactionType *string    `json:"reactionType,omitempty"`
	ViewedAt     time.Time  `json:"viewedAt"`
	ReactedAt    *time.Time `json:"reactedAt,omitempty"`
}

type AcceptedResponse struct {
	Accepted bool `json:"accepted"`
}
