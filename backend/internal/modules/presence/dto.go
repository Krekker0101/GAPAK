package presence

import "time"

type HeartbeatRequest struct {
	ConnectionID string  `json:"connectionId" validate:"required,uuid4"`
	State        string  `json:"state" validate:"required,oneof=ACTIVE IDLE"`
	PagePath     *string `json:"pagePath,omitempty" validate:"omitempty,max=320"`
}

type DisconnectRequest struct {
	ConnectionID string  `json:"connectionId" validate:"required,uuid4"`
	Reason       *string `json:"reason,omitempty" validate:"omitempty,max=80"`
}

type PresenceQueryRequest struct {
	UserIDs []string `json:"userIds" validate:"required,min=1,max=50,dive,uuid4"`
}

type PresenceResponse struct {
	UserID              string     `json:"userId"`
	State               string     `json:"state"`
	IsOnline            bool       `json:"isOnline"`
	LastSeenAt          *time.Time `json:"lastSeenAt,omitempty"`
	LastHeartbeatAt     *time.Time `json:"lastHeartbeatAt,omitempty"`
	CanViewOnlineStatus bool       `json:"canViewOnlineStatus"`
	CanViewLastSeen     bool       `json:"canViewLastSeen"`
}
