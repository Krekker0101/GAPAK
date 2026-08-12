package auth

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gapak/backend/internal/domain/enums"
	"github.com/gapak/backend/internal/domain/model"
	apperrors "github.com/gapak/backend/internal/platform/errors"
	"github.com/gapak/backend/internal/platform/privacy"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) FindUserByLogin(ctx context.Context, login string) (*model.User, error) {
	const query = `
		SELECT id, email, username, display_name, password_hash, role, account_status,
		       is_anonymous, two_factor_enabled, two_factor_secret_ciphertext, two_factor_secret_nonce,
		       failed_login_attempts, locked_until,
		       created_at, updated_at, deleted_at
		FROM users
		WHERE deleted_at IS NULL AND (email = $1 OR username = $1)
		LIMIT 1`

	row := r.db.QueryRow(ctx, query, login)
	return scanUser(row)
}

func (r *Repository) FindUserByID(ctx context.Context, userID string) (*model.User, error) {
	const query = `
		SELECT id, email, username, display_name, role, account_status,
		       is_anonymous, two_factor_enabled,
		       created_at, updated_at, deleted_at
		FROM users
		WHERE deleted_at IS NULL AND id = $1
		LIMIT 1`

	row := r.db.QueryRow(ctx, query, userID)
	return scanUserPublic(row)
}

func (r *Repository) IncrementFailedLoginAttempts(ctx context.Context, userID string, maxAttempts int, lockoutDuration time.Duration) (bool, error) {
	const query = `
		UPDATE users
		SET failed_login_attempts = failed_login_attempts + 1,
		    locked_until = CASE
		        WHEN failed_login_attempts + 1 >= $2 THEN NOW() + $3::interval
		        ELSE locked_until
		    END,
		    updated_at = NOW()
		WHERE id = $1
		RETURNING failed_login_attempts, (locked_until IS NOT NULL AND locked_until > NOW()) AS is_locked`
	var attempts int
	var isLocked bool
	if err := r.db.QueryRow(ctx, query, userID, maxAttempts, fmt.Sprintf("%d seconds", int(lockoutDuration.Seconds()))).Scan(&attempts, &isLocked); err != nil {
		return false, err
	}
	return isLocked, nil
}

func (r *Repository) ResetFailedLoginAttempts(ctx context.Context, userID string) error {
	const query = `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, userID)
	return err
}

func (r *Repository) CreateUser(ctx context.Context, req RegisterRequest, email *string, passwordHash string, isAnonymous bool, defaults privacy.PrivacyDefaults) (*model.User, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	userID := uuid.NewString()
	const userQuery = `
		INSERT INTO users (id, email, username, display_name, password_hash, role, account_status, is_anonymous, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
		RETURNING id, email, username, display_name, password_hash, role, account_status,
		          is_anonymous, two_factor_enabled, two_factor_secret_ciphertext, two_factor_secret_nonce,
		          failed_login_attempts, locked_until,
		          created_at, updated_at, deleted_at`

	user, err := scanUser(tx.QueryRow(ctx, userQuery,
		userID,
		email,
		req.Username,
		req.DisplayName,
		passwordHash,
		string(enums.RoleUser),
		string(enums.AccountStatusActive),
		isAnonymous,
	))
	if err != nil {
		if isUniqueViolation(err) {
			return nil, apperrors.ErrConflict
		}
		return nil, err
	}

	const privacyQuery = `
		INSERT INTO user_privacy_settings
			(user_id, profile_visibility, last_seen_visibility, allow_friend_requests, allow_trusted_invites,
			 searchable_by_email, searchable_by_username, post_default_privacy, show_online_status, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`

	if _, err := tx.Exec(ctx, privacyQuery,
		userID,
		string(defaults.ProfileVisibility),
		string(defaults.LastSeenVisibility),
		defaults.AllowFriendRequests,
		defaults.AllowTrustedInvites,
		defaults.SearchableByEmail,
		defaults.SearchableByUsername,
		string(defaults.PostDefaultPrivacy),
		defaults.ShowOnlineStatus,
	); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return user, nil
}

func (r *Repository) CreateSession(ctx context.Context, session model.DeviceSession) error {
	const query = `
		INSERT INTO device_sessions
			(id, user_id, refresh_token_hash, refresh_token_family, user_agent, device_name, device_fingerprint,
			 ip_address, is_current, security_level, last_used_at, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`
	_, err := r.db.Exec(ctx, query,
		session.ID,
		session.UserID,
		session.RefreshTokenHash,
		session.RefreshTokenFamily,
		session.UserAgent,
		session.DeviceName,
		session.DeviceFingerprint,
		session.IPAddress,
		session.IsCurrent,
		string(session.SecurityLevel),
		session.LastUsedAt,
		session.ExpiresAt,
	)
	return err
}

func (r *Repository) FindSessionByID(ctx context.Context, sessionID string) (*model.DeviceSession, error) {
	const query = `
		SELECT id, user_id, refresh_token_hash, refresh_token_family, user_agent, device_name, device_fingerprint,
		       ip_address, country_code, city, is_current, security_level, last_used_at, expires_at, revoked_at, created_at
		FROM device_sessions
		WHERE id = $1
		LIMIT 1`
	row := r.db.QueryRow(ctx, query, sessionID)
	return scanSession(row)
}

func (r *Repository) RotateSession(ctx context.Context, sessionID, expectedRefreshTokenHash, nextRefreshTokenHash string, expiresAt time.Time) error {
	// Compare-and-swap the refresh-token hash so a refresh token can only be
	// rotated once. A plain UPDATE by session ID is vulnerable to concurrent
	// refresh requests both succeeding with the same old token.
	const query = `
		UPDATE device_sessions
		SET refresh_token_hash = $3, last_used_at = NOW(), expires_at = $4
		WHERE id = $1
		  AND refresh_token_hash = $2
		  AND revoked_at IS NULL
		  AND expires_at > NOW()`
	tag, err := r.db.Exec(ctx, query, sessionID, expectedRefreshTokenHash, nextRefreshTokenHash, expiresAt)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperrors.ErrNotFound
	}
	return nil
}

func (r *Repository) RevokeSession(ctx context.Context, sessionID string) error {
	const query = `UPDATE device_sessions SET revoked_at = NOW(), is_current = false WHERE id = $1 AND revoked_at IS NULL`
	_, err := r.db.Exec(ctx, query, sessionID)
	return err
}

func (r *Repository) RevokeOtherSessions(ctx context.Context, userID, currentSessionID string) error {
	const query = `
		UPDATE device_sessions
		SET revoked_at = NOW(), is_current = false
		WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL`
	_, err := r.db.Exec(ctx, query, userID, currentSessionID)
	return err
}

func (r *Repository) RevokeAllSessions(ctx context.Context, userID string) error {
	const query = `
		UPDATE device_sessions
		SET revoked_at = NOW(), is_current = false
		WHERE user_id = $1 AND revoked_at IS NULL`
	_, err := r.db.Exec(ctx, query, userID)
	return err
}

func (r *Repository) StorePasswordResetToken(ctx context.Context, userID, tokenHash string, expiresAt time.Time) error {
	const query = `
		INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
		VALUES ($1, $2, $3, $4)`
	_, err := r.db.Exec(ctx, query, uuid.NewString(), userID, tokenHash, expiresAt)
	return err
}

func (r *Repository) FindPasswordResetToken(ctx context.Context, tokenHash string) (*model.PasswordResetToken, error) {
	const query = `
		SELECT id, user_id, token_hash, expires_at, used_at, created_at
		FROM password_reset_tokens
		WHERE token_hash = $1
		LIMIT 1`
	row := r.db.QueryRow(ctx, query, tokenHash)

	var token model.PasswordResetToken
	var usedAt sql.NullTime
	if err := row.Scan(&token.ID, &token.UserID, &token.TokenHash, &token.ExpiresAt, &usedAt, &token.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	if usedAt.Valid {
		token.UsedAt = &usedAt.Time
	}
	return &token, nil
}

func (r *Repository) MarkPasswordResetUsed(ctx context.Context, tokenID string) error {
	const query = `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, tokenID)
	return err
}

// ResetPasswordWithToken atomically validates and consumes a password reset
// token while changing the password. This prevents two concurrent requests
// from both successfully using the same reset token.
func (r *Repository) ResetPasswordWithToken(ctx context.Context, tokenHash, passwordHash string) (string, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	var tokenID, userID string
	var expiresAt time.Time
	var usedAt sql.NullTime
	if err := tx.QueryRow(ctx, `
		SELECT id, user_id, expires_at, used_at
		FROM password_reset_tokens
		WHERE token_hash = $1
		FOR UPDATE`, tokenHash).Scan(&tokenID, &userID, &expiresAt, &usedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", apperrors.ErrNotFound
		}
		return "", err
	}
	if usedAt.Valid || !expiresAt.After(time.Now().UTC()) {
		return "", apperrors.ErrNotFound
	}

	if _, err := tx.Exec(ctx, `
		UPDATE users
		SET password_hash = $2, password_changed_at = NOW(), updated_at = NOW()
		WHERE id = $1`, userID, passwordHash); err != nil {
		return "", err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE password_reset_tokens
		SET used_at = NOW()
		WHERE id = $1 AND used_at IS NULL`, tokenID); err != nil {
		return "", err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return userID, nil
}

func (r *Repository) UpsertTwoFactorSetupChallenge(ctx context.Context, userID, sessionID, secretCiphertext, secretNonce string, expiresAt time.Time, maxAttempts int) error {
	const query = `
		INSERT INTO two_factor_setup_challenges (
			user_id, setup_session_id, secret_ciphertext, secret_nonce, attempts, max_attempts, expires_at, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, 0, $5, $6, NOW(), NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			setup_session_id = EXCLUDED.setup_session_id,
			secret_ciphertext = EXCLUDED.secret_ciphertext,
			secret_nonce = EXCLUDED.secret_nonce,
			attempts = 0,
			max_attempts = EXCLUDED.max_attempts,
			expires_at = EXCLUDED.expires_at,
			updated_at = NOW()`
	_, err := r.db.Exec(ctx, query, userID, sessionID, secretCiphertext, secretNonce, maxAttempts, expiresAt)
	return err
}

func (r *Repository) FindTwoFactorSetupChallenge(ctx context.Context, userID string) (*model.TwoFactorSetupChallenge, error) {
	const query = `
		SELECT user_id, setup_session_id, secret_ciphertext, secret_nonce, attempts, max_attempts, expires_at, created_at, updated_at
		FROM two_factor_setup_challenges
		WHERE user_id = $1
		LIMIT 1`
	row := r.db.QueryRow(ctx, query, userID)

	var item model.TwoFactorSetupChallenge
	if err := row.Scan(
		&item.UserID,
		&item.SetupSessionID,
		&item.SecretCiphertext,
		&item.SecretNonce,
		&item.Attempts,
		&item.MaxAttempts,
		&item.ExpiresAt,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	return &item, nil
}

func (r *Repository) RegisterFailedTwoFactorSetupAttempt(ctx context.Context, userID string) (int, int, error) {
	const query = `
		UPDATE two_factor_setup_challenges
		SET attempts = attempts + 1,
		    updated_at = NOW()
		WHERE user_id = $1
		RETURNING attempts, max_attempts`
	var attempts int
	var maxAttempts int
	if err := r.db.QueryRow(ctx, query, userID).Scan(&attempts, &maxAttempts); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, 0, apperrors.ErrNotFound
		}
		return 0, 0, err
	}
	if attempts >= maxAttempts {
		if err := r.DeleteTwoFactorSetupChallenge(ctx, userID); err != nil {
			return attempts, maxAttempts, err
		}
	}
	return attempts, maxAttempts, nil
}

func (r *Repository) DeleteTwoFactorSetupChallenge(ctx context.Context, userID string) error {
	const query = `DELETE FROM two_factor_setup_challenges WHERE user_id = $1`
	_, err := r.db.Exec(ctx, query, userID)
	return err
}

func (r *Repository) UpdatePassword(ctx context.Context, userID, passwordHash string) error {
	const query = `
		UPDATE users
		SET password_hash = $2, password_changed_at = NOW(), updated_at = NOW()
		WHERE id = $1`
	_, err := r.db.Exec(ctx, query, userID, passwordHash)
	return err
}

func (r *Repository) CompleteTwoFactorSetup(ctx context.Context, userID, ciphertext, nonce string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	const enableQuery = `
		UPDATE users
		SET two_factor_enabled = true,
		    two_factor_secret_ciphertext = $2,
		    two_factor_secret_nonce = $3,
		    updated_at = NOW()
		WHERE id = $1`
	if _, err := tx.Exec(ctx, enableQuery, userID, ciphertext, nonce); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `DELETE FROM two_factor_setup_challenges WHERE user_id = $1`, userID); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *Repository) DisableTwoFactor(ctx context.Context, userID string) error {
	_, err := r.db.Exec(ctx, `UPDATE users SET two_factor_enabled = false, two_factor_secret_ciphertext = NULL, two_factor_secret_nonce = NULL, updated_at = NOW() WHERE id = $1`, userID)
	return err
}

func (r *Repository) CreateAuditEvent(ctx context.Context, actorUserID, actorSessionID *string, action, resourceType, resourceID string, metadata map[string]any) error {
	const query = `
		INSERT INTO audit_events (id, actor_user_id, actor_session_id, action, resource_type, resource_id, severity, metadata_json)
		VALUES ($1, $2, $3, $4, $5, $6, 'INFO', $7::jsonb)`
	payload, _ := json.Marshal(metadata)
	_, err := r.db.Exec(ctx, query, uuid.NewString(), actorUserID, actorSessionID, action, resourceType, resourceID, payload)
	return err
}

func (r *Repository) CreateDeviceLoginAlert(ctx context.Context, userID, sessionID string) error {
	const query = `
		INSERT INTO device_login_alerts (id, user_id, session_id, channel, status)
		VALUES ($1, $2, $3, 'IN_APP', 'PENDING')`
	_, err := r.db.Exec(ctx, query, uuid.NewString(), userID, sessionID)
	return err
}

func scanUserPublic(row pgx.Row) (*model.User, error) {
	var user model.User
	var role string
	var accountStatus string
	var email sql.NullString
	if err := row.Scan(
		&user.ID,
		&email,
		&user.Username,
		&user.DisplayName,
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
	return &user, nil
}

func scanUser(row pgx.Row) (*model.User, error) {
	var user model.User
	var role string
	var accountStatus string
	var email sql.NullString
	var twoFactorCiphertext sql.NullString
	var twoFactorNonce sql.NullString
	var lockedUntil sql.NullTime
	if err := row.Scan(
		&user.ID,
		&email,
		&user.Username,
		&user.DisplayName,
		&user.PasswordHash,
		&role,
		&accountStatus,
		&user.IsAnonymous,
		&user.TwoFactorEnabled,
		&twoFactorCiphertext,
		&twoFactorNonce,
		&user.FailedLoginAttempts,
		&lockedUntil,
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
	if twoFactorCiphertext.Valid {
		user.TwoFactorSecretCiphertext = &twoFactorCiphertext.String
	}
	if twoFactorNonce.Valid {
		user.TwoFactorSecretNonce = &twoFactorNonce.String
	}
	if lockedUntil.Valid {
		user.LockedUntil = &lockedUntil.Time
	}
	return &user, nil
}

func scanSession(row pgx.Row) (*model.DeviceSession, error) {
	var session model.DeviceSession
	var securityLevel string
	var userAgent, deviceName, deviceFingerprint, ipAddress, countryCode, city sql.NullString
	if err := row.Scan(
		&session.ID,
		&session.UserID,
		&session.RefreshTokenHash,
		&session.RefreshTokenFamily,
		&userAgent,
		&deviceName,
		&deviceFingerprint,
		&ipAddress,
		&countryCode,
		&city,
		&session.IsCurrent,
		&securityLevel,
		&session.LastUsedAt,
		&session.ExpiresAt,
		&session.RevokedAt,
		&session.CreatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	if userAgent.Valid {
		session.UserAgent = &userAgent.String
	}
	if deviceName.Valid {
		session.DeviceName = &deviceName.String
	}
	if deviceFingerprint.Valid {
		session.DeviceFingerprint = &deviceFingerprint.String
	}
	if ipAddress.Valid {
		session.IPAddress = &ipAddress.String
	}
	if countryCode.Valid {
		session.CountryCode = &countryCode.String
	}
	if city.Valid {
		session.City = &city.String
	}
	session.SecurityLevel = enums.SessionSecurityLevel(securityLevel)
	return &session, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func (r *Repository) FindSocialAccount(ctx context.Context, provider, providerUserID string) (*model.SocialAccount, error) {
	const query = `
		SELECT id, user_id, provider, provider_user_id, email, display_name, avatar_url, created_at, updated_at
		FROM social_accounts
		WHERE provider = $1 AND provider_user_id = $2
		LIMIT 1`
	row := r.db.QueryRow(ctx, query, provider, providerUserID)
	return scanSocialAccount(row)
}

func (r *Repository) FindSocialAccountByEmail(ctx context.Context, provider, email string) (*model.SocialAccount, error) {
	const query = `
		SELECT id, user_id, provider, provider_user_id, email, display_name, avatar_url, created_at, updated_at
		FROM social_accounts
		WHERE provider = $1 AND email = $2
		LIMIT 1`
	row := r.db.QueryRow(ctx, query, provider, email)
	return scanSocialAccount(row)
}

func (r *Repository) CreateSocialAccount(ctx context.Context, userID, provider, providerUserID, email, displayName, avatarURL string) (*model.SocialAccount, error) {
	const query = `
		INSERT INTO social_accounts (id, user_id, provider, provider_user_id, email, display_name, avatar_url, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
		RETURNING id, user_id, provider, provider_user_id, email, display_name, avatar_url, created_at, updated_at`
	id := uuid.NewString()
	row := r.db.QueryRow(ctx, query, id, userID, provider, providerUserID,
		nullIfEmpty(email), nullIfEmpty(displayName), nullIfEmpty(avatarURL))
	return scanSocialAccount(row)
}

func (r *Repository) CreateUserFromOAuth(ctx context.Context, email, displayName, avatarURL, username string) (*model.User, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	userID := uuid.NewString()
	const userQuery = `
		INSERT INTO users (id, email, username, display_name, password_hash, role, account_status, is_anonymous, email_verified_at, updated_at)
		VALUES ($1, $2, $3, $4, '', $5, $6, false, NOW(), NOW())
		RETURNING id, email, username, display_name, role, account_status,
		          is_anonymous, two_factor_enabled, created_at, updated_at, deleted_at`

	user, err := scanUserPublic(tx.QueryRow(ctx, userQuery,
		userID,
		nullIfEmpty(email),
		username,
		displayName,
		string(enums.RoleUser),
		string(enums.AccountStatusActive),
	))
	if err != nil {
		if isUniqueViolation(err) {
			return nil, apperrors.ErrConflict
		}
		return nil, err
	}

	const privacyQuery = `
		INSERT INTO user_privacy_settings
			(user_id, profile_visibility, last_seen_visibility, allow_friend_requests, allow_trusted_invites,
			 searchable_by_email, searchable_by_username, post_default_privacy, show_online_status, updated_at)
		VALUES ($1, 'CONNECTIONS', 'CONNECTIONS', true, true, false, true, 'FRIENDS', true, NOW())`

	if _, err := tx.Exec(ctx, privacyQuery, userID); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return user, nil
}

func (r *Repository) FindUserByEmail(ctx context.Context, email string) (*model.User, error) {
	const query = `
		SELECT id, email, username, display_name, role, account_status,
		       is_anonymous, two_factor_enabled,
		       created_at, updated_at, deleted_at
		FROM users
		WHERE deleted_at IS NULL AND email = $1
		LIMIT 1`
	row := r.db.QueryRow(ctx, query, email)
	return scanUserPublic(row)
}

func (r *Repository) LinkSocialAccount(ctx context.Context, userID, provider, providerUserID, email, displayName, avatarURL string) error {
	const query = `
		INSERT INTO social_accounts (id, user_id, provider, provider_user_id, email, display_name, avatar_url, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
		ON CONFLICT (provider, provider_user_id) DO UPDATE SET
			email = EXCLUDED.email,
			display_name = EXCLUDED.display_name,
			avatar_url = EXCLUDED.avatar_url,
			updated_at = NOW()`
	_, err := r.db.Exec(ctx, query, uuid.NewString(), userID, provider, providerUserID,
		nullIfEmpty(email), nullIfEmpty(displayName), nullIfEmpty(avatarURL))
	return err
}

func (r *Repository) GenerateUniqueUsername(ctx context.Context, base string) (string, error) {
	base = strings.ToLower(strings.TrimSpace(base))
	if base == "" {
		base = "user"
	}
	// Remove non-alphanumeric characters
	cleaned := ""
	for _, c := range base {
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') {
			cleaned += string(c)
		}
	}
	if cleaned == "" {
		cleaned = "user"
	}
	if len(cleaned) > 28 {
		cleaned = cleaned[:28]
	}

	candidate := cleaned
	for i := 0; i < 100; i++ {
		var exists bool
		err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)`, candidate).Scan(&exists)
		if err != nil {
			return "", err
		}
		if !exists {
			return candidate, nil
		}
		candidate = fmt.Sprintf("%s%d", cleaned[:min(len(cleaned), 24)], i+1)
	}
	return "", fmt.Errorf("unable to generate unique username for base: %s", base)
}

func scanSocialAccount(row pgx.Row) (*model.SocialAccount, error) {
	var sa model.SocialAccount
	var email, displayName, avatarURL sql.NullString
	if err := row.Scan(
		&sa.ID,
		&sa.UserID,
		&sa.Provider,
		&sa.ProviderUserID,
		&email,
		&displayName,
		&avatarURL,
		&sa.CreatedAt,
		&sa.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	if email.Valid {
		sa.Email = &email.String
	}
	if displayName.Valid {
		sa.DisplayName = &displayName.String
	}
	if avatarURL.Valid {
		sa.AvatarURL = &avatarURL.String
	}
	return &sa, nil
}

func nullIfEmpty(s string) interface{} {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return s
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
