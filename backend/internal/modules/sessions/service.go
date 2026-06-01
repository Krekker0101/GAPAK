package sessions

import (
	"context"

	"github.com/gapak/backend/internal/domain/model"
	"github.com/gapak/backend/internal/platform/privacy"
)

type Service struct {
	repo    *Repository
	privacy *privacy.Service
}

func NewService(repo *Repository, privacyService *privacy.Service) *Service {
	return &Service{repo: repo, privacy: privacyService}
}

func (s *Service) List(ctx context.Context, userID, currentSessionID string) ([]SessionResponse, error) {
	sessions, err := s.repo.ListByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	response := make([]SessionResponse, 0, len(sessions))
	for _, item := range sessions {
		response = append(response, toResponse(item, currentSessionID, s.privacy))
	}
	return response, nil
}

func (s *Service) Revoke(ctx context.Context, userID, sessionID string) (AcceptedResponse, error) {
	if err := s.repo.RevokeSession(ctx, userID, sessionID); err != nil {
		return AcceptedResponse{}, err
	}
	return AcceptedResponse{Accepted: true}, nil
}

func (s *Service) RevokeOthers(ctx context.Context, userID, currentSessionID string) (AcceptedResponse, error) {
	if err := s.repo.RevokeOthers(ctx, userID, currentSessionID); err != nil {
		return AcceptedResponse{}, err
	}
	return AcceptedResponse{Accepted: true}, nil
}

func toResponse(item model.DeviceSession, currentSessionID string, privacyService *privacy.Service) SessionResponse {
	deviceName := deref(item.DeviceName)
	userAgent := deref(item.UserAgent)
	ipAddress := deref(item.IPAddress)
	countryCode := deref(item.CountryCode)
	city := deref(item.City)
	if privacyService != nil {
		deviceName = privacyService.SessionDeviceName(&item)
		userAgent = privacyService.SessionUserAgent(&item)
		ipAddress = privacyService.SessionIPAddress(&item)
		countryCode = privacyService.SessionCountryCode(&item)
		city = privacyService.SessionCity(&item)
	}
	return SessionResponse{
		ID:            item.ID,
		DeviceName:    deviceName,
		UserAgent:     userAgent,
		IPAddress:     ipAddress,
		CountryCode:   countryCode,
		City:          city,
		SecurityLevel: string(item.SecurityLevel),
		IsCurrent:     item.ID == currentSessionID,
		LastUsedAt:    item.LastUsedAt,
		ExpiresAt:     item.ExpiresAt,
		CreatedAt:     item.CreatedAt,
		RevokedAt:     item.RevokedAt,
	}
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
