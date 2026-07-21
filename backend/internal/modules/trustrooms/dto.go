package trustrooms

import "time"

type CreateTrustRoomRequest struct {
	Name                 string     `json:"name" validate:"required,min=3,max=120"`
	Description          string     `json:"description" validate:"omitempty,max=600"`
	Visibility           string     `json:"visibility" validate:"required,oneof=SECRET PRIVATE"`
	AccessMode           string     `json:"accessMode" validate:"required,oneof=INVITE_ONLY REQUEST OWNER_APPROVAL"`
	RequireTwoFactor     bool       `json:"requireTwoFactor"`
	MinAccountAgeDays    int        `json:"minAccountAgeDays" validate:"omitempty,min=0,max=3650"`
	MessageRetentionDays *int       `json:"messageRetentionDays" validate:"omitempty,min=1,max=3650"`
	ExpiresAt            *time.Time `json:"expiresAt" validate:"omitempty"`
}

type AddMemberRequest struct {
	UserID string `json:"userId" validate:"required,uuid4"`
	Role   string `json:"role" validate:"required,oneof=OWNER ADMIN MODERATOR MEMBER AUDITOR"`
}

type TrustRoomResponse struct {
	ID                   string     `json:"id"`
	OwnerID              string     `json:"ownerId"`
	Name                 string     `json:"name"`
	Description          string     `json:"description,omitempty"`
	Visibility           string     `json:"visibility"`
	AccessMode           string     `json:"accessMode"`
	RequireTwoFactor     bool       `json:"requireTwoFactor"`
	MinAccountAgeDays    int        `json:"minAccountAgeDays"`
	MessageRetentionDays *int       `json:"messageRetentionDays,omitempty"`
	ExpiresAt            *time.Time `json:"expiresAt,omitempty"`
	CreatedAt            time.Time  `json:"createdAt"`
	UpdatedAt            time.Time  `json:"updatedAt"`
}

type TrustRoomMemberResponse struct {
	UserID       string     `json:"userId"`
	Username     string     `json:"username"`
	DisplayName  string     `json:"displayName"`
	AvatarFileID *string    `json:"avatarFileId,omitempty"`
	Role         string     `json:"role"`
	JoinedAt     time.Time  `json:"joinedAt"`
	TrustedUntil *time.Time `json:"trustedUntil,omitempty"`
}

type TrustRoomDetailResponse struct {
	Room            TrustRoomResponse         `json:"room"`
	CurrentUserRole string                    `json:"currentUserRole"`
	MemberCount     int                       `json:"memberCount"`
	Members         []TrustRoomMemberResponse `json:"members"`
}

type AcceptedResponse struct {
	Accepted bool `json:"accepted"`
}
