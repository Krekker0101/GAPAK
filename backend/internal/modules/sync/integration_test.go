package sync

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func openIntegrationDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL is not configured")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Skipf("integration database unavailable: %v", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		t.Skipf("integration database unavailable: %v", err)
	}
	return pool
}

func createSyncUser(t *testing.T, pool *pgxpool.Pool, username string) string {
	t.Helper()
	id := uuid.NewString()
	_, err := pool.Exec(context.Background(), `
		INSERT INTO users (id, username, display_name, password_hash, updated_at)
		VALUES ($1, $2, $3, 'integration-only', NOW())`, id, username, username)
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func addUserEvent(t *testing.T, pool *pgxpool.Pool, actorID, aggregateID, key string) int64 {
	t.Helper()
	payload, _ := json.Marshal(map[string]any{"userId": aggregateID})
	var revision int64
	err := pool.QueryRow(context.Background(), `
		INSERT INTO domain_events (id, event_type, aggregate_type, aggregate_id, actor_id, recipient_user_ids, payload_json, idempotency_key, occurred_at)
		VALUES ($1, 'USER_UPDATED', 'user', $2, $3, $4::uuid[], $5::jsonb, $6, NOW())
		RETURNING revision`, uuid.NewString(), aggregateID, actorID, "{"+actorID+"}", payload, key).Scan(&revision)
	if err != nil {
		t.Fatal(err)
	}
	return revision
}

func cleanupSyncUser(t *testing.T, pool *pgxpool.Pool, ids ...string) {
	t.Helper()
	ctx := context.Background()
	for _, id := range ids {
		_, _ = pool.Exec(ctx, `DELETE FROM domain_events WHERE actor_id=$1 OR $1 = ANY(recipient_user_ids)`, id)
		_, _ = pool.Exec(ctx, `DELETE FROM users WHERE id=$1`, id)
	}
}

func TestSyncPaginationSnapshotAndReconnect(t *testing.T) {
	pool := openIntegrationDB(t)
	defer pool.Close()

	syncUser := createSyncUser(t, pool, "sync-int-"+uuid.NewString()[:8])
	target1 := createSyncUser(t, pool, "sync-t1-"+uuid.NewString()[:8])
	target2 := createSyncUser(t, pool, "sync-t2-"+uuid.NewString()[:8])
	target3 := createSyncUser(t, pool, "sync-t3-"+uuid.NewString()[:8])
	defer cleanupSyncUser(t, pool, syncUser, target1, target2, target3)

	addUserEvent(t, pool, syncUser, target1, "sync-int-1-"+uuid.NewString())
	addUserEvent(t, pool, syncUser, target2, "sync-int-2-"+uuid.NewString())

	svc := NewService(NewRepository(pool), NewCursorCodec("integration-secret"))
	first, err := svc.Sync(context.Background(), syncUser, "", 1)
	if err != nil {
		t.Fatal(err)
	}
	if !first.HasMore || first.NextCursor == "" {
		t.Fatalf("expected a continuation cursor")
	}

	addUserEvent(t, pool, syncUser, target3, "sync-int-3-"+uuid.NewString())
	second, err := svc.Sync(context.Background(), syncUser, first.NextCursor, 10)
	if err != nil {
		t.Fatal(err)
	}
	if second.HasMore {
		t.Fatalf("snapshot should have been exhausted")
	}
	for _, c := range second.Changes.Users {
		if c.ID == target3 {
			t.Fatalf("new event after snapshot leaked into continuation")
		}
	}

	third, err := svc.Sync(context.Background(), syncUser, second.NextCursor, 10)
	if err != nil {
		t.Fatal(err)
	}
	found3 := false
	for _, c := range third.Changes.Users {
		if c.ID == target3 {
			found3 = true
		}
	}
	if !found3 {
		t.Fatalf("tail cursor failed to pick up new event")
	}
}

func TestSyncDuplicateCursorDeterministic(t *testing.T) {
	pool := openIntegrationDB(t)
	defer pool.Close()
	syncUser := createSyncUser(t, pool, "sync-dup-"+uuid.NewString()[:8])
	target := createSyncUser(t, pool, "sync-dupt-"+uuid.NewString()[:8])
	defer cleanupSyncUser(t, pool, syncUser, target)
	addUserEvent(t, pool, syncUser, target, "sync-dup-event-"+uuid.NewString())

	svc := NewService(NewRepository(pool), NewCursorCodec("integration-secret"))
	first, err := svc.Sync(context.Background(), syncUser, "", 10)
	if err != nil {
		t.Fatal(err)
	}
	a, err := svc.Sync(context.Background(), syncUser, first.NextCursor, 10)
	if err != nil {
		t.Fatal(err)
	}
	b, err := svc.Sync(context.Background(), syncUser, first.NextCursor, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(a.Changes.Users) != len(b.Changes.Users) || len(a.Deleted) != len(b.Deleted) || a.HasMore != b.HasMore {
		t.Fatalf("duplicate cursor produced non-deterministic result")
	}
}
