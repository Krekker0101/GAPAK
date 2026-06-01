package security

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gapak/backend/internal/domain/model"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) ListAuditEvents(ctx context.Context, userID string) ([]model.AuditEvent, error) {
	const query = `
		SELECT id, actor_user_id, actor_session_id, target_user_id, action, resource_type, resource_id,
		       severity, ip_address, user_agent, metadata_json, created_at
		FROM audit_events
		WHERE actor_user_id = $1 OR target_user_id = $1
		ORDER BY created_at DESC
		LIMIT 100`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.AuditEvent, 0)
	for rows.Next() {
		var item model.AuditEvent
		if err := rows.Scan(
			&item.ID,
			&item.ActorUserID,
			&item.ActorSessionID,
			&item.TargetUserID,
			&item.Action,
			&item.ResourceType,
			&item.ResourceID,
			&item.Severity,
			&item.IPAddress,
			&item.UserAgent,
			&item.MetadataJSON,
			&item.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) ListFlags(ctx context.Context, userID string) ([]model.SuspiciousActivityFlag, error) {
	const query = `
		SELECT id, user_id, session_id, reason, severity, status, metadata_json, created_at, reviewed_at
		FROM suspicious_activity_flags
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 100`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.SuspiciousActivityFlag, 0)
	for rows.Next() {
		var item model.SuspiciousActivityFlag
		if err := rows.Scan(
			&item.ID,
			&item.UserID,
			&item.SessionID,
			&item.Reason,
			&item.Severity,
			&item.Status,
			&item.MetadataJSON,
			&item.CreatedAt,
			&item.ReviewedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) ListAlerts(ctx context.Context, userID string) ([]model.DeviceLoginAlert, error) {
	const query = `
		SELECT id, user_id, session_id, channel, status, created_at, acknowledged_at
		FROM device_login_alerts
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 100`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.DeviceLoginAlert, 0)
	for rows.Next() {
		var item model.DeviceLoginAlert
		if err := rows.Scan(
			&item.ID,
			&item.UserID,
			&item.SessionID,
			&item.Channel,
			&item.Status,
			&item.CreatedAt,
			&item.AcknowledgedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func decodeJSON(raw []byte) map[string]any {
	if len(raw) == 0 {
		return map[string]any{}
	}
	payload := map[string]any{}
	_ = json.Unmarshal(raw, &payload)
	return payload
}

func (r *Repository) RevokeSessions(ctx context.Context, userID string, preserveCurrent bool, currentSessionID *string) (int64, error) {
	query := `
		UPDATE device_sessions
		SET revoked_at = NOW(), is_current = false
		WHERE user_id = $1 AND revoked_at IS NULL`
	args := []any{userID}
	if preserveCurrent && currentSessionID != nil && *currentSessionID != "" {
		query += ` AND id <> $2`
		args = append(args, *currentSessionID)
	}
	tag, err := r.db.Exec(ctx, query, args...)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

func (r *Repository) RevokePlaybackGrants(ctx context.Context, userID string) (int64, error) {
	const query = `
		UPDATE playback_access_grants
		SET status = 'REVOKED', updated_at = NOW()
		WHERE viewer_user_id = $1 AND status = 'ACTIVE'`
	tag, err := r.db.Exec(ctx, query, userID)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

func (r *Repository) AbortPendingUploads(ctx context.Context, userID string) (int64, error) {
	const query = `
		UPDATE upload_sessions
		SET status = 'ABORTED', aborted_at = NOW(), updated_at = NOW()
		WHERE owner_id = $1 AND status IN ('INITIATED', 'PARTIAL')`
	tag, err := r.db.Exec(ctx, query, userID)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

func (r *Repository) CreateAuditEvent(ctx context.Context, actorUserID, targetUserID *string, action, resourceType, resourceID string, metadata map[string]any) (string, error) {
	payload, _ := json.Marshal(metadata)
	auditID := uuid.NewString()
	const query = `
		INSERT INTO audit_events (id, actor_user_id, target_user_id, action, resource_type, resource_id, severity, metadata_json)
		VALUES ($1, $2, $3, $4, $5, $6, 'CRITICAL', $7::jsonb)`
	_, err := r.db.Exec(ctx, query, auditID, actorUserID, targetUserID, action, resourceType, resourceID, payload)
	if err != nil {
		return "", err
	}
	return auditID, nil
}
