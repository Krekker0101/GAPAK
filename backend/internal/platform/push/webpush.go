package push

// The Web Push provider deliberately keeps RFC-level encryption in its own file/package boundary.
// This implementation expects the browser subscription's endpoint, p256dh and auth values.

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/hkdf"
)

type WebPushConfig struct {
	VAPIDSubject            string
	VAPIDPublicKeyBase64URL string
	VAPIDPrivateKeyPKCS8PEM string
	AudienceOverride        string
}
type WebPushProvider struct {
	cfg        WebPushConfig
	privateKey *ecdsa.PrivateKey
}

func NewWebPushProvider(cfg WebPushConfig) (*WebPushProvider, error) {
	cfg.VAPIDPrivateKeyPKCS8PEM = strings.ReplaceAll(cfg.VAPIDPrivateKeyPKCS8PEM, "\\n", "\n")
	if cfg.VAPIDSubject == "" || cfg.VAPIDPrivateKeyPKCS8PEM == "" {
		return nil, fmt.Errorf("Web Push VAPID credentials are incomplete")
	}
	key, err := parseECDSAPrivateKey(cfg.VAPIDPrivateKeyPKCS8PEM)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(cfg.VAPIDPublicKeyBase64URL) == "" {
		pub := elliptic.Marshal(elliptic.P256(), key.PublicKey.X, key.PublicKey.Y)
		cfg.VAPIDPublicKeyBase64URL = base64.RawURLEncoding.EncodeToString(pub)
	}
	return &WebPushProvider{cfg: cfg, privateKey: key}, nil
}
func (p *WebPushProvider) Name() ProviderName { return ProviderWebPush }

func (p *WebPushProvider) Send(ctx context.Context, device Device, n Notification) (DeliveryResult, error) {
	if device.Endpoint == "" || device.PublicKey == "" || device.AuthKey == "" {
		return DeliveryResult{}, &DeliveryError{Kind: ErrKindInvalid, Err: fmt.Errorf("Web Push subscription is incomplete")}
	}
	plaintext, err := requireNotificationPayload(n)
	if err != nil {
		return DeliveryResult{}, &DeliveryError{Kind: ErrKindInvalid, Err: err}
	}
	body, _, err := encryptWebPush(plaintext, device.PublicKey, device.AuthKey)
	if err != nil {
		return DeliveryResult{}, &DeliveryError{Kind: ErrKindInvalid, Err: err}
	}
	audience := p.cfg.AudienceOverride
	if audience == "" {
		u, err := url.Parse(device.Endpoint)
		if err != nil {
			return DeliveryResult{}, &DeliveryError{Kind: ErrKindInvalid, Err: err}
		}
		audience = u.Scheme + "://" + u.Host
	}
	vapid, err := p.vapidJWT(audience)
	if err != nil {
		return DeliveryResult{}, &DeliveryError{Kind: ErrKindPermanent, Err: err}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, device.Endpoint, bytes.NewReader(body))
	if err != nil {
		return DeliveryResult{}, &DeliveryError{Kind: ErrKindInvalid, Err: err}
	}
	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("Content-Encoding", "aes128gcm")
	req.Header.Set("Authorization", "vapid t="+vapid+", k="+p.cfg.VAPIDPublicKeyBase64URL)
	req.Header.Set("TTL", "86400")
	resp, err := defaultHTTPClient.Do(req)
	if err != nil {
		return DeliveryResult{}, &DeliveryError{Kind: ErrKindRetryable, Err: err}
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return DeliveryResult{}, &DeliveryError{Kind: webpushClassify(resp.StatusCode), StatusCode: resp.StatusCode, Err: fmt.Errorf("Web Push endpoint returned HTTP %d", resp.StatusCode)}
	}
	return DeliveryResult{StatusCode: resp.StatusCode}, nil
}
func (p *WebPushProvider) vapidJWT(audience string) (string, error) {
	now := time.Now().UTC()
	token := jwt.NewWithClaims(jwt.SigningMethodES256, jwt.MapClaims{"aud": audience, "exp": now.Add(12 * time.Hour).Unix(), "sub": p.cfg.VAPIDSubject})
	token.Header["typ"] = "JWT"
	return token.SignedString(p.privateKey)
}
func webpushClassify(status int) DeliveryErrorKind {
	if status == 404 || status == 410 {
		return ErrKindInvalid
	}
	if status == 408 || status == 429 || status >= 500 {
		return ErrKindRetryable
	}
	if status == 401 || status == 403 {
		return ErrKindPermanent
	}
	return ErrKindPermanent
}

func parseECDSAPrivateKey(pemText string) (*ecdsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(pemText))
	if block == nil {
		return nil, fmt.Errorf("VAPID PEM block missing")
	}
	keyAny, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	key, ok := keyAny.(*ecdsa.PrivateKey)
	if !ok || key.Curve != elliptic.P256() {
		return nil, fmt.Errorf("VAPID key must be P-256 ECDSA")
	}
	return key, nil
}

func encryptWebPush(plaintext []byte, clientPublicKeyB64, authB64 string) ([]byte, []byte, error) {
	clientPubRaw, err := base64.RawURLEncoding.DecodeString(clientPublicKeyB64)
	if err != nil {
		return nil, nil, err
	}
	clientPub, err := ecdh.P256().NewPublicKey(clientPubRaw)
	if err != nil {
		return nil, nil, err
	}
	auth, err := base64.RawURLEncoding.DecodeString(authB64)
	if err != nil {
		return nil, nil, err
	}
	ephPriv, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		return nil, nil, err
	}
	shared, err := ephPriv.ECDH(clientPub)
	if err != nil {
		return nil, nil, err
	}
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return nil, nil, err
	}
	// RFC 8291 / RFC 8188 derivation for aes128gcm.
	ikmInfo := append([]byte("WebPush: info\x00"), clientPubRaw...)
	ikmInfo = append(ikmInfo, ephPriv.PublicKey().Bytes()...)
	prk := hkdf.Extract(sha256.New, shared, auth)
	ikm := make([]byte, 32)
	if err := hkdfExpand(prk, ikmInfo, ikm); err != nil {
		return nil, nil, err
	}
	prk2 := hkdf.Extract(sha256.New, ikm, salt)
	cek := make([]byte, 16)
	nonce := make([]byte, 12)
	if err := hkdfExpand(prk2, []byte("Content-Encoding: aes128gcm\x00"), cek); err != nil {
		return nil, nil, err
	}
	if err := hkdfExpand(prk2, []byte("Content-Encoding: nonce\x00"), nonce); err != nil {
		return nil, nil, err
	}
	block, err := aes.NewCipher(cek)
	if err != nil {
		return nil, nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, err
	}
	padded := append(append([]byte{}, plaintext...), 0x02)
	ciphertext := gcm.Seal(nil, nonce, padded, nil)
	recordSize := 4096
	head := append([]byte{}, salt...)
	head = append(head, byte(recordSize>>24), byte(recordSize>>16), byte(recordSize>>8), byte(recordSize))
	pubLen := ephPriv.PublicKey().Bytes()
	if len(pubLen) > 255 {
		return nil, nil, fmt.Errorf("invalid ephemeral key")
	}
	head = append(head, 0, byte(len(pubLen)))
	head = append(head, pubLen...)
	return append(head, ciphertext...), salt, nil
}
func hkdfExpand(prk []byte, info []byte, out []byte) error {
	reader := hkdf.New(sha256.New, prk, nil, info)
	_, err := io.ReadFull(reader, out)
	return err
}
