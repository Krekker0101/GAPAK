package sync

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Event struct {
	ID            string
	Type          string
	AggregateType string
	AggregateID   string
	Revision      int64
	OccurredAt    time.Time
	Payload       map[string]any
}

type Repository struct{ db *pgxpool.Pool }

func NewRepository(db *pgxpool.Pool) *Repository { return &Repository{db: db} }

func (r *Repository) CurrentRevision(ctx context.Context) (int64, error) {
	var v int64
	if err := r.db.QueryRow(ctx, `SELECT COALESCE(MAX(revision), 0) FROM domain_events`).Scan(&v); err != nil {
		return 0, err
	}
	return v, nil
}

func (r *Repository) Events(ctx context.Context, userID string, after, snapshot int64, limit int) ([]Event, bool, error) {
	if limit <= 0 {
		limit = 20
	}
	rows, err := r.db.Query(ctx, `
        SELECT id::text, event_type, aggregate_type, aggregate_id::text, revision, occurred_at, payload_json
        FROM domain_events de
        WHERE de.revision > $1 AND de.revision <= $2
          AND (
                de.actor_id = $3
                OR $3 = ANY(de.recipient_user_ids)
                OR (de.aggregate_type = 'message' AND EXISTS (
                    SELECT 1 FROM messages m
                    JOIN direct_chat_members dcm ON dcm.chat_id = m.chat_id
                    WHERE m.id = de.aggregate_id AND dcm.user_id = $3 AND dcm.deleted_at IS NULL
                ))
                OR (de.aggregate_type = 'connection' AND EXISTS (
                    SELECT 1 FROM friend_connections fc
                    WHERE fc.id = de.aggregate_id AND (fc.requester_id = $3 OR fc.addressee_id = $3)
                ))
                OR (de.aggregate_type = 'subscription' AND EXISTS (
                    SELECT 1 FROM subscriptions s
                    WHERE s.id = de.aggregate_id AND (s.subscriber_id = $3 OR s.creator_id = $3)
                ))
                OR (de.aggregate_type = 'subscription_request' AND EXISTS (
                    SELECT 1 FROM subscription_requests sr
                    WHERE sr.id = de.aggregate_id AND (sr.subscriber_id = $3 OR sr.creator_id = $3)
                ))
              )
        ORDER BY de.revision ASC
        LIMIT $4`, after, snapshot, userID, limit+1)
	if err != nil {
		return nil, false, err
	}
	defer rows.Close()
	events := make([]Event, 0, limit)
	for rows.Next() {
		var e Event
		var payload []byte
		if err := rows.Scan(&e.ID, &e.Type, &e.AggregateType, &e.AggregateID, &e.Revision, &e.OccurredAt, &payload); err != nil {
			return nil, false, err
		}
		e.Payload = map[string]any{}
		if len(payload) > 0 {
			if err := json.Unmarshal(payload, &e.Payload); err != nil {
				return nil, false, err
			}
		}
		events = append(events, e)
	}
	if err := rows.Err(); err != nil {
		return nil, false, err
	}
	more := len(events) > limit
	if more {
		events = events[:limit]
	}
	return events, more, nil
}

func (r *Repository) LoadChange(ctx context.Context, userID string, e Event) (Change, *DeletedChange, error) {
	switch e.AggregateType {
	case "user":
		return r.userChange(ctx, userID, e)
	case "connection":
		return r.connectionChange(ctx, userID, e)
	case "message":
		return r.messageAndChatChange(ctx, userID, e)
	case "story":
		return r.storyChange(ctx, userID, e)
	case "subscription", "subscription_request":
		return r.subscriptionChange(ctx, userID, e)
	case "live_stream":
		return r.liveChange(ctx, userID, e)
	case "notification":
		return r.notificationChange(ctx, userID, e)
	case "notification_collection":
		return r.notificationCollectionChange(ctx, userID, e)
	default:
		return Change{}, nil, nil
	}
}

func (r *Repository) NotificationsForEvent(ctx context.Context, userID, eventID string, revision int64) ([]Change, error) {
	rows, err := r.db.Query(ctx, `
        SELECT id::text, type, title, body, created_at, read_at, action_url,
               COALESCE(data, '{}'::jsonb), COALESCE(actor_id::text, ''), entity_type, entity_id::text, event_id::text
        FROM notifications
        WHERE user_id = $1 AND event_id = $2
        ORDER BY id`, userID, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Change
	for rows.Next() {
		var id, typ, title, body, actorID string
		var createdAt time.Time
		var readAt *time.Time
		var actionURL, entityType, entityID, eventID2 *string
		var data []byte
		if err := rows.Scan(&id, &typ, &title, &body, &createdAt, &readAt, &actionURL, &data, &actorID, &entityType, &entityID, &eventID2); err != nil {
			return nil, err
		}
		m := map[string]any{"id": id, "type": typ, "title": title, "body": body, "createdAt": createdAt, "readAt": readAt, "actionUrl": actionURL, "actorId": actorID, "entityType": entityType, "entityId": entityID, "eventId": eventID2}
		var metadata map[string]any
		if err := json.Unmarshal(data, &metadata); err != nil {
			return nil, err
		}
		m["data"] = metadata
		out = append(out, Change{ID: id, EntityType: "notification", Operation: "upsert", Revision: revision, UpdatedAt: &createdAt, Data: m})
	}
	return out, rows.Err()
}

func (r *Repository) userChange(ctx context.Context, userID string, e Event) (Change, *DeletedChange, error) {
	var c Change
	c.ID = e.AggregateID
	c.EntityType = "user"
	c.Operation = "upsert"
	c.Revision = e.Revision
	var deletedAt *time.Time
	var m = map[string]any{}
	var updatedAt, createdAt time.Time
	var id, username, displayName string
	var bio, avatar, statusMessage *string
	var role, accountStatus, accountType string
	var anonymous bool
	var emailVerifiedAt *time.Time
	err := r.db.QueryRow(ctx, `SELECT id::text, username, display_name, bio, avatar_file_id::text, status_message, role::text, account_status::text, account_type::text, is_anonymous, email_verified_at, created_at, updated_at, deleted_at FROM users WHERE id = $1`, e.AggregateID).Scan(&id, &username, &displayName, &bio, &avatar, &statusMessage, &role, &accountStatus, &accountType, &anonymous, &emailVerifiedAt, &createdAt, &updatedAt, &deletedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c, &DeletedChange{ID: e.AggregateID, EntityType: "user", Revision: e.Revision, DeletedAt: timePtr(e.OccurredAt)}, nil
		}
		return c, nil, err
	}
	c.UpdatedAt = &updatedAt
	c.DeletedAt = deletedAt
	if deletedAt != nil {
		return c, &DeletedChange{ID: id, EntityType: "user", Revision: e.Revision, DeletedAt: deletedAt}, nil
	}
	m["id"] = id
	m["username"] = username
	m["displayName"] = displayName
	m["bio"] = bio
	m["avatarFileId"] = avatar
	m["statusMessage"] = statusMessage
	m["role"] = role
	m["accountStatus"] = accountStatus
	m["accountType"] = accountType
	m["isAnonymous"] = anonymous
	m["emailVerifiedAt"] = emailVerifiedAt
	m["createdAt"] = createdAt
	m["updatedAt"] = updatedAt
	c.Data = m
	return c, nil, nil
}

func (r *Repository) connectionChange(ctx context.Context, userID string, e Event) (Change, *DeletedChange, error) {
	var c Change
	c.ID = e.AggregateID
	c.EntityType = "connection"
	c.Operation = "upsert"
	c.Revision = e.Revision
	var req, add, status string
	var accepted *time.Time
	var created, updated time.Time
	var deleted *time.Time
	err := r.db.QueryRow(ctx, `SELECT requester_id::text, addressee_id::text, status::text, accepted_at, created_at, updated_at, deleted_at FROM friend_connections WHERE id=$1 AND (requester_id=$2 OR addressee_id=$2)`, e.AggregateID, userID).Scan(&req, &add, &status, &accepted, &created, &updated, &deleted)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c, &DeletedChange{ID: e.AggregateID, EntityType: "connection", Revision: e.Revision, DeletedAt: timePtr(e.OccurredAt)}, nil
		}
		return c, nil, err
	}
	c.UpdatedAt = &updated
	c.DeletedAt = deleted
	if deleted != nil {
		return c, &DeletedChange{ID: e.AggregateID, EntityType: "connection", Revision: e.Revision, DeletedAt: deleted}, nil
	}
	c.Data = map[string]any{"id": e.AggregateID, "requesterId": req, "addresseeId": add, "status": status, "acceptedAt": accepted, "createdAt": created, "updatedAt": updated}
	return c, nil, nil
}

func (r *Repository) messageAndChatChange(ctx context.Context, userID string, e Event) (Change, *DeletedChange, error) {
	var c Change
	c.ID = e.AggregateID
	c.EntityType = "message"
	c.Operation = "upsert"
	c.Revision = e.Revision

	var chatID, senderID, clientID, typ, status, ciphertext, nonce, senderKeyID, encProto, encAlgo string
	var content, senderDeviceID, aad, authTag, replyTo, forwardedFrom *string
	var ratchet *int64
	var metadata []byte
	var seq int64
	var sentAt time.Time
	var edited, expires, deleted, created, updated *time.Time
	var deletedByID *string
	err := r.db.QueryRow(ctx, `SELECT chat_id::text, sender_id::text, client_message_id, sender_device_id::text, sequence_number,
            type::text, status::text, ciphertext, nonce, sender_key_id, encryption_protocol::text, encryption_algorithm,
            associated_data, ratchet_counter, authentication_tag, content, metadata, reply_to_message_id::text,
            forwarded_from_message_id::text, expires_at, sent_at, edited_at, deleted_at, deleted_by_id::text,
            created_at, updated_at
        FROM messages WHERE id=$1`, e.AggregateID).Scan(&chatID, &senderID, &clientID, &senderDeviceID, &seq, &typ, &status, &ciphertext, &nonce, &senderKeyID, &encProto, &encAlgo, &aad, &ratchet, &authTag, &content, &metadata, &replyTo, &forwardedFrom, &expires, &sentAt, &edited, &deleted, &deletedByID, &created, &updated)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c, &DeletedChange{ID: e.AggregateID, EntityType: "message", Revision: e.Revision, DeletedAt: timePtr(e.OccurredAt)}, nil
		}
		return c, nil, err
	}
	if deleted != nil {
		return c, &DeletedChange{ID: e.AggregateID, EntityType: "message", Revision: e.Revision, DeletedAt: deleted}, nil
	}
	c.UpdatedAt = updated
	c.Data = map[string]any{"id": e.AggregateID, "chatId": chatID, "senderId": senderID, "clientMessageId": clientID, "senderDeviceId": senderDeviceID, "sequenceNumber": seq, "type": typ, "status": status, "ciphertext": ciphertext, "nonce": nonce, "senderKeyId": senderKeyID, "encryptionProtocol": encProto, "encryptionAlgorithm": encAlgo, "associatedData": aad, "ratchetCounter": ratchet, "authenticationTag": authTag, "content": content, "metadata": map[string]any{}, "replyToMessageId": replyTo, "forwardedFromMessageId": forwardedFrom, "expiresAt": expires, "sentAt": sentAt, "editedAt": edited, "createdAt": created, "updatedAt": updated}
	if len(metadata) > 0 {
		var m map[string]any
		if err := json.Unmarshal(metadata, &m); err == nil {
			c.Data["metadata"] = m
		}
	}
	return c, nil, nil
}

func (r *Repository) storyChange(ctx context.Context, userID string, e Event) (Change, *DeletedChange, error) {
	var c Change
	c.ID = e.AggregateID
	c.EntityType = "story"
	c.Operation = "upsert"
	c.Revision = e.Revision
	var authorID, mediaID, status, privacy string
	var videoID, trustRoomID, caption, highlight *string
	var allowReplies, allowReactions bool
	var expires, published, created, updated time.Time
	var deleted *time.Time
	err := r.db.QueryRow(ctx, `SELECT author_id::text, media_file_id::text, video_asset_id::text, trust_room_id::text, caption, privacy::text, status::text, allow_replies, allow_reactions, highlight_title, expires_at, published_at, deleted_at, created_at, updated_at FROM stories WHERE id=$1`, e.AggregateID).Scan(&authorID, &mediaID, &videoID, &trustRoomID, &caption, &privacy, &status, &allowReplies, &allowReactions, &highlight, &expires, &published, &deleted, &created, &updated)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c, &DeletedChange{ID: e.AggregateID, EntityType: "story", Revision: e.Revision, DeletedAt: timePtr(e.OccurredAt)}, nil
		}
		return c, nil, err
	}
	if deleted != nil {
		return c, &DeletedChange{ID: e.AggregateID, EntityType: "story", Revision: e.Revision, DeletedAt: deleted}, nil
	}
	c.UpdatedAt = &updated
	c.DeletedAt = deleted
	c.Data = map[string]any{"id": e.AggregateID, "authorId": authorID, "mediaFileId": mediaID, "videoAssetId": videoID, "trustRoomId": trustRoomID, "caption": caption, "privacy": privacy, "status": status, "allowReplies": allowReplies, "allowReactions": allowReactions, "highlightTitle": highlight, "expiresAt": expires, "publishedAt": published, "createdAt": created, "updatedAt": updated}
	return c, nil, nil
}

func (r *Repository) subscriptionChange(ctx context.Context, userID string, e Event) (Change, *DeletedChange, error) {
	var c Change
	c.ID = e.AggregateID
	c.EntityType = "subscription"
	c.Operation = "upsert"
	c.Revision = e.Revision
	if e.AggregateType == "subscription_request" {
		var subscriber, creator, status, message string
		var requested, responded, created, updated time.Time
		if err := r.db.QueryRow(ctx, `SELECT subscriber_id::text, creator_id::text, status::text, COALESCE(message,''), requested_at, COALESCE(responded_at, created_at), created_at, updated_at FROM subscription_requests WHERE id=$1 AND (subscriber_id=$2 OR creator_id=$2)`, e.AggregateID, userID).Scan(&subscriber, &creator, &status, &message, &requested, &responded, &created, &updated); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return c, &DeletedChange{ID: e.AggregateID, EntityType: "subscription", Revision: e.Revision, DeletedAt: timePtr(e.OccurredAt)}, nil
			}
			return c, nil, err
		}
		c.UpdatedAt = &updated
		c.Data = map[string]any{"id": e.AggregateID, "kind": "request", "subscriberId": subscriber, "creatorId": creator, "status": status, "message": message, "requestedAt": requested, "respondedAt": responded, "createdAt": created, "updatedAt": updated}
		return c, nil, nil
	}
	var subscriber, creator, status, typ string
	var subscribed, created, updated time.Time
	if err := r.db.QueryRow(ctx, `SELECT subscriber_id::text, creator_id::text, status::text, subscription_type::text, subscribed_at, created_at, updated_at FROM subscriptions WHERE id=$1 AND (subscriber_id=$2 OR creator_id=$2)`, e.AggregateID, userID).Scan(&subscriber, &creator, &status, &typ, &subscribed, &created, &updated); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c, &DeletedChange{ID: e.AggregateID, EntityType: "subscription", Revision: e.Revision, DeletedAt: timePtr(e.OccurredAt)}, nil
		}
		return c, nil, err
	}
	c.UpdatedAt = &updated
	c.Data = map[string]any{"id": e.AggregateID, "kind": "subscription", "subscriberId": subscriber, "creatorId": creator, "status": status, "subscriptionType": typ, "subscribedAt": subscribed, "createdAt": created, "updatedAt": updated}
	return c, nil, nil
}

func (r *Repository) liveChange(ctx context.Context, userID string, e Event) (Change, *DeletedChange, error) {
	var c Change
	c.ID = e.AggregateID
	c.EntityType = "live"
	c.Operation = "upsert"
	c.Revision = e.Revision
	var host, title, status, visibility string
	var desc, room *string
	var scheduled, started, ended, deleted *time.Time
	var created, updated time.Time
	var viewers int
	if err := r.db.QueryRow(ctx, `SELECT host_user_id::text, trust_room_id::text, title, description, visibility::text, status::text, scheduled_for, started_at, ended_at, viewer_count, deleted_at, created_at, updated_at FROM live_streams WHERE id=$1`, e.AggregateID).Scan(&host, &room, &title, &desc, &visibility, &status, &scheduled, &started, &ended, &viewers, &deleted, &created, &updated); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c, &DeletedChange{ID: e.AggregateID, EntityType: "live", Revision: e.Revision, DeletedAt: timePtr(e.OccurredAt)}, nil
		}
		return c, nil, err
	}
	if deleted != nil {
		return c, &DeletedChange{ID: e.AggregateID, EntityType: "live", Revision: e.Revision, DeletedAt: deleted}, nil
	}
	c.UpdatedAt = &updated
	c.DeletedAt = deleted
	c.Data = map[string]any{"id": e.AggregateID, "hostUserId": host, "trustRoomId": room, "title": title, "description": desc, "visibility": visibility, "status": status, "scheduledFor": scheduled, "startedAt": started, "endedAt": ended, "viewerCount": viewers, "createdAt": created, "updatedAt": updated}
	return c, nil, nil
}

func (r *Repository) notificationChange(ctx context.Context, userID string, e Event) (Change, *DeletedChange, error) {
	var c Change
	c.ID = e.AggregateID
	c.EntityType = "notification"
	c.Operation = "upsert"
	c.Revision = e.Revision
	var typ, title, body, actorID string
	var created, updated time.Time
	var readAt *time.Time
	var actionURL, entityType, entityID *string
	var data []byte
	err := r.db.QueryRow(ctx, `SELECT type,title,body,COALESCE(actor_id::text, ''),created_at,updated_at,read_at,action_url,entity_type,entity_id,COALESCE(data,'{}'::jsonb) FROM notifications WHERE id=$1 AND user_id=$2`, e.AggregateID, userID).Scan(&typ, &title, &body, &actorID, &created, &updated, &readAt, &actionURL, &entityType, &entityID, &data)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return c, &DeletedChange{ID: e.AggregateID, EntityType: "notification", Revision: e.Revision, DeletedAt: timePtr(e.OccurredAt)}, nil
		}
		return c, nil, err
	}
	var metadata map[string]any
	if len(data) > 0 {
		if err := json.Unmarshal(data, &metadata); err != nil {
			return c, nil, err
		}
	}
	c.UpdatedAt = &updated
	c.Data = map[string]any{"id": e.AggregateID, "type": typ, "title": title, "body": body, "actorId": actorID, "createdAt": created, "updatedAt": updated, "readAt": readAt, "actionUrl": actionURL, "entityType": entityType, "entityId": entityID, "data": metadata}
	return c, nil, nil
}

func (r *Repository) notificationCollectionChange(ctx context.Context, userID string, e Event) (Change, *DeletedChange, error) {
	c := Change{ID: userID, EntityType: "notification", Operation: "readAll", Revision: e.Revision, UpdatedAt: timePtr(e.OccurredAt), Data: map[string]any{"readAll": true, "readAt": e.OccurredAt}}
	return c, nil, nil
}

func timePtr(t time.Time) *time.Time { t = t.UTC(); return &t }

func (r *Repository) ChatChange(ctx context.Context, userID, chatID string, revision int64) (Change, error) {
	var c Change
	c.ID = chatID
	c.EntityType = "chat"
	c.Operation = "upsert"
	c.Revision = revision
	var typ, title, description, createdBy string
	var avatar, lastMessage *string
	var protocol string
	var ttl *int
	var muted, pinned bool
	var lastAt *time.Time
	var seq int64
	var members int
	var created, updated time.Time
	var deleted *time.Time
	if err := r.db.QueryRow(ctx, `
		SELECT c.type::text, c.title, c.description, c.avatar_file_id::text, c.created_by_id::text,
		       c.encryption_protocol::text, c.message_ttl_seconds, c.is_muted, c.is_pinned,
		       c.last_message_id::text, c.last_message_at, c.last_sequence_number, c.member_count,
		       c.created_at, c.updated_at, c.deleted_at
		FROM direct_chats c
		JOIN direct_chat_members m ON m.chat_id = c.id
		WHERE c.id = $1 AND m.user_id = $2 AND m.deleted_at IS NULL`, chatID, userID).Scan(&typ, &title, &description, &avatar, &createdBy, &protocol, &ttl, &muted, &pinned, &lastMessage, &lastAt, &seq, &members, &created, &updated, &deleted); err != nil {
		return c, err
	}
	c.UpdatedAt = &updated
	c.DeletedAt = deleted
	c.Data = map[string]any{"id": chatID, "type": typ, "title": title, "description": description, "avatarFileId": avatar, "createdById": createdBy, "encryptionProtocol": protocol, "messageTtlSeconds": ttl, "isMuted": muted, "isPinned": pinned, "lastMessageId": lastMessage, "lastMessageAt": lastAt, "lastSequenceNumber": seq, "memberCount": members, "createdAt": created, "updatedAt": updated}
	return c, nil
}
