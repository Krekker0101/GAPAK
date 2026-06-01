package sessions

import "time"

type SessionResponse struct {
	ID            string     `json:"id"`
	DeviceName    string     `json:"deviceName,omitempty"`
	UserAgent     string     `json:"userAgent,omitempty"`
	IPAddress     string     `json:"ipAddress,omitempty"`
	CountryCode   string     `json:"countryCode,omitempty"`
	City          string     `json:"city,omitempty"`
	SecurityLevel string     `json:"securityLevel"`
	IsCurrent     bool       `json:"isCurrent"`
	LastUsedAt    time.Time  `json:"lastUsedAt"`
	ExpiresAt     time.Time  `json:"expiresAt"`
	CreatedAt     time.Time  `json:"createdAt"`
	RevokedAt     *time.Time `json:"revokedAt,omitempty"`
}

type AcceptedResponse struct {
	Accepted bool `json:"accepted"`
}
