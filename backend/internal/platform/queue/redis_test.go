package queue

import (
	"context"
	"errors"
	"testing"
	"time"

	apperrors "github.com/gapak/backend/internal/platform/errors"
)

func TestRedisQueueUnavailableWithoutClient(t *testing.T) {
	t.Parallel()

	q := NewRedisQueue(nil)
	if q.Available() {
		t.Fatal("queue should report unavailable when redis client is nil")
	}

	err := q.Publish(context.Background(), "queue:test", Envelope{ID: "job-1"})
	if !errors.Is(err, apperrors.ErrDependencyUnavailable) {
		t.Fatalf("expected dependency unavailable on publish, got %v", err)
	}

	envelope, err := q.Consume(context.Background(), "queue:test", time.Millisecond)
	if !errors.Is(err, apperrors.ErrDependencyUnavailable) {
		t.Fatalf("expected dependency unavailable on consume, got %v", err)
	}
	if envelope != nil {
		t.Fatalf("expected no envelope when queue is unavailable, got %+v", envelope)
	}

	err = q.PublishLiveEvent(context.Background(), "channel:test", map[string]any{"type": "ping"})
	if !errors.Is(err, apperrors.ErrDependencyUnavailable) {
		t.Fatalf("expected dependency unavailable on live publish, got %v", err)
	}
}
