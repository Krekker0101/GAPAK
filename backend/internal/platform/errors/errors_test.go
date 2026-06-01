package errors

import (
	"errors"
	stderrors "errors"
	"testing"
)

func TestWithDetailsClonesError(t *testing.T) {
	first := WithDetails(ErrRateLimited, map[string]any{"limit": 5})
	second := WithDetails(ErrRateLimited, map[string]any{"limit": 10})

	if first == ErrRateLimited || second == ErrRateLimited {
		t.Fatal("WithDetails must not mutate shared sentinel errors")
	}
	if _, exists := ErrRateLimited.Details["limit"]; exists {
		t.Fatal("shared sentinel details must remain untouched")
	}
	if first.Details["limit"] != 5 {
		t.Fatalf("expected first cloned error to keep its own details, got %v", first.Details["limit"])
	}
	if second.Details["limit"] != 10 {
		t.Fatalf("expected second cloned error to keep its own details, got %v", second.Details["limit"])
	}
}

func TestWithDetails_NilErr(t *testing.T) {
	got := WithDetails(nil, map[string]any{"key": "value"})
	if got != nil {
		t.Errorf("WithDetails(nil, ...) = %v, want nil", got)
	}
}

func TestAs_NilErr(t *testing.T) {
	got := As(nil)
	if got != nil {
		t.Errorf("As(nil) = %v, want nil", got)
	}
}

func TestAs_PreservesAppError(t *testing.T) {
	original := New(400, "test.code", "test message")
	got := As(original)
	if got.Code != "test.code" {
		t.Errorf("As(%v).Code = %q, want %q", original, got.Code, "test.code")
	}
}

func TestAs_WrapsUnknownError(t *testing.T) {
	unknown := errors.New("unknown error")
	got := As(unknown)
	if got.Code != "internal.server_error" {
		t.Errorf("As(unknown) = %v, want code internal.server_error", got.Code)
	}
}

func TestAs_WrapsStdlibError(t *testing.T) {
	unknown := stderrors.New("stdlib error")
	got := As(unknown)
	if got.Code != "internal.server_error" {
		t.Errorf("As(stdlib) = %v, want code internal.server_error", got.Code)
	}
}
