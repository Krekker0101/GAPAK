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

func TestMemoryStoreKeepsConcurrentSessionTokensValid(t *testing.T) {
	store := NewMemoryStore()
	first, err := store.Issue(context.Background(), "session-1", time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	second, err := store.Issue(context.Background(), "session-1", time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if first == second {
		t.Fatal("independent CSRF issues must produce different tokens")
	}
	for _, token := range []string{first, second} {
		ok, validateErr := store.Validate(context.Background(), "session-1", token)
		if validateErr != nil || !ok {
			t.Fatalf("concurrent token was invalidated, ok=%v err=%v", ok, validateErr)
		}
	}
}

func TestMemoryStoreDeleteRevokesEverySessionToken(t *testing.T) {
	store := NewMemoryStore()
	first, _ := store.Issue(context.Background(), "session-1", time.Minute)
	second, _ := store.Issue(context.Background(), "session-1", time.Minute)
	other, _ := store.Issue(context.Background(), "session-2", time.Minute)
	if err := store.Delete(context.Background(), "session-1"); err != nil {
		t.Fatal(err)
	}
	for _, token := range []string{first, second} {
		if ok, _ := store.Validate(context.Background(), "session-1", token); ok {
			t.Fatal("deleted session token still validates")
		}
	}
	if ok, err := store.Validate(context.Background(), "session-2", other); err != nil || !ok {
		t.Fatalf("deleting one session affected another, ok=%v err=%v", ok, err)
	}
}
