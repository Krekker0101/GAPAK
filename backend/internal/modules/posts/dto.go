package posts

import "time"

type CreatePostRequest struct {
	ContentType      string     `json:"contentType" validate:"omitempty,oneof=POST CLIP"`
	Body             string     `json:"body" validate:"required,min=1,max=5000"`
	Privacy          string     `json:"privacy" validate:"required,oneof=PUBLIC FRIENDS TRUSTED_CIRCLE PRIVATE ONE_TIME TIMED"`
	ExpiresAt        *time.Time `json:"expiresAt" validate:"omitempty"`
	OneTimeViewLimit *int       `json:"oneTimeViewLimit" validate:"omitempty,min=1,max=10"`
	AudienceUserIDs  []string   `json:"audienceUserIds" validate:"omitempty,dive,uuid4"`
	MediaFileIDs     []string   `json:"mediaFileIds" validate:"omitempty,dive,uuid4"`
}

type UpdatePostRequest struct {
	ContentType      *string    `json:"contentType" validate:"omitempty,oneof=POST CLIP"`
	Body             *string    `json:"body" validate:"omitempty,min=1,max=5000"`
	Privacy          *string    `json:"privacy" validate:"omitempty,oneof=PUBLIC FRIENDS TRUSTED_CIRCLE PRIVATE ONE_TIME TIMED"`
	ExpiresAt        *time.Time `json:"expiresAt" validate:"omitempty"`
	OneTimeViewLimit *int       `json:"oneTimeViewLimit" validate:"omitempty,min=1,max=10"`
	AudienceUserIDs  []string   `json:"audienceUserIds" validate:"omitempty,dive,uuid4"`
	MediaFileIDs     []string   `json:"mediaFileIds" validate:"omitempty,dive,uuid4"`
}

type FeedQuery struct {
	Page        int    `query:"page" validate:"omitempty,min=1"`
	Limit       int    `query:"limit" validate:"omitempty,min=1,max=50"`
	ContentType string `query:"contentType" validate:"omitempty,oneof=POST CLIP"`
}

type PostResponse struct {
	ID               string     `json:"id"`
	AuthorID         string     `json:"authorId"`
	ContentType      string     `json:"contentType"`
	Body             string     `json:"body"`
	Privacy          string     `json:"privacy"`
	LikeCount        int        `json:"likeCount"`
	CommentCount     int        `json:"commentCount"`
	IsLiked          bool       `json:"isLiked"`
	ExpiresAt        *time.Time `json:"expiresAt,omitempty"`
	OneTimeViewLimit *int       `json:"oneTimeViewLimit,omitempty"`
	AudienceUserIDs  []string   `json:"audienceUserIds,omitempty"`
	MediaFileIDs     []string   `json:"mediaFileIDs,omitempty"`
	PublishedAt      time.Time  `json:"publishedAt"`
	EditedAt         *time.Time `json:"editedAt,omitempty"`
}

type AcceptedResponse struct {
	Accepted bool `json:"accepted"`
}

type CreateCommentRequest struct {
	Content         string  `json:"content" validate:"required,min=1,max=1000"`
	ParentCommentID *string `json:"parentCommentId" validate:"omitempty,uuid4"`
}

type UpdateCommentRequest struct {
	Content string `json:"content" validate:"required,min=1,max=1000"`
}

type CommentQuery struct {
	Page   int `query:"page" validate:"omitempty,min=1"`
	Limit  int `query:"limit" validate:"omitempty,min=1,max=50"`
	SortBy string `query:"sortBy" validate:"omitempty,oneof=recent top"`
}

type CommentResponse struct {
	ID              string            `json:"id"`
	PostID          string            `json:"postId"`
	AuthorID        string            `json:"authorId"`
	ParentCommentID *string           `json:"parentCommentId,omitempty"`
	Content         string            `json:"content"`
	LikeCount       int               `json:"likeCount"`
	ReplyCount      int               `json:"replyCount"`
	IsLiked         bool              `json:"isLiked"`
	Replies         []CommentResponse `json:"replies,omitempty"`
	CreatedAt       time.Time         `json:"createdAt"`
	UpdatedAt       time.Time         `json:"updatedAt"`
}

type LikesListResponse struct {
	UserID   string `json:"userId"`
	Username string `json:"username"`
}

