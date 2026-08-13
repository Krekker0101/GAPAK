package push

import (
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type FCMConfig struct {
	ProjectID     string
	ClientEmail   string
	PrivateKeyPEM string
	TokenEndpoint string
	APIBaseURL    string
}

type FCMProvider struct {
	cfg         FCMConfig
	mu          sync.Mutex
	accessToken string
	expiresAt   time.Time
	privateKey  *rsa.PrivateKey
}

func NewFCMProvider(cfg FCMConfig) (*FCMProvider, error) {
	cfg.PrivateKeyPEM = strings.ReplaceAll(cfg.PrivateKeyPEM, "\\n", "\n")
	if strings.TrimSpace(cfg.ProjectID) == "" || strings.TrimSpace(cfg.ClientEmail) == "" || strings.TrimSpace(cfg.PrivateKeyPEM) == "" {
		return nil, fmt.Errorf("FCM credentials are incomplete")
	}
	if cfg.TokenEndpoint == "" {
		cfg.TokenEndpoint = "https://oauth2.googleapis.com/token"
	}
	if cfg.APIBaseURL == "" {
		cfg.APIBaseURL = "https://fcm.googleapis.com/v1/projects"
	}
	key, err := parseRSAPrivateKey(cfg.PrivateKeyPEM)
	if err != nil {
		return nil, fmt.Errorf("parse FCM private key: %w", err)
	}
	return &FCMProvider{cfg: cfg, privateKey: key}, nil
}

func (p *FCMProvider) Name() ProviderName { return ProviderFCM }

func (p *FCMProvider) token(ctx context.Context) (string, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.accessToken != "" && time.Until(p.expiresAt) > 2*time.Minute {
		return p.accessToken, nil
	}
	now := time.Now().UTC()
	claims := jwt.MapClaims{"iss": p.cfg.ClientEmail, "scope": "https://www.googleapis.com/auth/firebase.messaging", "aud": p.cfg.TokenEndpoint, "iat": now.Unix(), "exp": now.Add(55 * time.Minute).Unix()}
	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	signed, err := tok.SignedString(p.privateKey)
	if err != nil {
		return "", err
	}
	form := url.Values{"grant_type": {"urn:ietf:params:oauth:grant-type:jwt-bearer"}, "assertion": {signed}}
	status, body, err := doForm(ctx, p.cfg.TokenEndpoint, form)
	if err != nil {
		return "", &DeliveryError{Kind: fcmClassify(status), StatusCode: status, Err: err}
	}
	var response struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int64  `json:"expires_in"`
	}
	if err := json.Unmarshal(body, &response); err != nil || response.AccessToken == "" {
		return "", fmt.Errorf("invalid FCM OAuth response")
	}
	p.accessToken = response.AccessToken
	p.expiresAt = now.Add(time.Duration(response.ExpiresIn) * time.Second)
	return p.accessToken, nil
}

func (p *FCMProvider) Send(ctx context.Context, device Device, n Notification) (DeliveryResult, error) {
	if device.Token == "" {
		return DeliveryResult{}, &DeliveryError{Kind: ErrKindInvalid, Err: fmt.Errorf("FCM token is empty")}
	}
	payload, err := requireNotificationPayload(n)
	if err != nil {
		return DeliveryResult{}, &DeliveryError{Kind: ErrKindInvalid, Err: err}
	}
	token, err := p.token(ctx)
	if err != nil {
		return DeliveryResult{}, err
	}
	requestBody := map[string]any{"message": map[string]any{"token": device.Token, "data": map[string]string{"payload": base64.RawURLEncoding.EncodeToString(payload), "notification_id": n.ID, "type": n.Type}}}
	body, _ := json.Marshal(requestBody)
	endpoint := strings.TrimRight(p.cfg.APIBaseURL, "/") + "/" + url.PathEscape(p.cfg.ProjectID) + "/messages:send"
	status, raw, err := doJSON(ctx, "POST", endpoint, map[string]string{"Authorization": "Bearer " + token, "Content-Type": "application/json"}, body)
	if err != nil {
		return DeliveryResult{}, &DeliveryError{Kind: fcmClassify(status), StatusCode: status, Err: err}
	}
	var response struct {
		Name string `json:"name"`
	}
	_ = json.Unmarshal(raw, &response)
	return DeliveryResult{ProviderMessageID: response.Name, StatusCode: status}, nil
}

func fcmClassify(status int) DeliveryErrorKind {
	if status == 400 || status == 404 {
		return ErrKindInvalid
	}
	if status == 401 || status == 403 {
		return ErrKindPermanent
	}
	if status == 408 || status == 429 || status >= 500 {
		return ErrKindRetryable
	}
	return ErrKindPermanent
}

func parseRSAPrivateKey(raw string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(raw))
	if block == nil {
		return nil, fmt.Errorf("PEM block missing")
	}
	if key, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		if rsaKey, ok := key.(*rsa.PrivateKey); ok {
			return rsaKey, nil
		}
	}
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	return nil, fmt.Errorf("unsupported RSA private key")
}
