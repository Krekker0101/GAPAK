package httpx

import apperrors "github.com/gapak/backend/internal/platform/errors"

type Meta struct {
	RequestID  string         `json:"requestId,omitempty"`
	Pagination map[string]any `json:"pagination,omitempty"`
}

type SuccessResponse[T any] struct {
	Success bool `json:"success"`
	Data    T    `json:"data"`
	Meta    Meta `json:"meta,omitempty"`
}

type ErrorResponse struct {
	Success bool      `json:"success"`
	Error   ErrorBody `json:"error"`
	Meta    Meta      `json:"meta,omitempty"`
}

type ErrorBody struct {
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Details map[string]any `json:"details,omitempty"`
}

func OK[T any](data T, requestID string, pagination map[string]any) SuccessResponse[T] {
	return SuccessResponse[T]{
		Success: true,
		Data:    data,
		Meta: Meta{
			RequestID:  requestID,
			Pagination: pagination,
		},
	}
}

func ErrorEnvelope(err *apperrors.AppError, requestID string) ErrorResponse {
	return ErrorResponse{
		Success: false,
		Error: ErrorBody{
			Code:    err.Code,
			Message: err.Message,
			Details: err.Details,
		},
		Meta: Meta{
			RequestID: requestID,
		},
	}
}
