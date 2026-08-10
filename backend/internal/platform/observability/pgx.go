package observability

import (
	"context"
	"github.com/jackc/pgx/v5"
	"strings"
	"time"
)

type queryStartKey struct{}
type QueryTracer struct{ Registry *Registry }

func (t QueryTracer) TraceQueryStart(ctx context.Context, _ *pgx.Conn, _ pgx.TraceQueryStartData) context.Context {
	return context.WithValue(ctx, queryStartKey{}, time.Now())
}
func (t QueryTracer) TraceQueryEnd(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryEndData) {
	if t.Registry == nil {
		return
	}
	started, _ := ctx.Value(queryStartKey{}).(time.Time)
	if started.IsZero() {
		return
	}
	d := time.Since(started)
	op := classifySQL(data.CommandTag.String())
	key := Label("operation", op)
	t.Registry.DBQueries.add(key, 1)
	t.Registry.DBLatency.observe(key, d.Seconds())
	if data.Err != nil {
		t.Registry.DBErrors.add(key, 1)
	}
}
func classifySQL(s string) string {
	s = strings.TrimSpace(strings.ToUpper(s))
	for _, v := range []string{"SELECT", "INSERT", "UPDATE", "DELETE", "BEGIN", "COMMIT", "ROLLBACK", "COPY"} {
		if strings.HasPrefix(s, v) {
			return strings.ToLower(v)
		}
	}
	return "other"
}
