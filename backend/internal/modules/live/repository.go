package live

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gapak/backend/internal/domain/enums"
	"github.com/gapak/backend/internal/domain/model"
	apperrors "github.com/gapak/backend/internal/platform/errors"
)

type Repository struct {
	db               *pgxpool.Pool
	eventChannelBase string
}

func NewRepository(db *pgxpool.Pool, eventChannelBase string) *Repository {
	return &Repository{db: db, eventChannelBase: eventChannelBase}
}

func (r *Repository) Create(ctx context.Context, hostUserID string, req CreateLiveStreamRequest) (*model.LiveStream, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	const query = `
		INSERT INTO live_streams (
			id, host_user_id, trust_room_id, title, description, visibility, status, scheduled_for,
			stream_key_hash, allow_replay, updated_at
		)
		VALUES (
			$1,
			$2,
			$3,
			$4,
			NULLIF($5, ''),
			$6,
			CASE WHEN $7::timestamp IS NULL THEN 'LIVE'::"LiveStreamStatus" ELSE 'SCHEDULED'::"LiveStreamStatus" END,
			$7::timestamp,
			$8,
			$9,
			NOW()
		)
		RETURNING id, host_user_id, trust_room_id, title, description, visibility, status, scheduled_for,
		          started_at, ended_at, stream_key_hash, ingest_url, playback_manifest_key, replay_media_file_id,
		          viewer_count, allow_replay, created_at, updated_at, deleted_at`
	item, err := scanLiveStream(tx.QueryRow(ctx, query,
		uuid.NewString(),
		hostUserID,
		req.TrustRoomID,
		req.Title,
		stringPtr(req.Description),
		req.Visibility,
		req.ScheduledFor,
		uuid.NewString(),
		req.AllowReplay,
	))
	if err != nil {
		return nil, err
	}

	if err := r.appendRealtimeEvent(ctx, tx, item.ID, "live.created", map[string]any{
		"streamId":     item.ID,
		"hostUserId":   hostUserID,
		"visibility":   string(item.Visibility),
		"status":       string(item.Status),
		"scheduledFor": item.ScheduledFor,
		"allowReplay":  item.AllowReplay,
		"viewerCount":  item.ViewerCount,
		"createdAt":    item.CreatedAt,
		"eventChannel": r.eventChannel(item.ID),
	}); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return item, nil
}

func (r *Repository) ListVisible(ctx context.Context, viewerID string, page, limit int) ([]model.LiveStream, error) {
	offset := (page - 1) * limit
	const query = `
		SELECT ls.id, ls.host_user_id, ls.trust_room_id, ls.title, ls.description, ls.visibility, ls.status,
		       ls.scheduled_for, ls.started_at, ls.ended_at, ls.stream_key_hash, ls.ingest_url,
		       ls.playback_manifest_key, ls.replay_media_file_id, ls.viewer_count, ls.allow_replay,
		       ls.created_at, ls.updated_at, ls.deleted_at
		FROM live_streams ls
		WHERE ls.deleted_at IS NULL
		  AND (
		    ls.host_user_id = $1
		    OR ls.visibility = 'PUBLIC'
		    OR (ls.visibility = 'FRIENDS' AND EXISTS (
		          SELECT 1 FROM friend_connections fc
		          WHERE fc.deleted_at IS NULL AND fc.status = 'ACCEPTED'
		            AND ((fc.requester_id = ls.host_user_id AND fc.addressee_id = $1) OR (fc.addressee_id = ls.host_user_id AND fc.requester_id = $1))
		        ))
		    OR (ls.visibility = 'TRUSTED_CIRCLE' AND EXISTS (
		          SELECT 1 FROM trusted_circle_memberships tcm
		          WHERE tcm.owner_id = ls.host_user_id AND tcm.member_id = $1
		        ))
		    OR (ls.visibility = 'TRUST_ROOM' AND EXISTS (
		          SELECT 1 FROM trust_room_members trm
		          WHERE trm.room_id = ls.trust_room_id AND trm.user_id = $1 AND trm.deleted_at IS NULL
		        ))
		    OR (ls.visibility = 'PRIVATE' AND EXISTS (
		          SELECT 1 FROM live_participants lp
		          WHERE lp.stream_id = ls.id AND lp.user_id = $1
		        ))
		  )
		ORDER BY COALESCE(ls.started_at, ls.scheduled_for, ls.created_at) DESC
		LIMIT $2 OFFSET $3`
	rows, err := r.db.Query(ctx, query, viewerID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.LiveStream, 0)
	for rows.Next() {
		item, err := scanLiveStream(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func (r *Repository) GetVisible(ctx context.Context, viewerID, streamID string) (*model.LiveStream, error) {
	const query = `
		SELECT ls.id, ls.host_user_id, ls.trust_room_id, ls.title, ls.description, ls.visibility, ls.status,
		       ls.scheduled_for, ls.started_at, ls.ended_at, ls.stream_key_hash, ls.ingest_url,
		       ls.playback_manifest_key, ls.replay_media_file_id, ls.viewer_count, ls.allow_replay,
		       ls.created_at, ls.updated_at, ls.deleted_at
		FROM live_streams ls
		WHERE ls.id = $2
		  AND ls.deleted_at IS NULL
		  AND (
		    ls.host_user_id = $1
		    OR ls.visibility = 'PUBLIC'
		    OR (ls.visibility = 'FRIENDS' AND EXISTS (
		          SELECT 1 FROM friend_connections fc
		          WHERE fc.deleted_at IS NULL AND fc.status = 'ACCEPTED'
		            AND ((fc.requester_id = ls.host_user_id AND fc.addressee_id = $1) OR (fc.addressee_id = ls.host_user_id AND fc.requester_id = $1))
		        ))
		    OR (ls.visibility = 'TRUSTED_CIRCLE' AND EXISTS (
		          SELECT 1 FROM trusted_circle_memberships tcm
		          WHERE tcm.owner_id = ls.host_user_id AND tcm.member_id = $1
		        ))
		    OR (ls.visibility = 'TRUST_ROOM' AND EXISTS (
		          SELECT 1 FROM trust_room_members trm
		          WHERE trm.room_id = ls.trust_room_id AND trm.user_id = $1 AND trm.deleted_at IS NULL
		        ))
		    OR (ls.visibility = 'PRIVATE' AND EXISTS (
		          SELECT 1 FROM live_participants lp
		          WHERE lp.stream_id = ls.id AND lp.user_id = $1
		        ))
		  )
		LIMIT 1`
	return scanLiveStream(r.db.QueryRow(ctx, query, viewerID, streamID))
}

func (r *Repository) Start(ctx context.Context, hostUserID, streamID string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	const query = `
		UPDATE live_streams
		SET status = 'LIVE', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
		WHERE id = $1 AND host_user_id = $2 AND deleted_at IS NULL
		RETURNING viewer_count`
	var viewerCount int
	if err := tx.QueryRow(ctx, query, streamID, hostUserID).Scan(&viewerCount); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperrors.ErrNotFound
		}
		return err
	}
	if err := r.appendRealtimeEvent(ctx, tx, streamID, "live.started", map[string]any{
		"type":        "live.started",
		"streamId":    streamID,
		"actorId":     hostUserID,
		"viewerCount": viewerCount,
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Repository) End(ctx context.Context, hostUserID, streamID string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	const query = `
		UPDATE live_streams
		SET status = 'ENDED', ended_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND host_user_id = $2 AND deleted_at IS NULL
		RETURNING viewer_count`
	var viewerCount int
	if err := tx.QueryRow(ctx, query, streamID, hostUserID).Scan(&viewerCount); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperrors.ErrNotFound
		}
		return err
	}
	if err := r.appendRealtimeEvent(ctx, tx, streamID, "live.ended", map[string]any{
		"type":        "live.ended",
		"streamId":    streamID,
		"actorId":     hostUserID,
		"viewerCount": viewerCount,
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Repository) UpsertParticipant(ctx context.Context, streamID, userID string, role enums.LiveParticipantRole, isGhostMode bool) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	const query = `
		INSERT INTO live_participants (stream_id, user_id, role, joined_at, is_muted, is_ghost_mode)
		VALUES ($1, $2, $3, NOW(), false, $4)
		ON CONFLICT (stream_id, user_id)
		DO UPDATE SET role = EXCLUDED.role, joined_at = NOW(), left_at = NULL, is_ghost_mode = EXCLUDED.is_ghost_mode`
	if _, err := tx.Exec(ctx, query, streamID, userID, string(role), isGhostMode); err != nil {
		return err
	}
	const viewerCountQuery = `
		UPDATE live_streams
		SET viewer_count = (
			SELECT COUNT(*)
			FROM live_participants
			WHERE stream_id = $1 AND left_at IS NULL
		),
		    updated_at = NOW()
		WHERE id = $1
		RETURNING viewer_count`
	var viewerCount int
	if err := tx.QueryRow(ctx, viewerCountQuery, streamID).Scan(&viewerCount); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperrors.ErrNotFound
		}
		return err
	}
	if err := r.appendRealtimeEvent(ctx, tx, streamID, "live.participant_joined", map[string]any{
		"type":        "live.participant_joined",
		"streamId":    streamID,
		"userId":      userID,
		"role":        string(role),
		"isGhostMode": isGhostMode,
		"viewerCount": viewerCount,
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Repository) CreateChatMessage(ctx context.Context, streamID, senderID, body string) (*model.LiveChatMessage, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	const query = `
		INSERT INTO live_chat_messages (id, stream_id, sender_id, body)
		VALUES ($1, $2, $3, $4)
		RETURNING id, stream_id, sender_id, body, created_at, deleted_at`
	item, err := scanLiveChatMessage(tx.QueryRow(ctx, query, uuid.NewString(), streamID, senderID, body))
	if err != nil {
		return nil, err
	}
	if err := r.appendRealtimeEvent(ctx, tx, streamID, "live.chat_message", map[string]any{
		"type":      "live.chat_message",
		"streamId":  streamID,
		"messageId": item.ID,
		"senderId":  senderID,
		"body":      item.Body,
		"createdAt": item.CreatedAt,
	}); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return item, nil
}

func (r *Repository) ListChatMessages(ctx context.Context, streamID string) ([]model.LiveChatMessage, error) {
	const query = `
		SELECT id, stream_id, sender_id, body, created_at, deleted_at
		FROM live_chat_messages
		WHERE stream_id = $1 AND deleted_at IS NULL
		ORDER BY created_at DESC
		LIMIT 100`
	rows, err := r.db.Query(ctx, query, streamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.LiveChatMessage, 0)
	for rows.Next() {
		item, err := scanLiveChatMessage(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func (r *Repository) ListEvents(ctx context.Context, streamID string, after int64, limit int) ([]model.RealtimeEvent, error) {
	const query = `
		SELECT id, sequence, channel, aggregate_type, aggregate_id, event_type, payload_json, relay_status,
		       relay_attempts, last_relay_error, reserved_at, relayed_at, created_at, updated_at
		FROM realtime_events
		WHERE aggregate_type = 'live_stream'
		  AND aggregate_id = $1
		  AND sequence > $2
		ORDER BY sequence ASC
		LIMIT $3`
	rows, err := r.db.Query(ctx, query, streamID, after, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.RealtimeEvent, 0)
	for rows.Next() {
		item, err := scanRealtimeEvent(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func (r *Repository) appendRealtimeEvent(ctx context.Context, tx pgx.Tx, streamID, eventType string, payload map[string]any) error {
	rawPayload, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	const query = `
		INSERT INTO realtime_events (
			id, channel, aggregate_type, aggregate_id, event_type, payload_json, relay_status, updated_at
		)
		VALUES ($1, $2, 'live_stream', $3, $4, $5::jsonb, 'PENDING', NOW())`
	_, err = tx.Exec(ctx, query, uuid.NewString(), r.eventChannel(streamID), streamID, eventType, rawPayload)
	return err
}

func (r *Repository) eventChannel(streamID string) string {
	return fmt.Sprintf("%s:%s", r.eventChannelBase, streamID)
}

func scanLiveStream(row interface{ Scan(dest ...any) error }) (*model.LiveStream, error) {
	var item model.LiveStream
	var visibility string
	var status string
	if err := row.Scan(
		&item.ID,
		&item.HostUserID,
		&item.TrustRoomID,
		&item.Title,
		&item.Description,
		&visibility,
		&status,
		&item.ScheduledFor,
		&item.StartedAt,
		&item.EndedAt,
		&item.StreamKeyHash,
		&item.IngestURL,
		&item.PlaybackManifestKey,
		&item.ReplayMediaFileID,
		&item.ViewerCount,
		&item.AllowReplay,
		&item.CreatedAt,
		&item.UpdatedAt,
		&item.DeletedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	item.Visibility = enums.LiveVisibility(visibility)
	item.Status = enums.LiveStreamStatus(status)
	return &item, nil
}

func scanLiveChatMessage(row interface{ Scan(dest ...any) error }) (*model.LiveChatMessage, error) {
	var item model.LiveChatMessage
	if err := row.Scan(
		&item.ID,
		&item.StreamID,
		&item.SenderID,
		&item.Body,
		&item.CreatedAt,
		&item.DeletedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	return &item, nil
}

func scanRealtimeEvent(row interface{ Scan(dest ...any) error }) (*model.RealtimeEvent, error) {
	var item model.RealtimeEvent
	if err := row.Scan(
		&item.ID,
		&item.Sequence,
		&item.Channel,
		&item.AggregateType,
		&item.AggregateID,
		&item.EventType,
		&item.PayloadJSON,
		&item.RelayStatus,
		&item.RelayAttempts,
		&item.LastRelayError,
		&item.ReservedAt,
		&item.RelayedAt,
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

func stringPtr(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
