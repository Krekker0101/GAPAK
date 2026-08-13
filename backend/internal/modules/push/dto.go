package push

import "time"

type RegisterDeviceRequest struct {
	DeviceID  string  `json:"deviceId" validate:"required,min=1,max=128"`
	Platform  string  `json:"platform" validate:"required,oneof=web android ios macos windows unknown"`
	Provider  string  `json:"provider" validate:"required,oneof=webpush fcm apns"`
	Endpoint  string  `json:"endpoint" validate:"omitempty,max=4096,url"`
	Token     string  `json:"token" validate:"omitempty,max=4096"`
	PublicKey string  `json:"publicKey" validate:"omitempty,max=512"`
	AuthKey   string  `json:"authKey" validate:"omitempty,max=512"`
	ExpiresAt *string `json:"expiration" validate:"omitempty"`
}

type DeviceResponse struct {
	ID         string     `json:"id"`
	DeviceID   string     `json:"deviceId"`
	Platform   string     `json:"platform"`
	Provider   string     `json:"provider"`
	Endpoint   string     `json:"endpoint,omitempty"`
	Expiration *time.Time `json:"expiration,omitempty"`
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt"`
	RevokedAt  *time.Time `json:"revokedAt,omitempty"`
}
