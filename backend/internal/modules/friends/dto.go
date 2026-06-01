package friends

import "time"

type CreateConnectionRequest struct {
	TargetUserID string `json:"targetUserId" validate:"required,uuid4"`
}

type ToggleTrustedCircleRequest struct {
	Enabled bool `json:"enabled"`
}

type ConnectionResponse struct {
	ID               string     `json:"id"`
	RequesterID      string     `json:"requesterId"`
	AddresseeID      string     `json:"addresseeId"`
	Status           string     `json:"status"`
	AcceptedAt       *time.Time `json:"acceptedAt,omitempty"`
	TrustedByCurrent bool       `json:"trustedByCurrent"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
}

type AcceptedResponse struct {
	Accepted bool `json:"accepted"`
}
