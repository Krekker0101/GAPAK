package csrf

import (
	"context"
	"testing"
	"time"
)

func TestMemoryStoreBindsTokenToSession(t *testing.T) {
	store := NewMemoryStore()
	token, err := store.Issue(context.Background(), "session-1", time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	ok, err := store.Validate(context.Background(), "session-1", token)
	if err != nil || !ok {
		t.Fatalf("expected token to validate, ok=%v err=%v", ok, err)
	}
	ok, err = store.Validate(context.Background(), "session-2", token)
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Fatal("token validated for wrong session")
	}
	ok, err = store.Validate(context.Background(), "session-1", token+"x")
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Fatal("tampered token validated")
	}
}

func TestMemoryStoreExpiresToken(t *testing.T) {
	store := NewMemoryStore()
	token, err := store.Issue(context.Background(), "session-1", time.Millisecond)
	if err != nil {
		t.Fatal(err)
	}
	time.Sleep(5 * time.Millisecond)
	ok, err := store.Validate(context.Background(), "session-1", token)
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Fatal("expired token validated")
	}
}

func TestMemoryStoreBootstrapToken(t *testing.T) {
	store := NewMemoryStore()
	token, err := store.Issue(context.Background(), "", time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	ok, err := store.Validate(context.Background(), "", token)
	if err != nil || !ok {
		t.Fatalf("expected bootstrap token to validate, ok=%v err=%v", ok, err)
	}
}
