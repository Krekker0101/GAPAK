package admin

import (
	"encoding/json"
	"time"
)

type OverviewResponse struct {
	TotalUsers       int64        `json:"totalUsers"`
	ActiveUsers      int64        `json:"activeUsers"`
	ActiveSessions   int64        `json:"activeSessions"`
	NewUsers7d       int64        `json:"newUsers7d"`
	Admins           int64        `json:"admins"`
	Posts            int64        `json:"posts"`
	TrustRooms       int64        `json:"trustRooms"`
	SecurityEvents24 int64        `json:"securityEvents24h"`
	SignupTrend      []TrendPoint `json:"signupTrend"`
	GeneratedAt      time.Time    `json:"generatedAt"`
}

type TrendPoint struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

type ListUsersResponse struct {
	Users  []AdminUserResponse `json:"users"`
	Total  int64               `json:"total"`
	Limit  int                 `json:"limit"`
	Offset int                 `json:"offset"`
}

type AdminUserResponse struct {
	ID               string     `json:"id"`
	Email            *string    `json:"email,omitempty"`
	Username         string     `json:"username"`
	DisplayName      string     `json:"displayName"`
	Role             string     `json:"role"`
	AccountStatus    string     `json:"accountStatus"`
	IsAnonymous      bool       `json:"isAnonymous"`
	TwoFactorEnabled bool       `json:"twoFactorEnabled"`
	LastSeenAt       *time.Time `json:"lastSeenAt,omitempty"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
}

type UpdateUserRequest struct {
	DisplayName   *string `json:"displayName" validate:"omitempty,min=2,max=80"`
	Role          *string `json:"role" validate:"omitempty,oneof=USER MODERATOR ADMIN SECURITY_ANALYST"`
	AccountStatus *string `json:"accountStatus" validate:"omitempty,oneof=ACTIVE SUSPENDED DELETED"`
}

type PageSummaryResponse struct {
	ID          string     `json:"id"`
	Slug        string     `json:"slug"`
	Locale      string     `json:"locale"`
	Title       string     `json:"title"`
	Status      string     `json:"status"`
	Version     int        `json:"version"`
	UpdatedBy   *string    `json:"updatedBy,omitempty"`
	PublishedAt *time.Time `json:"publishedAt,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

type PageContent struct {
	Blocks []ContentBlock `json:"blocks"`
}

type ContentBlock struct {
	ID    string         `json:"id"`
	Type  string         `json:"type"`
	Props map[string]any `json:"props"`
}

type PageResponse struct {
	PageSummaryResponse
	Content PageContent `json:"content"`
}

type UpdatePageRequest struct {
	Locale  string          `json:"locale" validate:"required,oneof=en ru tj"`
	Title   string          `json:"title" validate:"required,min=2,max=160"`
	Status  string          `json:"status" validate:"required,oneof=DRAFT PUBLISHED ARCHIVED"`
	Content json.RawMessage `json:"content" validate:"required"`
}
