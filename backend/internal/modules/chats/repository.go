package chats

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
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

// dbConn abstracts *pgxpool.Pool and pgx.Tx so repository methods can run inside a transaction.
type dbConn interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Begin(ctx context.Context) (pgx.Tx, error)
	SendBatch(ctx context.Context, b *pgx.Batch) pgx.BatchResults
}

type Repository struct {
	db dbConn
}

// allowedUpdateColumns defines which columns can be set via the generic Update* helpers.
var allowedUpdateColumns = map[string]map[string]struct{}{
	"chats": {
		"title":               {},
		"description":         {},
		"avatar_file_id":      {},
		"encryption_protocol": {},
		"message_ttl_seconds": {},
		"is_muted":            {},
		"is_pinned":           {},
	},
	"chat_members": {
		"role":                 {},
		"nickname":             {},
		"is_muted":             {},
		"mute_until":           {},
		"last_read_message_id": {},
		"last_read_at":         {},
	},
	"messages": {
		"ciphertext":                {},
		"nonce":                     {},
		"content":                   {},
		"metadata":                  {},
		"sender_key_id":             {},
		"encryption_protocol":       {},
		"encryption_algorithm":      {},
		"associated_data":           {},
		"ratchet_counter":           {},
		"authentication_tag":        {},
		"reply_to_message_id":       {},
		"forwarded_from_message_id": {},
		"forwarded_from_chat_id":    {},
		"expires_at":                {},
		"edited_at":                 {},
		"status":                    {},
	},
}

func validateUpdateColumns(table string, updates map[string]interface{}) (map[string]interface{}, error) {
	allowed, ok := allowedUpdateColumns[table]
	if !ok {
		return nil, apperrors.New(500, "chats.unknown_update_table", "Unknown update table: "+table)
	}
	filtered := make(map[string]interface{}, len(updates))
	for key, value := range updates {
		if _, ok := allowed[key]; !ok {
			return nil, apperrors.New(400, "chats.invalid_update_field", "Update field not allowed for "+table+": "+key)
		}
		filtered[key] = value
	}
	return filtered, nil
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// Begin starts a new transaction.
func (r *Repository) Begin(ctx context.Context) (pgx.Tx, error) {
	return r.db.Begin(ctx)
}

// WithTx returns a repository instance that runs against the given transaction.
func (r *Repository) WithTx(tx pgx.Tx) *Repository {
	return &Repository{db: tx}
}

// ============================================================================
// CHAT OPERATIONS
// ============================================================================

func (r *Repository) CreateChat(ctx context.Context, chat *model.Chat) (*model.Chat, error) {
	chat.ID = uuid.NewString()
	chat.CreatedAt = time.Now().UTC()
	chat.UpdatedAt = time.Now().UTC()
	chat.MemberCount = 0

	const query = `
		INSERT INTO chats (
			id, type, title, description, avatar_file_id, created_by_id,
			encryption_protocol, message_ttl_seconds, is_muted, is_pinned,
			last_sequence_number, member_count, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id, type, title, description, avatar_file_id, created_by_id,
		          encryption_protocol, message_ttl_seconds, is_muted, is_pinned,
		          last_message_id, last_message_at, last_sequence_number,
		          member_count, created_at, updated_at, deleted_at
	`

	row := r.db.QueryRow(ctx, query,
		chat.ID,
		chat.Type,
		chat.Title,
		chat.Description,
		chat.AvatarFileID,
		chat.CreatedByID,
		chat.EncryptionProtocol,
		chat.MessageTTLSeconds,
		chat.IsMuted,
		chat.IsPinned,
		chat.LastSequenceNumber,
		chat.MemberCount,
		chat.CreatedAt,
		chat.UpdatedAt,
	)

	return r.scanChat(row)
}

func (r *Repository) GetChat(ctx context.Context, chatID string) (*model.Chat, error) {
	const query = `
		SELECT id, type, title, description, avatar_file_id, created_by_id,
		       encryption_protocol, message_ttl_seconds, is_muted, is_pinned,
		       last_message_id, last_message_at, last_sequence_number,
		       member_count, created_at, updated_at, deleted_at
		FROM chats
		WHERE id = $1
	`

	return r.scanChat(r.db.QueryRow(ctx, query, chatID))
}

func (r *Repository) GetChatByMembers(ctx context.Context, memberIDs []string) (*model.Chat, error) {
	const query = `
		SELECT c.id, c.type, c.title, c.description, c.avatar_file_id, c.created_by_id,
		       c.encryption_protocol, c.message_ttl_seconds, c.is_muted, c.is_pinned,
		       c.last_message_id, c.last_message_at, c.last_sequence_number,
		       c.member_count, c.created_at, c.updated_at, c.deleted_at
		FROM chats c
		WHERE c.type = 'DIRECT'
		  AND c.deleted_at IS NULL
		  AND c.member_count = 2
		  AND EXISTS (
		  	SELECT 1 FROM chat_members cm
		  	WHERE cm.chat_id = c.id
		  	AND cm.user_id = ANY($1)
		  	AND cm.deleted_at IS NULL
		  	AND cm.left_at IS NULL
		  	GROUP BY cm.chat_id
		  	HAVING COUNT(*) = 2
		  )
		LIMIT 1
	`

	return r.scanChat(r.db.QueryRow(ctx, query, memberIDs))
}

func (r *Repository) UpdateChat(ctx context.Context, chatID string, updates map[string]interface{}) (*model.Chat, error) {
	if len(updates) == 0 {
		return r.GetChat(ctx, chatID)
	}

	updates, err := validateUpdateColumns("chats", updates)
	if err != nil {
		return nil, err
	}

	setClauses := make([]string, 0)
	args := make([]interface{}, 0)
	argIndex := 1

	for key, value := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, argIndex))
		args = append(args, value)
		argIndex++
	}

	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", argIndex))
	args = append(args, time.Now())
	argIndex++

	args = append(args, chatID)

	query := fmt.Sprintf(`
		UPDATE chats
		SET %s
		WHERE id = $%d
		RETURNING id, type, title, description, avatar_file_id, created_by_id,
		          encryption_protocol, message_ttl_seconds, is_muted, is_pinned,
		          last_message_id, last_message_at, last_sequence_number,
		          member_count, created_at, updated_at, deleted_at
	`, strings.Join(setClauses, ", "), argIndex)

	return r.scanChat(r.db.QueryRow(ctx, query, args...))
}

func (r *Repository) DeleteChat(ctx context.Context, chatID string) error {
	const query = `UPDATE chats SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, chatID)
	return err
}

func (r *Repository) ListUserChats(ctx context.Context, userID string, limit, offset int, unreadOnly, pinnedOnly bool) ([]*model.Chat, error) {
	const query = `
		SELECT c.id, c.type, c.title, c.description, c.avatar_file_id, c.created_by_id,
		       c.encryption_protocol, c.message_ttl_seconds, c.is_muted, c.is_pinned,
		       c.last_message_id, c.last_message_at, c.last_sequence_number,
		       c.member_count, c.created_at, c.updated_at, c.deleted_at
		FROM chats c
		INNER JOIN chat_members cm ON cm.chat_id = c.id AND cm.user_id = $1
		WHERE c.deleted_at IS NULL
		  AND cm.deleted_at IS NULL
		  AND cm.left_at IS NULL
		  AND ($2 = false OR c.is_pinned = true)
		  AND ($3 = false OR EXISTS (
		  	SELECT 1 FROM messages m
		  	WHERE m.chat_id = c.id
		  	AND m.sent_at > COALESCE(cm.last_read_at, '1970-01-01'::timestamp)
		  	AND m.sender_id != $1
		  	AND m.deleted_at IS NULL
		  ))
		ORDER BY c.is_pinned DESC, c.last_message_at DESC NULLS LAST, c.created_at DESC
		LIMIT $4 OFFSET $5
	`

	rows, err := r.db.Query(ctx, query, userID, pinnedOnly, unreadOnly, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	chats := make([]*model.Chat, 0)
	for rows.Next() {
		chat, err := r.scanChat(rows)
		if err != nil {
			return nil, err
		}
		chats = append(chats, chat)
	}

	return chats, rows.Err()
}

// ============================================================================
// CHAT MEMBER OPERATIONS
// ============================================================================

func (r *Repository) AddChatMember(ctx context.Context, member *model.ChatMember) (*model.ChatMember, error) {
	member.ID = uuid.NewString()
	member.JoinedAt = time.Now()
	member.CreatedAt = time.Now()
	member.UpdatedAt = time.Now()

	const query = `
		INSERT INTO chat_members (
			id, chat_id, user_id, role, nickname, joined_at,
			is_muted, last_read_message_id, last_read_at, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, chat_id, user_id, role, nickname, joined_at, left_at,
		          is_muted, mute_until, last_read_message_id, last_read_at,
		          created_at, updated_at, deleted_at
	`

	return r.scanChatMember(r.db.QueryRow(ctx, query,
		member.ID,
		member.ChatID,
		member.UserID,
		member.Role,
		member.Nickname,
		member.JoinedAt,
		member.IsMuted,
		member.LastReadMessageID,
		member.LastReadAt,
		member.CreatedAt,
		member.UpdatedAt,
	))
}

func (r *Repository) GetChatMember(ctx context.Context, chatID, userID string) (*model.ChatMember, error) {
	const query = `
		SELECT id, chat_id, user_id, role, nickname, joined_at, left_at,
		       is_muted, mute_until, last_read_message_id, last_read_at,
		       created_at, updated_at, deleted_at
		FROM chat_members
		WHERE chat_id = $1 AND user_id = $2 AND deleted_at IS NULL
	`

	return r.scanChatMember(r.db.QueryRow(ctx, query, chatID, userID))
}

func (r *Repository) UpdateChatMember(ctx context.Context, chatID, userID string, updates map[string]interface{}) (*model.ChatMember, error) {
	if len(updates) == 0 {
		return r.GetChatMember(ctx, chatID, userID)
	}

	updates, err := validateUpdateColumns("chat_members", updates)
	if err != nil {
		return nil, err
	}

	setClauses := make([]string, 0)
	args := make([]interface{}, 0)
	argIndex := 1

	for key, value := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, argIndex))
		args = append(args, value)
		argIndex++
	}

	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", argIndex))
	args = append(args, time.Now())
	argIndex++

	args = append(args, chatID, userID)

	query := fmt.Sprintf(`
		UPDATE chat_members
		SET %s
		WHERE chat_id = $%d AND user_id = $%d AND deleted_at IS NULL
		RETURNING id, chat_id, user_id, role, nickname, joined_at, left_at,
		          is_muted, mute_until, last_read_message_id, last_read_at,
		          created_at, updated_at, deleted_at
	`, strings.Join(setClauses, ", "), argIndex, argIndex+1)

	return r.scanChatMember(r.db.QueryRow(ctx, query, args...))
}

func (r *Repository) RemoveChatMember(ctx context.Context, chatID, userID string) error {
	const query = `
		UPDATE chat_members
		SET left_at = NOW(), deleted_at = NOW(), updated_at = NOW()
		WHERE chat_id = $1 AND user_id = $2 AND deleted_at IS NULL
	`
	_, err := r.db.Exec(ctx, query, chatID, userID)
	return err
}

func (r *Repository) ListChatMembers(ctx context.Context, chatID string, role string, limit, offset int) ([]*model.ChatMember, error) {
	query := `
		SELECT id, chat_id, user_id, role, nickname, joined_at, left_at,
		       is_muted, mute_until, last_read_message_id, last_read_at,
		       created_at, updated_at, deleted_at
		FROM chat_members
		WHERE chat_id = $1 AND deleted_at IS NULL
	`
	args := []interface{}{chatID}
	argIndex := 2

	if role != "" {
		query += fmt.Sprintf(" AND role = $%d", argIndex)
		args = append(args, role)
		argIndex++
	}

	query += fmt.Sprintf(" ORDER BY joined_at ASC LIMIT $%d OFFSET $%d", argIndex, argIndex+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	members := make([]*model.ChatMember, 0)
	for rows.Next() {
		member, err := r.scanChatMember(rows)
		if err != nil {
			return nil, err
		}
		members = append(members, member)
	}

	return members, rows.Err()
}

func (r *Repository) AssertChatMembership(ctx context.Context, chatID, userID string) error {
	const query = `
		SELECT 1 FROM chat_members
		WHERE chat_id = $1 AND user_id = $2 AND deleted_at IS NULL AND left_at IS NULL
		LIMIT 1
	`
	var exists int
	err := r.db.QueryRow(ctx, query, chatID, userID).Scan(&exists)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperrors.ErrForbidden
		}
		return err
	}
	return nil
}

// ============================================================================
// MESSAGE OPERATIONS
// ============================================================================

func (r *Repository) CreateMessage(ctx context.Context, message *model.Message) (*model.Message, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	message.ID = uuid.NewString()
	message.SentAt = time.Now().UTC()
	message.CreatedAt = time.Now().UTC()
	message.UpdatedAt = time.Now().UTC()
	message.Status = enums.MessageStatusSent

	const seqQuery = `
		UPDATE chats
		SET last_sequence_number = last_sequence_number + 1,
		    updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
		RETURNING last_sequence_number
	`
	err = tx.QueryRow(ctx, seqQuery, message.ChatID).Scan(&message.SequenceNumber)
	if err != nil {
		return nil, err
	}

	const query = `
		INSERT INTO messages (
			id, chat_id, sender_id, client_message_id, sender_device_id, sequence_number, type, status,
			ciphertext, nonce, sender_key_id, encryption_protocol, authentication_tag,
			encryption_algorithm, associated_data, ratchet_counter, content, metadata,
			reply_to_message_id, forwarded_from_message_id, forwarded_from_chat_id,
			expires_at, sent_at, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
		        $11, $12, $13, $14, $15, $16, $17, $18, $19,
		        $20, $21, $22, $23, $24, $25)
		RETURNING id, chat_id, sender_id, client_message_id, sender_device_id, sequence_number, type, status,
		          ciphertext, nonce, sender_key_id, encryption_protocol, authentication_tag,
		          encryption_algorithm, associated_data, ratchet_counter, content, metadata,
		          reply_to_message_id, forwarded_from_message_id, forwarded_from_chat_id,
		          expires_at, sent_at, edited_at, deleted_at, deleted_by_id, created_at, updated_at
	`

	created, err := r.scanMessage(tx.QueryRow(ctx, query,
		message.ID,
		message.ChatID,
		message.SenderID,
		message.ClientMessageID,
		message.SenderDeviceID,
		message.SequenceNumber,
		message.Type,
		message.Status,
		message.Ciphertext,
		message.Nonce,
		message.SenderKeyID,
		message.EncryptionProtocol,
		message.AuthenticationTag,
		message.EncryptionAlgorithm,
		message.AssociatedData,
		message.RatchetCounter,
		message.Content,
		message.Metadata,
		message.ReplyToMessageID,
		message.ForwardedFromMessageID,
		message.ForwardedFromChatID,
		message.ExpiresAt,
		message.SentAt,
		message.CreatedAt,
		message.UpdatedAt,
	))
	if err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE chats
		SET last_message_id = $2,
		    last_message_at = $3,
		    updated_at = NOW()
		WHERE id = $1
	`, message.ChatID, created.ID, created.SentAt); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return created, nil
}

func (r *Repository) GetMessage(ctx context.Context, messageID string) (*model.Message, error) {
	const query = `
		SELECT id, chat_id, sender_id, client_message_id, sender_device_id, sequence_number, type, status,
		       ciphertext, nonce, sender_key_id, encryption_protocol, authentication_tag,
		       encryption_algorithm, associated_data, ratchet_counter, content, metadata,
		       reply_to_message_id, forwarded_from_message_id, forwarded_from_chat_id,
		       expires_at, sent_at, edited_at, deleted_at, deleted_by_id, created_at, updated_at
		FROM messages
		WHERE id = $1
	`

	return r.scanMessage(r.db.QueryRow(ctx, query, messageID))
}

func (r *Repository) UpdateMessage(ctx context.Context, messageID string, updates map[string]interface{}) (*model.Message, error) {
	if len(updates) == 0 {
		return r.GetMessage(ctx, messageID)
	}

	updates, err := validateUpdateColumns("messages", updates)
	if err != nil {
		return nil, err
	}

	setClauses := make([]string, 0)
	args := make([]interface{}, 0)
	argIndex := 1

	for key, value := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, argIndex))
		args = append(args, value)
		argIndex++
	}

	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", argIndex))
	args = append(args, time.Now())
	argIndex++

	args = append(args, messageID)

	query := fmt.Sprintf(`
		UPDATE messages
		SET %s
		WHERE id = $%d
		RETURNING id, chat_id, sender_id, client_message_id, sender_device_id, sequence_number, type, status,
		          ciphertext, nonce, sender_key_id, encryption_protocol, authentication_tag,
		          encryption_algorithm, associated_data, ratchet_counter, content, metadata,
		          reply_to_message_id, forwarded_from_message_id, forwarded_from_chat_id,
		          expires_at, sent_at, edited_at, deleted_at, deleted_by_id, created_at, updated_at
	`, strings.Join(setClauses, ", "), argIndex)

	return r.scanMessage(r.db.QueryRow(ctx, query, args...))
}

func (r *Repository) DeleteMessage(ctx context.Context, messageID, deletedByID string, deleteForEveryone bool) error {
	if deleteForEveryone {
		const query = `
			UPDATE messages
			SET deleted_at = NOW(), deleted_by_id = $1, updated_at = NOW()
			WHERE id = $2
		`
		_, err := r.db.Exec(ctx, query, deletedByID, messageID)
		return err
	}
	return nil
}

func (r *Repository) GetMessagesCursor(ctx context.Context, chatID, userID string, cursor *time.Time, cursorID *string, limit int, before bool) ([]*model.Message, error) {
	if err := r.AssertChatMembership(ctx, chatID, userID); err != nil {
		return nil, err
	}

	var query string
	var args []interface{}

	if before {
		if cursor != nil && cursorID != nil {
			query = `
				SELECT id, chat_id, sender_id, client_message_id, sender_device_id, sequence_number, type, status,
				       ciphertext, nonce, sender_key_id, encryption_protocol, authentication_tag,
				       encryption_algorithm, associated_data, ratchet_counter, content, metadata,
				       reply_to_message_id, forwarded_from_message_id, forwarded_from_chat_id,
				       expires_at, sent_at, edited_at, deleted_at, deleted_by_id, created_at, updated_at
				FROM messages
				WHERE chat_id = $1 AND deleted_at IS NULL
				  AND (sent_at < $2 OR (sent_at = $2 AND id < $3))
				ORDER BY sent_at DESC, id DESC
				LIMIT $4
			`
			args = []interface{}{chatID, cursor, cursorID, limit}
		} else {
			query = `
				SELECT id, chat_id, sender_id, client_message_id, sender_device_id, sequence_number, type, status,
				       ciphertext, nonce, sender_key_id, encryption_protocol, authentication_tag,
				       encryption_algorithm, associated_data, ratchet_counter, content, metadata,
				       reply_to_message_id, forwarded_from_message_id, forwarded_from_chat_id,
				       expires_at, sent_at, edited_at, deleted_at, deleted_by_id, created_at, updated_at
				FROM messages
				WHERE chat_id = $1 AND deleted_at IS NULL
				ORDER BY sent_at DESC, id DESC
				LIMIT $2
			`
			args = []interface{}{chatID, limit}
		}
		query = `
			SELECT * FROM (` + query + `) ordered_messages
			ORDER BY sent_at ASC, id ASC
		`
	} else {
		if cursor != nil && cursorID != nil {
			query = `
				SELECT id, chat_id, sender_id, client_message_id, sender_device_id, sequence_number, type, status,
				       ciphertext, nonce, sender_key_id, encryption_protocol, authentication_tag,
				       encryption_algorithm, associated_data, ratchet_counter, content, metadata,
				       reply_to_message_id, forwarded_from_message_id, forwarded_from_chat_id,
				       expires_at, sent_at, edited_at, deleted_at, deleted_by_id, created_at, updated_at
				FROM messages
				WHERE chat_id = $1 AND deleted_at IS NULL
				  AND (sent_at > $2 OR (sent_at = $2 AND id > $3))
				ORDER BY sent_at ASC, id ASC
				LIMIT $4
			`
			args = []interface{}{chatID, cursor, cursorID, limit}
		} else {
			query = `
				SELECT id, chat_id, sender_id, client_message_id, sender_device_id, sequence_number, type, status,
				       ciphertext, nonce, sender_key_id, encryption_protocol, authentication_tag,
				       encryption_algorithm, associated_data, ratchet_counter, content, metadata,
				       reply_to_message_id, forwarded_from_message_id, forwarded_from_chat_id,
				       expires_at, sent_at, edited_at, deleted_at, deleted_by_id, created_at, updated_at
				FROM messages
				WHERE chat_id = $1 AND deleted_at IS NULL
				ORDER BY sent_at ASC, id ASC
				LIMIT $2
			`
			args = []interface{}{chatID, limit}
		}
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	messages := make([]*model.Message, 0)
	for rows.Next() {
		message, err := r.scanMessage(rows)
		if err != nil {
			return nil, err
		}
		messages = append(messages, message)
	}

	return messages, rows.Err()
}

// ============================================================================
// ATTACHMENT OPERATIONS
// ============================================================================

func (r *Repository) CreateAttachment(ctx context.Context, attachment *model.Attachment) (*model.Attachment, error) {
	attachment.ID = uuid.NewString()
	attachment.CreatedAt = time.Now()

	const query = `
		INSERT INTO attachments (
			id, message_id, media_file_id, kind, file_name, mime_type,
			size_bytes, width, height, duration_seconds, thumbnail_file_id, metadata, created_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id, message_id, media_file_id, kind, file_name, mime_type,
		          size_bytes, width, height, duration_seconds, thumbnail_file_id, metadata, created_at
	`

	return r.scanAttachment(r.db.QueryRow(ctx, query,
		attachment.ID,
		attachment.MessageID,
		attachment.MediaFileID,
		attachment.Kind,
		attachment.FileName,
		attachment.MimeType,
		attachment.SizeBytes,
		attachment.Width,
		attachment.Height,
		attachment.DurationSeconds,
		attachment.ThumbnailFileID,
		attachment.Metadata,
		attachment.CreatedAt,
	))
}

func (r *Repository) GetAttachmentsByMessage(ctx context.Context, messageID string) ([]*model.Attachment, error) {
	const query = `
		SELECT id, message_id, media_file_id, kind, file_name, mime_type,
		       size_bytes, width, height, duration_seconds, thumbnail_file_id, metadata, created_at
		FROM attachments
		WHERE message_id = $1
		ORDER BY created_at ASC
	`

	rows, err := r.db.Query(ctx, query, messageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	attachments := make([]*model.Attachment, 0)
	for rows.Next() {
		attachment, err := r.scanAttachment(rows)
		if err != nil {
			return nil, err
		}
		attachments = append(attachments, attachment)
	}

	return attachments, rows.Err()
}

func (r *Repository) GetAttachmentsByMessageIDs(ctx context.Context, messageIDs []string) (map[string][]*model.Attachment, error) {
	result := make(map[string][]*model.Attachment, len(messageIDs))
	if len(messageIDs) == 0 {
		return result, nil
	}
	const query = `
		SELECT id, message_id, media_file_id, kind, file_name, mime_type,
		       size_bytes, width, height, duration_seconds, thumbnail_file_id, metadata, created_at
		FROM attachments
		WHERE message_id = ANY($1::text[])
		ORDER BY message_id, created_at ASC
	`
	rows, err := r.db.Query(ctx, query, messageIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		attachment, err := r.scanAttachment(rows)
		if err != nil {
			return nil, err
		}
		result[attachment.MessageID] = append(result[attachment.MessageID], attachment)
	}
	return result, rows.Err()
}

// ============================================================================
// REACTION OPERATIONS
// ============================================================================

func (r *Repository) AddReaction(ctx context.Context, reaction *model.Reaction) (*model.Reaction, error) {
	reaction.ID = uuid.NewString()
	reaction.CreatedAt = time.Now()

	const query = `
		INSERT INTO reactions (id, message_id, user_id, reaction_type, created_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (message_id, user_id)
		DO UPDATE SET reaction_type = $4, created_at = $5
		RETURNING id, message_id, user_id, reaction_type, created_at
	`

	return r.scanReaction(r.db.QueryRow(ctx, query,
		reaction.ID,
		reaction.MessageID,
		reaction.UserID,
		reaction.ReactionType,
		reaction.CreatedAt,
	))
}

func (r *Repository) RemoveReaction(ctx context.Context, messageID, userID, reactionType string) error {
	const query = `
		DELETE FROM reactions
		WHERE message_id = $1 AND user_id = $2 AND reaction_type = $3
	`
	_, err := r.db.Exec(ctx, query, messageID, userID, reactionType)
	return err
}

func (r *Repository) GetReactions(ctx context.Context, messageID, reactionType string, limit int) ([]*model.Reaction, error) {
	query := `
		SELECT id, message_id, user_id, reaction_type, created_at
		FROM reactions
		WHERE message_id = $1
	`
	args := []interface{}{messageID}

	if reactionType != "" {
		query += " AND reaction_type = $2"
		args = append(args, reactionType)
	}

	query += " ORDER BY created_at ASC"
	if limit > 0 {
		query += " LIMIT $" + fmt.Sprintf("%d", len(args)+1)
		args = append(args, limit)
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	reactions := make([]*model.Reaction, 0)
	for rows.Next() {
		reaction, err := r.scanReaction(rows)
		if err != nil {
			return nil, err
		}
		reactions = append(reactions, reaction)
	}

	return reactions, rows.Err()
}

// ============================================================================
// READ/DELIVERY RECEIPT OPERATIONS
// ============================================================================

func (r *Repository) MarkAsRead(ctx context.Context, messageID, userID string) (*model.ReadReceipt, error) {
	const query = `
		INSERT INTO read_receipts (id, message_id, user_id, read_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (message_id, user_id)
		DO UPDATE SET read_at = NOW()
		RETURNING id, message_id, user_id, read_at
	`

	id := uuid.NewString()
	return r.scanReadReceipt(r.db.QueryRow(ctx, query, id, messageID, userID))
}

func (r *Repository) MarkAsDelivered(ctx context.Context, messageID, userID string) (*model.DeliveryReceipt, error) {
	const query = `
		INSERT INTO delivery_receipts (id, message_id, user_id, delivered_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (message_id, user_id)
		DO UPDATE SET delivered_at = NOW()
		RETURNING id, message_id, user_id, delivered_at
	`

	id := uuid.NewString()
	return r.scanDeliveryReceipt(r.db.QueryRow(ctx, query, id, messageID, userID))
}

// ============================================================================
// TYPING SESSION OPERATIONS
// ============================================================================

func (r *Repository) SetTypingStatus(ctx context.Context, chatID, userID string, status enums.TypingStatus, expiresAt time.Time) error {
	const query = `
		INSERT INTO typing_sessions (id, chat_id, user_id, status, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (chat_id, user_id)
		DO UPDATE SET status = $4, expires_at = $5
	`

	id := uuid.NewString()
	_, err := r.db.Exec(ctx, query, id, chatID, userID, status, expiresAt)
	return err
}

func (r *Repository) GetTypingSessions(ctx context.Context, chatID string) ([]*model.TypingSession, error) {
	const query = `
		SELECT id, chat_id, user_id, status, expires_at, created_at
		FROM typing_sessions
		WHERE chat_id = $1 AND expires_at > NOW()
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(ctx, query, chatID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sessions := make([]*model.TypingSession, 0)
	for rows.Next() {
		session, err := r.scanTypingSession(rows)
		if err != nil {
			return nil, err
		}
		sessions = append(sessions, session)
	}

	return sessions, rows.Err()
}

// ============================================================================
// PINNED MESSAGE OPERATIONS
// ============================================================================

func (r *Repository) PinMessage(ctx context.Context, chatID, messageID, pinnedByID string) (*model.PinnedMessage, error) {
	const query = `
		INSERT INTO pinned_messages (id, chat_id, message_id, pinned_by_id, pinned_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (chat_id, message_id)
		DO UPDATE SET pinned_by_id = $4, pinned_at = NOW()
		RETURNING id, chat_id, message_id, pinned_by_id, pinned_at
	`

	id := uuid.NewString()
	return r.scanPinnedMessage(r.db.QueryRow(ctx, query, id, chatID, messageID, pinnedByID))
}

func (r *Repository) UnpinMessage(ctx context.Context, chatID, messageID string) error {
	const query = `DELETE FROM pinned_messages WHERE chat_id = $1 AND message_id = $2`
	_, err := r.db.Exec(ctx, query, chatID, messageID)
	return err
}

func (r *Repository) GetPinnedMessages(ctx context.Context, chatID string) ([]*model.PinnedMessage, error) {
	const query = `
		SELECT id, chat_id, message_id, pinned_by_id, pinned_at
		FROM pinned_messages
		WHERE chat_id = $1
		ORDER BY pinned_at DESC
	`

	rows, err := r.db.Query(ctx, query, chatID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	pinned := make([]*model.PinnedMessage, 0)
	for rows.Next() {
		p, err := r.scanPinnedMessage(rows)
		if err != nil {
			return nil, err
		}
		pinned = append(pinned, p)
	}

	return pinned, rows.Err()
}

// ============================================================================
// MESSAGE VERSION OPERATIONS
// ============================================================================

func (r *Repository) CreateMessageVersion(ctx context.Context, version *model.MessageVersion) (*model.MessageVersion, error) {
	version.ID = uuid.NewString()
	version.EditedAt = time.Now().UTC()

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Lock the parent message to serialize concurrent edits and avoid duplicate version numbers.
	if _, err := tx.Exec(ctx, `SELECT 1 FROM messages WHERE id = $1 FOR UPDATE`, version.MessageID); err != nil {
		return nil, err
	}

	const versionQuery = `
		SELECT COALESCE(MAX(version_number), 0) + 1
		FROM message_versions
		WHERE message_id = $1
	`
	if err := tx.QueryRow(ctx, versionQuery, version.MessageID).Scan(&version.VersionNumber); err != nil {
		return nil, err
	}

	const query = `
		INSERT INTO message_versions (
			id, message_id, version_number, ciphertext, nonce, content, metadata, edited_at, edited_by_id
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, message_id, version_number, ciphertext, nonce, content, metadata, edited_at, edited_by_id
	`

	v, err := r.scanMessageVersion(tx.QueryRow(ctx, query,
		version.ID,
		version.MessageID,
		version.VersionNumber,
		version.Ciphertext,
		version.Nonce,
		version.Content,
		version.Metadata,
		version.EditedAt,
		version.EditedByID,
	))
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return v, nil
}

func (r *Repository) GetMessageVersions(ctx context.Context, messageID string) ([]*model.MessageVersion, error) {
	const query = `
		SELECT id, message_id, version_number, ciphertext, nonce, content, metadata, edited_at, edited_by_id
		FROM message_versions
		WHERE message_id = $1
		ORDER BY version_number DESC
	`

	rows, err := r.db.Query(ctx, query, messageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	versions := make([]*model.MessageVersion, 0)
	for rows.Next() {
		version, err := r.scanMessageVersion(rows)
		if err != nil {
			return nil, err
		}
		versions = append(versions, version)
	}

	return versions, rows.Err()
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

func (r *Repository) CreateAttachmentsBatch(ctx context.Context, attachments []*model.Attachment) error {
	if len(attachments) == 0 {
		return nil
	}

	const query = `
		INSERT INTO attachments (
			id, message_id, media_file_id, kind, file_name, mime_type,
			size_bytes, width, height, duration_seconds, thumbnail_file_id, metadata, created_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`

	for _, attachment := range attachments {
		attachment.ID = uuid.NewString()
		attachment.CreatedAt = time.Now()

		_, err := r.db.Exec(ctx, query,
			attachment.ID,
			attachment.MessageID,
			attachment.MediaFileID,
			attachment.Kind,
			attachment.FileName,
			attachment.MimeType,
			attachment.SizeBytes,
			attachment.Width,
			attachment.Height,
			attachment.DurationSeconds,
			attachment.ThumbnailFileID,
			attachment.Metadata,
			attachment.CreatedAt,
		)
		if err != nil {
			return err
		}
	}

	return nil
}

func (r *Repository) MarkMessagesAsDeliveredBatch(ctx context.Context, messageID string, userIDs []string) error {
	if len(userIDs) == 0 {
		return nil
	}

	const query = `
		INSERT INTO delivery_receipts (id, message_id, user_id, delivered_at)
		SELECT gen_random_uuid(), $1, unnest($2::uuid[]), NOW()
		ON CONFLICT (message_id, user_id)
		DO UPDATE SET delivered_at = NOW()
	`

	_, err := r.db.Exec(ctx, query, messageID, userIDs)
	return err
}

// ============================================================================
// TRUSTED CHAT DEVICE AND KEY ENVELOPE OPERATIONS
// ============================================================================

func (r *Repository) RegisterTrustedDevice(ctx context.Context, device *model.TrustedDevice) (*model.TrustedDevice, error) {
	device.ID = uuid.NewString()
	device.Fingerprint = trustedDeviceFingerprint(device.IdentityKeyPublic)
	device.TrustStatus = "TRUSTED"

	const query = `
		INSERT INTO trusted_chat_devices (
			id, user_id, device_name, identity_key_public, signing_key_public, fingerprint, trust_status
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, user_id, device_name, identity_key_public, signing_key_public,
		          fingerprint, trust_status, created_at, last_seen_at, revoked_at
	`
	return r.scanTrustedDevice(r.db.QueryRow(ctx, query,
		device.ID,
		device.UserID,
		device.DeviceName,
		device.IdentityKeyPublic,
		device.SigningKeyPublic,
		device.Fingerprint,
		device.TrustStatus,
	))
}

func (r *Repository) ListTrustedDevices(ctx context.Context, userID string) ([]*model.TrustedDevice, error) {
	const query = `
		SELECT id, user_id, device_name, identity_key_public, signing_key_public,
		       fingerprint, trust_status, created_at, last_seen_at, revoked_at
		FROM trusted_chat_devices
		WHERE user_id = $1
		ORDER BY revoked_at NULLS FIRST, created_at DESC
	`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	devices := make([]*model.TrustedDevice, 0)
	for rows.Next() {
		device, err := r.scanTrustedDevice(rows)
		if err != nil {
			return nil, err
		}
		devices = append(devices, device)
	}
	return devices, rows.Err()
}

func (r *Repository) GetTrustedDevice(ctx context.Context, deviceID string) (*model.TrustedDevice, error) {
	const query = `
		SELECT id, user_id, device_name, identity_key_public, signing_key_public,
		       fingerprint, trust_status, created_at, last_seen_at, revoked_at
		FROM trusted_chat_devices
		WHERE id = $1
	`
	return r.scanTrustedDevice(r.db.QueryRow(ctx, query, deviceID))
}

func (r *Repository) RevokeTrustedDevice(ctx context.Context, userID, deviceID string) error {
	const query = `
		UPDATE trusted_chat_devices
		SET trust_status = 'REVOKED', revoked_at = NOW()
		WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
	`
	tag, err := r.db.Exec(ctx, query, deviceID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperrors.ErrNotFound
	}
	return nil
}

func (r *Repository) PublishDevicePreKey(ctx context.Context, preKey *model.DevicePreKey) (*model.DevicePreKey, error) {
	preKey.ID = uuid.NewString()

	const query = `
		INSERT INTO trusted_chat_prekeys (
			id, device_id, user_id, key_id, public_key, signature, one_time, expires_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (device_id, key_id) DO UPDATE SET
			public_key = EXCLUDED.public_key,
			signature = EXCLUDED.signature,
			one_time = EXCLUDED.one_time,
			expires_at = EXCLUDED.expires_at,
			used_at = NULL
		RETURNING id, device_id, user_id, key_id, public_key, signature, one_time, used_at, created_at, expires_at
	`
	return r.scanDevicePreKey(r.db.QueryRow(ctx, query,
		preKey.ID,
		preKey.DeviceID,
		preKey.UserID,
		preKey.KeyID,
		preKey.PublicKey,
		preKey.Signature,
		preKey.OneTime,
		preKey.ExpiresAt,
	))
}

func (r *Repository) GetPreKeyBundle(ctx context.Context, userID string) (*model.TrustedDevice, *model.DevicePreKey, *model.DevicePreKey, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, nil, nil, err
	}
	defer tx.Rollback(ctx)

	const deviceQuery = `
		SELECT id, user_id, device_name, identity_key_public, signing_key_public,
		       fingerprint, trust_status, created_at, last_seen_at, revoked_at
		FROM trusted_chat_devices
		WHERE user_id = $1 AND revoked_at IS NULL AND trust_status = 'TRUSTED'
		ORDER BY last_seen_at DESC NULLS LAST, created_at DESC
		LIMIT 1
	`
	device, err := r.scanTrustedDevice(tx.QueryRow(ctx, deviceQuery, userID))
	if err != nil {
		return nil, nil, nil, err
	}

	const signedQuery = `
		SELECT id, device_id, user_id, key_id, public_key, signature, one_time, used_at, created_at, expires_at
		FROM trusted_chat_prekeys
		WHERE user_id = $1 AND device_id = $2 AND one_time = false
		  AND (expires_at IS NULL OR expires_at > NOW())
		ORDER BY created_at DESC
		LIMIT 1
	`
	signedPreKey, err := r.scanDevicePreKey(tx.QueryRow(ctx, signedQuery, userID, device.ID))
	if err != nil && !errors.Is(err, apperrors.ErrNotFound) {
		return nil, nil, nil, err
	}

	const oneTimeQuery = `
		SELECT id, device_id, user_id, key_id, public_key, signature, one_time, used_at, created_at, expires_at
		FROM trusted_chat_prekeys
		WHERE user_id = $1 AND device_id = $2 AND one_time = true AND used_at IS NULL
		  AND (expires_at IS NULL OR expires_at > NOW())
		ORDER BY created_at ASC
		LIMIT 1
		FOR UPDATE SKIP LOCKED
	`
	oneTimePreKey, err := r.scanDevicePreKey(tx.QueryRow(ctx, oneTimeQuery, userID, device.ID))
	if err != nil && !errors.Is(err, apperrors.ErrNotFound) {
		return nil, nil, nil, err
	}
	if oneTimePreKey != nil {
		if _, err := tx.Exec(ctx, `UPDATE trusted_chat_prekeys SET used_at = NOW() WHERE id = $1`, oneTimePreKey.ID); err != nil {
			return nil, nil, nil, err
		}
		now := time.Now()
		oneTimePreKey.UsedAt = &now
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, nil, nil, err
	}
	return device, signedPreKey, oneTimePreKey, nil
}

func (r *Repository) CreateMessageKeyEnvelopes(ctx context.Context, envelopes []*model.MessageKey) error {
	if len(envelopes) == 0 {
		return nil
	}

	const query = `
		INSERT INTO trusted_chat_message_key_envelopes (
			id, message_id, recipient_id, recipient_device_id, sender_device_id,
			key_id, algorithm, encrypted_key, nonce, key_version
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (message_id, recipient_device_id) DO UPDATE SET
			key_id = EXCLUDED.key_id,
			algorithm = EXCLUDED.algorithm,
			encrypted_key = EXCLUDED.encrypted_key,
			nonce = EXCLUDED.nonce,
			key_version = EXCLUDED.key_version
	`
	batch := &pgx.Batch{}
	for _, envelope := range envelopes {
		envelope.ID = uuid.NewString()
		if envelope.KeyVersion <= 0 {
			envelope.KeyVersion = 1
		}
		batch.Queue(query,
			envelope.ID,
			envelope.MessageID,
			envelope.RecipientID,
			envelope.RecipientDeviceID,
			envelope.SenderDeviceID,
			envelope.KeyID,
			envelope.Algorithm,
			envelope.EncryptedKey,
			envelope.Nonce,
			envelope.KeyVersion,
		)
	}
	results := r.db.SendBatch(ctx, batch)
	defer results.Close()
	for range envelopes {
		if _, err := results.Exec(); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) GetMessageKeyEnvelopesForUser(ctx context.Context, messageID, userID string) ([]*model.MessageKey, error) {
	const query = `
		SELECT id, message_id, recipient_id, recipient_device_id, sender_device_id,
		       key_id, algorithm, encrypted_key, nonce, key_version, created_at
		FROM trusted_chat_message_key_envelopes
		WHERE message_id = $1 AND recipient_id = $2
		ORDER BY created_at ASC
	`
	rows, err := r.db.Query(ctx, query, messageID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	envelopes := make([]*model.MessageKey, 0)
	for rows.Next() {
		envelope, err := r.scanMessageKey(rows)
		if err != nil {
			return nil, err
		}
		envelopes = append(envelopes, envelope)
	}
	return envelopes, rows.Err()
}

func (r *Repository) GetMessageKeyEnvelopesForUsers(ctx context.Context, messageIDs []string, userID string) (map[string][]*model.MessageKey, error) {
	result := make(map[string][]*model.MessageKey, len(messageIDs))
	if len(messageIDs) == 0 || userID == "" {
		return result, nil
	}
	const query = `
		SELECT id, message_id, recipient_id, recipient_device_id, sender_device_id,
		       key_id, algorithm, encrypted_key, nonce, key_version, created_at
		FROM trusted_chat_message_key_envelopes
		WHERE message_id = ANY($1::text[]) AND recipient_id = $2
		ORDER BY message_id, created_at ASC
	`
	rows, err := r.db.Query(ctx, query, messageIDs, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		envelope, err := r.scanMessageKey(rows)
		if err != nil {
			return nil, err
		}
		result[envelope.MessageID] = append(result[envelope.MessageID], envelope)
	}
	return result, rows.Err()
}

// ============================================================================
// CLEANUP OPERATIONS
// ============================================================================

func (r *Repository) CleanupExpiredTypingSessions(ctx context.Context) error {
	const query = `DELETE FROM typing_sessions WHERE expires_at < NOW()`
	_, err := r.db.Exec(ctx, query)
	return err
}

func (r *Repository) CleanupExpiredMessages(ctx context.Context) error {
	const query = `
		UPDATE messages
		SET deleted_at = NOW(), updated_at = NOW()
		WHERE expires_at IS NOT NULL
		AND expires_at < NOW()
		AND deleted_at IS NULL
	`
	_, err := r.db.Exec(ctx, query)
	return err
}

// ============================================================================
// SCAN HELPERS
// ============================================================================

func (r *Repository) scanChat(row interface{ Scan(dest ...any) error }) (*model.Chat, error) {
	var chat model.Chat
	var chatType, encryptionProtocol string

	err := row.Scan(
		&chat.ID,
		&chatType,
		&chat.Title,
		&chat.Description,
		&chat.AvatarFileID,
		&chat.CreatedByID,
		&encryptionProtocol,
		&chat.MessageTTLSeconds,
		&chat.IsMuted,
		&chat.IsPinned,
		&chat.LastMessageID,
		&chat.LastMessageAt,
		&chat.LastSequenceNumber,
		&chat.MemberCount,
		&chat.CreatedAt,
		&chat.UpdatedAt,
		&chat.DeletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}

	chat.Type = enums.ChatType(chatType)
	chat.EncryptionProtocol = enums.EncryptionProtocol(encryptionProtocol)
	return &chat, nil
}

func (r *Repository) scanChatMember(row interface{ Scan(dest ...any) error }) (*model.ChatMember, error) {
	var member model.ChatMember
	var role string

	err := row.Scan(
		&member.ID,
		&member.ChatID,
		&member.UserID,
		&role,
		&member.Nickname,
		&member.JoinedAt,
		&member.LeftAt,
		&member.IsMuted,
		&member.MuteUntil,
		&member.LastReadMessageID,
		&member.LastReadAt,
		&member.CreatedAt,
		&member.UpdatedAt,
		&member.DeletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}

	member.Role = enums.ChatMemberRole(role)
	return &member, nil
}

func (r *Repository) scanMessage(row interface{ Scan(dest ...any) error }) (*model.Message, error) {
	var message model.Message
	var messageType, messageStatus, encryptionProtocol string
	var content sql.NullString
	var authenticationTag sql.NullString
	var senderDeviceID sql.NullString
	var associatedData sql.NullString
	var ratchetCounter sql.NullInt64

	err := row.Scan(
		&message.ID,
		&message.ChatID,
		&message.SenderID,
		&message.ClientMessageID,
		&senderDeviceID,
		&message.SequenceNumber,
		&messageType,
		&messageStatus,
		&message.Ciphertext,
		&message.Nonce,
		&message.SenderKeyID,
		&encryptionProtocol,
		&authenticationTag,
		&message.EncryptionAlgorithm,
		&associatedData,
		&ratchetCounter,
		&content,
		&message.Metadata,
		&message.ReplyToMessageID,
		&message.ForwardedFromMessageID,
		&message.ForwardedFromChatID,
		&message.ExpiresAt,
		&message.SentAt,
		&message.EditedAt,
		&message.DeletedAt,
		&message.DeletedByID,
		&message.CreatedAt,
		&message.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}

	message.Type = enums.MessageType(messageType)
	message.Status = enums.MessageStatus(messageStatus)
	message.EncryptionProtocol = enums.EncryptionProtocol(encryptionProtocol)
	if content.Valid {
		message.Content = &content.String
	}
	if authenticationTag.Valid {
		message.AuthenticationTag = &authenticationTag.String
	}
	if senderDeviceID.Valid {
		message.SenderDeviceID = &senderDeviceID.String
	}
	if associatedData.Valid {
		message.AssociatedData = &associatedData.String
	}
	if ratchetCounter.Valid {
		message.RatchetCounter = &ratchetCounter.Int64
	}

	return &message, nil
}

func (r *Repository) scanAttachment(row interface{ Scan(dest ...any) error }) (*model.Attachment, error) {
	var attachment model.Attachment
	var kind string
	var fileName, mimeType sql.NullString

	err := row.Scan(
		&attachment.ID,
		&attachment.MessageID,
		&attachment.MediaFileID,
		&kind,
		&fileName,
		&mimeType,
		&attachment.SizeBytes,
		&attachment.Width,
		&attachment.Height,
		&attachment.DurationSeconds,
		&attachment.ThumbnailFileID,
		&attachment.Metadata,
		&attachment.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}

	attachment.Kind = enums.AttachmentKind(kind)
	if fileName.Valid {
		attachment.FileName = &fileName.String
	}
	if mimeType.Valid {
		attachment.MimeType = &mimeType.String
	}

	return &attachment, nil
}

func (r *Repository) scanReaction(row interface{ Scan(dest ...any) error }) (*model.Reaction, error) {
	var reaction model.Reaction
	var reactionType string

	err := row.Scan(
		&reaction.ID,
		&reaction.MessageID,
		&reaction.UserID,
		&reactionType,
		&reaction.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}

	reaction.ReactionType = enums.ReactionType(reactionType)
	return &reaction, nil
}

func (r *Repository) scanReadReceipt(row interface{ Scan(dest ...any) error }) (*model.ReadReceipt, error) {
	var receipt model.ReadReceipt
	err := row.Scan(&receipt.ID, &receipt.MessageID, &receipt.UserID, &receipt.ReadAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	return &receipt, nil
}

func (r *Repository) scanDeliveryReceipt(row interface{ Scan(dest ...any) error }) (*model.DeliveryReceipt, error) {
	var receipt model.DeliveryReceipt
	err := row.Scan(&receipt.ID, &receipt.MessageID, &receipt.UserID, &receipt.DeliveredAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	return &receipt, nil
}

func (r *Repository) scanTypingSession(row interface{ Scan(dest ...any) error }) (*model.TypingSession, error) {
	var session model.TypingSession
	var status string
	err := row.Scan(&session.ID, &session.ChatID, &session.UserID, &status, &session.ExpiresAt, &session.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	session.Status = enums.TypingStatus(status)
	return &session, nil
}

func (r *Repository) scanPinnedMessage(row interface{ Scan(dest ...any) error }) (*model.PinnedMessage, error) {
	var pinned model.PinnedMessage
	err := row.Scan(&pinned.ID, &pinned.ChatID, &pinned.MessageID, &pinned.PinnedByID, &pinned.PinnedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	return &pinned, nil
}

func (r *Repository) scanMessageVersion(row interface{ Scan(dest ...any) error }) (*model.MessageVersion, error) {
	var version model.MessageVersion
	var content sql.NullString
	err := row.Scan(
		&version.ID,
		&version.MessageID,
		&version.VersionNumber,
		&version.Ciphertext,
		&version.Nonce,
		&content,
		&version.Metadata,
		&version.EditedAt,
		&version.EditedByID,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	if content.Valid {
		version.Content = &content.String
	}
	return &version, nil
}

func (r *Repository) scanTrustedDevice(row interface{ Scan(dest ...any) error }) (*model.TrustedDevice, error) {
	var device model.TrustedDevice
	var deviceName, signingKey sql.NullString
	err := row.Scan(
		&device.ID,
		&device.UserID,
		&deviceName,
		&device.IdentityKeyPublic,
		&signingKey,
		&device.Fingerprint,
		&device.TrustStatus,
		&device.CreatedAt,
		&device.LastSeenAt,
		&device.RevokedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	if deviceName.Valid {
		device.DeviceName = &deviceName.String
	}
	if signingKey.Valid {
		device.SigningKeyPublic = &signingKey.String
	}
	return &device, nil
}

func (r *Repository) scanDevicePreKey(row interface{ Scan(dest ...any) error }) (*model.DevicePreKey, error) {
	var preKey model.DevicePreKey
	var signature sql.NullString
	err := row.Scan(
		&preKey.ID,
		&preKey.DeviceID,
		&preKey.UserID,
		&preKey.KeyID,
		&preKey.PublicKey,
		&signature,
		&preKey.OneTime,
		&preKey.UsedAt,
		&preKey.CreatedAt,
		&preKey.ExpiresAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	if signature.Valid {
		preKey.Signature = &signature.String
	}
	return &preKey, nil
}

func (r *Repository) scanMessageKey(row interface{ Scan(dest ...any) error }) (*model.MessageKey, error) {
	var envelope model.MessageKey
	var nonce sql.NullString
	err := row.Scan(
		&envelope.ID,
		&envelope.MessageID,
		&envelope.RecipientID,
		&envelope.RecipientDeviceID,
		&envelope.SenderDeviceID,
		&envelope.KeyID,
		&envelope.Algorithm,
		&envelope.EncryptedKey,
		&nonce,
		&envelope.KeyVersion,
		&envelope.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperrors.ErrNotFound
		}
		return nil, err
	}
	if nonce.Valid {
		envelope.Nonce = &nonce.String
	}
	return &envelope, nil
}

func trustedDeviceFingerprint(identityKey string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(identityKey)))
	return hex.EncodeToString(sum[:])
}
