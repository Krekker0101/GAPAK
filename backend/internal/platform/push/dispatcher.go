package push

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gapak/backend/internal/config"
	appcrypto "github.com/gapak/backend/internal/platform/crypto"
)

type Dispatcher struct {
	db          *pgxpool.Pool
	encryptor   *appcrypto.Encryptor
	providers   map[ProviderName]PushProvider
	maxAttempts int
	baseRetry   time.Duration
	maxRetry    time.Duration
}

type OutboxItem struct {
	ID, NotificationID, SubscriptionID, Provider string
	Attempts, MaxAttempts                        int
	Notification                                 Notification
	Device                                       Device
	LockToken                                    string
}

func NewDispatcher(cfg config.PushConfig, db *pgxpool.Pool, encryptor *appcrypto.Encryptor) (*Dispatcher, error) {
	d := &Dispatcher{db: db, encryptor: encryptor, providers: map[ProviderName]PushProvider{}, maxAttempts: cfg.MaxAttempts, baseRetry: cfg.BaseRetry, maxRetry: cfg.MaxRetry}
	if !cfg.Enabled || len(cfg.Providers) == 0 {
		return d, nil
	}
	for _, raw := range cfg.Providers {
		switch ProviderName(strings.ToLower(strings.TrimSpace(raw))) {
		case ProviderWebPush:
			p, err := NewWebPushProvider(WebPushConfig{VAPIDSubject: cfg.WebPush.VAPIDSubject, VAPIDPublicKeyBase64URL: cfg.WebPush.VAPIDPublicKeyBase64URL, VAPIDPrivateKeyPKCS8PEM: cfg.WebPush.VAPIDPrivateKeyPEM, AudienceOverride: cfg.WebPush.AudienceOverride})
			if err != nil {
				return nil, err
			}
			d.providers[p.Name()] = p
		case ProviderFCM:
			p, err := NewFCMProvider(FCMConfig{ProjectID: cfg.FCM.ProjectID, ClientEmail: cfg.FCM.ClientEmail, PrivateKeyPEM: cfg.FCM.PrivateKeyPEM, TokenEndpoint: cfg.FCM.TokenEndpoint, APIBaseURL: cfg.FCM.APIBaseURL})
			if err != nil {
				return nil, err
			}
			d.providers[p.Name()] = p
		case ProviderAPNs:
			p, err := NewAPNsProvider(APNsConfig{TeamID: cfg.APNs.TeamID, KeyID: cfg.APNs.KeyID, PrivateKeyPEM: cfg.APNs.PrivateKeyPEM, BundleID: cfg.APNs.BundleID, Production: cfg.APNs.Production})
			if err != nil {
				return nil, err
			}
			d.providers[p.Name()] = p
		}
	}
	return d, nil
}

func (d *Dispatcher) Enabled() bool { return d != nil && len(d.providers) > 0 }

func (d *Dispatcher) Run(ctx context.Context, poll time.Duration, batchSize int) {
	if d == nil || !d.Enabled() {
		return
	}
	if poll <= 0 {
		poll = 2 * time.Second
	}
	if batchSize <= 0 {
		batchSize = 20
	}
	lastExpirySweep := time.Time{}
	for ctx.Err() == nil {
		if lastExpirySweep.IsZero() || time.Since(lastExpirySweep) >= time.Minute {
			_ = d.expireSubscriptions(ctx)
			lastExpirySweep = time.Now()
		}
		items, err := d.claim(ctx, batchSize)
		if err != nil {
			if !sleepCtx(ctx, poll) {
				return
			}
			continue
		}
		if len(items) == 0 {
			if !sleepCtx(ctx, poll) {
				return
			}
			continue
		}
		for _, item := range items {
			d.process(ctx, item)
		}
	}
}

func (d *Dispatcher) claim(ctx context.Context, limit int) ([]OutboxItem, error) {
	lockToken := uuid.NewString()
	rows, err := d.db.Query(ctx, `WITH picked AS (
		SELECT id FROM push_outbox
		WHERE ((status='PENDING' AND available_at <= NOW())
		   OR (status='PROCESSING' AND locked_at < NOW() - INTERVAL '2 minutes'))
		  AND attempts < max_attempts
		ORDER BY created_at
		LIMIT $1 FOR UPDATE SKIP LOCKED
	)
	UPDATE push_outbox o SET status='PROCESSING', locked_at=NOW(), lock_token=$2, attempts=o.attempts+1, updated_at=NOW()
	FROM picked WHERE o.id=picked.id
	RETURNING o.id::text,o.notification_id::text,o.subscription_id::text,o.provider,o.attempts,o.max_attempts`, limit, lockToken)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]OutboxItem, 0)
	for rows.Next() {
		var id, notif, sub, provider string
		var attempts, maxAttempts int
		if err := rows.Scan(&id, &notif, &sub, &provider, &attempts, &maxAttempts); err != nil {
			return nil, err
		}
		item, err := d.loadItem(ctx, id, notif, sub, provider, attempts, maxAttempts, lockToken)
		if err != nil {
			_ = d.markRetryOrDead(ctx, id, lockToken, attempts, maxAttempts, err)
			continue
		}
		out = append(out, *item)
	}
	return out, rows.Err()
}

func (d *Dispatcher) loadItem(ctx context.Context, id, notificationID, subscriptionID, provider string, attempts, maxAttempts int, lockToken string) (*OutboxItem, error) {
	var item OutboxItem
	item.ID = id
	item.NotificationID = notificationID
	item.SubscriptionID = subscriptionID
	item.Provider = provider
	item.Attempts = attempts
	item.MaxAttempts = maxAttempts
	item.LockToken = lockToken
	var dataJSON []byte
	var created time.Time
	var expiration *time.Time
	var endpoint, publicKey, ciphertext, nonce, deviceID, platform, userID string
	err := d.db.QueryRow(ctx, `SELECT n.id::text,n.type,n.title,n.body,n.data,n.created_at,s.id::text,s.user_id::text,s.device_id,s.platform,s.provider,COALESCE(s.endpoint,''),COALESCE(s.public_key,''),COALESCE(s.credential_ciphertext,''),COALESCE(s.credential_nonce,''),s.expiration_at
	FROM notifications n JOIN push_outbox o ON o.notification_id=n.id JOIN push_device_subscriptions s ON s.id=o.subscription_id
	WHERE o.id=$1`, id).Scan(&item.Notification.ID, &item.Notification.Type, &item.Notification.TitleKey, &item.Notification.BodyKey, &dataJSON, &created, &item.SubscriptionID, &userID, &deviceID, &platform, &provider, &endpoint, &publicKey, &ciphertext, &nonce, &expiration)
	if err != nil {
		return nil, err
	}
	item.Notification.CreatedAt = created
	if len(dataJSON) > 0 {
		if err := json.Unmarshal(dataJSON, &item.Notification.Data); err != nil {
			return nil, err
		}
	}
	var secret string
	if ciphertext == "" || nonce == "" {
		return nil, fmt.Errorf("push subscription credential missing")
	}
	if d.encryptor == nil {
		return nil, fmt.Errorf("push encryption key unavailable")
	}
	secretPlain, err := d.encryptor.DecryptWithAAD(ciphertext, nonce, userID+":"+deviceID+":"+provider)
	if err != nil {
		return nil, fmt.Errorf("decrypt subscription credential: %w", err)
	}
	secret = secretPlain
	item.Device = Device{ID: item.SubscriptionID, UserID: userID, DeviceID: deviceID, Platform: platform, Provider: ProviderName(provider), Endpoint: endpoint, PublicKey: publicKey, ExpirationAt: expiration}
	if item.Device.Provider == ProviderWebPush {
		item.Device.AuthKey = secret
	} else {
		item.Device.Token = secret
	}
	return &item, nil
}

func (d *Dispatcher) process(ctx context.Context, item OutboxItem) {
	provider := d.providers[ProviderName(item.Provider)]
	if provider == nil {
		_ = d.markDead(ctx, item.ID, item.LockToken, "provider not configured")
		return
	}
	if item.Device.ExpirationAt != nil && !item.Device.ExpirationAt.After(time.Now().UTC()) {
		_ = d.revokeAndDead(ctx, item)
		return
	}
	_, err := provider.Send(ctx, item.Device, item.Notification)
	if err == nil {
		_ = d.markDelivered(ctx, item.ID, item.LockToken)
		return
	}
	var de *DeliveryError
	if errors.As(err, &de) && (de.Kind == ErrKindInvalid) {
		_ = d.revokeAndDead(ctx, item)
		return
	}
	if errors.As(err, &de) && de.Kind == ErrKindDisabled {
		_ = d.markDead(ctx, item.ID, item.LockToken, err.Error())
		return
	}
	_ = d.markRetryOrDead(ctx, item.ID, item.LockToken, item.Attempts, item.MaxAttempts, err)
}

func (d *Dispatcher) expireSubscriptions(ctx context.Context) error {
	tx, err := d.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `UPDATE push_device_subscriptions SET revoked_at=COALESCE(revoked_at,NOW()), updated_at=NOW() WHERE revoked_at IS NULL AND expiration_at IS NOT NULL AND expiration_at <= NOW()`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE push_outbox o SET status='DEAD', dead_lettered_at=NOW(), last_error='push subscription expired', updated_at=NOW() FROM push_device_subscriptions s WHERE s.id=o.subscription_id AND s.revoked_at IS NOT NULL AND o.status IN ('PENDING','PROCESSING')`); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (d *Dispatcher) markDelivered(ctx context.Context, id, token string) error {
	_, err := d.db.Exec(ctx, `UPDATE push_outbox SET status='DELIVERED',delivered_at=NOW(),locked_at=NULL,lock_token=NULL,last_error=NULL,updated_at=NOW() WHERE id=$1 AND status='PROCESSING' AND lock_token=$2`, id, token)
	return err
}
func (d *Dispatcher) markDead(ctx context.Context, id, token string, errText string) error {
	_, err := d.db.Exec(ctx, `UPDATE push_outbox SET status='DEAD',dead_lettered_at=NOW(),locked_at=NULL,lock_token=NULL,last_error=$3,updated_at=NOW() WHERE id=$1 AND status='PROCESSING' AND lock_token=$2`, id, token, truncateError(errText))
	return err
}
func (d *Dispatcher) revokeAndDead(ctx context.Context, item OutboxItem) error {
	tx, err := d.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `UPDATE push_device_subscriptions SET revoked_at=COALESCE(revoked_at,NOW()),updated_at=NOW() WHERE id=$1`, item.SubscriptionID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE push_outbox SET status='DEAD',dead_lettered_at=NOW(),locked_at=NULL,lock_token=NULL,last_error='push subscription invalid or expired',updated_at=NOW() WHERE id=$1 AND status='PROCESSING' AND lock_token=$2`, item.ID, item.LockToken); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (d *Dispatcher) markRetryOrDead(ctx context.Context, id, token string, attempts, maxAttempts int, deliveryErr error) error {
	if attempts >= maxAttempts {
		return d.markDead(ctx, id, token, deliveryErr.Error())
	}
	delay := d.baseRetry * time.Duration(math.Pow(2, float64(attempts-1)))
	if delay > d.maxRetry {
		delay = d.maxRetry
	}
	_, err := d.db.Exec(ctx, `UPDATE push_outbox SET status='PENDING',available_at=$3,locked_at=NULL,lock_token=NULL,last_error=$4,updated_at=NOW() WHERE id=$1 AND status='PROCESSING' AND lock_token=$2`, id, token, time.Now().UTC().Add(delay), truncateError(deliveryErr.Error()))
	return err
}
func sleepCtx(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-t.C:
		return true
	}
}
func truncateError(s string) string {
	if len(s) > 2000 {
		return s[:2000]
	}
	return s
}
