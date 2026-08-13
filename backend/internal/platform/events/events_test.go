package events

import "testing"

func TestNotificationDataDoesNotLeakE2EECiphertext(t *testing.T) {
	event := DomainEvent{
		ID: "evt", Type: MessageCreated, AggregateType: "message", AggregateID: "550e8400-e29b-41d4-a716-446655440000",
		ActorID: strPtr("660e8400-e29b-41d4-a716-446655440000"), RecipientUserIDs: []string{"770e8400-e29b-41d4-a716-446655440000"},
		Payload: map[string]any{"messageId": "550e8400-e29b-41d4-a716-446655440000", "chatId": "880e8400-e29b-41d4-a716-446655440000", "ciphertext": "SECRET", "nonce": "SECRET2", "sequence": int64(4)},
	}
	data := buildNotificationData(event, event.RecipientUserIDs[0])
	if _, ok := data["ciphertext"]; ok {
		t.Fatal("ciphertext leaked into notification data")
	}
	if _, ok := data["nonce"]; ok {
		t.Fatal("nonce leaked into notification data")
	}
	if got := data["messageId"]; got != event.AggregateID {
		t.Fatalf("messageId=%v", got)
	}
}

func TestNotificationDedupeKeyIsStable(t *testing.T) {
	e := DomainEvent{Type: ConnectionRequestCreated, AggregateType: "connection", AggregateID: "550e8400-e29b-41d4-a716-446655440000", IdempotencyKey: "k"}
	a := notificationDedupeKey(e, "770e8400-e29b-41d4-a716-446655440000")
	b := notificationDedupeKey(e, "770e8400-e29b-41d4-a716-446655440000")
	if a == "" || a != b {
		t.Fatal("dedupe key is not stable")
	}
}

func strPtr(v string) *string { return &v }
