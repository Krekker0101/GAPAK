package users

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gapak/backend/internal/domain/enums"
	"github.com/gapak/backend/internal/domain/model"
	apperrors "github.com/gapak/backend/internal/platform/errors"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) FindProfile(ctx context.Context, userID string) (*model.User, error) {
	const query = `
		SELECT id, email, username, display_name, bio, avatar_file_id, status_message, password_hash, role, account_status,
		       is_anonymous, two_factor_enabled, two_factor_secret_ciphertext, two_factor_secret_nonce,
		       created_at, updated_at, deleted_at
		FROM users
		WHERE id = $1 AND deleted_at IS NULL
		LIMIT 1`
	row := r.db.QueryRow(ctx, query, userID)

	var user model.User
	var role, accountStatus string
	var email, bio, avatarFileID, statusMessage sql.NullString
	var twoFactorSecretCiphertext, twoFactorSecretNonce sql.NullString
	if err := row.Scan(
		&user.ID,
		&email,
		&user.Username,
		&user.DisplayName,
		&bio,
		&avatarFileID,
		&statusMessage,
		&user.PasswordHash,
		&role,
		&accountStatus,
		&user.IsAnonymous,
		&user.TwoFactorEnabled,
		&twoFactorSecretCiphertext,
		&twoFactorSecretNonce,
		&user.CreatedAt,
		&user.UpdatedAt,
		&user.DeletedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	user.Role = enums.UserRole(role)
	user.AccountStatus = enums.AccountStatus(accountStatus)
	if email.Valid {
		user.Email = &email.String
	}
	if bio.Valid {
		user.Bio = &bio.String
	}
	if avatarFileID.Valid {
		user.AvatarFileID = &avatarFileID.String
	}
	if statusMessage.Valid {
		user.StatusMessage = &statusMessage.String
	}
	return &user, nil
}

func (r *Repository) FindPrivacy(ctx context.Context, userID string) (*model.UserPrivacySettings, error) {
	const query = `
		SELECT user_id, profile_visibility, last_seen_visibility, allow_friend_requests, allow_trusted_invites,
		       searchable_by_email, searchable_by_username, post_default_privacy, show_online_status, created_at, updated_at
		FROM user_privacy_settings
		WHERE user_id = $1
		LIMIT 1`
	row := r.db.QueryRow(ctx, query, userID)

	var settings model.UserPrivacySettings
	var profileVisibility, lastSeenVisibility, postDefaultPrivacy string
	if err := row.Scan(
		&settings.UserID,
		&profileVisibility,
		&lastSeenVisibility,
		&settings.AllowFriendRequests,
		&settings.AllowTrustedInvites,
		&settings.SearchableByEmail,
		&settings.SearchableByUsername,
		&postDefaultPrivacy,
		&settings.ShowOnlineStatus,
		&settings.CreatedAt,
		&settings.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}

	settings.ProfileVisibility = enums.ProfileVisibility(profileVisibility)
	settings.LastSeenVisibility = enums.LastSeenVisibility(lastSeenVisibility)
	settings.PostDefaultPrivacy = enums.PostPrivacy(postDefaultPrivacy)
	return &settings, nil
}

func (r *Repository) UpdateProfile(ctx context.Context, userID string, req UpdateProfileRequest) error {
	fields := []string{}
	args := []any{userID}
	index := 2

	if req.DisplayName != nil {
		fields = append(fields, "display_name = $"+itoa(index))
		args = append(args, strings.TrimSpace(*req.DisplayName))
		index++
	}
	if req.Bio != nil {
		fields = append(fields, "bio = $"+itoa(index))
		args = append(args, strings.TrimSpace(*req.Bio))
		index++
	}
	if req.StatusMessage != nil {
		fields = append(fields, "status_message = $"+itoa(index))
		args = append(args, strings.TrimSpace(*req.StatusMessage))
		index++
	}
	if req.AvatarFileID != nil {
		fields = append(fields, "avatar_file_id = $"+itoa(index))
		args = append(args, strings.TrimSpace(*req.AvatarFileID))
		index++
	}
	if len(fields) == 0 {
		return nil
	}

	query := "UPDATE users SET " + strings.Join(fields, ", ") + ", updated_at = NOW() WHERE id = $1"
	_, err := r.db.Exec(ctx, query, args...)
	return err
}

func (r *Repository) UpdatePrivacy(ctx context.Context, userID string, req UpdatePrivacyRequest) error {
	const query = `
		UPDATE user_privacy_settings
		SET profile_visibility = $2,
		    last_seen_visibility = $3,
		    allow_friend_requests = $4,
		    allow_trusted_invites = $5,
		    searchable_by_email = $6,
		    searchable_by_username = $7,
		    post_default_privacy = $8,
		    show_online_status = $9,
		    updated_at = NOW()
		WHERE user_id = $1`
	_, err := r.db.Exec(ctx, query,
		userID,
		req.ProfileVisibility,
		req.LastSeenVisibility,
		req.AllowFriendRequests,
		req.AllowTrustedInvites,
		req.SearchableByEmail,
		req.SearchableByUsername,
		req.PostDefaultPrivacy,
		req.ShowOnlineStatus,
	)
	return err
}

func itoa(value int) string {
	return strconv.Itoa(value)
}
