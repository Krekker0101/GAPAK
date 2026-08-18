package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type TokenType string

const (
	TokenTypeAccess  TokenType = "access"
	TokenTypeRefresh TokenType = "refresh"
)

type JWTConfig struct {
	Issuer        string
	Audience      string
	AccessSecret  string
	RefreshSecret string
	AccessTTL     time.Duration
	RefreshTTL    time.Duration
}

type SigningKey struct {
	ID      string
	Secret  string
	Current bool
}

type Claims struct {
	UserID    string   `json:"userId"`
	SessionID string   `json:"sessionId"`
	Role      string   `json:"role"`
	Scopes    []string `json:"scopes,omitempty"`
	TokenType string   `json:"tokenType"`
	jwt.RegisteredClaims
}

type TokenPair struct {
	AccessToken      string    `json:"accessToken"`
	AccessTokenTTL   int64     `json:"accessTokenTtl"`
	RefreshToken     string    `json:"refreshToken,omitempty"`
	RefreshTokenTTL  int64     `json:"refreshTokenTtl"`
	RefreshExpiresAt time.Time `json:"refreshExpiresAt"`
}

type Manager struct {
	cfg         JWTConfig
	revocation  RevocationChecker
	accessKeys  keyRing
	refreshKeys keyRing
	mu          sync.RWMutex
}

type keyRing struct {
	signingKey       SigningKey
	verificationKeys map[string]string
}

func NewJWTManager(cfg JWTConfig) *Manager {
	return &Manager{
		cfg: cfg,
		accessKeys: keyRing{
			signingKey:       SigningKey{ID: "current", Secret: cfg.AccessSecret, Current: true},
			verificationKeys: map[string]string{"current": cfg.AccessSecret},
		},
		refreshKeys: keyRing{
			signingKey:       SigningKey{ID: "current", Secret: cfg.RefreshSecret, Current: true},
			verificationKeys: map[string]string{"current": cfg.RefreshSecret},
		},
	}
}

func (m *Manager) RotateAccessSigningKey(newKey SigningKey) {
	m.mu.Lock()
	defer m.mu.Unlock()
	oldID := m.accessKeys.signingKey.ID
	oldSecret := m.accessKeys.signingKey.Secret
	m.accessKeys.signingKey = newKey
	m.accessKeys.verificationKeys[newKey.ID] = newKey.Secret
	m.accessKeys.verificationKeys[oldID] = oldSecret
}

func (m *Manager) RotateRefreshSigningKey(newKey SigningKey) {
	m.mu.Lock()
	defer m.mu.Unlock()
	oldID := m.refreshKeys.signingKey.ID
	oldSecret := m.refreshKeys.signingKey.Secret
	m.refreshKeys.signingKey = newKey
	m.refreshKeys.verificationKeys[newKey.ID] = newKey.Secret
	m.refreshKeys.verificationKeys[oldID] = oldSecret
}

func (m *Manager) SetRevocationChecker(rc RevocationChecker) {
	m.revocation = rc
}

func (m *Manager) Issue(userID, sessionID, role string, scopes []string) (TokenPair, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	now := time.Now().UTC()
	accessExpiry := now.Add(m.cfg.AccessTTL)
	refreshExpiry := now.Add(m.cfg.RefreshTTL)
	accessClaims := Claims{
		UserID:    userID,
		SessionID: sessionID,
		Role:      role,
		Scopes:    scopes,
		TokenType: string(TokenTypeAccess),
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    m.cfg.Issuer,
			Subject:   userID,
			Audience:  []string{m.cfg.Audience},
			ExpiresAt: jwt.NewNumericDate(accessExpiry),
			NotBefore: jwt.NewNumericDate(now),
			IssuedAt:  jwt.NewNumericDate(now),
			ID:        uuid.NewString(),
		},
	}

	refreshClaims := Claims{
		UserID:    userID,
		SessionID: sessionID,
		Role:      role,
		Scopes:    scopes,
		TokenType: string(TokenTypeRefresh),
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    m.cfg.Issuer,
			Subject:   userID,
			Audience:  []string{m.cfg.Audience},
			ExpiresAt: jwt.NewNumericDate(refreshExpiry),
			NotBefore: jwt.NewNumericDate(now),
			IssuedAt:  jwt.NewNumericDate(now),
			ID:        uuid.NewString(),
		},
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessToken.Header["kid"] = m.accessKeys.signingKey.ID
	accessTokenStr, err := accessToken.SignedString([]byte(m.accessKeys.signingKey.Secret))
	if err != nil {
		return TokenPair{}, err
	}

	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshToken.Header["kid"] = m.refreshKeys.signingKey.ID
	refreshTokenStr, err := refreshToken.SignedString([]byte(m.refreshKeys.signingKey.Secret))
	if err != nil {
		return TokenPair{}, err
	}

	return TokenPair{
		AccessToken:      accessTokenStr,
		AccessTokenTTL:   int64(m.cfg.AccessTTL.Seconds()),
		RefreshToken:     refreshTokenStr,
		RefreshTokenTTL:  int64(m.cfg.RefreshTTL.Seconds()),
		RefreshExpiresAt: refreshExpiry,
	}, nil
}

func (m *Manager) ParseAccessToken(raw string) (*Claims, error) {
	m.mu.RLock()
	keys := cloneKeyMap(m.accessKeys.verificationKeys)
	m.mu.RUnlock()
	return m.parse(raw, keys, TokenTypeAccess)
}

func (m *Manager) ParseRefreshToken(raw string) (*Claims, error) {
	m.mu.RLock()
	keys := cloneKeyMap(m.refreshKeys.verificationKeys)
	m.mu.RUnlock()
	return m.parse(raw, keys, TokenTypeRefresh)
}

func (m *Manager) VerifyAccessToken(ctx context.Context, raw string) (*Claims, error) {
	claims, err := m.ParseAccessToken(raw)
	if err != nil {
		return nil, err
	}
	if m.revocation == nil {
		return claims, nil
	}
	revoked, err := m.revocation.IsRevoked(ctx, claims)
	if err != nil {
		return nil, err
	}
	if revoked {
		return nil, jwt.ErrTokenInvalidClaims
	}
	return claims, nil
}

func (m *Manager) RevokeAccessToken(ctx context.Context, jti string) error {
	if m.revocation == nil || jti == "" {
		return nil
	}
	return m.revocation.Revoke(ctx, jti, m.cfg.AccessTTL)
}

func (m *Manager) RevokeUserTokens(ctx context.Context, userID string) error {
	if m.revocation == nil || userID == "" {
		return nil
	}
	return m.revocation.RevokeUser(ctx, userID, time.Now().UTC())
}

func (m *Manager) ValidateToken(ctx context.Context, raw string) (string, error) {
	claims, err := m.VerifyAccessToken(ctx, raw)
	if err != nil {
		return "", err
	}
	return claims.UserID, nil
}

// ValidateSessionToken authenticates a browser WebSocket fallback frame and
// returns only the identity needed to validate the backing device session.
// The raw token is never placed in a URL, where proxies and access logs could
// retain it.
func (m *Manager) ValidateSessionToken(ctx context.Context, raw string) (string, string, error) {
	claims, err := m.VerifyAccessToken(ctx, raw)
	if err != nil {
		return "", "", err
	}
	return claims.UserID, claims.SessionID, nil
}

func (m *Manager) parse(raw string, verificationKeys map[string]string, expected TokenType) (*Claims, error) {
	token, err := jwt.ParseWithClaims(raw, &Claims{}, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		kid, ok := token.Header["kid"].(string)
		if !ok || strings.TrimSpace(kid) == "" {
			return nil, jwt.ErrTokenUnverifiable
		}
		secret, ok := verificationKeys[kid]
		if !ok || strings.TrimSpace(secret) == "" {
			return nil, jwt.ErrTokenUnverifiable
		}
		return []byte(secret), nil
	}, jwt.WithAudience(m.cfg.Audience), jwt.WithIssuer(m.cfg.Issuer), jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid || claims.TokenType != string(expected) {
		return nil, jwt.ErrTokenInvalidClaims
	}
	return claims, nil
}

func RandomToken(size int) (string, error) {
	buffer := make([]byte, size)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
}

func HashOpaqueToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func ConstantTimeCompare(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

func tokenTypeFromBearer(raw string) string {
	parts := strings.SplitN(raw, ".", 2)
	if len(parts) < 2 {
		return "unknown"
	}
	decoded, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "unknown"
	}
	return string(decoded)
}

func cloneKeyMap(src map[string]string) map[string]string {
	dst := make(map[string]string, len(src))
	for k, v := range src {
		dst[k] = v
	}
	return dst
}
