package auth

import "time"

type RegisterRequest struct {
	Email             string `json:"email,omitempty" validate:"omitempty,email,max=254"`
	Username          string `json:"username" validate:"required,min=3,max=32,alphanum"`
	DisplayName       string `json:"displayName" validate:"required,min=2,max=80"`
	Password          string `json:"password" validate:"required,min=12,max=128"`
	PreferAnonymous   bool   `json:"preferAnonymous"`
	DeviceName        string `json:"deviceName" validate:"omitempty,max=120"`
	DeviceFingerprint string `json:"deviceFingerprint" validate:"omitempty,max=255"`
}

type LoginRequest struct {
	Login             string `json:"login" validate:"required,min=3,max=254"`
	Password          string `json:"password" validate:"required,min=12,max=128"`
	TOTPCode          string `json:"totpCode" validate:"omitempty,len=6,numeric"`
	DeviceName        string `json:"deviceName" validate:"omitempty,max=120"`
	DeviceFingerprint string `json:"deviceFingerprint" validate:"omitempty,max=255"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refreshToken" validate:"omitempty,min=32,max=2048"`
}

type LogoutRequest struct {
	AllDevices bool `json:"allDevices"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email" validate:"required,email,max=254"`
}

type ResetPasswordRequest struct {
	Token       string `json:"token" validate:"required,min=32,max=256"`
	NewPassword string `json:"newPassword" validate:"required,min=12,max=128"`
}

type VerifyTwoFactorRequest struct {
	Code string `json:"code" validate:"required,len=6,numeric"`
}

type AuthUser struct {
	ID               string  `json:"id"`
	Email            *string `json:"email,omitempty"`
	Username         string  `json:"username"`
	DisplayName      string  `json:"displayName"`
	Role             string  `json:"role"`
	IsAnonymous      bool    `json:"isAnonymous"`
	TwoFactorEnabled bool    `json:"twoFactorEnabled"`
}

type AuthSession struct {
	ID            string    `json:"id"`
	DeviceName    string    `json:"deviceName,omitempty"`
	UserAgent     string    `json:"userAgent,omitempty"`
	IPAddress     string    `json:"ipAddress,omitempty"`
	SecurityLevel string    `json:"securityLevel"`
	LastUsedAt    time.Time `json:"lastUsedAt"`
	ExpiresAt     time.Time `json:"expiresAt"`
	CreatedAt     time.Time `json:"createdAt"`
}

type AuthResponse struct {
	User         AuthUser    `json:"user"`
	Session      AuthSession `json:"session"`
	AccessToken  string      `json:"accessToken"`
	AccessTTL    int64       `json:"accessTokenTtl"`
	RefreshTTL   int64       `json:"refreshTokenTtl"`
	CSRFToken    string      `json:"csrfToken"`
	RefreshUntil time.Time   `json:"refreshExpiresAt"`
}

type AcceptedResponse struct {
	Accepted bool `json:"accepted"`
}

type TwoFactorSetupResponse struct {
	Secret     string `json:"secret"`
	OtpAuthURL string `json:"otpAuthUrl"`
}
