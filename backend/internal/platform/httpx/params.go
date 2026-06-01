package httpx

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	apperrors "github.com/gapak/backend/internal/platform/errors"
)

func UUIDParam(c *fiber.Ctx, name string) (string, error) {
	value := strings.TrimSpace(c.Params(name))
	if value == "" {
		return "", apperrors.WithDetails(apperrors.ErrInvalidIdentifier, map[string]any{
			"param": name,
		})
	}
	if _, err := uuid.Parse(value); err != nil {
		return "", apperrors.WithDetails(apperrors.ErrInvalidIdentifier, map[string]any{
			"param": name,
			"value": value,
		})
	}
	return value, nil
}
