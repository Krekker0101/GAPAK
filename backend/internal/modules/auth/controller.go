package auth

import (
	"crypto/sha256"
	"encoding/base64"
	"net/url"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"

	"github.com/gapak/backend/internal/config"
	"github.com/gapak/backend/internal/domain/common"
	authplatform "github.com/gapak/backend/internal/platform/auth"
	"github.com/gapak/backend/internal/platform/csrf"
	apperrors "github.com/gapak/backend/internal/platform/errors"
	"github.com/gapak/backend/internal/platform/httpx"
	"github.com/gapak/backend/internal/platform/middleware"
	"github.com/gapak/backend/internal/platform/privacy"
)

type Controller struct {
	service               *Service
	jwt                   *authplatform.Manager
	validate              *validator.Validate
	config                config.SecurityConfig
	privacy               *privacy.Service
	csrf                  csrf.Store
	allowedOrigins        []string
	configuredFrontendURL string
}

func NewController(service *Service, validate *validator.Validate, cfg config.SecurityConfig, privacyService *privacy.Service, csrfStore csrf.Store, jwtManager *authplatform.Manager, frontendRedirectURL string, allowedOrigins ...string) *Controller {
	return &Controller{service: service, jwt: jwtManager, validate: validate, config: cfg, privacy: privacyService, csrf: csrfStore, allowedOrigins: allowedOrigins, configuredFrontendURL: strings.TrimRight(strings.TrimSpace(frontendRedirectURL), "/") + "/"}
}

func (ctl *Controller) RegisterRoutes(router fiber.Router, requireAuth fiber.Handler, authLimiter fiber.Handler, passwordLimiter fiber.Handler) {
	group := router.Group("/auth")
	group.Get("/csrf", ctl.issueCSRFToken)
	group.Post("/register", authLimiter, middleware.ValidateCSRFForMutations(ctl.csrf, ctl.jwt, ctl.config, ctl.allowedOrigins...), ctl.register)
	group.Post("/register-anonymous", authLimiter, middleware.ValidateCSRFForMutations(ctl.csrf, ctl.jwt, ctl.config, ctl.allowedOrigins...), ctl.registerAnonymous)
	group.Post("/login", authLimiter, middleware.ValidateCSRFForMutations(ctl.csrf, ctl.jwt, ctl.config, ctl.allowedOrigins...), ctl.login)
	// Refresh performs conditional CSRF validation itself when a refresh cookie is used.
	// Do not wrap it in the unconditional mutation middleware: a first-load request
	// without a refresh cookie must return 401 rather than an unrelated CSRF 403.
	group.Post("/refresh", authLimiter, ctl.refresh)
	group.Post("/forgot-password", passwordLimiter, middleware.ValidateCSRFForMutations(ctl.csrf, ctl.jwt, ctl.config, ctl.allowedOrigins...), ctl.forgotPassword)
	group.Post("/reset-password", passwordLimiter, middleware.ValidateCSRFForMutations(ctl.csrf, ctl.jwt, ctl.config, ctl.allowedOrigins...), ctl.resetPassword)
	group.Post("/logout", requireAuth, middleware.ValidateCSRFForMutations(ctl.csrf, ctl.jwt, ctl.config, ctl.allowedOrigins...), ctl.logout)
	group.Post("/2fa/setup", requireAuth, middleware.ValidateCSRFForMutations(ctl.csrf, ctl.jwt, ctl.config, ctl.allowedOrigins...), ctl.setupTwoFactor)
	group.Post("/2fa/verify", requireAuth, middleware.ValidateCSRFForMutations(ctl.csrf, ctl.jwt, ctl.config, ctl.allowedOrigins...), ctl.verifyTwoFactor)
	group.Post("/2fa/disable", requireAuth, middleware.ValidateCSRFForMutations(ctl.csrf, ctl.jwt, ctl.config, ctl.allowedOrigins...), ctl.disableTwoFactor)

	group.Get("/oauth/:provider", ctl.oauthRedirect)
	group.Post("/oauth/:provider", ctl.oauthLogin)
	group.Get("/callback/:provider", ctl.oauthCallback)
}

func (ctl *Controller) issueCSRFToken(c *fiber.Ctx) error {
	sessionID := middleware.SessionIDForRequest(c, ctl.jwt, ctl.config)
	ttl := 15 * time.Minute
	if refresh := strings.TrimSpace(c.Cookies(ctl.config.RefreshCookieName)); refresh != "" {
		if claims, err := ctl.jwt.ParseRefreshToken(refresh); err == nil && claims.ExpiresAt != nil {
			remaining := time.Until(claims.ExpiresAt.Time)
			if remaining > 0 && remaining < ttl {
				ttl = remaining
			}
		}
	}
	token, err := ctl.csrf.Issue(c.UserContext(), sessionID, ttl)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(map[string]any{"csrfToken": token, "hasSession": sessionID != ""}, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) register(c *fiber.Ctx) error {
	payload, err := httpx.BindBody[RegisterRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	response, refreshToken, err := ctl.service.Register(c.UserContext(), payload, ctl.requestMeta(c, payload.DeviceName, payload.DeviceFingerprint))
	if err != nil {
		return err
	}
	authplatform.SetAccessCookie(c, ctl.config, response.AccessToken, time.Now().UTC().Add(time.Duration(response.AccessTTL)*time.Second))
	authplatform.SetRefreshCookie(c, ctl.config, refreshToken, response.RefreshUntil)
	if err := ctl.attachCSRF(c, &response); err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) login(c *fiber.Ctx) error {
	payload, err := httpx.BindBody[LoginRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	response, refreshToken, err := ctl.service.Login(c.UserContext(), payload, ctl.requestMeta(c, payload.DeviceName, payload.DeviceFingerprint))
	if err != nil {
		return err
	}
	authplatform.SetAccessCookie(c, ctl.config, response.AccessToken, time.Now().UTC().Add(time.Duration(response.AccessTTL)*time.Second))
	authplatform.SetRefreshCookie(c, ctl.config, refreshToken, response.RefreshUntil)
	if err := ctl.attachCSRF(c, &response); err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) registerAnonymous(c *fiber.Ctx) error {
	payload, err := httpx.BindBody[RegisterRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	payload.Email = ""
	payload.PreferAnonymous = true
	response, refreshToken, err := ctl.service.Register(c.UserContext(), payload, ctl.requestMeta(c, payload.DeviceName, payload.DeviceFingerprint))
	if err != nil {
		return err
	}
	authplatform.SetAccessCookie(c, ctl.config, response.AccessToken, time.Now().UTC().Add(time.Duration(response.AccessTTL)*time.Second))
	authplatform.SetRefreshCookie(c, ctl.config, refreshToken, response.RefreshUntil)
	if err := ctl.attachCSRF(c, &response); err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) refresh(c *fiber.Ctx) error {
	rawToken := strings.TrimSpace(c.Cookies(ctl.config.RefreshCookieName))
	if rawToken == "" {
		return apperrors.ErrUnauthorized
	}
	if err := middleware.ValidateCSRFForMutations(ctl.csrf, ctl.jwt, ctl.config, ctl.allowedOrigins...)(c); err != nil {
		return err
	}

	response, refreshToken, err := ctl.service.Refresh(c.UserContext(), rawToken)
	if err != nil {
		return err
	}
	authplatform.SetAccessCookie(c, ctl.config, response.AccessToken, time.Now().UTC().Add(time.Duration(response.AccessTTL)*time.Second))
	authplatform.SetRefreshCookie(c, ctl.config, refreshToken, response.RefreshUntil)
	if err := ctl.attachCSRF(c, &response); err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) logout(c *fiber.Ctx) error {
	var payload LogoutRequest
	if len(c.Body()) > 0 {
		var err error
		payload, err = httpx.BindBody[LogoutRequest](c, ctl.validate)
		if err != nil {
			return err
		}
	}
	if strings.TrimSpace(c.Cookies(ctl.config.RefreshCookieName)) != "" {
		if err := middleware.ValidateCSRF(ctl.csrf, ctl.jwt, ctl.config, ctl.allowedOrigins...)(c); err != nil {
			return err
		}
	}
	claims := middleware.ClaimsFromContext(c)
	if err := ctl.service.Logout(c.UserContext(), claims.UserID, claims.SessionID, payload.AllDevices); err != nil {
		return err
	}
	if payload.AllDevices {
		_ = ctl.service.RevokeUserTokens(c.UserContext(), claims.UserID)
	} else {
		_ = ctl.service.RevokeAccessToken(c.UserContext(), claims.ID)
	}
	authplatform.ClearAuthCookies(c, ctl.config)
	_ = ctl.csrf.Delete(c.UserContext(), claims.SessionID)
	return c.JSON(httpx.OK(AcceptedResponse{Accepted: true}, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) forgotPassword(c *fiber.Ctx) error {
	payload, err := httpx.BindBody[ForgotPasswordRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	response, err := ctl.service.ForgotPassword(c.UserContext(), payload)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) resetPassword(c *fiber.Ctx) error {
	payload, err := httpx.BindBody[ResetPasswordRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	response, err := ctl.service.ResetPassword(c.UserContext(), payload)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) setupTwoFactor(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.SetupTwoFactor(c.UserContext(), claims.UserID, claims.SessionID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) verifyTwoFactor(c *fiber.Ctx) error {
	payload, err := httpx.BindBody[VerifyTwoFactorRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.VerifyTwoFactor(c.UserContext(), claims.UserID, claims.SessionID, payload)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) disableTwoFactor(c *fiber.Ctx) error {
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.DisableTwoFactor(c.UserContext(), claims.UserID, claims.SessionID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) attachCSRF(c *fiber.Ctx, response *AuthResponse) error {
	token, err := ctl.issueSessionCSRF(c, response.Session.ID, response.RefreshUntil)
	if err != nil {
		return err
	}
	response.CSRFToken = token
	return nil
}

// issueSessionCSRF issues a CSRF token bound to sessionID, capping its TTL to
// whichever is sooner: 15 minutes, or the remaining time until refreshUntil.
func (ctl *Controller) issueSessionCSRF(c *fiber.Ctx, sessionID string, refreshUntil time.Time) (string, error) {
	ttl := 15 * time.Minute
	if remaining := time.Until(refreshUntil); remaining > 0 && remaining < ttl {
		ttl = remaining
	}
	return ctl.csrf.Issue(c.UserContext(), sessionID, ttl)
}

func (ctl *Controller) requestMeta(c *fiber.Ctx, deviceName, deviceFingerprint string) common.RequestMeta {
	if ctl.privacy != nil {
		return ctl.privacy.RequestMeta(c, deviceName, deviceFingerprint)
	}
	return common.RequestMeta{IP: c.IP(), UserAgent: c.Get(fiber.HeaderUserAgent), DeviceName: deviceName, DeviceFingerprint: deviceFingerprint}
}

func (ctl *Controller) oauthRedirect(c *fiber.Ctx) error {
	provider := c.Params("provider")
	if provider == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Provider is required")
	}
	state, err := authplatform.RandomToken(32)
	if err != nil {
		return err
	}
	codeVerifier, err := authplatform.RandomToken(48)
	if err != nil {
		return err
	}
	hash := sha256.Sum256([]byte(codeVerifier))
	codeChallenge := base64.RawURLEncoding.EncodeToString(hash[:])
	c.Cookie(&fiber.Cookie{Name: "oauth_state", Value: state, Path: "/", MaxAge: 600, HTTPOnly: true, Secure: ctl.config.CookieSecure, SameSite: fiber.CookieSameSiteLaxMode, Domain: controllerCookieDomain(ctl.config.CookieDomain)})
	c.Cookie(&fiber.Cookie{Name: "oauth_pkce", Value: codeVerifier, Path: "/", MaxAge: 600, HTTPOnly: true, Secure: ctl.config.CookieSecure, SameSite: fiber.CookieSameSiteLaxMode, Domain: controllerCookieDomain(ctl.config.CookieDomain)})
	redirectURL, err := ctl.service.GetOAuthRedirectURL(c.UserContext(), provider, state, codeChallenge)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(map[string]string{"url": redirectURL}, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) oauthLogin(c *fiber.Ctx) error {
	provider := c.Params("provider")
	if provider == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Provider is required")
	}
	state, err := authplatform.RandomToken(32)
	if err != nil {
		return err
	}
	codeVerifier, err := authplatform.RandomToken(48)
	if err != nil {
		return err
	}
	hash := sha256.Sum256([]byte(codeVerifier))
	codeChallenge := base64.RawURLEncoding.EncodeToString(hash[:])
	c.Cookie(&fiber.Cookie{Name: "oauth_state", Value: state, Path: "/", MaxAge: 600, HTTPOnly: true, Secure: ctl.config.CookieSecure, SameSite: fiber.CookieSameSiteLaxMode, Domain: controllerCookieDomain(ctl.config.CookieDomain)})
	c.Cookie(&fiber.Cookie{Name: "oauth_pkce", Value: codeVerifier, Path: "/", MaxAge: 600, HTTPOnly: true, Secure: ctl.config.CookieSecure, SameSite: fiber.CookieSameSiteLaxMode, Domain: controllerCookieDomain(ctl.config.CookieDomain)})
	redirectURL, err := ctl.service.GetOAuthRedirectURL(c.UserContext(), provider, state, codeChallenge)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(map[string]string{"url": redirectURL}, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) oauthCallback(c *fiber.Ctx) error {
	provider := c.Params("provider")
	code := c.Query("code")
	state := c.Query("state")
	savedState := c.Cookies("oauth_state")
	codeVerifier := c.Cookies("oauth_pkce")
	if savedState == "" || state == "" || savedState != state || codeVerifier == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid OAuth state")
	}
	for _, name := range []string{"oauth_state", "oauth_pkce"} {
		c.Cookie(&fiber.Cookie{Name: name, Value: "", Path: "/", MaxAge: -1, HTTPOnly: true, Secure: ctl.config.CookieSecure, SameSite: fiber.CookieSameSiteLaxMode, Domain: controllerCookieDomain(ctl.config.CookieDomain)})
	}
	if code == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Authorization code is required")
	}
	meta := common.RequestMeta{IP: c.IP(), UserAgent: c.Get(fiber.HeaderUserAgent)}
	response, refreshToken, err := ctl.service.HandleOAuthCallback(c.UserContext(), provider, code, codeVerifier, meta)
	if err != nil {
		return c.Redirect(ctl.oauthErrorRedirect("oauth_failed"), fiber.StatusTemporaryRedirect)
	}
	authplatform.SetAccessCookie(c, ctl.config, response.AccessToken, time.Now().UTC().Add(time.Duration(response.AccessTTL)*time.Second))
	authplatform.SetRefreshCookie(c, ctl.config, refreshToken, response.RefreshUntil)
	return c.Redirect(strings.TrimRight(ctl.configuredFrontendRedirect(), "/")+"/", fiber.StatusTemporaryRedirect)
}

func (ctl *Controller) configuredFrontendRedirect() string {
	if ctl.configuredFrontendURL != "" {
		return ctl.configuredFrontendURL
	}
	return "/"
}

func (ctl *Controller) oauthErrorRedirect(code string) string {
	base := strings.TrimRight(ctl.configuredFrontendRedirect(), "/") + "/login"
	if code == "" {
		return base
	}
	return base + "?error=" + url.QueryEscape(code)
}

func controllerCookieSameSite(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "strict":
		return fiber.CookieSameSiteStrictMode
	case "none":
		return fiber.CookieSameSiteNoneMode
	default:
		return fiber.CookieSameSiteLaxMode
	}
}

func controllerCookieDomain(raw string) string {
	domain := strings.TrimSpace(raw)
	if domain == "" || strings.EqualFold(domain, "localhost") || domain == "127.0.0.1" || domain == "::1" {
		return ""
	}
	return domain
}
