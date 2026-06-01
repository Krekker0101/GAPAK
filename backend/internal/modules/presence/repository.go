package presence

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	apperrors "github.com/gapak/backend/internal/platform/errors"
)

type Repository struct {
	db *pgxpool.Pool
}

type PresenceStatusRecord struct {
	UserID          string
	LastSeenAt      *time.Time
	ShowOnline      bool
	LastSeenScope   string
	IsConnection    bool
	HasActive       bool
	HasIdle         bool
	LastHeartbeatAt *time.Time
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) UpsertHeartbeat(ctx context.Context, userID, sessionID string, req HeartbeatRequest, now time.Time) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	const presenceQuery = `
		INSERT INTO user_presence_connections (
			connection_id, user_id, session_id, state, page_path, connected_at,
			last_heartbeat_at, last_activity_at, disconnected_at, updated_at
		)
		VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, $6, $6, NULL, $6)
		ON CONFLICT (connection_id)
		DO UPDATE SET
			user_id = EXCLUDED.user_id,
			session_id = EXCLUDED.session_id,
			state = EXCLUDED.state,
			page_path = EXCLUDED.page_path,
			connected_at = CASE
				WHEN user_presence_connections.disconnected_at IS NOT NULL THEN EXCLUDED.connected_at
				ELSE user_presence_connections.connected_at
			END,
			last_heartbeat_at = EXCLUDED.last_heartbeat_at,
			last_activity_at = EXCLUDED.last_activity_at,
			disconnected_at = NULL,
			updated_at = EXCLUDED.updated_at`
	if _, err := tx.Exec(ctx, presenceQuery, req.ConnectionID, userID, sessionID, req.State, deref(req.PagePath), now); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE users
		SET last_seen_at = $2, updated_at = NOW()
		WHERE id = $1
	`, userID, now); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *Repository) Disconnect(ctx context.Context, userID, sessionID string, req DisconnectRequest, now time.Time) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		UPDATE user_presence_connections
		SET state = 'DISCONNECTED',
		    disconnected_at = $4,
		    last_heartbeat_at = $4,
		    last_activity_at = $4,
		    updated_at = $4
		WHERE connection_id = $1
		  AND user_id = $2
		  AND session_id = $3
	`, req.ConnectionID, userID, sessionID, now); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE users
		SET last_seen_at = $2, updated_at = NOW()
		WHERE id = $1
	`, userID, now); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *Repository) FindStatus(ctx context.Context, viewerID, targetUserID string, activeSince time.Time) (*PresenceStatusRecord, error) {
	const query = `
		SELECT u.id,
		       u.last_seen_at,
		       ups.show_online_status,
		       ups.last_seen_visibility,
		       EXISTS (
		         SELECT 1
		         FROM friend_connections fc
		         WHERE fc.deleted_at IS NULL
		           AND fc.status = 'ACCEPTED'
		           AND ((fc.requester_id = u.id AND fc.addressee_id = $1) OR (fc.addressee_id = u.id AND fc.requester_id = $1))
		       ) AS is_connection,
		       EXISTS (
		         SELECT 1
		         FROM user_presence_connections upc
		         WHERE upc.user_id = u.id
		           AND upc.state = 'ACTIVE'
		           AND upc.disconnected_at IS NULL
		           AND upc.last_heartbeat_at >= $3
		       ) AS has_active,
		       EXISTS (
		         SELECT 1
		         FROM user_presence_connections upc
		         WHERE upc.user_id = u.id
		           AND upc.state = 'IDLE'
		           AND upc.disconnected_at IS NULL
		           AND upc.last_heartbeat_at >= $3
		       ) AS has_idle,
		       (
		         SELECT MAX(upc.last_heartbeat_at)
		         FROM user_presence_connections upc
		         WHERE upc.user_id = u.id
		       ) AS last_heartbeat_at
		FROM users u
		JOIN user_privacy_settings ups ON ups.user_id = u.id
		WHERE u.id = $2
		  AND u.deleted_at IS NULL
		LIMIT 1`
	row := r.db.QueryRow(ctx, query, viewerID, targetUserID, activeSince)

	var item PresenceStatusRecord
	if err := row.Scan(
		&item.UserID,
		&item.LastSeenAt,
		&item.ShowOnline,
		&item.LastSeenScope,
		&item.IsConnection,
		&item.HasActive,
		&item.HasIdle,
		&item.LastHeartbeatAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	return &item, nil
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
