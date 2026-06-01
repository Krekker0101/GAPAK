package users

type ProfileResponse struct {
	ID               string          `json:"id"`
	Email            *string         `json:"email,omitempty"`
	Username         string          `json:"username"`
	DisplayName      string          `json:"displayName"`
	Bio              string          `json:"bio,omitempty"`
	AvatarFileID     string          `json:"avatarFileId,omitempty"`
	StatusMessage    string          `json:"statusMessage,omitempty"`
	Role             string          `json:"role"`
	IsAnonymous      bool            `json:"isAnonymous"`
	TwoFactorEnabled bool            `json:"twoFactorEnabled"`
	Privacy          PrivacyResponse `json:"privacy"`
}

type UpdateProfileRequest struct {
	DisplayName   *string `json:"displayName" validate:"omitempty,min=2,max=80"`
	Bio           *string `json:"bio" validate:"omitempty,max=600"`
	StatusMessage *string `json:"statusMessage" validate:"omitempty,max=160"`
	AvatarFileID  *string `json:"avatarFileId" validate:"omitempty,uuid4"`
}

type PrivacyResponse struct {
	ProfileVisibility    string `json:"profileVisibility"`
	LastSeenVisibility   string `json:"lastSeenVisibility"`
	AllowFriendRequests  bool   `json:"allowFriendRequests"`
	AllowTrustedInvites  bool   `json:"allowTrustedInvites"`
	SearchableByEmail    bool   `json:"searchableByEmail"`
	SearchableByUsername bool   `json:"searchableByUsername"`
	PostDefaultPrivacy   string `json:"postDefaultPrivacy"`
	ShowOnlineStatus     bool   `json:"showOnlineStatus"`
}

type UpdatePrivacyRequest struct {
	ProfileVisibility    string `json:"profileVisibility" validate:"required,oneof=PUBLIC CONNECTIONS TRUSTED_ONLY PRIVATE"`
	LastSeenVisibility   string `json:"lastSeenVisibility" validate:"required,oneof=EVERYONE CONNECTIONS NOBODY"`
	AllowFriendRequests  bool   `json:"allowFriendRequests"`
	AllowTrustedInvites  bool   `json:"allowTrustedInvites"`
	SearchableByEmail    bool   `json:"searchableByEmail"`
	SearchableByUsername bool   `json:"searchableByUsername"`
	PostDefaultPrivacy   string `json:"postDefaultPrivacy" validate:"required,oneof=PUBLIC FRIENDS TRUSTED_CIRCLE PRIVATE ONE_TIME TIMED"`
	ShowOnlineStatus     bool   `json:"showOnlineStatus"`
}
