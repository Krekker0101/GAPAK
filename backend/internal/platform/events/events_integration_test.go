package events

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestEmitTxPersistsNotificationAndIsIdempotent(t *testing.T) {
	dsn := os.Getenv("GAPAK_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("GAPAK_TEST_DATABASE_URL not configured")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := db.Ping(ctx); err != nil {
		t.Fatal(err)
	}

	actor, recipient := uuid.New(), uuid.New()
	for id, username := range map[uuid.UUID]string{actor: "evt_actor_" + actor.String()[:8], recipient: "evt_rec_" + recipient.String()[:8]} {
		_, err := db.Exec(ctx, `INSERT INTO users(id, username, display_name, password_hash, updated_at) VALUES($1,$2,$3,$4,NOW())`, id, username, username, "integration-test")
		if err != nil {
			t.Fatal(err)
		}
		defer db.Exec(context.Background(), `DELETE FROM users WHERE id=$1`, id)
	}

	deviceID := uuid.New()
	if _, err := db.Exec(ctx, `INSERT INTO push_device_subscriptions(id,user_id,device_id,platform,provider,endpoint,credential_ciphertext,credential_nonce,public_key,credential_hash,created_at,updated_at) VALUES($1,$2,'evt-device','web','webpush','https://push.invalid/example','cipher','nonce','public',repeat('d',64),NOW(),NOW())`, deviceID, recipient); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), `DELETE FROM push_device_subscriptions WHERE id=$1`, deviceID)

	tx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	eventID := uuid.NewString()
	ev := DomainEvent{
		ID: eventID, Type: ConnectionRequestCreated, AggregateType: "connection", AggregateID: uuid.NewString(),
		ActorID: strPtr(actor.String()), RecipientUserIDs: []string{recipient.String()},
		Payload:        map[string]any{"connectionId": uuid.NewString(), "requesterId": actor.String()},
		IdempotencyKey: "integration:" + eventID,
	}
	if err := NewNotifier().EmitTx(ctx, tx, ev); err != nil {
		tx.Rollback(ctx)
		t.Fatal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}

	var notificationCount int
	if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND event_id=$2`, recipient, eventID).Scan(&notificationCount); err != nil {
		t.Fatal(err)
	}
	if notificationCount != 1 {
		t.Fatalf("notificationCount=%d", notificationCount)
	}
	var outboxCount int
	if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM push_outbox WHERE notification_id=(SELECT id FROM notifications WHERE user_id=$1 AND event_id=$2 LIMIT 1) AND subscription_id=$3`, recipient, eventID, deviceID).Scan(&outboxCount); err != nil {
		t.Fatal(err)
	}
	if outboxCount != 1 {
		t.Fatalf("push outbox count=%d", outboxCount)
	}

	tx, err = db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err := NewNotifier().EmitTx(ctx, tx, ev); err != nil {
		tx.Rollback(ctx)
		t.Fatal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND event_id=$2`, recipient, eventID).Scan(&notificationCount); err != nil {
		t.Fatal(err)
	}
	if notificationCount != 1 {
		t.Fatalf("duplicate notification created: %d", notificationCount)
	}
	if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM push_outbox WHERE notification_id=(SELECT id FROM notifications WHERE user_id=$1 AND event_id=$2 LIMIT 1) AND subscription_id=$3`, recipient, eventID, deviceID).Scan(&outboxCount); err != nil {
		t.Fatal(err)
	}
	if outboxCount != 1 {
		t.Fatalf("duplicate push outbox created: %d", outboxCount)
	}

	tx, err = db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	rollbackEvent := DomainEvent{ID: uuid.NewString(), Type: ConnectionRequestCreated, AggregateType: "connection", AggregateID: uuid.NewString(), ActorID: strPtr(actor.String()), RecipientUserIDs: []string{recipient.String()}, Payload: map[string]any{"connectionId": uuid.NewString()}, IdempotencyKey: "rollback:" + uuid.NewString()}
	if err := NewNotifier().EmitTx(ctx, tx, rollbackEvent); err != nil {
		_ = tx.Rollback(ctx)
		t.Fatal(err)
	}
	if err := tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	var rollbackNotifications, rollbackOutbox int
	if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM notifications WHERE event_id=$1`, rollbackEvent.ID).Scan(&rollbackNotifications); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM push_outbox WHERE notification_id IN (SELECT id FROM notifications WHERE event_id=$1)`, rollbackEvent.ID).Scan(&rollbackOutbox); err != nil {
		t.Fatal(err)
	}
	if rollbackNotifications != 0 || rollbackOutbox != 0 {
		t.Fatalf("rollback leaked notification=%d outbox=%d", rollbackNotifications, rollbackOutbox)
	}
}
