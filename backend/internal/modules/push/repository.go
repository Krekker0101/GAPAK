package push

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	appcrypto "github.com/gapak/backend/internal/platform/crypto"
)

type Repository struct {
	db        *pgxpool.Pool
	encryptor *appcrypto.Encryptor
}

func NewRepository(db *pgxpool.Pool, encryptor *appcrypto.Encryptor) *Repository {
	return &Repository{db: db, encryptor: encryptor}
}

type storedDevice struct {
	ID, UserID, DeviceID, Platform, Provider, Endpoint, PublicKey string
	CredentialCiphertext, CredentialNonce, CredentialHash         string
	Expiration                                                    *time.Time
	CreatedAt, UpdatedAt                                          time.Time
	RevokedAt                                                     *time.Time
}

func credentialHash(provider, endpoint, token, publicKey, authKey string) string {
	seed := strings.Join([]string{provider, endpoint, token, publicKey, authKey}, "\x00")
	sum := sha256.Sum256([]byte(seed))
	return hex.EncodeToString(sum[:])
}

func (r *Repository) UpsertDevice(ctx context.Context, userID string, req RegisterDeviceRequest, expiration *time.Time) (*storedDevice, error) {
	provider := strings.ToLower(strings.TrimSpace(req.Provider))
	endpoint := strings.TrimSpace(req.Endpoint)
	token := strings.TrimSpace(req.Token)
	publicKey := strings.TrimSpace(req.PublicKey)
	authKey := strings.TrimSpace(req.AuthKey)
	if provider == "webpush" && (endpoint == "" || publicKey == "" || authKey == "") {
		return nil, fmt.Errorf("webpush requires endpoint, publicKey and authKey")
	}
	if provider == "webpush" {
		u, err := url.Parse(endpoint)
		if err != nil || !strings.EqualFold(u.Scheme, "https") || u.Host == "" {
			return nil, fmt.Errorf("webpush endpoint must be HTTPS")
		}
		pub, err := base64.RawURLEncoding.DecodeString(publicKey)
		if err != nil || len(pub) != 65 {
			return nil, fmt.Errorf("webpush publicKey must be a base64url P-256 public key")
		}
		auth, err := base64.RawURLEncoding.DecodeString(authKey)
		if err != nil || len(auth) != 16 {
			return nil, fmt.Errorf("webpush authKey must be a 16-byte base64url value")
		}
	}
	if (provider == "fcm" || provider == "apns") && token == "" {
		return nil, fmt.Errorf("%s requires token", provider)
	}
	if r.encryptor == nil {
		return nil, fmt.Errorf("device credential encryptor is unavailable")
	}
	secret := token
	if provider == "webpush" {
		secret = authKey
	}
	ciphertext, nonce, err := r.encryptor.EncryptWithAAD(secret, userID+":"+req.DeviceID+":"+provider)
	if err != nil {
		return nil, fmt.Errorf("encrypt device credential: %w", err)
	}
	credentialHashValue := credentialHash(provider, endpoint, token, publicKey, authKey)
	id := uuid.NewString()
	const q = `
INSERT INTO push_device_subscriptions
(id,user_id,device_id,platform,provider,endpoint,credential_ciphertext,credential_nonce,public_key,credential_hash,expiration_at,created_at,updated_at,revoked_at)
VALUES($1,$2,$3,$4,$5,NULLIF($6,''),$7,$8,NULLIF($9,''),$10,$11,NOW(),NOW(),NULL)
ON CONFLICT (user_id, provider, credential_hash) WHERE revoked_at IS NULL
DO UPDATE SET device_id=EXCLUDED.device_id, platform=EXCLUDED.platform, endpoint=EXCLUDED.endpoint,
credential_ciphertext=EXCLUDED.credential_ciphertext, credential_nonce=EXCLUDED.credential_nonce,
public_key=EXCLUDED.public_key, expiration_at=EXCLUDED.expiration_at, updated_at=NOW(), revoked_at=NULL
RETURNING id::text,user_id::text,device_id,platform,provider,COALESCE(endpoint,''),COALESCE(public_key,''),
credential_ciphertext,credential_nonce,credential_hash,expiration_at,created_at,updated_at,revoked_at`
	var d storedDevice
	err = r.db.QueryRow(ctx, q, id, userID, strings.TrimSpace(req.DeviceID), strings.ToLower(req.Platform), provider, endpoint, ciphertext, nonce, publicKey, credentialHashValue, expiration).Scan(
		&d.ID, &d.UserID, &d.DeviceID, &d.Platform, &d.Provider, &d.Endpoint, &d.PublicKey, &d.CredentialCiphertext, &d.CredentialNonce, &d.CredentialHash, &d.Expiration, &d.CreatedAt, &d.UpdatedAt, &d.RevokedAt)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func base64String(b []byte) string { return base64.StdEncoding.EncodeToString(b) }

func (r *Repository) ListDevices(ctx context.Context, userID string) ([]storedDevice, error) {
	rows, err := r.db.Query(ctx, `SELECT id::text,user_id::text,device_id,platform,provider,COALESCE(endpoint,''),COALESCE(public_key,''),credential_ciphertext,credential_nonce,credential_hash,expiration_at,created_at,updated_at,revoked_at FROM push_device_subscriptions WHERE user_id=$1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]storedDevice, 0)
	for rows.Next() {
		var d storedDevice
		if err := rows.Scan(&d.ID, &d.UserID, &d.DeviceID, &d.Platform, &d.Provider, &d.Endpoint, &d.PublicKey, &d.CredentialCiphertext, &d.CredentialNonce, &d.CredentialHash, &d.Expiration, &d.CreatedAt, &d.UpdatedAt, &d.RevokedAt); err != nil {
			return nil, err
		}
		items = append(items, d)
	}
	return items, rows.Err()
}

func (r *Repository) RevokeDevice(ctx context.Context, userID, id string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `UPDATE push_device_subscriptions SET revoked_at=COALESCE(revoked_at,NOW()), updated_at=NOW() WHERE id=$1 AND user_id=$2`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	if _, err := tx.Exec(ctx, `UPDATE push_outbox SET status='DEAD', dead_lettered_at=COALESCE(dead_lettered_at,NOW()), updated_at=NOW(), last_error='subscription revoked' WHERE subscription_id=$1 AND status IN ('PENDING','PROCESSING')`, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
