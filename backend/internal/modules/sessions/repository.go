package sessions

import (
	"context"
	"database/sql"

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

func (r *Repository) ListByUser(ctx context.Context, userID string) ([]model.DeviceSession, error) {
	const query = `
		SELECT id, user_id, refresh_token_hash, refresh_token_family, user_agent, device_name, device_fingerprint,
		       ip_address, country_code, city, is_current, security_level, last_used_at, expires_at, revoked_at, created_at
		FROM device_sessions
		WHERE user_id = $1
		ORDER BY created_at DESC`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sessions := make([]model.DeviceSession, 0)
	for rows.Next() {
		var session model.DeviceSession
		var securityLevel string
		var userAgent, deviceName, deviceFingerprint, ipAddress, countryCode, city sql.NullString
		if err := rows.Scan(
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
		sessions = append(sessions, session)
	}
	return sessions, rows.Err()
}

func (r *Repository) RevokeSession(ctx context.Context, userID, sessionID string) error {
	const query = `
		UPDATE device_sessions
		SET revoked_at = NOW(), is_current = false
		WHERE user_id = $1 AND id = $2 AND revoked_at IS NULL`
	tag, err := r.db.Exec(ctx, query, userID, sessionID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperrors.ErrNotFound
	}
	return nil
}

func (r *Repository) RevokeOthers(ctx context.Context, userID, currentSessionID string) error {
	const query = `
		UPDATE device_sessions
		SET revoked_at = NOW(), is_current = false
		WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL`
	_, err := r.db.Exec(ctx, query, userID, currentSessionID)
	return err
}
