package push

import (
	"context"
	"fmt"
	"strings"
	"time"
)

type Service struct{ repo *Repository }

func NewService(repo *Repository) *Service { return &Service{repo: repo} }
func (s *Service) Register(ctx context.Context, userID string, req RegisterDeviceRequest) (DeviceResponse, error) {
	if strings.TrimSpace(req.Provider) == "" {
		return DeviceResponse{}, fmt.Errorf("provider is required")
	}
	var expiration *time.Time
	if req.ExpiresAt != nil && strings.TrimSpace(*req.ExpiresAt) != "" {
		t, err := time.Parse(time.RFC3339, strings.TrimSpace(*req.ExpiresAt))
		if err != nil {
			return DeviceResponse{}, fmt.Errorf("expiration must be RFC3339")
		}
		tt := t.UTC()
		expiration = &tt
	}
	d, err := s.repo.UpsertDevice(ctx, userID, req, expiration)
	if err != nil {
		return DeviceResponse{}, err
	}
	return toResponse(*d), nil
}
func (s *Service) List(ctx context.Context, userID string) ([]DeviceResponse, error) {
	items, err := s.repo.ListDevices(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]DeviceResponse, 0, len(items))
	for _, d := range items {
		out = append(out, toResponse(d))
	}
	return out, nil
}
func (s *Service) Revoke(ctx context.Context, userID, id string) error {
	return s.repo.RevokeDevice(ctx, userID, id)
}
func toResponse(d storedDevice) DeviceResponse {
	return DeviceResponse{ID: d.ID, DeviceID: d.DeviceID, Platform: d.Platform, Provider: d.Provider, Endpoint: d.Endpoint, Expiration: d.Expiration, CreatedAt: d.CreatedAt, UpdatedAt: d.UpdatedAt, RevokedAt: d.RevokedAt}
}
