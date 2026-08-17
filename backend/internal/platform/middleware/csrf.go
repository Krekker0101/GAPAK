package middleware

import (
	"net/url"
	"strings"

	"github.com/gofiber/fiber/v2"

	"github.com/gapak/backend/internal/config"
	auth "github.com/gapak/backend/internal/platform/auth"
	"github.com/gapak/backend/internal/platform/csrf"
	apperrors "github.com/gapak/backend/internal/platform/errors"
)

func ValidateCSRF(store csrf.Store, jwtManager *auth.Manager, cfg config.SecurityConfig, allowedOrigins ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if err := validateOriginBoundary(c, cfg, allowedOrigins); err != nil {
			return err
		}
		token := strings.TrimSpace(c.Get("X-CSRF-Token"))
		if token == "" {
			return apperrors.ErrCSRFInvalid
		}
		sessionID := sessionIDFromRequest(c, jwtManager, cfg)
		ok, err := store.Validate(c.UserContext(), sessionID, token)
		if err != nil || !ok {
			return apperrors.ErrCSRFInvalid
		}
		return c.Next()
	}
}

func ValidateCSRFForMutations(store csrf.Store, jwtManager *auth.Manager, cfg config.SecurityConfig, allowedOrigins ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !isSafeMethod(c.Method()) {
			if err := validateOriginBoundary(c, cfg, allowedOrigins); err != nil {
				return err
			}
		}
		token := strings.TrimSpace(c.Get("X-CSRF-Token"))
		if token == "" {
			return apperrors.ErrCSRFInvalid
		}
		sessionID := sessionIDFromRequest(c, jwtManager, cfg)
		ok, err := store.Validate(c.UserContext(), sessionID, token)
		if err != nil || !ok {
			return apperrors.ErrCSRFInvalid
		}
		return c.Next()
	}
}

func BrowserMutationCSRF(store csrf.Store, jwtManager *auth.Manager, cfg config.SecurityConfig, allowedOrigins ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if isSafeMethod(c.Method()) {
			return c.Next()
		}
		if c.Get("Origin") == "" && c.Get("Referer") == "" && c.Cookies(auth.AccessCookieName) == "" && c.Cookies(cfg.RefreshCookieName) == "" {
			// Explicit bearer-token/server-to-server clients do not need browser CSRF.
			return c.Next()
		}
		return ValidateCSRFForMutations(store, jwtManager, cfg, allowedOrigins...)(c)
	}
}

func validateOriginBoundary(c *fiber.Ctx, cfg config.SecurityConfig, allowedOrigins []string) error {
	origin := strings.TrimSpace(c.Get("Origin"))
	if origin != "" {
		if !isAllowedOrigin(origin, allowedOrigins) {
			return apperrors.ErrCSRFInvalid
		}
		return nil
	}
	if ref := strings.TrimSpace(c.Get("Referer")); ref != "" {
		if !refererMatchesAllowedOrigin(ref, allowedOrigins) {
			return apperrors.ErrCSRFInvalid
		}
		return nil
	}
	if c.Get("Origin") == "" && c.Get("Referer") == "" && (c.Cookies(auth.AccessCookieName) != "" || c.Cookies(cfg.RefreshCookieName) != "") && strings.TrimSpace(c.Get("Authorization")) == "" {
		return apperrors.ErrCSRFInvalid
	}
	return nil
}

func sessionIDFromRequest(c *fiber.Ctx, jwtManager *auth.Manager, cfg config.SecurityConfig) string {
	if jwtManager == nil {
		return ""
	}
	if token := bearerToken(c.Get("Authorization")); token != "" {
		if claims, err := jwtManager.VerifyAccessToken(c.UserContext(), token); err == nil {
			return claims.SessionID
		}
	}
	if token := strings.TrimSpace(c.Cookies(auth.AccessCookieName)); token != "" {
		if claims, err := jwtManager.VerifyAccessToken(c.UserContext(), token); err == nil {
			return claims.SessionID
		}
	}
	if token := strings.TrimSpace(c.Cookies(cfg.RefreshCookieName)); token != "" {
		if claims, err := jwtManager.ParseRefreshToken(token); err == nil {
			return claims.SessionID
		}
	}
	return ""
}

func SessionIDForRequest(c *fiber.Ctx, jwtManager *auth.Manager, cfg config.SecurityConfig) string {
	return sessionIDFromRequest(c, jwtManager, cfg)
}

func isSafeMethod(method string) bool {
	switch strings.ToUpper(method) {
	case "GET", "HEAD", "OPTIONS":
		return true
	default:
		return false
	}
}

func refererMatchesAllowedOrigin(raw string, allowedOrigins []string) bool {
	ref := strings.TrimSpace(raw)
	if ref == "" {
		return false
	}
	u, err := url.Parse(ref)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return false
	}
	return isAllowedOrigin(u.Scheme+"://"+u.Host, allowedOrigins)
}

func isAllowedOrigin(origin string, allowedOrigins []string) bool {
	origin = strings.TrimRight(strings.TrimSpace(origin), "/")
	if origin == "" {
		return false
	}
	for _, allowed := range allowedOrigins {
		if strings.EqualFold(origin, strings.TrimRight(strings.TrimSpace(allowed), "/")) {
			return true
		}
	}
	return false
}
