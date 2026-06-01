package security

import "time"

type AuditEventResponse struct {
	ID           string         `json:"id"`
	Action       string         `json:"action"`
	ResourceType string         `json:"resourceType"`
	ResourceID   string         `json:"resourceId"`
	Severity     string         `json:"severity"`
	Metadata     map[string]any `json:"metadata"`
	CreatedAt    time.Time      `json:"createdAt"`
}

type SuspiciousFlagResponse struct {
	ID         string         `json:"id"`
	Reason     string         `json:"reason"`
	Severity   string         `json:"severity"`
	Status     string         `json:"status"`
	Metadata   map[string]any `json:"metadata"`
	CreatedAt  time.Time      `json:"createdAt"`
	ReviewedAt *time.Time     `json:"reviewedAt,omitempty"`
}

type DeviceAlertResponse struct {
	ID             string     `json:"id"`
	SessionID      string     `json:"sessionId"`
	Channel        string     `json:"channel"`
	Status         string     `json:"status"`
	CreatedAt      time.Time  `json:"createdAt"`
	AcknowledgedAt *time.Time `json:"acknowledgedAt,omitempty"`
}

type PanicModeRequest struct {
	PreserveCurrentSession bool    `json:"preserveCurrentSession"`
	CurrentSessionID       *string `json:"currentSessionId,omitempty" validate:"omitempty,uuid4"`
	Reason                 string  `json:"reason" validate:"required,min=3,max=255"`
}

type PanicModeResponse struct {
	Accepted            bool   `json:"accepted"`
	RevokedSessionCount int64  `json:"revokedSessionCount"`
	RevokedGrantCount   int64  `json:"revokedGrantCount"`
	AbortedUploadCount  int64  `json:"abortedUploadCount"`
	AuditEventID        string `json:"auditEventId"`
}
