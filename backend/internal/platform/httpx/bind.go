package httpx

import (
	"fmt"
	"mime"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"

	apperrors "github.com/gapak/backend/internal/platform/errors"
)

func BindBody[T any](c *fiber.Ctx, validate *validator.Validate) (T, error) {
	var payload T
	mediaType, _, err := mime.ParseMediaType(c.Get(fiber.HeaderContentType))
	if err != nil || (mediaType != fiber.MIMEApplicationJSON && !strings.HasSuffix(mediaType, "+json")) {
		return payload, apperrors.New(fiber.StatusUnsupportedMediaType, "request.unsupported_media_type", "Content-Type must be application/json")
	}
	if err := c.BodyParser(&payload); err != nil {
		return payload, apperrors.WithDetails(apperrors.Wrap(err, fiber.StatusBadRequest, "request.invalid_json", "Invalid JSON body"), map[string]any{
			"reason": err.Error(),
		})
	}
	if err := validate.Struct(payload); err != nil {
		return payload, validationError(err)
	}
	return payload, nil
}

func BindQuery[T any](c *fiber.Ctx, validate *validator.Validate) (T, error) {
	var payload T
	if err := c.QueryParser(&payload); err != nil {
		return payload, apperrors.WithDetails(apperrors.Wrap(err, fiber.StatusBadRequest, "request.invalid_query", "Invalid query parameters"), map[string]any{
			"reason": err.Error(),
		})
	}
	if err := validate.Struct(payload); err != nil {
		return payload, validationError(err)
	}
	return payload, nil
}

// sensitiveFields lists validator field names whose raw value must not be echoed back.
var sensitiveFields = map[string]struct{}{
	"password":        {},
	"newpassword":     {},
	"oldpassword":     {},
	"confirmpassword": {},
	"twofactorcode":   {},
	"totpcode":        {},
	"otpcode":         {},
	"token":           {},
	"refreshtoken":    {},
	"secret":          {},
	"ciphertext":      {},
	"nonce":           {},
	"key":             {},
}

func isSensitiveField(name string) bool {
	_, ok := sensitiveFields[strings.ToLower(name)]
	return ok
}

func validationError(err error) error {
	validationErr := apperrors.New(fiber.StatusBadRequest, "request.validation_failed", "Request validation failed")
	validationErr.Details = map[string]any{}

	fields, ok := err.(validator.ValidationErrors)
	if !ok {
		validationErr.Details["reason"] = err.Error()
		return validationErr
	}

	violations := make([]map[string]string, 0, len(fields))
	for _, fieldErr := range fields {
		violation := map[string]string{
			"field": fieldErr.Field(),
			"rule":  fieldErr.Tag(),
		}
		if !isSensitiveField(fieldErr.Field()) {
			violation["value"] = fmt.Sprintf("%v", fieldErr.Value())
		}
		violations = append(violations, violation)
	}

	validationErr.Details["violations"] = violations
	return validationErr
}
