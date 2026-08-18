package friends

import "time"

type CreateConnectionRequest struct {
	TargetUserID string `json:"targetUserId" validate:"required,uuid4"`
}

type ToggleTrustedCircleRequest struct {
	Enabled bool `json:"enabled"`
}

type SuggestionsQuery struct {
	Limit int `query:"limit" validate:"omitempty,min=1,max=50"`
}

type SuggestionPrivacyResponse struct {
	ProfileVisibility string `json:"profileVisibility"`
}

type SuggestionProfileResponse struct {
	ID              string                    `json:"id"`
	Username        string                    `json:"username"`
	DisplayName     string                    `json:"displayName"`
	Bio             string                    `json:"bio,omitempty"`
	AvatarFileID    string                    `json:"avatarFileId,omitempty"`
	Role            string                    `json:"role"`
	IsAnonymous     bool                      `json:"isAnonymous"`
	PrivacySettings SuggestionPrivacyResponse `json:"privacySettings"`
}

type ConnectionSuggestionResponse struct {
	Profile                SuggestionProfileResponse `json:"profile"`
	MutualConnectionsCount int                       `json:"mutualConnectionsCount"`
	Reason                 string                    `json:"reason"`
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
