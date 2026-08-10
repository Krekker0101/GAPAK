package observability

import (
	"strings"
	"testing"
)

func TestMetricsRenderIsPrometheusCompatible(t *testing.T) {
	r := NewRegistry()
	r.HTTPRequests.Inc(Labels("method", "GET", "endpoint", "/health/live", "status", "200"))
	r.HTTPLatency.Observe(Label("endpoint", "/health/live"), 0.01)
	out := string(r.Render())
	for _, want := range []string{"# TYPE gapak_http_requests_total counter", "gapak_http_requests_total{endpoint=\"/health/live\",method=\"GET\",status=\"200\"} 1", "gapak_http_request_duration_seconds_bucket{endpoint=\"/health/live\",le=\"0.01\"}"} {
		if !strings.Contains(out, want) {
			t.Fatalf("missing %q in metrics:\n%s", want, out)
		}
	}
}
