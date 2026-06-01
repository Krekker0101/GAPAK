package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"

	"github.com/gapak/backend/internal/platform/auth"
	apperrors "github.com/gapak/backend/internal/platform/errors"
)

const claimsContextKey = "authClaims"

func RequireAuth(jwtManager *auth.Manager) fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := bearerToken(c.Get(fiber.HeaderAuthorization))
		if token == "" {
			return apperrors.ErrUnauthorized
		}
		claims, err := jwtManager.ParseAccessToken(token)
		if err != nil {
			return apperrors.ErrInvalidToken
		}
		c.Locals(claimsContextKey, claims)
		return c.Next()
	}
}

func OptionalAuth(jwtManager *auth.Manager) fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := bearerToken(c.Get(fiber.HeaderAuthorization))
		if token == "" {
			return c.Next()
		}
		claims, err := jwtManager.ParseAccessToken(token)
		if err == nil {
			c.Locals(claimsContextKey, claims)
		}
		return c.Next()
	}
}

func bearerToken(rawHeader string) string {
	parts := strings.Fields(rawHeader)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return parts[1]
}

func ClaimsFromContext(c *fiber.Ctx) *auth.Claims {
	claims, _ := c.Locals(claimsContextKey).(*auth.Claims)
	return claims
}

func RequirePermissions(rolePermissions map[string][]string, permissions ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		claims := ClaimsFromContext(c)
		if claims == nil {
			return apperrors.ErrUnauthorized
		}
		allowed := map[string]struct{}{}
		for _, permission := range rolePermissions[claims.Role] {
			allowed[permission] = struct{}{}
		}
		for _, permission := range permissions {
			if _, ok := allowed[permission]; !ok {
				return apperrors.ErrForbidden
			}
		}
		return c.Next()
	}
}
