package auth

import (
	"crypto/rand"
	"encoding/base64"
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

type Claims struct {
	UserID    string   `json:"userId"`
	SessionID string   `json:"sessionId"`
	Role      string   `json:"role"`
	Scopes    []string `json:"scopes,omitempty"`
	TokenType string   `json:"tokenType"`
	CSRFToken string   `json:"csrfToken,omitempty"`
	jwt.RegisteredClaims
}

type TokenPair struct {
	AccessToken      string    `json:"accessToken"`
	AccessTokenTTL   int64     `json:"accessTokenTtl"`
	RefreshToken     string    `json:"refreshToken,omitempty"`
	RefreshTokenTTL  int64     `json:"refreshTokenTtl"`
	RefreshExpiresAt time.Time `json:"refreshExpiresAt"`
	CSRFToken        string    `json:"csrfToken"`
}

type Manager struct {
	cfg JWTConfig
}

func NewJWTManager(cfg JWTConfig) *Manager {
	return &Manager{cfg: cfg}
}

func (m *Manager) Issue(userID, sessionID, role string, scopes []string) (TokenPair, error) {
	now := time.Now().UTC()
	accessExpiry := now.Add(m.cfg.AccessTTL)
	refreshExpiry := now.Add(m.cfg.RefreshTTL)
	csrfToken, err := RandomToken(32)
	if err != nil {
		return TokenPair{}, err
	}

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
		CSRFToken: csrfToken,
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

	accessToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims).SignedString([]byte(m.cfg.AccessSecret))
	if err != nil {
		return TokenPair{}, err
	}
	refreshToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims).SignedString([]byte(m.cfg.RefreshSecret))
	if err != nil {
		return TokenPair{}, err
	}

	return TokenPair{
		AccessToken:      accessToken,
		AccessTokenTTL:   int64(m.cfg.AccessTTL.Seconds()),
		RefreshToken:     refreshToken,
		RefreshTokenTTL:  int64(m.cfg.RefreshTTL.Seconds()),
		RefreshExpiresAt: refreshExpiry,
		CSRFToken:        csrfToken,
	}, nil
}

func (m *Manager) ParseAccessToken(raw string) (*Claims, error) {
	return m.parse(raw, []byte(m.cfg.AccessSecret), TokenTypeAccess)
}

func (m *Manager) ParseRefreshToken(raw string) (*Claims, error) {
	return m.parse(raw, []byte(m.cfg.RefreshSecret), TokenTypeRefresh)
}

func (m *Manager) parse(raw string, secret []byte, expected TokenType) (*Claims, error) {
	token, err := jwt.ParseWithClaims(raw, &Claims{}, func(token *jwt.Token) (any, error) {
		return secret, nil
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
