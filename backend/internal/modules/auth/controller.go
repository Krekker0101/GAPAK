package auth

import (
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

func (ctl *Controller) RegisterRoutes(router fiber.Router, requireAuth fiber.Handler, authLimiter fiber.Handler, passwordLimiter fiber.Handler) {
	group := router.Group("/auth")
	group.Get("/csrf", ctl.csrf)
	group.Post("/register", authLimiter, middleware.ValidateCSRFForMutations(ctl.config), ctl.register)
	group.Post("/register-anonymous", authLimiter, middleware.ValidateCSRFForMutations(ctl.config), ctl.registerAnonymous)
	group.Post("/login", authLimiter, middleware.ValidateCSRFForMutations(ctl.config), ctl.login)
	group.Post("/refresh", ctl.refresh)
	group.Post("/forgot-password", passwordLimiter, ctl.forgotPassword)
	group.Post("/reset-password", passwordLimiter, ctl.resetPassword)
	group.Post("/logout", requireAuth, ctl.logout)
	group.Post("/2fa/setup", requireAuth, ctl.setupTwoFactor)
	group.Post("/2fa/verify", requireAuth, ctl.verifyTwoFactor)
}

func (ctl *Controller) csrf(c *fiber.Ctx) error {
	csrfToken, err := authplatform.RandomToken(32)
	if err != nil {
		return err
	}
	expiresAt := time.Now().Add(15 * time.Minute) // Short-lived for unauthenticated
	authplatform.SetCSRFCookie(c, ctl.config, csrfToken, expiresAt)
	return c.JSON(httpx.OK(map[string]string{"csrfToken": csrfToken}, c.GetRespHeader(fiber.HeaderXRequestID), nil))
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
		return fiber.ErrUnauthorized
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
	authplatform.SetCSRFCookie(c, ctl.config, response.CSRFToken, response.RefreshUntil)
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

func (ctl *Controller) requestMeta(c *fiber.Ctx, deviceName, deviceFingerprint string) common.RequestMeta {
	if ctl.privacy != nil {
		return ctl.privacy.RequestMeta(c, deviceName, deviceFingerprint)
	}
	return common.RequestMeta{
		IP:                c.IP(),
		UserAgent:         c.Get(fiber.HeaderUserAgent),
		DeviceName:        deviceName,
		DeviceFingerprint: deviceFingerprint,
	}
}
