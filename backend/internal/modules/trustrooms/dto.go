package trustrooms

import "time"

type CreateTrustRoomRequest struct {
	Name                 string `json:"name" validate:"required,min=3,max=120"`
	Description          string `json:"description" validate:"omitempty,max=600"`
	Visibility           string `json:"visibility" validate:"required,oneof=SECRET PRIVATE"`
	AccessMode           string `json:"accessMode" validate:"required,oneof=INVITE_ONLY REQUEST OWNER_APPROVAL"`
	RequireTwoFactor     bool   `json:"requireTwoFactor"`
	MinAccountAgeDays    int    `json:"minAccountAgeDays" validate:"omitempty,min=0,max=3650"`
	MessageRetentionDays *int   `json:"messageRetentionDays" validate:"omitempty,min=1,max=3650"`
}

type AddMemberRequest struct {
	UserID string `json:"userId" validate:"required,uuid4"`
	Role   string `json:"role" validate:"required,oneof=OWNER ADMIN MODERATOR MEMBER AUDITOR"`
}

type TrustRoomResponse struct {
	ID                   string    `json:"id"`
	OwnerID              string    `json:"ownerId"`
	Name                 string    `json:"name"`
	Description          string    `json:"description,omitempty"`
	Visibility           string    `json:"visibility"`
	AccessMode           string    `json:"accessMode"`
	RequireTwoFactor     bool      `json:"requireTwoFactor"`
	MinAccountAgeDays    int       `json:"minAccountAgeDays"`
	MessageRetentionDays *int      `json:"messageRetentionDays,omitempty"`
	CreatedAt            time.Time `json:"createdAt"`
	UpdatedAt            time.Time `json:"updatedAt"`
}

type AcceptedResponse struct {
	Accepted bool `json:"accepted"`
}
