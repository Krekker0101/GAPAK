package auth

import (
	"context"
	"html"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

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
	loginFailDelayBase        = 200 * time.Millisecond
	loginFailDelayMax         = 2 * time.Second
)

type Service struct {
	repo      *Repository
	passwords *authplatform.PasswordManager
	jwt       *authplatform.Manager
	totp      *authplatform.TOTPManager
	encryptor *appcrypto.Encryptor
	privacy   *privacy.Service
}

func NewService(repo *Repository, passwords *authplatform.PasswordManager, jwt *authplatform.Manager, totp *authplatform.TOTPManager, encryptor *appcrypto.Encryptor, privacyService *privacy.Service) *Service {
	return &Service{
		repo:      repo,
		passwords: passwords,
		jwt:       jwt,
		totp:      totp,
		encryptor: encryptor,
		privacy:   privacyService,
	}
}

func (s *Service) Register(ctx context.Context, req RegisterRequest, meta common.RequestMeta) (AuthResponse, string, error) {
	req.Username = strings.ToLower(strings.TrimSpace(req.Username))
	req.DisplayName = html.EscapeString(strings.TrimSpace(req.DisplayName))

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
	login := strings.ToLower(strings.TrimSpace(req.Login))
	user, err := s.repo.FindUserByLogin(ctx, login)
	if err != nil {
		applyLoginFailDelay("")
		return AuthResponse{}, "", apperrors.ErrInvalidCredentials
	}
	if err := ensureUserActive(user); err != nil {
		applyLoginFailDelay("")
		return AuthResponse{}, "", err
	}

	ok, err := s.passwords.Compare(req.Password, user.PasswordHash)
	if err != nil || !ok {
		applyLoginFailDelay(user.PasswordHash)
		return AuthResponse{}, "", apperrors.ErrInvalidCredentials
	}

	if user.TwoFactorEnabled {
		if strings.TrimSpace(req.TOTPCode) == "" {
			return AuthResponse{}, "", apperrors.New(401, "auth.two_factor_required", "Two-factor code is required")
		}
		secret, err := s.encryptor.Decrypt(pointerValue(user.TwoFactorSecretCiphertext), pointerValue(user.TwoFactorSecretNonce))
		if err != nil {
			return AuthResponse{}, "", apperrors.ErrInternal
		}
		if !s.totp.ValidateWithWindow(req.TOTPCode, secret) {
			applyLoginFailDelay(user.PasswordHash)
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

	auditErr := s.repo.CreateAuditEvent(ctx, &user.ID, &response.Session.ID, "auth.login", "session", response.Session.ID, s.privacy.SanitizeAuditMetadata(map[string]any{
		"deviceName":  strings.TrimSpace(req.DeviceName),
		"isAnonymous": user.IsAnonymous,
	}))
	if auditErr != nil {
		zerolog.Ctx(ctx).Error().Err(auditErr).Str("userId", user.ID).Str("sessionId", response.Session.ID).Msg("failed to create audit event for login")
	}

	return response, refreshToken, nil
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

	if err := s.repo.RotateSession(ctx, session.ID, authplatform.HashOpaqueToken(pair.RefreshToken), pair.RefreshExpiresAt); err != nil {
		return AuthResponse{}, "", err
	}

	session.RefreshTokenHash = authplatform.HashOpaqueToken(pair.RefreshToken)
	session.ExpiresAt = pair.RefreshExpiresAt
	session.LastUsedAt = time.Now().UTC()

	return s.buildAuthResponse(user, session, pair), pair.RefreshToken, nil
}

func (s *Service) Logout(ctx context.Context, userID, currentSessionID string, allDevices bool) error {
	if allDevices {
		if err := s.repo.RevokeOtherSessions(ctx, userID, currentSessionID); err != nil {
			return err
		}
		return s.repo.RevokeSession(ctx, currentSessionID)
	}
	return s.repo.RevokeSession(ctx, currentSessionID)
}

func (s *Service) ForgotPassword(ctx context.Context, req ForgotPasswordRequest) (AcceptedResponse, error) {
	if !s.privacy.CanUsePasswordRecovery() {
		return AcceptedResponse{}, privacy.ErrPasswordRecoveryDisabled
	}
	user, err := s.repo.FindUserByLogin(ctx, strings.ToLower(strings.TrimSpace(req.Email)))
	if err != nil {
		return AcceptedResponse{Accepted: true}, nil
	}
	if user.Email == nil || user.IsAnonymous {
		return AcceptedResponse{}, privacy.ErrPasswordRecoveryDisabled
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
	resetToken, err := s.repo.FindPasswordResetToken(ctx, authplatform.HashOpaqueToken(req.Token))
	if err != nil {
		return AcceptedResponse{}, apperrors.New(400, "auth.reset_token_invalid", "Reset token is invalid or expired")
	}
	if resetToken.UsedAt != nil || resetToken.ExpiresAt.Before(time.Now().UTC()) {
		return AcceptedResponse{}, apperrors.New(400, "auth.reset_token_invalid", "Reset token is invalid or expired")
	}

	passwordHash, err := s.passwords.Hash(req.NewPassword)
	if err != nil {
		return AcceptedResponse{}, err
	}

	if err := s.repo.UpdatePassword(ctx, resetToken.UserID, passwordHash); err != nil {
		return AcceptedResponse{}, err
	}
	if err := s.repo.MarkPasswordResetUsed(ctx, resetToken.ID); err != nil {
		return AcceptedResponse{}, err
	}

	// Revoke all sessions on password reset for security
	_ = s.repo.RevokeAllSessions(ctx, resetToken.UserID)

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

	challengeCiphertext, challengeNonce, err := s.encryptor.Encrypt(key.Secret())
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

	secret, err := s.encryptor.Decrypt(challenge.SecretCiphertext, challenge.SecretNonce)
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

	ciphertext, nonce, err := s.encryptor.Encrypt(secret)
	if err != nil {
		return AcceptedResponse{}, err
	}
	if err := s.repo.CompleteTwoFactorSetup(ctx, userID, ciphertext, nonce); err != nil {
		return AcceptedResponse{}, err
	}
	_ = s.repo.CreateAuditEvent(ctx, &userID, &sessionID, "auth.2fa_enabled", "user", userID, s.privacy.SanitizeAuditMetadata(map[string]any{"method": "totp"}))
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

func applyLoginFailDelay(passwordHashForTiming string) {
	// Use constant delay to prevent timing side-channels
	time.Sleep(loginFailDelayBase + 100*time.Millisecond)
}
