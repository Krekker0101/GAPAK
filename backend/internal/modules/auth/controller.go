package auth

import (
	"crypto/sha256"
	"encoding/base64"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"

	"github.com/gapak/backend/internal/config"
	"github.com/gapak/backend/internal/domain/common"
	authplatform "github.com/gapak/backend/internal/platform/auth"
	"github.com/gapak/backend/internal/platform/httpx"
	"github.com/gapak/backend/internal/platform/middleware"
	"github.com/gapak/backend/internal/platform/privacy"
)

type Controller struct {
	service  *Service
	validate *validator.Validate
	config   config.SecurityConfig
	privacy  *privacy.Service
}

func NewController(service *Service, validate *validator.Validate, cfg config.SecurityConfig, privacyService *privacy.Service) *Controller {
	return &Controller{service: service, validate: validate, config: cfg, privacy: privacyService}
}

func (ctl *Controller) RegisterRoutes(router fiber.Router, requireAuth fiber.Handler, authLimiter fiber.Handler, passwordLimiter fiber.Handler, idempotency fiber.Handler) {
	group := router.Group("/auth")
	group.Get("/csrf", ctl.csrf)
	group.Post("/register", idempotency, authLimiter, middleware.ValidateCSRFForMutations(ctl.config), ctl.register)
	group.Post("/register-anonymous", idempotency, authLimiter, middleware.ValidateCSRFForMutations(ctl.config), ctl.registerAnonymous)
	group.Post("/login", idempotency, authLimiter, middleware.ValidateCSRFForMutations(ctl.config), ctl.login)
	// Refresh performs conditional CSRF validation itself when a refresh cookie is used.
	// Do not wrap it in the unconditional mutation middleware: a first-load request
	// without a refresh cookie must return 401 rather than an unrelated CSRF 403.
	group.Post("/refresh", idempotency, authLimiter, ctl.refresh)
	group.Post("/forgot-password", idempotency, passwordLimiter, middleware.ValidateCSRFForMutations(ctl.config), ctl.forgotPassword)
	group.Post("/reset-password", idempotency, passwordLimiter, middleware.ValidateCSRFForMutations(ctl.config), ctl.resetPassword)
	group.Post("/logout", requireAuth, ctl.logout)
	group.Post("/2fa/setup", requireAuth, ctl.setupTwoFactor)
	group.Post("/2fa/verify", requireAuth, ctl.verifyTwoFactor)
	group.Post("/2fa/disable", requireAuth, ctl.disableTwoFactor)

	group.Get("/oauth/:provider", ctl.oauthRedirect)
	group.Post("/oauth/:provider", ctl.oauthLogin)
	group.Get("/callback/:provider", ctl.oauthCallback)
}

func (ctl *Controller) csrf(c *fiber.Ctx) error {
	csrfToken, err := authplatform.RandomToken(32)
	if err != nil {
		return err
	}
	expiresAt := time.Now().Add(15 * time.Minute)
	authplatform.SetCSRFCookie(c, ctl.config, csrfToken, expiresAt)
	return c.JSON(httpx.OK(map[string]any{"csrfToken": csrfToken, "hasSession": strings.TrimSpace(c.Cookies(ctl.config.RefreshCookieName)) != ""}, c.GetRespHeader(fiber.HeaderXRequestID), nil))
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
	authplatform.SetRefreshCookie(c, ctl.config, refreshToken, response.RefreshUntil)
	authplatform.SetCSRFCookie(c, ctl.config, response.CSRFToken, response.RefreshUntil)
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
	authplatform.SetRefreshCookie(c, ctl.config, refreshToken, response.RefreshUntil)
	authplatform.SetCSRFCookie(c, ctl.config, response.CSRFToken, response.RefreshUntil)
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
	authplatform.SetRefreshCookie(c, ctl.config, refreshToken, response.RefreshUntil)
	authplatform.SetCSRFCookie(c, ctl.config, response.CSRFToken, response.RefreshUntil)
	return c.Status(fiber.StatusCreated).JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) refresh(c *fiber.Ctx) error {
	var payload RefreshRequest
	if len(c.Body()) > 0 {
		var err error
		payload, err = httpx.BindBody[RefreshRequest](c, ctl.validate)
		if err != nil {
			return err
		}
	}

	cookieRefreshToken := strings.TrimSpace(c.Cookies(ctl.config.RefreshCookieName))
	rawToken := strings.TrimSpace(payload.RefreshToken)
	if rawToken == "" {
		rawToken = cookieRefreshToken
	}
	if rawToken == "" {
		return fiber.NewError(fiber.StatusUnauthorized, "Authentication required")
	}

	if cookieRefreshToken != "" {
		if err := middleware.ValidateCSRF(ctl.config)(c); err != nil {
			return err
		}
	}

	response, refreshToken, err := ctl.service.Refresh(c.UserContext(), rawToken)
	if err != nil {
		return err
	}
	authplatform.SetRefreshCookie(c, ctl.config, refreshToken, response.RefreshUntil)
	// Keep the CSRF token stable during refresh. Login/register establish a fresh token,
	// while /auth/csrf can explicitly renew it when the client has no usable token.
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
		if err := middleware.ValidateCSRF(ctl.config)(c); err != nil {
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
		return c.Redirect("/login?error=oauth_failed", fiber.StatusTemporaryRedirect)
	}
	authplatform.SetRefreshCookie(c, ctl.config, refreshToken, response.RefreshUntil)
	authplatform.SetCSRFCookie(c, ctl.config, response.CSRFToken, response.RefreshUntil)
	c.Cookie(&fiber.Cookie{Name: "gapak_at", Value: response.AccessToken, Path: "/", HTTPOnly: true, Secure: ctl.config.CookieSecure, SameSite: controllerCookieSameSite(ctl.config.CookieSameSite), Domain: controllerCookieDomain(ctl.config.CookieDomain), MaxAge: 300})
	return c.Redirect("/auth/callback", fiber.StatusTemporaryRedirect)
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
