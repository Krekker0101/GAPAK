package users

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gapak/backend/internal/domain/enums"
	"github.com/gapak/backend/internal/domain/model"
	"github.com/gapak/backend/internal/platform/concurrency"
	apperrors "github.com/gapak/backend/internal/platform/errors"
	"github.com/gapak/backend/internal/platform/events"
	"github.com/gapak/backend/internal/platform/observability"
)

type Repository struct {
	db *pgxpool.Pool
}

type PublicProfileRecord struct {
	User    model.User
	Privacy model.UserPrivacySettings
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) FindProfile(ctx context.Context, userID string) (*model.User, error) {
	const query = `
		SELECT id, email, username, display_name, bio, avatar_file_id, status_message, role, account_status,
		       is_anonymous, two_factor_enabled,
		       created_at, updated_at, deleted_at
		FROM users
		WHERE id = $1 AND deleted_at IS NULL
		LIMIT 1`
	row := r.db.QueryRow(ctx, query, userID)

	var user model.User
	var role, accountStatus string
	var email, bio, avatarFileID, statusMessage sql.NullString
	if err := row.Scan(
		&user.ID,
		&email,
		&user.Username,
		&user.DisplayName,
		&bio,
		&avatarFileID,
		&statusMessage,
		&role,
		&accountStatus,
		&user.IsAnonymous,
		&user.TwoFactorEnabled,
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

func (r *Repository) CanViewProfile(ctx context.Context, viewerID, targetUserID string) (bool, error) {
	if viewerID == targetUserID {
		return true, nil
	}
	const query = `
		SELECT ups.profile_visibility,
		       EXISTS (
		         SELECT 1 FROM friend_connections fc
		         WHERE fc.status = 'ACCEPTED' AND fc.deleted_at IS NULL
		           AND ((fc.requester_id = $1 AND fc.addressee_id = $2)
		             OR (fc.requester_id = $2 AND fc.addressee_id = $1))
		       ),
		       EXISTS (
		         SELECT 1 FROM trusted_circle_memberships tcm
		         WHERE tcm.owner_id = $2 AND tcm.member_id = $1
		       ),
		       EXISTS (
		         SELECT 1
		         FROM chat_members viewer_member
		         JOIN chat_members target_member ON target_member.chat_id = viewer_member.chat_id
		         WHERE viewer_member.user_id = $1 AND target_member.user_id = $2
		           AND viewer_member.deleted_at IS NULL AND viewer_member.left_at IS NULL
		           AND target_member.deleted_at IS NULL AND target_member.left_at IS NULL
		       )
		FROM users u
		JOIN user_privacy_settings ups ON ups.user_id = u.id
		WHERE u.id = $2 AND u.account_status = 'ACTIVE' AND u.deleted_at IS NULL`
	var visibility string
	var connected, trusted, sharedChat bool
	if err := r.db.QueryRow(ctx, query, viewerID, targetUserID).Scan(&visibility, &connected, &trusted, &sharedChat); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, apperrors.ErrNotFound
		}
		return false, err
	}
	if sharedChat {
		return true, nil
	}
	switch enums.ProfileVisibility(visibility) {
	case enums.ProfileVisibilityPublic:
		return true, nil
	case enums.ProfileVisibilityConnections:
		return connected, nil
	case enums.ProfileVisibilityTrustedOnly:
		return trusted, nil
	default:
		return false, nil
	}
}

func (r *Repository) SearchPublicProfiles(ctx context.Context, viewerID, queryText string, limit int) ([]PublicProfileRecord, error) {
	const query = `
		SELECT u.id, u.username, u.display_name,
		       CASE WHEN ups.profile_visibility = 'PUBLIC' THEN u.bio ELSE NULL END,
		       CASE WHEN ups.profile_visibility = 'PUBLIC' THEN u.avatar_file_id ELSE NULL END,
		       u.role, u.is_anonymous,
		       ups.profile_visibility, ups.searchable_by_username
		FROM users u
		JOIN user_privacy_settings ups ON ups.user_id = u.id
		WHERE u.id <> $1 AND u.account_status = 'ACTIVE' AND u.deleted_at IS NULL
		  AND u.is_anonymous = false
		  AND ups.searchable_by_username = true
		  AND (u.username ILIKE '%' || $2 || '%' OR u.display_name ILIKE '%' || $2 || '%')
		ORDER BY CASE WHEN LOWER(u.username) = LOWER($2) THEN 0 ELSE 1 END,
		         u.display_name ASC, u.id ASC
		LIMIT $3`
	return scanPublicProfiles(r.db.Query(ctx, query, viewerID, queryText, limit))
}

func (r *Repository) DiscoverPublicProfiles(ctx context.Context, viewerID, sort string, limit int) ([]PublicProfileRecord, error) {
	orderBy := "u.created_at DESC, u.id DESC"
	if sort == "top" {
		orderBy = "connection_count DESC, u.created_at DESC, u.id DESC"
	}
	query := `
		SELECT u.id, u.username, u.display_name, u.bio, u.avatar_file_id, u.role, u.is_anonymous,
		       ups.profile_visibility, ups.searchable_by_username,
		       (SELECT COUNT(*) FROM friend_connections fc
		        WHERE fc.status = 'ACCEPTED' AND fc.deleted_at IS NULL
		          AND (fc.requester_id = u.id OR fc.addressee_id = u.id)) AS connection_count
		FROM users u
		JOIN user_privacy_settings ups ON ups.user_id = u.id
		WHERE u.id <> $1 AND u.account_status = 'ACTIVE' AND u.deleted_at IS NULL
		  AND u.is_anonymous = false
		  AND ups.profile_visibility = 'PUBLIC'
		  AND ups.allow_friend_requests = true
		  AND NOT EXISTS (
		    SELECT 1 FROM friend_connections existing
		    WHERE existing.deleted_at IS NULL
		      AND ((existing.requester_id = $1 AND existing.addressee_id = u.id)
		        OR (existing.requester_id = u.id AND existing.addressee_id = $1))
		  )
		ORDER BY ` + orderBy + `
		LIMIT $2`
	rows, err := r.db.Query(ctx, query, viewerID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]PublicProfileRecord, 0)
	for rows.Next() {
		item, err := scanPublicProfile(rows, true)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func scanPublicProfiles(rows pgx.Rows, err error) ([]PublicProfileRecord, error) {
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]PublicProfileRecord, 0)
	for rows.Next() {
		item, err := scanPublicProfile(rows, false)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func scanPublicProfile(row pgx.Row, withScore bool) (PublicProfileRecord, error) {
	var item PublicProfileRecord
	var bio, avatarFileID sql.NullString
	var role, visibility string
	values := []any{&item.User.ID, &item.User.Username, &item.User.DisplayName, &bio, &avatarFileID, &role, &item.User.IsAnonymous, &visibility, &item.Privacy.SearchableByUsername}
	var score int
	if withScore {
		values = append(values, &score)
	}
	if err := row.Scan(values...); err != nil {
		return PublicProfileRecord{}, err
	}
	item.User.Role = enums.UserRole(role)
	item.Privacy.UserID = item.User.ID
	item.Privacy.ProfileVisibility = enums.ProfileVisibility(visibility)
	if bio.Valid {
		item.User.Bio = &bio.String
	}
	if avatarFileID.Valid {
		item.User.AvatarFileID = &avatarFileID.String
	}
	return item, nil
}

func (r *Repository) FindPrivacy(ctx context.Context, userID string) (*model.UserPrivacySettings, error) {
	const query = `
		INSERT INTO user_privacy_settings
			(user_id, profile_visibility, last_seen_visibility, allow_friend_requests, allow_trusted_invites,
			 searchable_by_email, searchable_by_username, post_default_privacy, show_online_status, updated_at)
		SELECT id,
		       CASE WHEN is_anonymous THEN 'PRIVATE'::"ProfileVisibility" ELSE 'CONNECTIONS'::"ProfileVisibility" END,
		       CASE WHEN is_anonymous THEN 'NOBODY'::"LastSeenVisibility" ELSE 'CONNECTIONS'::"LastSeenVisibility" END,
		       NOT is_anonymous,
		       true,
		       false,
		       NOT is_anonymous,
		       CASE WHEN is_anonymous THEN 'PRIVATE'::"PostPrivacy" ELSE 'FRIENDS'::"PostPrivacy" END,
		       NOT is_anonymous,
		       NOW()
		FROM users
		WHERE id = $1 AND deleted_at IS NULL
		ON CONFLICT (user_id) DO NOTHING
		RETURNING user_id, profile_visibility, last_seen_visibility, allow_friend_requests, allow_trusted_invites,
		          searchable_by_email, searchable_by_username, post_default_privacy, show_online_status, created_at, updated_at`
	row := r.db.QueryRow(ctx, query, userID)

	settings, err := scanPrivacy(row)
	if err == nil {
		return settings, nil
	}
	if !errors.Is(err, apperrors.ErrNotFound) {
		return nil, err
	}

	const selectQuery = `
		SELECT user_id, profile_visibility, last_seen_visibility, allow_friend_requests, allow_trusted_invites,
		       searchable_by_email, searchable_by_username, post_default_privacy, show_online_status, created_at, updated_at
		FROM user_privacy_settings
		WHERE user_id = $1
		LIMIT 1`
	return scanPrivacy(r.db.QueryRow(ctx, selectQuery, userID))
}

func scanPrivacy(row pgx.Row) (*model.UserPrivacySettings, error) {
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
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := concurrency.NewStore(r.db, "").GuardTx(ctx, tx, "user_profile", userID); err != nil {
		return err
	}
	query := "UPDATE users SET " + strings.Join(fields, ", ") + ", updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL"
	if tag, err := tx.Exec(ctx, query, args...); err != nil {
		return err
	} else if tag.RowsAffected() == 0 {
		return apperrors.ErrNotFound
	}
	if err := events.NewNotifier().EmitTx(ctx, tx, events.DomainEvent{
		Type: events.UserUpdated, AggregateType: "user", AggregateID: userID,
		ActorID: strPtrUser(userID), RecipientUserIDs: []string{userID},
		Payload: map[string]any{"userId": userID}, IdempotencyKey: "user-updated:" + userID + ":" + uuid.NewString(),
		CorrelationID: observability.CorrelationID(ctx),
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func strPtrUser(v string) *string { return &v }

func (r *Repository) UpdatePrivacy(ctx context.Context, userID string, req UpdatePrivacyRequest) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := concurrency.NewStore(r.db, "").GuardTx(ctx, tx, "user_profile", userID); err != nil {
		return err
	}
	const query = `
		INSERT INTO user_privacy_settings (
			user_id, profile_visibility, last_seen_visibility, allow_friend_requests,
			allow_trusted_invites, searchable_by_email, searchable_by_username,
			post_default_privacy, show_online_status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			profile_visibility = EXCLUDED.profile_visibility,
			last_seen_visibility = EXCLUDED.last_seen_visibility,
			allow_friend_requests = EXCLUDED.allow_friend_requests,
			allow_trusted_invites = EXCLUDED.allow_trusted_invites,
			searchable_by_email = EXCLUDED.searchable_by_email,
			searchable_by_username = EXCLUDED.searchable_by_username,
			post_default_privacy = EXCLUDED.post_default_privacy,
			show_online_status = EXCLUDED.show_online_status,
			updated_at = NOW()`
	if _, err := tx.Exec(ctx, query, userID, req.ProfileVisibility, req.LastSeenVisibility, req.AllowFriendRequests, req.AllowTrustedInvites, req.SearchableByEmail, req.SearchableByUsername, req.PostDefaultPrivacy, req.ShowOnlineStatus); err != nil {
		return err
	}
	if err := events.NewNotifier().EmitTx(ctx, tx, events.DomainEvent{
		Type: events.UserUpdated, AggregateType: "user", AggregateID: userID,
		ActorID: strPtrUser(userID), RecipientUserIDs: []string{userID},
		Payload:        map[string]any{"userId": userID, "profileVisibility": req.ProfileVisibility},
		IdempotencyKey: "user-privacy-updated:" + userID + ":" + uuid.NewString(), CorrelationID: observability.CorrelationID(ctx),
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func itoa(value int) string {
	return strconv.Itoa(value)
}

func (r *Repository) GetTheme(ctx context.Context, userID string) (string, error) {
	const query = `
		INSERT INTO user_settings (user_id, theme, created_at, updated_at)
		VALUES ($1, 'light', NOW(), NOW())
		ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
		RETURNING theme`
	var theme string
	err := r.db.QueryRow(ctx, query, userID).Scan(&theme)
	if err != nil {
		return "light", err
	}
	return theme, nil
}

func (r *Repository) UpdateTheme(ctx context.Context, userID, theme string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := concurrency.NewStore(r.db, "").GuardTx(ctx, tx, "user_profile", userID); err != nil {
		return err
	}
	const query = `
		INSERT INTO user_settings (user_id, theme, created_at, updated_at)
		VALUES ($1, $2, NOW(), NOW())
		ON CONFLICT (user_id) DO UPDATE SET theme = $2, updated_at = NOW()`
	if _, err := tx.Exec(ctx, query, userID, theme); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
