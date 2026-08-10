package observability

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"strings"
)

type contextKey string

const traceIDKey contextKey = "gapak.trace_id"
const correlationIDKey contextKey = "gapak.correlation_id"

func NewID(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "unknown"
	}
	return hex.EncodeToString(b)
}
func WithTrace(ctx context.Context, traceID, correlationID string) context.Context {
	ctx = context.WithValue(ctx, traceIDKey, traceID)
	return context.WithValue(ctx, correlationIDKey, correlationID)
}
func TraceID(ctx context.Context) string {
	if v, ok := ctx.Value(traceIDKey).(string); ok {
		return v
	}
	return ""
}
func CorrelationID(ctx context.Context) string {
	if v, ok := ctx.Value(correlationIDKey).(string); ok {
		return v
	}
	return ""
}
func ValidExternalID(v string) string {
	v = strings.TrimSpace(v)
	if len(v) > 128 {
		return ""
	}
	return v
}
