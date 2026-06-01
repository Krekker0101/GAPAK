package httpx

import (
	"fmt"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"

	apperrors "github.com/gapak/backend/internal/platform/errors"
)

func BindBody[T any](c *fiber.Ctx, validate *validator.Validate) (T, error) {
	var payload T
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
		violations = append(violations, map[string]string{
			"field": fieldErr.Field(),
			"rule":  fieldErr.Tag(),
			"value": fmt.Sprintf("%v", fieldErr.Value()),
		})
	}

	validationErr.Details["violations"] = violations
	return validationErr
}
