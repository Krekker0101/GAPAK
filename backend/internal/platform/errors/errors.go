package errors

import (
	stderrors "errors"
	"net/http"
)

type AppError struct {
	Status  int
	Code    string
	Message string
	Details map[string]any
	Cause   error
}

func (e *AppError) Error() string {
	return e.Message
}

func (e *AppError) Unwrap() error {
	return e.Cause
}

func New(status int, code, message string) *AppError {
	return &AppError{
		Status:  status,
		Code:    code,
		Message: message,
		Details: map[string]any{},
	}
}

func Wrap(err error, status int, code, message string) *AppError {
	appErr := New(status, code, message)
	appErr.Cause = err
	return appErr
}

func WithDetails(err *AppError, details map[string]any) *AppError {
	if err == nil {
		return nil
	}
	cloned := *err
	cloned.Details = map[string]any{}
	for key, value := range err.Details {
		cloned.Details[key] = value
	}
	for key, value := range details {
		cloned.Details[key] = value
	}
	return &cloned
}

func As(err error) *AppError {
	if err == nil {
		return nil
	}
	var appErr *AppError
	if stderrors.As(err, &appErr) {
		return appErr
	}
	return Wrap(err, http.StatusInternalServerError, "internal.server_error", "Internal server error")
}

var (
	ErrUnauthorized          = New(http.StatusUnauthorized, "auth.unauthorized", "Authentication required")
	ErrForbidden             = New(http.StatusForbidden, "auth.forbidden", "You do not have permission to perform this action")
	ErrValidation            = New(http.StatusBadRequest, "request.validation_failed", "Request validation failed")
	ErrInvalidIdentifier     = New(http.StatusBadRequest, "request.invalid_identifier", "Invalid identifier")
	ErrNotFound              = New(http.StatusNotFound, "resource.not_found", "Requested resource was not found")
	ErrConflict              = New(http.StatusConflict, "resource.conflict", "Resource already exists")
	ErrRateLimited           = New(http.StatusTooManyRequests, "security.rate_limited", "Too many requests")
	ErrInvalidCredentials    = New(http.StatusUnauthorized, "auth.invalid_credentials", "Invalid credentials")
	ErrInvalidToken          = New(http.StatusUnauthorized, "auth.invalid_token", "Invalid or expired token")
	ErrCSRFInvalid           = New(http.StatusForbidden, "security.invalid_csrf", "Invalid CSRF token")
	ErrDependencyUnavailable = New(http.StatusServiceUnavailable, "dependency.unavailable", "Required dependency is temporarily unavailable")
	ErrInternal              = New(http.StatusInternalServerError, "internal.server_error", "Internal server error")
	ErrNotImplemented        = New(http.StatusNotImplemented, "feature.not_implemented", "Feature is scaffolded but not fully implemented yet")
)
