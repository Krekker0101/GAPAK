package chats

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
)

type dbtx interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
}

type Repository struct {
	db *pgxpool.Pool
}

type ChatRecord struct {
	ID             string
	ParticipantIDs []string
	LastMessageAt  *time.Time
	CreatedAt      time.Time
}

type MessageAttachmentRecord struct {
	MessageID    string
	MediaFileID  string
	Kind         string
	Status       string
	OriginalName *string
	MimeType     string
	SizeBytes    int64
}

type MessageRecord struct {
	Message     model.Message
	Attachments []MessageAttachmentRecord
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) EnsureDirectChat(ctx context.Context, userID, participantID string) (*model.DirectChat, error) {
	const existingQuery = `
		SELECT dc.id, dc.created_by_id, dc.last_message_at, dc.created_at, dc.updated_at, dc.deleted_at
		FROM direct_chats dc
		JOIN direct_chat_members m1 ON m1.chat_id = dc.id AND m1.user_id = $1 AND m1.deleted_at IS NULL
		JOIN direct_chat_members m2 ON m2.chat_id = dc.id AND m2.user_id = $2 AND m2.deleted_at IS NULL
		WHERE dc.deleted_at IS NULL
		LIMIT 1`

	existing, err := scanChat(r.db.QueryRow(ctx, existingQuery, userID, participantID))
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, apperrors.ErrNotFound) && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	chatID := uuid.NewString()
	const createChat = `
		INSERT INTO direct_chats (id, created_by_id, updated_at)
		VALUES ($1, $2, NOW())
		RETURNING id, created_by_id, last_message_at, created_at, updated_at, deleted_at`
	chat, err := scanChat(tx.QueryRow(ctx, createChat, chatID, userID))
	if err != nil {
		return nil, err
	}

	const addMember = `
		INSERT INTO direct_chat_members (chat_id, user_id, role, joined_at)
		VALUES ($1, $2, $3, NOW())`
	if _, err := tx.Exec(ctx, addMember, chatID, userID, string(enums.ChatRoleOwner)); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, addMember, chatID, participantID, string(enums.ChatRoleMember)); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return chat, nil
}

func (r *Repository) ListChats(ctx context.Context, userID string) ([]ChatRecord, error) {
	const query = `
		SELECT dc.id, ARRAY_AGG(dcm.user_id ORDER BY dcm.joined_at), dc.last_message_at, dc.created_at
		FROM direct_chats dc
		JOIN direct_chat_members self ON self.chat_id = dc.id AND self.user_id = $1 AND self.deleted_at IS NULL
		JOIN direct_chat_members dcm ON dcm.chat_id = dc.id AND dcm.deleted_at IS NULL
		WHERE dc.deleted_at IS NULL
		GROUP BY dc.id, dc.last_message_at, dc.created_at
		ORDER BY COALESCE(dc.last_message_at, dc.created_at) DESC`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]ChatRecord, 0)
	for rows.Next() {
		var item ChatRecord
		if err := rows.Scan(&item.ID, &item.ParticipantIDs, &item.LastMessageAt, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) SendMessage(ctx context.Context, senderID, chatID string, req SendMessageRequest) (*MessageRecord, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if err := r.assertMembership(ctx, tx, chatID, senderID); err != nil {
		return nil, err
	}

	attachmentIDs, err := extractAttachmentMediaIDs(req.AttachmentManifest)
	if err != nil {
		return nil, err
	}
	attachmentsByID, err := r.findReadyOwnedAttachments(ctx, tx, senderID, attachmentIDs)
	if err != nil {
		return nil, err
	}

	attachmentJSON, _ := json.Marshal(req.AttachmentManifest)
	metadataJSON, _ := json.Marshal(req.Metadata)
	messageID := uuid.NewString()
	const insertMessageQuery = `
		INSERT INTO messages (
			id, chat_id, sender_id, envelope_type, ciphertext, nonce, sender_key_id,
			attachment_manifest, metadata_json, client_message_id, sent_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, NOW())
		RETURNING id, chat_id, sender_id, envelope_type, ciphertext, nonce, sender_key_id,
		          attachment_manifest, metadata_json, client_message_id, sent_at, edited_at, deleted_at`

	message, err := scanMessage(tx.QueryRow(ctx, insertMessageQuery,
		messageID,
		chatID,
		senderID,
		req.EnvelopeType,
		[]byte(req.Ciphertext),
		req.Nonce,
		req.SenderKeyID,
		attachmentJSON,
		metadataJSON,
		req.ClientMessageID,
	))
	if err != nil {
		return nil, err
	}

	orderedAttachments := orderAttachments(attachmentIDs, attachmentsByID, messageID)
	if err := r.insertMessageAttachments(ctx, tx, messageID, orderedAttachments); err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `UPDATE direct_chats SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`, chatID); err != nil {
		return nil, err
	}

	record := &MessageRecord{
		Message:     *message,
		Attachments: orderedAttachments,
	}
	if err := r.appendRealtimeEvent(ctx, tx, chatID, "chat.message.sent", messageEventPayload(record)); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return record, nil
}

func (r *Repository) ListMessages(ctx context.Context, userID, chatID string, page, limit int) ([]MessageRecord, error) {
	if err := r.assertMembership(ctx, r.db, chatID, userID); err != nil {
		return nil, err
	}

	offset := (page - 1) * limit
	const query = `
		SELECT id, chat_id, sender_id, envelope_type, ciphertext, nonce, sender_key_id,
		       attachment_manifest, metadata_json, client_message_id, sent_at, edited_at, deleted_at
		FROM (
			SELECT id, chat_id, sender_id, envelope_type, ciphertext, nonce, sender_key_id,
			       attachment_manifest, metadata_json, client_message_id, sent_at, edited_at, deleted_at
			FROM messages
			WHERE chat_id = $1 AND deleted_at IS NULL
			ORDER BY sent_at DESC
			LIMIT $2 OFFSET $3
		) recent_messages
		ORDER BY sent_at ASC`
	rows, err := r.db.Query(ctx, query, chatID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.Message, 0)
	messageIDs := make([]string, 0)
	for rows.Next() {
		message, err := scanMessage(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *message)
		messageIDs = append(messageIDs, message.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	attachmentsByMessageID, err := r.listAttachmentsByMessageIDs(ctx, r.db, messageIDs)
	if err != nil {
		return nil, err
	}

	response := make([]MessageRecord, 0, len(items))
	for _, item := range items {
		attachments := attachmentsByMessageID[item.ID]
		for index := range attachments {
			attachments[index].MessageID = item.ID
		}
		response = append(response, MessageRecord{
			Message:     item,
			Attachments: attachments,
		})
	}
	return response, nil
}

func (r *Repository) ListEvents(ctx context.Context, userID, chatID string, after int64, limit int) ([]model.RealtimeEvent, error) {
	if err := r.assertMembership(ctx, r.db, chatID, userID); err != nil {
		return nil, err
	}

	const query = `
		SELECT id, sequence, channel, aggregate_type, aggregate_id, event_type, payload_json, relay_status,
		       relay_attempts, last_relay_error, reserved_at, relayed_at, created_at, updated_at
		FROM realtime_events
		WHERE aggregate_type = 'direct_chat'
		  AND aggregate_id = $1
		  AND sequence > $2
		ORDER BY sequence ASC
		LIMIT $3`
	rows, err := r.db.Query(ctx, query, chatID, after, limit)
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

func (r *Repository) assertMembership(ctx context.Context, querier dbtx, chatID, userID string) error {
	const membershipQuery = `
		SELECT 1
		FROM direct_chat_members
		WHERE chat_id = $1 AND user_id = $2 AND deleted_at IS NULL`
	var exists int
	if err := querier.QueryRow(ctx, membershipQuery, chatID, userID).Scan(&exists); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperrors.ErrForbidden
		}
		return err
	}
	return nil
}

func (r *Repository) findReadyOwnedAttachments(ctx context.Context, querier dbtx, ownerID string, mediaIDs []string) (map[string]MessageAttachmentRecord, error) {
	if len(mediaIDs) == 0 {
		return map[string]MessageAttachmentRecord{}, nil
	}

	const query = `
		SELECT id, COALESCE(kind, 'DOCUMENT') AS kind, status, original_name, mime_type, size_bytes
		FROM media_files
		WHERE owner_id = $1
		  AND deleted_at IS NULL
		  AND status = 'READY'
		  AND id = ANY($2::uuid[])`
	rows, err := querier.Query(ctx, query, ownerID, mediaIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make(map[string]MessageAttachmentRecord, len(mediaIDs))
	for rows.Next() {
		var attachment MessageAttachmentRecord
		var originalName sql.NullString
		if err := rows.Scan(
			&attachment.MediaFileID,
			&attachment.Kind,
			&attachment.Status,
			&originalName,
			&attachment.MimeType,
			&attachment.SizeBytes,
		); err != nil {
			return nil, err
		}
		if originalName.Valid {
			attachment.OriginalName = &originalName.String
		}
		items[attachment.MediaFileID] = attachment
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(items) != len(mediaIDs) {
		return nil, apperrors.New(400, "chats.attachment_not_ready", "One or more attachments are missing, not ready, or do not belong to the sender")
	}
	return items, nil
}

func (r *Repository) insertMessageAttachments(ctx context.Context, tx pgx.Tx, messageID string, attachments []MessageAttachmentRecord) error {
	if len(attachments) == 0 {
		return nil
	}

	const query = `
		INSERT INTO message_media_attachments (id, message_id, media_file_id)
		VALUES ($1, $2, $3)`
	for _, attachment := range attachments {
		if _, err := tx.Exec(ctx, query, uuid.NewString(), messageID, attachment.MediaFileID); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) listAttachmentsByMessageIDs(ctx context.Context, querier dbtx, messageIDs []string) (map[string][]MessageAttachmentRecord, error) {
	if len(messageIDs) == 0 {
		return map[string][]MessageAttachmentRecord{}, nil
	}

	const query = `
		SELECT mma.message_id, mma.media_file_id, COALESCE(m.kind, 'DOCUMENT') AS kind, m.status,
		       m.original_name, m.mime_type, m.size_bytes
		FROM message_media_attachments mma
		JOIN media_files m ON m.id = mma.media_file_id
		WHERE mma.message_id = ANY($1::uuid[])
		ORDER BY mma.created_at ASC`
	rows, err := querier.Query(ctx, query, messageIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make(map[string][]MessageAttachmentRecord, len(messageIDs))
	for rows.Next() {
		var attachment MessageAttachmentRecord
		var originalName sql.NullString
		if err := rows.Scan(
			&attachment.MessageID,
			&attachment.MediaFileID,
			&attachment.Kind,
			&attachment.Status,
			&originalName,
			&attachment.MimeType,
			&attachment.SizeBytes,
		); err != nil {
			return nil, err
		}
		if originalName.Valid {
			attachment.OriginalName = &originalName.String
		}
		items[attachment.MessageID] = append(items[attachment.MessageID], attachment)
	}
	return items, rows.Err()
}

func (r *Repository) appendRealtimeEvent(ctx context.Context, tx pgx.Tx, chatID, eventType string, payload map[string]any) error {
	rawPayload, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	const query = `
		INSERT INTO realtime_events (
			id, channel, aggregate_type, aggregate_id, event_type, payload_json, relay_status, updated_at
		)
		VALUES ($1, $2, 'direct_chat', $3, $4, $5::jsonb, 'PENDING', NOW())`
	_, err = tx.Exec(ctx, query, uuid.NewString(), r.eventChannel(chatID), chatID, eventType, rawPayload)
	return err
}

func (r *Repository) eventChannel(chatID string) string {
	return fmt.Sprintf("realtime:direct-chat:%s", chatID)
}

func orderAttachments(mediaIDs []string, attachmentsByID map[string]MessageAttachmentRecord, messageID string) []MessageAttachmentRecord {
	if len(mediaIDs) == 0 {
		return nil
	}

	ordered := make([]MessageAttachmentRecord, 0, len(mediaIDs))
	for _, mediaID := range mediaIDs {
		attachment, ok := attachmentsByID[mediaID]
		if !ok {
			continue
		}
		attachment.MessageID = messageID
		ordered = append(ordered, attachment)
	}
	return ordered
}

func extractAttachmentMediaIDs(manifest map[string]any) ([]string, error) {
	if len(manifest) == 0 {
		return nil, nil
	}

	seen := make(map[string]struct{})
	mediaIDs := make([]string, 0)
	appendMediaID := func(raw any) error {
		value, ok := raw.(string)
		if !ok {
			return apperrors.New(400, "chats.attachment_media_invalid", "Attachment media identifiers must be strings")
		}
		value = strings.TrimSpace(value)
		if value == "" {
			return apperrors.New(400, "chats.attachment_media_invalid", "Attachment media identifiers cannot be empty")
		}
		if _, err := uuid.Parse(value); err != nil {
			return apperrors.New(400, "chats.attachment_media_invalid", "Attachment media identifiers must be valid UUIDs")
		}
		if _, ok := seen[value]; ok {
			return nil
		}
		seen[value] = struct{}{}
		mediaIDs = append(mediaIDs, value)
		return nil
	}

	if rawMediaID, ok := manifest["mediaId"]; ok {
		if err := appendMediaID(rawMediaID); err != nil {
			return nil, err
		}
	}

	if rawMediaIDs, ok := manifest["mediaIds"]; ok {
		switch typed := rawMediaIDs.(type) {
		case []any:
			for _, item := range typed {
				if err := appendMediaID(item); err != nil {
					return nil, err
				}
			}
		case []string:
			for _, item := range typed {
				if err := appendMediaID(item); err != nil {
					return nil, err
				}
			}
		default:
			return nil, apperrors.New(400, "chats.attachment_media_invalid", "attachmentManifest.mediaIds must be an array")
		}
	}

	if rawAttachments, ok := manifest["attachments"]; ok {
		attachments, ok := rawAttachments.([]any)
		if !ok {
			return nil, apperrors.New(400, "chats.attachment_media_invalid", "attachmentManifest.attachments must be an array")
		}
		for _, attachment := range attachments {
			item, ok := attachment.(map[string]any)
			if !ok {
				return nil, apperrors.New(400, "chats.attachment_media_invalid", "attachmentManifest.attachments items must be objects")
			}
			rawMediaID, ok := item["mediaId"]
			if !ok {
				return nil, apperrors.New(400, "chats.attachment_media_invalid", "attachmentManifest.attachments items must include mediaId")
			}
			if err := appendMediaID(rawMediaID); err != nil {
				return nil, err
			}
		}
	}

	return mediaIDs, nil
}

func messageEventPayload(record *MessageRecord) map[string]any {
	attachmentManifest := map[string]any{}
	if len(record.Message.AttachmentManifest) > 0 {
		_ = json.Unmarshal(record.Message.AttachmentManifest, &attachmentManifest)
	}

	metadata := map[string]any{}
	if len(record.Message.MetadataJSON) > 0 {
		_ = json.Unmarshal(record.Message.MetadataJSON, &metadata)
	}

	attachments := make([]map[string]any, 0, len(record.Attachments))
	for _, attachment := range record.Attachments {
		payload := map[string]any{
			"mediaFileId": attachment.MediaFileID,
			"kind":        attachment.Kind,
			"status":      attachment.Status,
			"mimeType":    attachment.MimeType,
			"sizeBytes":   attachment.SizeBytes,
		}
		if attachment.OriginalName != nil {
			payload["originalName"] = *attachment.OriginalName
		}
		attachments = append(attachments, payload)
	}

	return map[string]any{
		"chatId": record.Message.ChatID,
		"message": map[string]any{
			"id":                 record.Message.ID,
			"chatId":             record.Message.ChatID,
			"senderId":           record.Message.SenderID,
			"envelopeType":       string(record.Message.EnvelopeType),
			"ciphertext":         string(record.Message.Ciphertext),
			"nonce":              record.Message.Nonce,
			"senderKeyId":        record.Message.SenderKeyID,
			"attachmentManifest": attachmentManifest,
			"attachments":        attachments,
			"metadata":           metadata,
			"clientMessageId":    record.Message.ClientMessageID,
			"sentAt":             record.Message.SentAt,
			"editedAt":           record.Message.EditedAt,
		},
	}
}

func scanChat(row interface{ Scan(dest ...any) error }) (*model.DirectChat, error) {
	var chat model.DirectChat
	if err := row.Scan(&chat.ID, &chat.CreatedByID, &chat.LastMessageAt, &chat.CreatedAt, &chat.UpdatedAt, &chat.DeletedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	return &chat, nil
}

func scanMessage(row interface{ Scan(dest ...any) error }) (*model.Message, error) {
	var message model.Message
	var envelopeType string
	if err := row.Scan(
		&message.ID,
		&message.ChatID,
		&message.SenderID,
		&envelopeType,
		&message.Ciphertext,
		&message.Nonce,
		&message.SenderKeyID,
		&message.AttachmentManifest,
		&message.MetadataJSON,
		&message.ClientMessageID,
		&message.SentAt,
		&message.EditedAt,
		&message.DeletedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	message.EnvelopeType = enums.MessageEnvelopeType(envelopeType)
	return &message, nil
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
