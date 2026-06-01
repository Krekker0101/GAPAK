package security

import (
	"context"

	apperrors "github.com/gapak/backend/internal/platform/errors"
	"github.com/gapak/backend/internal/platform/privacy"
)

type Service struct {
	repo    *Repository
	privacy *privacy.Service
}

func NewService(repo *Repository, privacyService *privacy.Service) *Service {
	return &Service{repo: repo, privacy: privacyService}
}

func (s *Service) Audit(ctx context.Context, userID string) ([]AuditEventResponse, error) {
	items, err := s.repo.ListAuditEvents(ctx, userID)
	if err != nil {
		return nil, err
	}
	response := make([]AuditEventResponse, 0, len(items))
	for _, item := range items {
		response = append(response, AuditEventResponse{
			ID:           item.ID,
			Action:       item.Action,
			ResourceType: item.ResourceType,
			ResourceID:   item.ResourceID,
			Severity:     string(item.Severity),
			Metadata:     decodeJSON(item.MetadataJSON),
			CreatedAt:    item.CreatedAt,
		})
	}
	return response, nil
}

func (s *Service) Flags(ctx context.Context, userID string) ([]SuspiciousFlagResponse, error) {
	items, err := s.repo.ListFlags(ctx, userID)
	if err != nil {
		return nil, err
	}
	response := make([]SuspiciousFlagResponse, 0, len(items))
	for _, item := range items {
		response = append(response, SuspiciousFlagResponse{
			ID:         item.ID,
			Reason:     string(item.Reason),
			Severity:   string(item.Severity),
			Status:     string(item.Status),
			Metadata:   decodeJSON(item.MetadataJSON),
			CreatedAt:  item.CreatedAt,
			ReviewedAt: item.ReviewedAt,
		})
	}
	return response, nil
}

func (s *Service) Alerts(ctx context.Context, userID string) ([]DeviceAlertResponse, error) {
	items, err := s.repo.ListAlerts(ctx, userID)
	if err != nil {
		return nil, err
	}
	response := make([]DeviceAlertResponse, 0, len(items))
	for _, item := range items {
		response = append(response, DeviceAlertResponse{
			ID:             item.ID,
			SessionID:      item.SessionID,
			Channel:        item.Channel,
			Status:         item.Status,
			CreatedAt:      item.CreatedAt,
			AcknowledgedAt: item.AcknowledgedAt,
		})
	}
	return response, nil
}

func (s *Service) PanicMode(ctx context.Context, userID, currentSessionID string, req PanicModeRequest) (PanicModeResponse, error) {
	var preservedSessionID *string
	if req.CurrentSessionID != nil && *req.CurrentSessionID != "" && *req.CurrentSessionID != currentSessionID {
		return PanicModeResponse{}, apperrors.New(400, "security.current_session_mismatch", "Current session does not match authenticated session")
	}
	if req.PreserveCurrentSession {
		preservedSessionID = &currentSessionID
	}

	revokedSessions, err := s.repo.RevokeSessions(ctx, userID, req.PreserveCurrentSession, preservedSessionID)
	if err != nil {
		return PanicModeResponse{}, err
	}
	revokedGrants, err := s.repo.RevokePlaybackGrants(ctx, userID)
	if err != nil {
		return PanicModeResponse{}, err
	}
	abortedUploads, err := s.repo.AbortPendingUploads(ctx, userID)
	if err != nil {
		return PanicModeResponse{}, err
	}
	auditID, err := s.repo.CreateAuditEvent(ctx, &userID, &userID, "security.panic_mode.executed", "security_profile", userID, map[string]any{
		"preserveCurrentSession": req.PreserveCurrentSession,
		"currentSessionId":       preservedSessionID,
		"reason":                 req.Reason,
		"revokedSessionCount":    revokedSessions,
		"revokedGrantCount":      revokedGrants,
		"abortedUploadCount":     abortedUploads,
	})
	if err != nil {
		return PanicModeResponse{}, err
	}
	return PanicModeResponse{
		Accepted:            true,
		RevokedSessionCount: revokedSessions,
		RevokedGrantCount:   revokedGrants,
		AbortedUploadCount:  abortedUploads,
		AuditEventID:        auditID,
	}, nil
}
