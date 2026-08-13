package middleware

import (
	"context"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gapak/backend/internal/platform/auth"
	apperrors "github.com/gapak/backend/internal/platform/errors"
)

const claimsContextKey = "authClaims"

func RequireAuth(jwtManager *auth.Manager) fiber.Handler {
	return RequireAuthWithSessionStore(jwtManager, nil)
}

func RequireAuthWithSessionStore(jwtManager *auth.Manager, db *pgxpool.Pool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := bearerToken(c.Get(fiber.HeaderAuthorization))
		if token == "" {
			token = strings.TrimSpace(c.Cookies(auth.AccessCookieName))
		}
		if token == "" {
			return apperrors.ErrUnauthorized
		}
		claims, err := jwtManager.VerifyAccessToken(c.UserContext(), token)
		if err != nil {
			return apperrors.ErrInvalidToken
		}
		if db != nil {
			active, err := activeSession(c.UserContext(), db, claims.UserID, claims.SessionID)
			if err != nil {
				return apperrors.ErrUnauthorized
			}
			if !active {
				return apperrors.ErrInvalidToken
			}
		}
		c.Locals(claimsContextKey, claims)
		return c.Next()
	}
}

func activeSession(ctx context.Context, db *pgxpool.Pool, userID, sessionID string) (bool, error) {
	var one int
	err := db.QueryRow(ctx, `
		SELECT 1 FROM device_sessions
		WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at > NOW()
		LIMIT 1`, sessionID, userID).Scan(&one)
	if err != nil {
		return false, err
	}
	return one == 1, nil
}

func OptionalAuth(jwtManager *auth.Manager) fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := bearerToken(c.Get(fiber.HeaderAuthorization))
		if token == "" {
			token = strings.TrimSpace(c.Cookies(auth.AccessCookieName))
		}
		if token == "" {
			return c.Next()
		}
		claims, err := jwtManager.VerifyAccessToken(c.UserContext(), token)
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
