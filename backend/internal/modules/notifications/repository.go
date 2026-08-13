package notifications

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"github.com/gapak/backend/internal/platform/events"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	apperrors "github.com/gapak/backend/internal/platform/errors"
)

type NotificationRecord struct {
	ID         string
	Type       string
	Title      string
	Body       string
	CreatedAt  time.Time
	ReadAt     *time.Time
	TargetURL  *string
	Metadata   map[string]any
	ActorID    string
	EntityType *string
	EntityID   *string
	EventID    *string
}

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository { return &Repository{db: db} }

func (r *Repository) List(ctx context.Context, userID string, limit int) ([]NotificationRecord, bool, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id::text, type, title, body, created_at, read_at,
		       action_url, COALESCE(data, '{}'::jsonb), COALESCE(actor_id::text, ''), entity_type, entity_id::text, event_id::text
		FROM notifications
		WHERE user_id = $1
		ORDER BY created_at DESC, id DESC
		LIMIT $2`, userID, limit+1)
	if err != nil {
		return nil, false, err
	}
	defer rows.Close()

	items := make([]NotificationRecord, 0, limit)
	for rows.Next() {
		var item NotificationRecord
		var data []byte
		if err := rows.Scan(&item.ID, &item.Type, &item.Title, &item.Body, &item.CreatedAt, &item.ReadAt, &item.TargetURL, &data, &item.ActorID, &item.EntityType, &item.EntityID, &item.EventID); err != nil {
			return nil, false, err
		}
		item.Metadata = map[string]any{}
		if len(data) > 0 {
			if err := json.Unmarshal(data, &item.Metadata); err != nil {
				return nil, false, err
			}
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, false, err
	}

	hasMore := len(items) > limit
	if hasMore {
		items = items[:limit]
	}
	return items, hasMore, nil
}

func (r *Repository) UnreadCount(ctx context.Context, userID string) (int, error) {
	var count int
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE`, userID).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

func (r *Repository) MarkRead(ctx context.Context, userID, notificationID string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `UPDATE notifications SET is_read = TRUE, read_at = COALESCE(read_at, NOW()), updated_at = NOW() WHERE id = $1 AND user_id = $2 AND is_read = FALSE`, notificationID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		var exists bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM notifications WHERE id = $1 AND user_id = $2)`, notificationID, userID).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			return apperrors.ErrNotFound
		}
	}
	if tag.RowsAffected() > 0 {
		payload := map[string]any{"notificationId": notificationID, "recipient_user_ids": []string{userID}}
		if err := appendNotificationRealtimeTx(ctx, tx, "notification.read", payload, userID); err != nil {
			return err
		}
		if err := events.NewNotifier().EmitTx(ctx, tx, events.DomainEvent{
			Type: events.NotificationRead, AggregateType: "notification", AggregateID: notificationID,
			ActorID: &userID, RecipientUserIDs: []string{userID},
			Payload:        map[string]any{"notificationId": notificationID},
			IdempotencyKey: "notification-read:" + notificationID + ":" + userID + ":" + time.Now().UTC().Format(time.RFC3339Nano),
		}); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *Repository) MarkAllRead(ctx context.Context, userID string) (int64, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `UPDATE notifications SET is_read = TRUE, read_at = COALESCE(read_at, NOW()), updated_at = NOW() WHERE user_id = $1 AND is_read = FALSE`, userID)
	if err != nil {
		return 0, err
	}
	if tag.RowsAffected() > 0 {
		if err := appendNotificationRealtimeTx(ctx, tx, "notification.read_all", map[string]any{
			"recipient_user_ids": []string{userID}, "readCount": tag.RowsAffected(),
		}, userID); err != nil {
			return 0, err
		}
		if err := events.NewNotifier().EmitTx(ctx, tx, events.DomainEvent{
			Type: events.NotificationReadAll, AggregateType: "notification_collection", AggregateID: userID,
			ActorID: &userID, RecipientUserIDs: []string{userID},
			Payload:        map[string]any{"readCount": tag.RowsAffected()},
			IdempotencyKey: "notification-read-all:" + userID + ":" + time.Now().UTC().Format(time.RFC3339Nano),
		}); err != nil {
			return 0, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

func appendNotificationRealtimeTx(ctx context.Context, tx pgx.Tx, eventType string, payload map[string]any, userID string) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO realtime_events (id, channel, aggregate_type, aggregate_id, event_type, payload_json, relay_status, updated_at)
		VALUES ($1, $2, 'notification', $3, $4, $5::jsonb, 'PENDING', NOW())`,
		uuid.NewString(), "notifications:"+userID, userID, eventType, raw)
	return err
}
