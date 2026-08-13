package push

import (
	"context"
	"errors"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gapak/backend/internal/platform/crypto"
)

type fakeProvider struct {
	name  ProviderName
	mu    sync.Mutex
	calls int
	mode  DeliveryErrorKind
}

func (f *fakeProvider) Name() ProviderName { return f.name }
func (f *fakeProvider) Send(context.Context, Device, Notification) (DeliveryResult, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	if f.mode != "" {
		return DeliveryResult{}, &DeliveryError{Kind: f.mode, Err: errors.New(string(f.mode))}
	}
	return DeliveryResult{StatusCode: 200, ProviderMessageID: uuid.NewString()}, nil
}

func testPushDB(t *testing.T) (*pgxpool.Pool, context.Context) {
	dsn := os.Getenv("GAPAK_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("GAPAK_TEST_DATABASE_URL not configured")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	t.Cleanup(cancel)
	db, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err := db.Ping(ctx); err != nil {
		t.Fatal(err)
	}
	return db, ctx
}

func TestDispatcherRetriesAndDeadLetters(t *testing.T) {
	db, ctx := testPushDB(t)
	user := uuid.New()
	if _, err := db.Exec(ctx, `INSERT INTO users(id,username,display_name,password_hash,updated_at) VALUES($1,$2,$3,$4,NOW())`, user, "push_test_"+user.String()[:8], "push", "test"); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), `DELETE FROM users WHERE id=$1`, user)
	notification := uuid.New()
	if _, err := db.Exec(ctx, `INSERT INTO notifications(id,user_id,type,title,body,data) VALUES($1,$2,'TEST','test.title','test.body','{}')`, notification, user); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), `DELETE FROM notifications WHERE id=$1`, notification)
	subscription := uuid.New()
	enc, _ := crypto.NewEncryptor("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
	secret, nonce, err := enc.EncryptWithAAD("token", user.String()+":"+"test-device"+":"+"fcm")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO push_device_subscriptions(id,user_id,device_id,platform,provider,endpoint,credential_ciphertext,credential_nonce,public_key,credential_hash,created_at,updated_at) VALUES($1,$2,'test-device','android','fcm','',$3,$4,'',repeat('a',64),NOW(),NOW())`, subscription, user, secret, nonce); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), `DELETE FROM push_device_subscriptions WHERE id=$1`, subscription)
	outbox := uuid.New()
	if _, err := db.Exec(ctx, `INSERT INTO push_outbox(id,notification_id,subscription_id,provider,status,attempts,max_attempts,available_at,created_at,updated_at) VALUES($1,$2,$3,'fcm','PENDING',0,2,NOW(),NOW(),NOW())`, outbox, notification, subscription); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), `DELETE FROM push_outbox WHERE id=$1`, outbox)
	d := &Dispatcher{db: db, encryptor: enc, providers: map[ProviderName]PushProvider{}, maxAttempts: 2, baseRetry: time.Millisecond, maxRetry: time.Millisecond}
	fake := &fakeProvider{name: ProviderFCM, mode: ErrKindRetryable}
	d.providers[ProviderFCM] = fake
	items, err := d.claim(ctx, 1)
	if err != nil || len(items) != 1 {
		t.Fatalf("claim items=%d err=%v", len(items), err)
	}
	d.process(ctx, items[0])
	var status string
	var attempts int
	if err := db.QueryRow(ctx, `SELECT status,attempts FROM push_outbox WHERE id=$1`, outbox).Scan(&status, &attempts); err != nil {
		t.Fatal(err)
	}
	if status != "PENDING" || attempts != 1 {
		t.Fatalf("status=%s attempts=%d", status, attempts)
	}
	items, err = d.claim(ctx, 1)
	if err != nil || len(items) != 1 {
		t.Fatal(err)
	}
	d.process(ctx, items[0])
	if err := db.QueryRow(ctx, `SELECT status,attempts FROM push_outbox WHERE id=$1`, outbox).Scan(&status, &attempts); err != nil {
		t.Fatal(err)
	}
	if status != "DEAD" || attempts != 2 {
		t.Fatalf("final status=%s attempts=%d", status, attempts)
	}
}

func TestDispatcherInvalidTokenRevokesSubscription(t *testing.T) {
	db, ctx := testPushDB(t)
	user := uuid.New()
	if _, err := db.Exec(ctx, `INSERT INTO users(id,username,display_name,password_hash,updated_at) VALUES($1,$2,$3,$4,NOW())`, user, "push_inv_"+user.String()[:8], "push", "test"); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), `DELETE FROM users WHERE id=$1`, user)
	notification := uuid.New()
	if _, err := db.Exec(ctx, `INSERT INTO notifications(id,user_id,type,title,body,data) VALUES($1,$2,'TEST','test.title','test.body','{}')`, notification, user); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), `DELETE FROM notifications WHERE id=$1`, notification)
	subscription := uuid.New()
	enc, _ := crypto.NewEncryptor("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
	secret, nonce, _ := enc.EncryptWithAAD("token", user.String()+":"+"device"+":"+"fcm")
	if _, err := db.Exec(ctx, `INSERT INTO push_device_subscriptions(id,user_id,device_id,platform,provider,credential_ciphertext,credential_nonce,credential_hash,created_at,updated_at) VALUES($1,$2,'device','android','fcm',$3,$4,repeat('b',64),NOW(),NOW())`, subscription, user, secret, nonce); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), `DELETE FROM push_device_subscriptions WHERE id=$1`, subscription)
	outbox := uuid.New()
	if _, err := db.Exec(ctx, `INSERT INTO push_outbox(id,notification_id,subscription_id,provider,status,attempts,max_attempts,available_at,created_at,updated_at) VALUES($1,$2,$3,'fcm','PENDING',0,2,NOW(),NOW(),NOW())`, outbox, notification, subscription); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), `DELETE FROM push_outbox WHERE id=$1`, outbox)
	d := &Dispatcher{db: db, encryptor: enc, providers: map[ProviderName]PushProvider{ProviderFCM: &fakeProvider{name: ProviderFCM, mode: ErrKindInvalid}}, maxAttempts: 2, baseRetry: time.Millisecond, maxRetry: time.Millisecond}
	items, err := d.claim(ctx, 1)
	if err != nil || len(items) != 1 {
		t.Fatal(err)
	}
	d.process(ctx, items[0])
	var revoked *time.Time
	if err := db.QueryRow(ctx, `SELECT revoked_at FROM push_device_subscriptions WHERE id=$1`, subscription).Scan(&revoked); err != nil {
		t.Fatal(err)
	}
	if revoked == nil {
		t.Fatal("invalid subscription was not revoked")
	}
	var status string
	if err := db.QueryRow(ctx, `SELECT status FROM push_outbox WHERE id=$1`, outbox).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != "DEAD" {
		t.Fatalf("status=%s", status)
	}
}

func TestDispatcherConcurrentClaimHasSingleWinner(t *testing.T) {
	db, ctx := testPushDB(t)
	user := uuid.New()
	if _, err := db.Exec(ctx, `INSERT INTO users(id,username,display_name,password_hash,updated_at) VALUES($1,$2,$3,$4,NOW())`, user, "push_con_"+user.String()[:8], "push", "test"); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), `DELETE FROM users WHERE id=$1`, user)
	notification := uuid.New()
	if _, err := db.Exec(ctx, `INSERT INTO notifications(id,user_id,type,title,body,data) VALUES($1,$2,'TEST','test.title','test.body','{}')`, notification, user); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), `DELETE FROM notifications WHERE id=$1`, notification)
	subscription := uuid.New()
	enc, _ := crypto.NewEncryptor("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
	secret, nonce, _ := enc.EncryptWithAAD("token", user.String()+":"+"device"+":"+"fcm")
	if _, err := db.Exec(ctx, `INSERT INTO push_device_subscriptions(id,user_id,device_id,platform,provider,credential_ciphertext,credential_nonce,credential_hash,created_at,updated_at) VALUES($1,$2,'device','android','fcm',$3,$4,repeat('c',64),NOW(),NOW())`, subscription, user, secret, nonce); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), `DELETE FROM push_device_subscriptions WHERE id=$1`, subscription)
	outbox := uuid.New()
	if _, err := db.Exec(ctx, `INSERT INTO push_outbox(id,notification_id,subscription_id,provider,status,attempts,max_attempts,available_at,created_at,updated_at) VALUES($1,$2,$3,'fcm','PENDING',0,2,NOW(),NOW(),NOW())`, outbox, notification, subscription); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(context.Background(), `DELETE FROM push_outbox WHERE id=$1`, outbox)
	d := &Dispatcher{db: db, encryptor: enc, maxAttempts: 2, baseRetry: time.Millisecond, maxRetry: time.Millisecond}
	const workers = 20
	results := make(chan int, workers)
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			items, err := d.claim(ctx, 1)
			if err != nil {
				t.Errorf("claim err: %v", err)
				return
			}
			results <- len(items)
		}()
	}
	wg.Wait()
	close(results)
	claimed := 0
	for n := range results {
		claimed += n
	}
	if claimed != 1 {
		t.Fatalf("expected exactly one claim, got %d", claimed)
	}
}
