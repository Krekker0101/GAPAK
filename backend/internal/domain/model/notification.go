package model

import "time"

// MentionType represents the type of mention
type MentionType string

const (
	MentionTypeChat            MentionType = "chat"
	MentionTypeComment         MentionType = "comment"
	MentionTypePost            MentionType = "post"
	MentionTypeStory           MentionType = "story"
	MentionTypeRoom            MentionType = "room"
	MentionTypeCommunity       MentionType = "community"
	MentionTypeProject         MentionType = "project"
	MentionTypeAICollaboration MentionType = "ai_collaboration"
)

// NotificationType represents the type of notification
type NotificationType string

const (
	NotificationTypeMention NotificationType = "mention"
	NotificationTypeLike    NotificationType = "like"
	NotificationTypeComment NotificationType = "comment"
	NotificationTypeFollow  NotificationType = "follow"
	NotificationTypeSystem  NotificationType = "system"
)

// Mention represents a user mention in content
type Mention struct {
	ID                     string      `json:"id" db:"id"`
	MentionedUserID        string      `json:"mentioned_user_id" db:"mentioned_user_id"`
	MentionedByUsername    string      `json:"mentioned_by_username" db:"mentioned_by_username"`
	MentionedByDisplayName string      `json:"mentioned_by_display_name" db:"mentioned_by_display_name"`
	MentionedByAvatar      *string     `json:"mentioned_by_avatar,omitempty" db:"mentioned_by_avatar"`
	Type                   MentionType `json:"type" db:"type"`
	Content                string      `json:"content" db:"content"`
	ContextID              string      `json:"context_id" db:"context_id"`
	ContextType            string      `json:"context_type" db:"context_type"`
	CreatedAt              time.Time   `json:"created_at" db:"created_at"`
	IsRead                 bool        `json:"is_read" db:"is_read"`

	// Optional metadata for navigation
	PostID      *string `json:"post_id,omitempty" db:"post_id"`
	CommentID   *string `json:"comment_id,omitempty" db:"comment_id"`
	RoomID      *string `json:"room_id,omitempty" db:"room_id"`
	CommunityID *string `json:"community_id,omitempty" db:"community_id"`
	ProjectID   *string `json:"project_id,omitempty" db:"project_id"`
	StoryID     *string `json:"story_id,omitempty" db:"story_id"`
	ChatID      *string `json:"chat_id,omitempty" db:"chat_id"`
}

// Notification represents a user notification
type Notification struct {
	ID        string           `json:"id" db:"id"`
	UserID    string           `json:"user_id" db:"user_id"`
	Type      NotificationType `json:"type" db:"type"`
	Title     string           `json:"title" db:"title"`
	Body      string           `json:"body" db:"body"`
	Data      map[string]any   `json:"data,omitempty" db:"data"`
	IsRead    bool             `json:"is_read" db:"is_read"`
	CreatedAt time.Time        `json:"created_at" db:"created_at"`
	ActionURL *string          `json:"action_url,omitempty" db:"action_url"`
}

// MentionAnalytics represents mention analytics for a user
type MentionAnalytics struct {
	TotalMentions    int64 `json:"total_mentions"`
	MentionsThisWeek int64 `json:"mentions_this_week"`
}

// TopMentioner represents a user who mentions the most
type TopMentioner struct {
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Count       int64  `json:"count"`
}

// TopCommunity represents a community with most mentions
type TopCommunity struct {
	CommunityID string `json:"community_id"`
	Name        string `json:"name"`
	Count       int64  `json:"count"`
}
