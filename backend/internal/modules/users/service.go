package users

import (
	"context"

	"github.com/gapak/backend/internal/domain/model"
	"github.com/gapak/backend/internal/modules/media"
	"github.com/gapak/backend/internal/platform/privacy"
)

type Service struct {
	repo      *Repository
	mediaRepo *media.Repository
	privacy   *privacy.Service
}

func NewService(repo *Repository, mediaRepo *media.Repository, privacyService *privacy.Service) *Service {
	return &Service{repo: repo, mediaRepo: mediaRepo, privacy: privacyService}
}

func (s *Service) GetMe(ctx context.Context, userID string) (ProfileResponse, error) {
	user, err := s.repo.FindProfile(ctx, userID)
	if err != nil {
		return ProfileResponse{}, err
	}
	privacy, err := s.repo.FindPrivacy(ctx, userID)
	if err != nil {
		return ProfileResponse{}, err
	}
	theme, err := s.repo.GetTheme(ctx, userID)
	if err != nil {
		return ProfileResponse{}, err
	}
	return s.toProfileResponse(user, privacy, theme), nil
}

func (s *Service) GetPublicProfile(ctx context.Context, userID string) (PublicProfileResponse, error) {
	user, err := s.repo.FindProfile(ctx, userID)
	if err != nil {
		return PublicProfileResponse{}, err
	}
	privacy, err := s.repo.FindPrivacy(ctx, userID)
	if err != nil {
		return PublicProfileResponse{}, err
	}
	return PublicProfileResponse{ID: user.ID, Username: user.Username, DisplayName: user.DisplayName, Bio: deref(user.Bio), AvatarFileID: deref(user.AvatarFileID), Role: string(user.Role), IsAnonymous: user.IsAnonymous, Privacy: PrivacyResponse{ProfileVisibility: string(privacy.ProfileVisibility), SearchableByUsername: privacy.SearchableByUsername}}, nil
}

func (s *Service) UpdateMe(ctx context.Context, userID string, req UpdateProfileRequest) (ProfileResponse, error) {
	if req.AvatarFileID != nil && s.mediaRepo != nil {
		if err := s.mediaRepo.ValidateAvatarMediaOwnership(ctx, userID, *req.AvatarFileID); err != nil {
			return ProfileResponse{}, err
		}
	}
	if err := s.repo.UpdateProfile(ctx, userID, req); err != nil {
		return ProfileResponse{}, err
	}
	return s.GetMe(ctx, userID)
}

func (s *Service) UpdateTheme(ctx context.Context, userID string, req UpdateThemeRequest) (ProfileResponse, error) {
	if err := s.repo.UpdateTheme(ctx, userID, req.Theme); err != nil {
		return ProfileResponse{}, err
	}
	return s.GetMe(ctx, userID)
}

func (s *Service) UpdatePrivacy(ctx context.Context, userID string, req UpdatePrivacyRequest) (ProfileResponse, error) {
	if err := s.repo.UpdatePrivacy(ctx, userID, req); err != nil {
		return ProfileResponse{}, err
	}
	return s.GetMe(ctx, userID)
}

func (s *Service) toProfileResponse(user *model.User, privacy *model.UserPrivacySettings, theme string) ProfileResponse {
	return ProfileResponse{
		ID:               user.ID,
		Email:            s.privacy.PublicEmail(user),
		Username:         user.Username,
		DisplayName:      user.DisplayName,
		Bio:              deref(user.Bio),
		AvatarFileID:     deref(user.AvatarFileID),
		StatusMessage:    deref(user.StatusMessage),
		Role:             string(user.Role),
		IsAnonymous:      user.IsAnonymous,
		TwoFactorEnabled: user.TwoFactorEnabled,
		Theme:            theme,
		Privacy: PrivacyResponse{
			ProfileVisibility:    string(privacy.ProfileVisibility),
			LastSeenVisibility:   string(privacy.LastSeenVisibility),
			AllowFriendRequests:  privacy.AllowFriendRequests,
			AllowTrustedInvites:  privacy.AllowTrustedInvites,
			SearchableByEmail:    privacy.SearchableByEmail,
			SearchableByUsername: privacy.SearchableByUsername,
			PostDefaultPrivacy:   string(privacy.PostDefaultPrivacy),
			ShowOnlineStatus:     privacy.ShowOnlineStatus,
		},
	}
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
