package moderation

import "time"

type CreateReportRequest struct {
	TargetType  string `json:"targetType" validate:"required,oneof=USER POST TRUST_ROOM MEDIA"`
	TargetID    string `json:"targetId" validate:"required,uuid4"`
	Reason      string `json:"reason" validate:"required,oneof=HARASSMENT SPAM ILLEGAL_CONTENT IMPERSONATION"`
	Description string `json:"description" validate:"omitempty,max=1000"`
}

type ResolveReportRequest struct {
	Status         string `json:"status" validate:"required,oneof=RESOLVED DISMISSED"`
	ResolutionNote string `json:"resolutionNote" validate:"omitempty,max=1000"`
}

type ReportResponse struct {
	ID              string    `json:"id"`
	ReporterUserID  string    `json:"reporterUserId"`
	TargetType      string    `json:"targetType"`
	TargetID        string    `json:"targetId"`
	Reason          string    `json:"reason"`
	Description     string    `json:"description,omitempty"`
	Status          string    `json:"status"`
	HandledByUserID string    `json:"handledByUserId,omitempty"`
	ResolutionNote  string    `json:"resolutionNote,omitempty"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}
