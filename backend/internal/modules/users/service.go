package users

import (
	"context"
	"strings"

	"github.com/gapak/backend/internal/domain/model"
	"github.com/gapak/backend/internal/modules/media"
	apperrors "github.com/gapak/backend/internal/platform/errors"
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

func (s *Service) GetPublicProfile(ctx context.Context, viewerID, userID string) (PublicProfileResponse, error) {
	allowed, err := s.repo.CanViewProfile(ctx, viewerID, userID)
	if err != nil {
		return PublicProfileResponse{}, err
	}
	if !allowed {
		return PublicProfileResponse{}, apperrors.ErrForbidden
	}
	user, err := s.repo.FindProfile(ctx, userID)
	if err != nil {
		return PublicProfileResponse{}, err
	}
	privacy, err := s.repo.FindPrivacy(ctx, userID)
	if err != nil {
		return PublicProfileResponse{}, err
	}
	return toPublicProfileResponse(user, privacy), nil
}

func (s *Service) Search(ctx context.Context, viewerID, query string, limit int) ([]PublicProfileResponse, error) {
	items, err := s.repo.SearchPublicProfiles(ctx, viewerID, strings.TrimSpace(query), limit)
	if err != nil {
		return nil, err
	}
	return publicProfileResponses(items), nil
}

func (s *Service) Discover(ctx context.Context, viewerID, sort string, limit int) ([]PublicProfileResponse, error) {
	items, err := s.repo.DiscoverPublicProfiles(ctx, viewerID, sort, limit)
	if err != nil {
		return nil, err
	}
	return publicProfileResponses(items), nil
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
	user, err := s.repo.FindProfile(ctx, userID)
	if err != nil {
		return ProfileResponse{}, err
	}
	if user.IsAnonymous && req.ProfileVisibility != "PRIVATE" {
		return ProfileResponse{}, apperrors.New(400, "users.anonymous_visibility_invalid", "Anonymous accounts must remain private")
	}
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
		Role:             strings.ToLower(string(user.Role)),
		Status:           strings.ToLower(string(user.AccountStatus)),
		Presence:         "offline",
		TrustScore:       0,
		Permissions:      []string{},
		IsAnonymous:      user.IsAnonymous,
		TwoFactorEnabled: user.TwoFactorEnabled,
		CreatedAt:        user.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
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

func toPublicProfileResponse(user *model.User, settings *model.UserPrivacySettings) PublicProfileResponse {
	return PublicProfileResponse{
		ID:           user.ID,
		Username:     user.Username,
		DisplayName:  user.DisplayName,
		Bio:          deref(user.Bio),
		AvatarFileID: deref(user.AvatarFileID),
		Role:         strings.ToLower(string(user.Role)),
		IsAnonymous:  user.IsAnonymous,
		Privacy: PrivacyResponse{
			ProfileVisibility:    string(settings.ProfileVisibility),
			SearchableByUsername: settings.SearchableByUsername,
		},
	}
}

func publicProfileResponses(items []PublicProfileRecord) []PublicProfileResponse {
	response := make([]PublicProfileResponse, 0, len(items))
	for i := range items {
		response = append(response, toPublicProfileResponse(&items[i].User, &items[i].Privacy))
	}
	return response
}
