package sync

import (
	"testing"
	"time"
)

func TestCursorRoundTripAndBinding(t *testing.T) {
	codec := NewCursorCodec("test-secret")
	now := time.Date(2026, 8, 13, 10, 0, 0, 0, time.UTC)
	raw, err := codec.Encode("user-1", 42, 10, now)
	if err != nil {
		t.Fatal(err)
	}
	snapshot, after, err := codec.Decode("user-1", raw, now.Add(time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if snapshot != 42 || after != 10 {
		t.Fatalf("unexpected cursor state: %d/%d", snapshot, after)
	}
	if _, _, err := codec.Decode("user-2", raw, now.Add(time.Minute)); err == nil {
		t.Fatal("cursor should be bound to user")
	}
}

func TestCursorExpired(t *testing.T) {
	codec := NewCursorCodec("test-secret")
	now := time.Date(2026, 8, 13, 10, 0, 0, 0, time.UTC)
	raw, err := codec.Encode("user-1", 42, 10, now)
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := codec.Decode("user-1", raw, now.Add(25*time.Hour)); err == nil {
		t.Fatal("expired cursor must fail")
	}
}
