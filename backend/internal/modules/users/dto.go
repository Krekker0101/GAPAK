package users

type ProfileResponse struct {
	ID               string          `json:"id"`
	Email            *string         `json:"email,omitempty"`
	Username         string          `json:"username"`
	DisplayName      string          `json:"displayName"`
	Bio              string          `json:"bio,omitempty"`
	AvatarFileID     string          `json:"avatarFileId,omitempty"`
	AvatarURL        string          `json:"avatarUrl,omitempty"`
	StatusMessage    string          `json:"statusMessage,omitempty"`
	Role             string          `json:"role"`
	Status           string          `json:"status"`
	Presence         string          `json:"presence"`
	TrustScore       int             `json:"trustScore"`
	Permissions      []string        `json:"permissions"`
	IsAnonymous      bool            `json:"isAnonymous"`
	TwoFactorEnabled bool            `json:"twoFactorEnabled"`
	CreatedAt        string          `json:"createdAt"`
	Theme            string          `json:"theme"`
	Privacy          PrivacyResponse `json:"privacy"`
}

type PublicProfileResponse struct {
	ID           string          `json:"id"`
	Username     string          `json:"username"`
	DisplayName  string          `json:"displayName"`
	Bio          string          `json:"bio,omitempty"`
	AvatarFileID string          `json:"avatarFileId,omitempty"`
	Role         string          `json:"role"`
	IsAnonymous  bool            `json:"isAnonymous"`
	Privacy      PrivacyResponse `json:"privacySettings"`
}

type SearchUsersQuery struct {
	Query string `query:"q" validate:"required,min=2,max=80"`
	Limit int    `query:"limit" validate:"omitempty,min=1,max=50"`
}

type DiscoverUsersQuery struct {
	Sort  string `query:"sort" validate:"omitempty,oneof=new top"`
	Limit int    `query:"limit" validate:"omitempty,min=1,max=50"`
}

type UpdateProfileRequest struct {
	DisplayName   *string `json:"displayName" validate:"omitempty,min=2,max=80"`
	Bio           *string `json:"bio" validate:"omitempty,max=600"`
	StatusMessage *string `json:"statusMessage" validate:"omitempty,max=160"`
	AvatarFileID  *string `json:"avatarFileId" validate:"omitempty,uuid4"`
	Theme         *string `json:"theme" validate:"omitempty,oneof=light dark auto"`
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

type UpdateThemeRequest struct {
	Theme string `json:"theme" validate:"required,oneof=light dark auto"`
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
