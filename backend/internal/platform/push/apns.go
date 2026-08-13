package push

import (
	"context"
	"crypto/ecdsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type APNsConfig struct {
	TeamID        string
	KeyID         string
	PrivateKeyPEM string
	BundleID      string
	Production    bool
}

type APNsProvider struct {
	cfg       APNsConfig
	key       *ecdsa.PrivateKey
	mu        sync.Mutex
	token     string
	expiresAt time.Time
}

func NewAPNsProvider(cfg APNsConfig) (*APNsProvider, error) {
	cfg.PrivateKeyPEM = strings.ReplaceAll(cfg.PrivateKeyPEM, "\\n", "\n")
	if cfg.TeamID == "" || cfg.KeyID == "" || cfg.PrivateKeyPEM == "" || cfg.BundleID == "" {
		return nil, fmt.Errorf("APNs credentials are incomplete")
	}
	block, _ := pem.Decode([]byte(cfg.PrivateKeyPEM))
	if block == nil {
		return nil, fmt.Errorf("APNs PEM block missing")
	}
	keyAny, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse APNs private key: %w", err)
	}
	key, ok := keyAny.(*ecdsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("APNs key must be ECDSA")
	}
	return &APNsProvider{cfg: cfg, key: key}, nil
}
func (p *APNsProvider) Name() ProviderName { return ProviderAPNs }
func (p *APNsProvider) jwt(ctx context.Context) (string, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.token != "" && time.Until(p.expiresAt) > 2*time.Minute {
		return p.token, nil
	}
	now := time.Now().UTC()
	t := jwt.NewWithClaims(jwt.SigningMethodES256, jwt.MapClaims{"iss": p.cfg.TeamID, "iat": now.Unix()})
	t.Header["kid"] = p.cfg.KeyID
	signed, err := t.SignedString(p.key)
	if err != nil {
		return "", err
	}
	p.token, p.expiresAt = signed, now.Add(50*time.Minute)
	return signed, nil
}
func (p *APNsProvider) Send(ctx context.Context, device Device, n Notification) (DeliveryResult, error) {
	if device.Token == "" {
		return DeliveryResult{}, &DeliveryError{Kind: ErrKindInvalid, Err: fmt.Errorf("APNs device token is empty")}
	}
	token, err := p.jwt(ctx)
	if err != nil {
		return DeliveryResult{}, &DeliveryError{Kind: ErrKindPermanent, Err: err}
	}
	payload, err := requireNotificationPayload(n)
	if err != nil {
		return DeliveryResult{}, &DeliveryError{Kind: ErrKindInvalid, Err: err}
	}
	var base map[string]any
	_ = json.Unmarshal(payload, &base)
	native := map[string]any{"aps": map[string]any{"alert": map[string]string{"title": n.TitleKey, "body": n.BodyKey}, "mutable-content": 1}, "gapak": base}
	body, _ := json.Marshal(native)
	host := "https://api.push.apple.com"
	if !p.cfg.Production {
		host = "https://api.sandbox.push.apple.com"
	}
	endpoint := strings.TrimRight(host, "/") + "/3/device/" + device.Token
	status, raw, err := doJSON(ctx, "POST", endpoint, map[string]string{"authorization": "bearer " + token, "apns-topic": p.cfg.BundleID, "apns-push-type": "alert", "apns-priority": "10", "content-type": "application/json"}, body)
	if err != nil {
		return DeliveryResult{}, &DeliveryError{Kind: apnsClassify(status, string(raw)), StatusCode: status, Err: err}
	}
	return DeliveryResult{StatusCode: status}, nil
}
func apnsClassify(status int, body string) DeliveryErrorKind {
	if status == 410 || strings.Contains(body, "BadDeviceToken") || strings.Contains(body, "Unregistered") {
		return ErrKindInvalid
	}
	if status == 400 {
		return ErrKindPermanent
	}
	if status == 403 {
		return ErrKindPermanent
	}
	if status == 408 || status == 429 || status >= 500 {
		return ErrKindRetryable
	}
	return ErrKindPermanent
}
