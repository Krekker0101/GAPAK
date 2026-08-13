package events

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/gapak/backend/internal/platform/observability"
)

// EventType is the canonical internal domain-event vocabulary.
type EventType string

const (
	UserUpdated               EventType = "USER_UPDATED"
	ConnectionRequestCreated  EventType = "CONNECTION_REQUEST_CREATED"
	ConnectionRequestAccepted EventType = "CONNECTION_REQUEST_ACCEPTED"
	ConnectionRemoved         EventType = "CONNECTION_REMOVED"
	MessageCreated            EventType = "MESSAGE_CREATED"
	MessageEdited             EventType = "MESSAGE_EDITED"
	MessageDeleted            EventType = "MESSAGE_DELETED"
	MessageReactionCreated    EventType = "MESSAGE_REACTION_CREATED"
	MessageReactionRemoved    EventType = "MESSAGE_REACTION_REMOVED"
	MessageRead               EventType = "MESSAGE_READ"
	StoryCreated              EventType = "STORY_CREATED"
	StoryReactionCreated      EventType = "STORY_REACTION_CREATED"
	StoryViewed               EventType = "STORY_VIEWED"
	SubscriptionCreated       EventType = "SUBSCRIPTION_CREATED"
	SubscriptionAccepted      EventType = "SUBSCRIPTION_ACCEPTED"
	LiveStarted               EventType = "LIVE_STARTED"
	LiveInviteCreated         EventType = "LIVE_INVITE_CREATED"
	MediaReady                EventType = "MEDIA_READY"
	TrustedDeviceAdded        EventType = "TRUSTED_DEVICE_ADDED"
	TrustedDeviceRevoked      EventType = "TRUSTED_DEVICE_REVOKED"
	SecurityAlert             EventType = "SECURITY_ALERT"
	SystemNotification        EventType = "SYSTEM_NOTIFICATION"
	NotificationRead          EventType = "NOTIFICATION_READ"
	NotificationReadAll       EventType = "NOTIFICATION_READ_ALL"
	StoryDeleted              EventType = "STORY_DELETED"
	LiveEnded                 EventType = "LIVE_ENDED"
	SubscriptionRemoved       EventType = "SUBSCRIPTION_REMOVED"
	ChatDeleted               EventType = "CHAT_DELETED"
)

var allowedTypes = map[EventType]struct{}{
	UserUpdated: {}, ConnectionRequestCreated: {}, ConnectionRequestAccepted: {}, ConnectionRemoved: {},
	MessageCreated: {}, MessageEdited: {}, MessageDeleted: {}, MessageReactionCreated: {}, MessageReactionRemoved: {}, MessageRead: {},
	StoryCreated: {}, StoryReactionCreated: {}, StoryViewed: {}, SubscriptionCreated: {}, SubscriptionAccepted: {},
	LiveStarted: {}, LiveInviteCreated: {}, MediaReady: {}, TrustedDeviceAdded: {}, TrustedDeviceRevoked: {},
	SecurityAlert: {}, SystemNotification: {}, NotificationRead: {}, NotificationReadAll: {}, StoryDeleted: {}, LiveEnded: {}, SubscriptionRemoved: {}, ChatDeleted: {},
}

// DomainEvent is the canonical backend event representation.
type DomainEvent struct {
	ID               string
	Type             EventType
	AggregateType    string
	AggregateID      string
	ActorID          *string
	RecipientUserIDs []string
	Payload          map[string]any
	Sequence         *int64
	IdempotencyKey   string
	CorrelationID    string
	OccurredAt       time.Time
}

// EventBus is the transactional event-emission abstraction used by domain repositories.
type EventBus interface {
	EmitTx(context.Context, pgx.Tx, DomainEvent) error
}

// Notifier writes durable domain events and notification records in the same DB transaction.
// Realtime delivery is represented in realtime_events so the existing worker/Redis fan-out remains authoritative.
type Notifier struct{}

func NewNotifier() *Notifier { return &Notifier{} }

func (n *Notifier) EmitTx(ctx context.Context, tx pgx.Tx, event DomainEvent) error {
	if tx == nil {
		return fmt.Errorf("event transaction is nil")
	}
	if _, ok := allowedTypes[event.Type]; !ok {
		return fmt.Errorf("unsupported domain event type %q", event.Type)
	}
	event.ID = strings.TrimSpace(event.ID)
	if event.ID == "" {
		event.ID = uuid.NewString()
	}
	if !uuidLike(event.AggregateID) {
		return fmt.Errorf("aggregate id must be a UUID: %q", event.AggregateID)
	}
	if event.IdempotencyKey == "" {
		event.IdempotencyKey = defaultIdempotencyKey(event)
	}
	if len(event.IdempotencyKey) > 255 {
		return fmt.Errorf("idempotency key too long")
	}
	event.CorrelationID = observability.ValidExternalID(event.CorrelationID)
	if event.OccurredAt.IsZero() {
		event.OccurredAt = time.Now().UTC()
	} else {
		event.OccurredAt = event.OccurredAt.UTC()
	}
	if event.Payload == nil {
		event.Payload = map[string]any{}
	}

	payload, err := json.Marshal(event.Payload)
	if err != nil {
		return fmt.Errorf("marshal domain event payload: %w", err)
	}
	recipientIDs := uniqueStrings(event.RecipientUserIDs)
	const insertEvent = `
        INSERT INTO domain_events (
            id, event_type, aggregate_type, aggregate_id, actor_id,
            recipient_user_ids, payload_json, sequence, idempotency_key,
            correlation_id, occurred_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::uuid[], $7::jsonb, $8, $9, $10, $11)
        ON CONFLICT (idempotency_key) DO NOTHING`
	tag, err := tx.Exec(ctx, insertEvent,
		event.ID, string(event.Type), event.AggregateType, event.AggregateID, event.ActorID,
		recipientArray(recipientIDs), payload, event.Sequence, event.IdempotencyKey,
		nullableString(event.CorrelationID), event.OccurredAt,
	)
	if err != nil {
		return fmt.Errorf("persist domain event: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil
	}

	if len(recipientIDs) == 0 {
		return nil
	}
	if !policyCreatesNotification(event.Type) {
		return nil
	}

	for _, recipientID := range recipientIDs {
		if event.ActorID != nil && *event.ActorID == recipientID && suppressSelfNotification(event.Type) {
			continue
		}
		notificationID := uuid.NewString()
		dedupeKey := notificationDedupeKey(event, recipientID)
		titleKey, bodyKey := notificationCopy(event.Type)
		data := buildNotificationData(event, recipientID)
		dataJSON, err := json.Marshal(data)
		if err != nil {
			return fmt.Errorf("marshal notification data: %w", err)
		}
		entityType := event.AggregateType
		entityID := event.AggregateID
		const insertNotification = `
            INSERT INTO notifications (
                id, user_id, actor_id, entity_type, entity_id, type, title, body,
                data, is_read, created_at, action_url, event_id, dedupe_key
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, FALSE, $10, NULL, $11, $12)
            ON CONFLICT (user_id, dedupe_key) DO NOTHING`
		var persistedNotificationID string
		if err := tx.QueryRow(ctx, insertNotification+" RETURNING id::text",
			notificationID, recipientID, event.ActorID, entityType, entityID,
			notificationType(event.Type), titleKey, bodyKey, dataJSON, event.OccurredAt, event.ID, dedupeKey,
		).Scan(&persistedNotificationID); err != nil {
			if err == pgx.ErrNoRows {
				continue
			}
			return fmt.Errorf("persist notification: %w", err)
		}
		notificationID = persistedNotificationID

		realtimePayload := map[string]any{
			"notificationId":     notificationID,
			"recipient_user_ids": []string{recipientID},
			"notification": map[string]any{
				"id":         notificationID,
				"type":       notificationType(event.Type),
				"title":      titleKey,
				"body":       bodyKey,
				"entityType": entityType,
				"entityId":   entityID,
				"actorId":    valueOrNil(event.ActorID),
				"data":       data,
				"createdAt":  event.OccurredAt,
			},
		}
		rtRaw, err := json.Marshal(realtimePayload)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
            INSERT INTO realtime_events (
                id, channel, aggregate_type, aggregate_id, event_type, payload_json, relay_status, updated_at
            )
            VALUES ($1, $2, 'notification', $3, 'notification.created', $4::jsonb, 'PENDING', NOW())
            ON CONFLICT (id) DO NOTHING
        `, uuid.NewString(), "notifications:"+recipientID, event.AggregateID, rtRaw); err != nil {
			return fmt.Errorf("persist notification realtime event: %w", err)
		}

		if _, err := tx.Exec(ctx, `
            INSERT INTO push_outbox (id, notification_id, subscription_id, provider, status, attempts, max_attempts, available_at, created_at, updated_at)
            SELECT md5($1::text || s.id::text)::uuid, $1, s.id, s.provider, 'PENDING', 0, 8, NOW(), NOW(), NOW()
            FROM push_device_subscriptions s
            WHERE s.user_id = $2
              AND s.revoked_at IS NULL
              AND (s.expiration_at IS NULL OR s.expiration_at > NOW())
              AND s.provider IN ('webpush','fcm','apns')
            ON CONFLICT (notification_id, subscription_id) DO NOTHING
        `, notificationID, recipientID); err != nil {
			return fmt.Errorf("persist push outbox: %w", err)
		}
	}
	return nil
}

func notificationDedupeKey(event DomainEvent, recipientID string) string {
	seed := event.IdempotencyKey + ":" + recipientID
	sum := sha256.Sum256([]byte(seed))
	return hex.EncodeToString(sum[:])
}

func defaultIdempotencyKey(event DomainEvent) string {
	return string(event.Type) + ":" + event.AggregateID + ":" + strings.Join(uniqueStrings(event.RecipientUserIDs), ",")
}

func notificationCopy(eventType EventType) (string, string) {
	switch eventType {
	case ConnectionRequestCreated:
		return "notifications.connectionRequest.title", "notifications.connectionRequest.body"
	case ConnectionRequestAccepted:
		return "notifications.connectionAccepted.title", "notifications.connectionAccepted.body"
	case ConnectionRemoved:
		return "notifications.connectionRemoved.title", "notifications.connectionRemoved.body"
	case MessageCreated:
		return "notifications.message.title", "notifications.message.body"
	case MessageEdited:
		return "notifications.messageEdited.title", "notifications.messageEdited.body"
	case MessageDeleted:
		return "notifications.messageDeleted.title", "notifications.messageDeleted.body"
	case MessageReactionCreated:
		return "notifications.messageReaction.title", "notifications.messageReaction.body"
	case MessageReactionRemoved:
		return "notifications.messageReactionRemoved.title", "notifications.messageReactionRemoved.body"
	case MessageRead:
		return "notifications.messageRead.title", "notifications.messageRead.body"
	case StoryCreated:
		return "notifications.story.title", "notifications.story.body"
	case StoryReactionCreated:
		return "notifications.storyReaction.title", "notifications.storyReaction.body"
	case StoryViewed:
		return "notifications.storyViewed.title", "notifications.storyViewed.body"
	case SubscriptionCreated:
		return "notifications.subscriptionCreated.title", "notifications.subscriptionCreated.body"
	case SubscriptionAccepted:
		return "notifications.subscriptionAccepted.title", "notifications.subscriptionAccepted.body"
	case LiveStarted:
		return "notifications.liveStarted.title", "notifications.liveStarted.body"
	case LiveInviteCreated:
		return "notifications.liveInvite.title", "notifications.liveInvite.body"
	case MediaReady:
		return "notifications.mediaReady.title", "notifications.mediaReady.body"
	case TrustedDeviceAdded:
		return "notifications.trustedDeviceAdded.title", "notifications.trustedDeviceAdded.body"
	case TrustedDeviceRevoked:
		return "notifications.trustedDeviceRevoked.title", "notifications.trustedDeviceRevoked.body"
	case SecurityAlert:
		return "notifications.securityAlert.title", "notifications.securityAlert.body"
	default:
		return "notifications.system.title", "notifications.system.body"
	}
}

func notificationType(eventType EventType) string { return strings.ToLower(string(eventType)) }
func policyCreatesNotification(eventType EventType) bool {
	switch eventType {
	case MessageRead, StoryViewed, NotificationRead, NotificationReadAll, StoryDeleted, LiveEnded, SubscriptionRemoved, ChatDeleted:
		return false
	default:
		return true
	}
}
func suppressSelfNotification(eventType EventType) bool {
	switch eventType {
	case UserUpdated, MessageCreated, MessageEdited, MessageDeleted, MessageReactionCreated, MessageReactionRemoved, MessageRead, StoryReactionCreated, StoryViewed, MediaReady:
		return true
	default:
		return false
	}
}
func buildNotificationData(event DomainEvent, recipientID string) map[string]any {
	data := map[string]any{
		"eventId":         event.ID,
		"eventType":       string(event.Type),
		"aggregateType":   event.AggregateType,
		"aggregateId":     event.AggregateID,
		"recipientUserId": recipientID,
	}
	// Never copy E2EE ciphertext/nonces/tags into notifications.
	for _, key := range []string{"messageId", "chatId", "storyId", "connectionId", "subscriptionId", "liveStreamId", "mediaFileId", "sequence", "reactionType"} {
		if value, ok := event.Payload[key]; ok {
			data[key] = value
		}
	}
	return data
}
func uniqueStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out
}
func recipientArray(values []string) []string { return uniqueStrings(values) }
func uuidLike(value string) bool              { _, err := uuid.Parse(value); return err == nil }
func nullableString(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
func valueOrNil(v *string) any {
	if v == nil {
		return nil
	}
	return *v
}
