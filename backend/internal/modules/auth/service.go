package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/gapak/backend/internal/config"
	"github.com/gapak/backend/internal/domain/common"
	"github.com/gapak/backend/internal/domain/enums"
	"github.com/gapak/backend/internal/domain/model"
	authplatform "github.com/gapak/backend/internal/platform/auth"
	appcrypto "github.com/gapak/backend/internal/platform/crypto"
	apperrors "github.com/gapak/backend/internal/platform/errors"
	"github.com/gapak/backend/internal/platform/privacy"
)

const (
	twoFactorSetupTTL         = 10 * time.Minute
	twoFactorSetupMaxAttempts = 5
	lockoutMaxAttempts        = 10
	lockoutDuration           = 15 * time.Minute
)

type Service struct {
	repo      *Repository
	passwords *authplatform.PasswordManager
	jwt       *authplatform.Manager
	totp      *authplatform.TOTPManager
	encryptor *appcrypto.Encryptor
	privacy   *privacy.Service
	oauthCfg  config.OAuthConfig
}

func NewService(repo *Repository, passwords *authplatform.PasswordManager, jwt *authplatform.Manager, totp *authplatform.TOTPManager, encryptor *appcrypto.Encryptor, privacyService *privacy.Service, oauthCfg config.OAuthConfig) *Service {
	return &Service{
		repo:      repo,
		passwords: passwords,
		jwt:       jwt,
		totp:      totp,
		encryptor: encryptor,
		privacy:   privacyService,
		oauthCfg:  oauthCfg,
	}
}

func (s *Service) Register(ctx context.Context, req RegisterRequest, meta common.RequestMeta) (AuthResponse, string, error) {
	req.Username = strings.ToLower(strings.TrimSpace(req.Username))
	req.DisplayName = strings.TrimSpace(req.DisplayName)

	email, isAnonymous, err := s.privacy.NormalizeRegistrationEmail(req.Email)
	if err != nil {
		return AuthResponse{}, "", err
	}
	if req.PreferAnonymous {
		isAnonymous = true
		email = nil
	}

	passwordHash, err := s.passwords.Hash(req.Password)
	if err != nil {
		return AuthResponse{}, "", err
	}

	user, err := s.repo.CreateUser(ctx, req, email, passwordHash, isAnonymous, s.privacy.DefaultsForUser(isAnonymous))
	if err != nil {
		return AuthResponse{}, "", err
	}

	response, refreshToken, err := s.issueSession(ctx, user, meta)
	if err != nil {
		return AuthResponse{}, "", err
	}

	auditErr := s.repo.CreateAuditEvent(ctx, &user.ID, &response.Session.ID, "auth.register", "user", user.ID, s.privacy.SanitizeAuditMetadata(map[string]any{
		"deviceName":  meta.DeviceName,
		"isAnonymous": user.IsAnonymous,
	}))
	if auditErr != nil {
		zerolog.Ctx(ctx).Error().Err(auditErr).Str("userId", user.ID).Str("sessionId", response.Session.ID).Msg("failed to create audit event for register")
	}
	return response, refreshToken, nil
}

func (s *Service) Login(ctx context.Context, req LoginRequest, meta common.RequestMeta) (AuthResponse, string, error) {
	start := time.Now()
	defer normalizeLoginTiming(start)

	login := strings.ToLower(strings.TrimSpace(req.Login))
	user, err := s.repo.FindUserByLogin(ctx, login)
	if err != nil {
		return AuthResponse{}, "", apperrors.ErrInvalidCredentials
	}
	if err := ensureUserActive(user); err != nil {
		return AuthResponse{}, "", err
	}

	if s.isAccountLocked(user) {
		_ = s.repo.CreateAuditEvent(ctx, &user.ID, nil, "auth.login_blocked_locked", "user", user.ID, s.privacy.SanitizeAuditMetadata(map[string]any{
			"reason":     "account_locked",
			"lockedUtil": user.LockedUntil,
		}))
		return AuthResponse{}, "", apperrors.ErrAccountLocked
	}

	ok, err := s.passwords.Compare(req.Password, user.PasswordHash)
	if err != nil || !ok {
		isLocked, incErr := s.repo.IncrementFailedLoginAttempts(ctx, user.ID, lockoutMaxAttempts, lockoutDuration)
		if incErr != nil {
			zerolog.Ctx(ctx).Error().Err(incErr).Str("userId", user.ID).Msg("failed to increment login attempts")
		}
		if isLocked {
			_ = s.repo.CreateAuditEvent(ctx, &user.ID, nil, "auth.account_locked", "user", user.ID, s.privacy.SanitizeAuditMetadata(map[string]any{
				"reason":      "max_attempts_exceeded",
				"maxAttempts": lockoutMaxAttempts,
				"lockoutSec":  int(lockoutDuration.Seconds()),
			}))
		} else {
			_ = s.repo.CreateAuditEvent(ctx, &user.ID, nil, "auth.login_failed", "user", user.ID, s.privacy.SanitizeAuditMetadata(map[string]any{
				"reason": "invalid_password",
			}))
		}
		return AuthResponse{}, "", apperrors.ErrInvalidCredentials
	}

	if err := s.repo.ResetFailedLoginAttempts(ctx, user.ID); err != nil {
		zerolog.Ctx(ctx).Error().Err(err).Str("userId", user.ID).Msg("failed to reset login attempts")
	}

	if user.TwoFactorEnabled {
		if strings.TrimSpace(req.TOTPCode) == "" {
			return AuthResponse{}, "", apperrors.New(401, "auth.two_factor_required", "Two-factor code is required")
		}
		secret, err := s.decryptTOTPSecret(user)
		if err != nil {
			return AuthResponse{}, "", apperrors.ErrInternal
		}
		if !s.totp.ValidateWithWindow(req.TOTPCode, secret) {
			return AuthResponse{}, "", apperrors.New(401, "auth.two_factor_invalid", "Invalid two-factor code")
		}
	}

	response, refreshToken, err := s.issueSession(ctx, user, common.RequestMeta{
		IP:                meta.IP,
		UserAgent:         meta.UserAgent,
		DeviceName:        strings.TrimSpace(req.DeviceName),
		DeviceFingerprint: meta.DeviceFingerprint,
	})
	if err != nil {
		return AuthResponse{}, "", err
	}

	_ = s.repo.CreateDeviceLoginAlert(ctx, user.ID, response.Session.ID)

	_ = s.repo.CreateAuditEvent(ctx, &user.ID, &response.Session.ID, "auth.login", "session", response.Session.ID, s.privacy.SanitizeAuditMetadata(map[string]any{
		"deviceName":  strings.TrimSpace(req.DeviceName),
		"isAnonymous": user.IsAnonymous,
	}))

	return response, refreshToken, nil
}

func (s *Service) isAccountLocked(user *model.User) bool {
	if user.LockedUntil == nil {
		return false
	}
	if user.LockedUntil.Before(time.Now().UTC()) {
		return false
	}
	return user.FailedLoginAttempts >= lockoutMaxAttempts
}

func (s *Service) Refresh(ctx context.Context, rawRefreshToken string) (AuthResponse, string, error) {
	claims, err := s.jwt.ParseRefreshToken(rawRefreshToken)
	if err != nil {
		return AuthResponse{}, "", apperrors.ErrInvalidToken
	}

	session, err := s.repo.FindSessionByID(ctx, claims.SessionID)
	if err != nil || session.RevokedAt != nil || session.ExpiresAt.Before(time.Now().UTC()) {
		return AuthResponse{}, "", apperrors.ErrInvalidToken
	}
	if session.RefreshTokenHash != authplatform.HashOpaqueToken(rawRefreshToken) {
		_ = s.repo.CreateAuditEvent(ctx, &session.UserID, &session.ID, "auth.refresh_replay_detected", "session", session.ID, s.privacy.SanitizeAuditMetadata(map[string]any{"reason": "refresh_token_hash_mismatch"}))
		_ = s.repo.RevokeSession(ctx, session.ID)
		return AuthResponse{}, "", apperrors.ErrInvalidToken
	}

	user, err := s.repo.FindUserByID(ctx, claims.UserID)
	if err != nil {
		return AuthResponse{}, "", apperrors.ErrInvalidToken
	}
	if err := ensureUserActive(user); err != nil {
		return AuthResponse{}, "", err
	}

	pair, err := s.jwt.Issue(user.ID, session.ID, string(user.Role), nil)
	if err != nil {
		return AuthResponse{}, "", err
	}

	oldRefreshHash := authplatform.HashOpaqueToken(rawRefreshToken)
	nextRefreshHash := authplatform.HashOpaqueToken(pair.RefreshToken)
	if err := s.repo.RotateSession(ctx, session.ID, oldRefreshHash, nextRefreshHash, pair.RefreshExpiresAt); err != nil {
		// A failed compare-and-swap means this refresh token was already used
		// (or the session was revoked/expired). Treat it as replay and revoke
		// the session so a stolen token cannot remain usable.
		if errors.Is(err, apperrors.ErrNotFound) {
			_ = s.repo.CreateAuditEvent(ctx, &session.UserID, &session.ID, "auth.refresh_replay_detected", "session", session.ID, s.privacy.SanitizeAuditMetadata(map[string]any{"reason": "rotation_conflict"}))
			_ = s.repo.RevokeSession(ctx, session.ID)
			return AuthResponse{}, "", apperrors.ErrInvalidToken
		}
		return AuthResponse{}, "", err
	}

	session.RefreshTokenHash = nextRefreshHash
	session.ExpiresAt = pair.RefreshExpiresAt
	session.LastUsedAt = time.Now().UTC()

	return s.buildAuthResponse(user, session, pair), pair.RefreshToken, nil
}

func (s *Service) Logout(ctx context.Context, userID, currentSessionID string, allDevices bool) error {
	if allDevices {
		if err := s.repo.RevokeOtherSessions(ctx, userID, currentSessionID); err != nil {
			return err
		}
		if err := s.repo.RevokeSession(ctx, currentSessionID); err != nil {
			return err
		}
		_ = s.repo.CreateAuditEvent(ctx, &userID, &currentSessionID, "auth.logout_all", "user", userID, s.privacy.SanitizeAuditMetadata(nil))
		return nil
	}
	if err := s.repo.RevokeSession(ctx, currentSessionID); err != nil {
		return err
	}
	_ = s.repo.CreateAuditEvent(ctx, &userID, &currentSessionID, "auth.logout", "session", currentSessionID, s.privacy.SanitizeAuditMetadata(nil))
	return nil
}

func (s *Service) decryptTOTPSecret(user *model.User) (string, error) {
	ciphertext := pointerValue(user.TwoFactorSecretCiphertext)
	nonce := pointerValue(user.TwoFactorSecretNonce)
	secret, err := s.encryptor.DecryptWithAAD(ciphertext, nonce, user.ID)
	if err == nil {
		return secret, nil
	}
	// Fallback to legacy ciphertexts without AAD.
	return s.encryptor.Decrypt(ciphertext, nonce)
}

func (s *Service) ForgotPassword(ctx context.Context, req ForgotPasswordRequest) (AcceptedResponse, error) {
	// Normalize timing to prevent distinguishing between non-existent users,
	// anonymous accounts, and real recoverable accounts.
	start := time.Now()
	defer normalizeForgotPasswordTiming(start)

	if !s.privacy.CanUsePasswordRecovery() {
		return AcceptedResponse{}, privacy.ErrPasswordRecoveryDisabled
	}
	user, err := s.repo.FindUserByLogin(ctx, strings.ToLower(strings.TrimSpace(req.Email)))
	if err != nil {
		return AcceptedResponse{Accepted: true}, nil
	}
	if user.Email == nil || user.IsAnonymous {
		// Return the same "accepted" response so the endpoint does not leak
		// whether the account exists or is anonymous.
		return AcceptedResponse{Accepted: true}, nil
	}

	rawToken, err := authplatform.RandomToken(48)
	if err != nil {
		return AcceptedResponse{}, err
	}
	if err := s.repo.StorePasswordResetToken(ctx, user.ID, authplatform.HashOpaqueToken(rawToken), time.Now().UTC().Add(30*time.Minute)); err != nil {
		return AcceptedResponse{}, err
	}
	return AcceptedResponse{Accepted: true}, nil
}

func (s *Service) ResetPassword(ctx context.Context, req ResetPasswordRequest) (AcceptedResponse, error) {
	passwordHash, err := s.passwords.Hash(req.NewPassword)
	if err != nil {
		return AcceptedResponse{}, err
	}

	userID, err := s.repo.ResetPasswordWithToken(ctx, authplatform.HashOpaqueToken(req.Token), passwordHash)
	if err != nil {
		return AcceptedResponse{}, apperrors.New(400, "auth.reset_token_invalid", "Reset token is invalid or expired")
	}

	// Revoke all sessions and access-token revocations after a password reset.
	_ = s.repo.RevokeAllSessions(ctx, userID)
	_ = s.jwt.RevokeUserTokens(ctx, userID)
	_ = s.repo.CreateAuditEvent(ctx, &userID, nil, "auth.password_reset_completed", "user", userID, s.privacy.SanitizeAuditMetadata(nil))

	return AcceptedResponse{Accepted: true}, nil
}

func (s *Service) SetupTwoFactor(ctx context.Context, userID, sessionID string) (TwoFactorSetupResponse, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return TwoFactorSetupResponse{}, err
	}
	if err := ensureUserActive(user); err != nil {
		return TwoFactorSetupResponse{}, err
	}
	if user.TwoFactorEnabled {
		return TwoFactorSetupResponse{}, apperrors.New(409, "auth.two_factor_already_enabled", "Two-factor authentication is already enabled")
	}

	key, err := s.totp.Generate(s.privacy.TOTPLabel(user))
	if err != nil {
		return TwoFactorSetupResponse{}, err
	}

	challengeCiphertext, challengeNonce, err := s.encryptor.EncryptWithAAD(key.Secret(), userID)
	if err != nil {
		return TwoFactorSetupResponse{}, err
	}

	if err := s.repo.UpsertTwoFactorSetupChallenge(
		ctx,
		userID,
		sessionID,
		challengeCiphertext,
		challengeNonce,
		time.Now().UTC().Add(twoFactorSetupTTL),
		twoFactorSetupMaxAttempts,
	); err != nil {
		return TwoFactorSetupResponse{}, err
	}
	_ = s.repo.CreateAuditEvent(ctx, &userID, &sessionID, "auth.2fa_setup_started", "user", userID, s.privacy.SanitizeAuditMetadata(map[string]any{
		"expiresInSeconds": int(twoFactorSetupTTL.Seconds()),
		"maxAttempts":      twoFactorSetupMaxAttempts,
	}))

	return TwoFactorSetupResponse{
		Secret:     key.Secret(),
		OtpAuthURL: key.URL(),
	}, nil
}

func (s *Service) VerifyTwoFactor(ctx context.Context, userID, sessionID string, req VerifyTwoFactorRequest) (AcceptedResponse, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return AcceptedResponse{}, err
	}
	if err := ensureUserActive(user); err != nil {
		return AcceptedResponse{}, err
	}
	if user.TwoFactorEnabled {
		return AcceptedResponse{}, apperrors.New(409, "auth.two_factor_already_enabled", "Two-factor authentication is already enabled")
	}

	challenge, err := s.repo.FindTwoFactorSetupChallenge(ctx, userID)
	if err != nil {
		if err == apperrors.ErrNotFound {
			return AcceptedResponse{}, apperrors.New(400, "auth.two_factor_setup_expired", "2FA setup request expired")
		}
		return AcceptedResponse{}, err
	}
	if challenge.ExpiresAt.Before(time.Now().UTC()) {
		_ = s.repo.DeleteTwoFactorSetupChallenge(ctx, userID)
		return AcceptedResponse{}, apperrors.New(400, "auth.two_factor_setup_expired", "2FA setup request expired")
	}
	if challenge.SetupSessionID != sessionID {
		return AcceptedResponse{}, apperrors.New(403, "auth.two_factor_session_mismatch", "2FA setup must be completed from the same session")
	}

	secret, err := s.encryptor.DecryptWithAAD(challenge.SecretCiphertext, challenge.SecretNonce, userID)
	if err != nil {
		secret, err = s.encryptor.Decrypt(challenge.SecretCiphertext, challenge.SecretNonce)
	}
	if err != nil {
		return AcceptedResponse{}, apperrors.ErrInternal
	}

	code := strings.TrimSpace(req.Code)
	if !s.totp.ValidateWithWindow(code, secret) {
		attempts, maxAttempts, err := s.repo.RegisterFailedTwoFactorSetupAttempt(ctx, userID)
		if err != nil && err != apperrors.ErrNotFound {
			return AcceptedResponse{}, err
		}
		if err == apperrors.ErrNotFound || attempts >= maxAttempts {
			_ = s.repo.CreateAuditEvent(ctx, &userID, &sessionID, "auth.2fa_setup_invalidated", "user", userID, s.privacy.SanitizeAuditMetadata(map[string]any{
				"reason": "max_attempts_exceeded",
			}))
			return AcceptedResponse{}, apperrors.New(400, "auth.two_factor_setup_expired", "2FA setup request expired")
		}
		return AcceptedResponse{}, apperrors.WithDetails(apperrors.New(400, "auth.two_factor_invalid", "Invalid two-factor code"), map[string]any{
			"attemptsRemaining": maxAttempts - attempts,
		})
	}

	ciphertext, nonce, err := s.encryptor.EncryptWithAAD(secret, userID)
	if err != nil {
		return AcceptedResponse{}, err
	}
	if err := s.repo.CompleteTwoFactorSetup(ctx, userID, ciphertext, nonce); err != nil {
		return AcceptedResponse{}, err
	}
	_ = s.repo.CreateAuditEvent(ctx, &userID, &sessionID, "auth.2fa_enabled", "user", userID, s.privacy.SanitizeAuditMetadata(map[string]any{"method": "totp"}))
	return AcceptedResponse{Accepted: true}, nil
}

func (s *Service) DisableTwoFactor(ctx context.Context, userID, sessionID string) (AcceptedResponse, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return AcceptedResponse{}, err
	}
	if err := ensureUserActive(user); err != nil {
		return AcceptedResponse{}, err
	}
	if !user.TwoFactorEnabled {
		return AcceptedResponse{Accepted: true}, nil
	}
	if err := s.repo.DisableTwoFactor(ctx, userID); err != nil {
		return AcceptedResponse{}, err
	}
	_ = s.repo.CreateAuditEvent(ctx, &userID, &sessionID, "auth.2fa_disabled", "user", userID, s.privacy.SanitizeAuditMetadata(map[string]any{"method": "totp"}))
	return AcceptedResponse{Accepted: true}, nil
}

func (s *Service) issueSession(ctx context.Context, user *model.User, meta common.RequestMeta) (AuthResponse, string, error) {
	sessionID := uuid.NewString()
	pair, err := s.jwt.Issue(user.ID, sessionID, string(user.Role), nil)
	if err != nil {
		return AuthResponse{}, "", err
	}

	session := model.DeviceSession{
		ID:                 sessionID,
		UserID:             user.ID,
		RefreshTokenHash:   authplatform.HashOpaqueToken(pair.RefreshToken),
		RefreshTokenFamily: uuid.NewString(),
		UserAgent:          stringPointer(meta.UserAgent),
		DeviceName:         stringPointer(meta.DeviceName),
		DeviceFingerprint:  stringPointer(meta.DeviceFingerprint),
		IPAddress:          stringPointer(meta.IP),
		IsCurrent:          true,
		SecurityLevel:      enums.SessionSecurityTrusted,
		LastUsedAt:         time.Now().UTC(),
		ExpiresAt:          pair.RefreshExpiresAt,
	}
	if err := s.repo.CreateSession(ctx, session); err != nil {
		return AuthResponse{}, "", err
	}

	sessionCopy := session
	sessionCopy.CreatedAt = time.Now().UTC()
	return s.buildAuthResponse(user, &sessionCopy, pair), pair.RefreshToken, nil
}

func (s *Service) buildAuthResponse(user *model.User, session *model.DeviceSession, pair authplatform.TokenPair) AuthResponse {
	return AuthResponse{
		User: AuthUser{
			ID:               user.ID,
			Email:            s.privacy.PublicEmail(user),
			Username:         user.Username,
			DisplayName:      user.DisplayName,
			Role:             string(user.Role),
			IsAnonymous:      user.IsAnonymous,
			TwoFactorEnabled: user.TwoFactorEnabled,
		},
		Session: AuthSession{
			ID:            session.ID,
			DeviceName:    s.privacy.SessionDeviceName(session),
			UserAgent:     s.privacy.SessionUserAgent(session),
			IPAddress:     s.privacy.SessionIPAddress(session),
			SecurityLevel: string(session.SecurityLevel),
			LastUsedAt:    session.LastUsedAt,
			ExpiresAt:     session.ExpiresAt,
			CreatedAt:     session.CreatedAt,
		},
		AccessToken:  pair.AccessToken,
		AccessTTL:    pair.AccessTokenTTL,
		RefreshTTL:   pair.RefreshTokenTTL,
		CSRFToken:    pair.CSRFToken,
		RefreshUntil: pair.RefreshExpiresAt,
	}
}

func pointerValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func stringPointer(value string) *string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return &value
}

func ensureUserActive(user *model.User) error {
	if user == nil || user.AccountStatus == enums.AccountStatusDeleted {
		return apperrors.ErrInvalidCredentials
	}
	if user.AccountStatus == enums.AccountStatusSuspended {
		return apperrors.New(403, "auth.account_suspended", "Account is suspended")
	}
	return nil
}

func (s *Service) RevokeAccessToken(ctx context.Context, jti string) error {
	return s.jwt.RevokeAccessToken(ctx, jti)
}

func (s *Service) RevokeUserTokens(ctx context.Context, userID string) error {
	return s.jwt.RevokeUserTokens(ctx, userID)
}

func (s *Service) GetOAuthRedirectURL(ctx context.Context, provider string, state, codeChallenge string) (string, error) {
	providerCfg, err := s.getOAuthProviderConfig(provider)
	if err != nil {
		return "", err
	}
	return buildAuthorizeURL(providerCfg, state, codeChallenge), nil
}

func (s *Service) HandleOAuthCallback(ctx context.Context, provider, code, codeVerifier string, meta common.RequestMeta) (AuthResponse, string, error) {
	providerCfg, err := s.getOAuthProviderConfig(provider)
	if err != nil {
		return AuthResponse{}, "", err
	}

	accessToken, err := exchangeCodeForToken(providerCfg, code, codeVerifier)
	if err != nil {
		return AuthResponse{}, "", apperrors.New(400, "auth.oauth_exchange_failed", "Failed to exchange authorization code")
	}

	userInfo, err := s.fetchOAuthUserInfo(provider, accessToken)
	if err != nil {
		return AuthResponse{}, "", apperrors.New(400, "auth.oauth_userinfo_failed", "Failed to fetch user information from provider")
	}

	if userInfo.ProviderUserID == "" {
		return AuthResponse{}, "", apperrors.New(400, "auth.oauth_no_user_id", "Provider did not return a user ID")
	}

	// Try to find existing social account
	socialAccount, err := s.repo.FindSocialAccount(ctx, provider, userInfo.ProviderUserID)
	if err == nil && socialAccount != nil {
		// Existing social account found - login the user
		user, err := s.repo.FindUserByID(ctx, socialAccount.UserID)
		if err != nil {
			return AuthResponse{}, "", apperrors.ErrInvalidCredentials
		}
		if err := ensureUserActive(user); err != nil {
			return AuthResponse{}, "", err
		}
		if err := ensureOAuthLoginAllowed(user); err != nil {
			return AuthResponse{}, "", err
		}
		response, refreshToken, err := s.issueSession(ctx, user, meta)
		if err == nil {
			_ = s.repo.CreateAuditEvent(ctx, &user.ID, &response.Session.ID, "auth.oauth_login", "session", response.Session.ID, s.privacy.SanitizeAuditMetadata(map[string]any{"provider": provider}))
		}
		return response, refreshToken, err
	}

	// No existing social account - only use a provider email for account
	// linking when the provider explicitly verified it. Unverified email
	// claims must never become an account-takeover primitive.
	verifiedEmail := ""
	if userInfo.EmailVerified {
		verifiedEmail = strings.ToLower(strings.TrimSpace(userInfo.Email))
	}
	var user *model.User
	if verifiedEmail != "" {
		user, err = s.repo.FindUserByEmail(ctx, verifiedEmail)
	}

	if user != nil {
		if err := ensureOAuthLoginAllowed(user); err != nil {
			return AuthResponse{}, "", err
		}
		// User exists with this email - link the social account
		if err := s.repo.LinkSocialAccount(ctx, user.ID, provider, userInfo.ProviderUserID, verifiedEmail, userInfo.DisplayName, userInfo.AvatarURL); err != nil {
			return AuthResponse{}, "", err
		}
		response, refreshToken, err := s.issueSession(ctx, user, meta)
		if err == nil {
			_ = s.repo.CreateAuditEvent(ctx, &user.ID, &response.Session.ID, "auth.oauth_linked_login", "session", response.Session.ID, s.privacy.SanitizeAuditMetadata(map[string]any{"provider": provider}))
		}
		return response, refreshToken, err
	}

	// Create a new user
	username, err := s.repo.GenerateUniqueUsername(ctx, extractUsernameBase(userInfo.DisplayName, userInfo.Email))
	if err != nil {
		return AuthResponse{}, "", apperrors.New(500, "auth.username_generation_failed", "Failed to generate username")
	}

	displayName := userInfo.DisplayName
	if displayName == "" {
		displayName = username
	}

	user, err = s.repo.CreateUserFromOAuth(ctx, verifiedEmail, displayName, userInfo.AvatarURL, username)
	if err != nil {
		return AuthResponse{}, "", err
	}

	// Link the social account
	if _, err := s.repo.CreateSocialAccount(ctx, user.ID, provider, userInfo.ProviderUserID, verifiedEmail, userInfo.DisplayName, userInfo.AvatarURL); err != nil {
		// Log but don't fail - user is already created
		zerolog.Ctx(ctx).Error().Err(err).Str("userId", user.ID).Str("provider", provider).Msg("failed to link social account")
	}

	response, refreshToken, err := s.issueSession(ctx, user, meta)
	if err == nil {
		_ = s.repo.CreateAuditEvent(ctx, &user.ID, &response.Session.ID, "auth.oauth_register", "session", response.Session.ID, s.privacy.SanitizeAuditMetadata(map[string]any{"provider": provider}))
	}
	return response, refreshToken, err
}

func ensureOAuthLoginAllowed(user *model.User) error {
	if user != nil && user.TwoFactorEnabled {
		return apperrors.New(401, "auth.two_factor_required", "Two-factor authentication is required; use password login")
	}
	return nil
}

func (s *Service) getOAuthProviderConfig(provider string) (config.OAuthProviderConfig, error) {
	switch strings.ToLower(provider) {
	case "google":
		cfg := s.oauthCfg.Google
		if cfg.ClientID == "" {
			return config.OAuthProviderConfig{}, apperrors.New(501, "auth.oauth_provider_disabled", "Google login is not configured")
		}
		return cfg, nil
	case "github":
		cfg := s.oauthCfg.GitHub
		if cfg.ClientID == "" {
			return config.OAuthProviderConfig{}, apperrors.New(501, "auth.oauth_provider_disabled", "GitHub login is not configured")
		}
		return cfg, nil
	case "facebook":
		cfg := s.oauthCfg.Facebook
		if cfg.ClientID == "" {
			return config.OAuthProviderConfig{}, apperrors.New(501, "auth.oauth_provider_disabled", "Facebook login is not configured")
		}
		return cfg, nil
	default:
		return config.OAuthProviderConfig{}, apperrors.New(400, "auth.oauth_unknown_provider", "Unknown OAuth provider")
	}
}

func (s *Service) fetchOAuthUserInfo(provider, accessToken string) (*oauthUserInfo, error) {
	switch strings.ToLower(provider) {
	case "google":
		return fetchGoogleUserInfo(accessToken)
	case "github":
		return fetchGitHubUserInfo(accessToken)
	case "facebook":
		return fetchFacebookUserInfo(accessToken)
	default:
		return nil, fmt.Errorf("unknown provider: %s", provider)
	}
}

func extractUsernameBase(displayName, email string) string {
	if displayName != "" {
		base := strings.ToLower(strings.TrimSpace(displayName))
		cleaned := ""
		for _, c := range base {
			if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_' {
				cleaned += string(c)
			}
		}
		if cleaned != "" {
			return cleaned
		}
	}
	if email != "" {
		parts := strings.SplitN(email, "@", 2)
		if len(parts) > 0 {
			return parts[0]
		}
	}
	return "user"
}

const targetLoginLatency = 400 * time.Millisecond

func normalizeLoginTiming(start time.Time) {
	if elapsed := time.Since(start); elapsed < targetLoginLatency {
		time.Sleep(targetLoginLatency - elapsed)
	}
}

const targetForgotPasswordLatency = 150 * time.Millisecond

func normalizeForgotPasswordTiming(start time.Time) {
	if elapsed := time.Since(start); elapsed < targetForgotPasswordLatency {
		time.Sleep(targetForgotPasswordLatency - elapsed)
	}
}
