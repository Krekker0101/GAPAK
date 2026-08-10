package observability

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type Histogram struct {
	buckets []float64
	counts  []uint64
	count   uint64
	sum     atomic.Uint64
}

func newHistogram(buckets []float64) *Histogram {
	return &Histogram{buckets: append([]float64(nil), buckets...), counts: make([]uint64, len(buckets)+1)}
}

func (h *Histogram) Observe(seconds float64) {
	atomic.AddUint64(&h.count, 1)
	h.sum.Add(uint64(seconds * 1_000_000_000))
	i := sort.SearchFloat64s(h.buckets, seconds)
	atomic.AddUint64(&h.counts[i], 1)
}

func (h *Histogram) snapshot() (uint64, uint64, []uint64) {
	counts := make([]uint64, len(h.counts))
	for i := range h.counts {
		counts[i] = atomic.LoadUint64(&h.counts[i])
	}
	return atomic.LoadUint64(&h.count), h.sum.Load(), counts
}

type labeledCounter struct {
	mu     sync.RWMutex
	values map[string]*atomic.Uint64
}

func newLabeledCounter() *labeledCounter {
	return &labeledCounter{values: make(map[string]*atomic.Uint64)}
}
func (c *labeledCounter) add(key string, n uint64) {
	c.mu.RLock()
	v := c.values[key]
	c.mu.RUnlock()
	if v == nil {
		c.mu.Lock()
		v = c.values[key]
		if v == nil {
			v = &atomic.Uint64{}
			c.values[key] = v
		}
		c.mu.Unlock()
	}
	v.Add(n)
}
func (c *labeledCounter) Inc(key string) { c.add(key, 1) }

func (c *labeledCounter) snapshot() map[string]uint64 {
	c.mu.RLock()
	defer c.mu.RUnlock()
	out := make(map[string]uint64, len(c.values))
	for k, v := range c.values {
		out[k] = v.Load()
	}
	return out
}

type labeledGauge struct {
	mu     sync.RWMutex
	values map[string]*atomic.Int64
}

func newLabeledGauge() *labeledGauge { return &labeledGauge{values: make(map[string]*atomic.Int64)} }
func (g *labeledGauge) Set(key string, value int64) {
	g.mu.RLock()
	v := g.values[key]
	g.mu.RUnlock()
	if v == nil {
		g.mu.Lock()
		v = g.values[key]
		if v == nil {
			v = &atomic.Int64{}
			g.values[key] = v
		}
		g.mu.Unlock()
	}
	v.Store(value)
}
func (g *labeledGauge) snapshot() map[string]int64 {
	g.mu.RLock()
	defer g.mu.RUnlock()
	out := make(map[string]int64, len(g.values))
	for k, v := range g.values {
		out[k] = v.Load()
	}
	return out
}

type labeledHistogram struct {
	mu      sync.RWMutex
	values  map[string]*Histogram
	buckets []float64
}

func newLabeledHistogram(buckets []float64) *labeledHistogram {
	return &labeledHistogram{values: make(map[string]*Histogram), buckets: buckets}
}
func (h *labeledHistogram) observe(key string, seconds float64) {
	h.mu.RLock()
	v := h.values[key]
	h.mu.RUnlock()
	if v == nil {
		h.mu.Lock()
		v = h.values[key]
		if v == nil {
			v = newHistogram(h.buckets)
			h.values[key] = v
		}
		h.mu.Unlock()
	}
	v.Observe(seconds)
}
func (h *labeledHistogram) Observe(key string, seconds float64) { h.observe(key, seconds) }

func (h *labeledHistogram) snapshot() map[string]*Histogram {
	h.mu.RLock()
	defer h.mu.RUnlock()
	out := make(map[string]*Histogram, len(h.values))
	for k, v := range h.values {
		out[k] = v
	}
	return out
}

type DBStats struct {
	AcquireCount  uint64
	AcquiredConns int32
	IdleConns     int32
	TotalConns    int32
	MaxConns      int32
}

// Registry is an in-process, low-cardinality Prometheus-compatible metrics registry.
// It intentionally avoids a heavyweight dependency while keeping labels bounded.
type Registry struct {
	HTTPRequests         *labeledCounter
	HTTPErrors           *labeledCounter
	HTTPLatency          *labeledHistogram
	RateLimitEvents      *labeledCounter
	DBQueries            *labeledCounter
	DBErrors             *labeledCounter
	DBLatency            *labeledHistogram
	RedisCommands        *labeledCounter
	RedisConnectionState *labeledGauge
	RedisErrors          *labeledCounter
	RedisLatency         *labeledHistogram
	WorkerJobs           *labeledCounter
	WorkerQueueDepth     *labeledGauge
	WorkerLatency        *labeledHistogram
	WSConnections        *labeledCounter
	WSActiveConnections  *labeledGauge
	WSDisconnects        *labeledCounter
	WSMessages           *labeledCounter
	WSErrors             *labeledCounter
	WSSlowConsumers      *labeledCounter
	MediaEvents          *labeledCounter
	MediaLatency         *labeledHistogram
	AuthEvents           *labeledCounter
	dbStats              atomic.Value
}

func NewRegistry() *Registry {
	buckets := []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10}
	r := &Registry{
		HTTPRequests: newLabeledCounter(), HTTPErrors: newLabeledCounter(), HTTPLatency: newLabeledHistogram(buckets), RateLimitEvents: newLabeledCounter(),
		DBQueries: newLabeledCounter(), DBErrors: newLabeledCounter(), DBLatency: newLabeledHistogram(buckets),
		RedisCommands: newLabeledCounter(), RedisConnectionState: newLabeledGauge(), RedisErrors: newLabeledCounter(), RedisLatency: newLabeledHistogram(buckets),
		WorkerJobs: newLabeledCounter(), WorkerQueueDepth: newLabeledGauge(), WorkerLatency: newLabeledHistogram(buckets),
		WSConnections: newLabeledCounter(), WSActiveConnections: newLabeledGauge(), WSDisconnects: newLabeledCounter(), WSMessages: newLabeledCounter(), WSErrors: newLabeledCounter(), WSSlowConsumers: newLabeledCounter(),
		MediaEvents: newLabeledCounter(), MediaLatency: newLabeledHistogram(buckets), AuthEvents: newLabeledCounter(),
	}
	r.dbStats.Store(DBStats{})
	return r
}

func (r *Registry) SetDBStats(s DBStats) { r.dbStats.Store(s) }
func (r *Registry) DBStats() DBStats     { return r.dbStats.Load().(DBStats) }

func (r *Registry) Render() []byte {
	var b strings.Builder
	emitGauge := func(name string, g *labeledGauge, help string) {
		fmt.Fprintf(&b, "# HELP %s %s\n# TYPE %s gauge\n", name, help, name)
		snap := g.snapshot()
		keys := make([]string, 0, len(snap))
		for k := range snap {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			fmt.Fprintf(&b, "%s%s %d\n", name, k, snap[k])
		}
	}
	emitCounter := func(name string, c *labeledCounter, help string) {
		fmt.Fprintf(&b, "# HELP %s %s\n# TYPE %s counter\n", name, help, name)
		snap := c.snapshot()
		keys := make([]string, 0, len(snap))
		for k := range snap {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			fmt.Fprintf(&b, "%s%s %d\n", name, k, snap[k])
		}
	}
	emitHist := func(name string, h *labeledHistogram, help string) {
		fmt.Fprintf(&b, "# HELP %s %s\n# TYPE %s histogram\n", name, help, name)
		snap := h.snapshot()
		keys := make([]string, 0, len(snap))
		for k := range snap {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			v := snap[k]
			count, sum, counts := v.snapshot()
			cumulative := uint64(0)
			for i, c := range counts {
				cumulative += c
				le := "+Inf"
				if i < len(v.buckets) {
					le = strconv.FormatFloat(v.buckets[i], 'f', -1, 64)
				}
				fmt.Fprintf(&b, "%s_bucket%s,le=%q} %d\n", name, strings.TrimSuffix(k, "}"), le, cumulative)
			}
			fmt.Fprintf(&b, "%s_sum%s %.9f\n%s_count%s %d\n", name, k, float64(sum)/1e9, name, k, count)
		}
	}
	emitCounter("gapak_http_requests_total", r.HTTPRequests, "HTTP requests")
	emitCounter("gapak_http_errors_total", r.HTTPErrors, "HTTP errors")
	emitHist("gapak_http_request_duration_seconds", r.HTTPLatency, "HTTP request latency")
	emitCounter("gapak_rate_limit_events_total", r.RateLimitEvents, "Rate limit events")
	emitCounter("gapak_db_queries_total", r.DBQueries, "Database queries")
	emitCounter("gapak_db_errors_total", r.DBErrors, "Database query errors")
	emitHist("gapak_db_query_duration_seconds", r.DBLatency, "Database query latency")
	emitCounter("gapak_redis_commands_total", r.RedisCommands, "Redis commands")
	emitGauge("gapak_redis_connection_state", r.RedisConnectionState, "Redis connection state (1=healthy, 0=unhealthy)")
	emitCounter("gapak_redis_errors_total", r.RedisErrors, "Redis command errors")
	emitHist("gapak_redis_command_duration_seconds", r.RedisLatency, "Redis command latency")
	emitCounter("gapak_worker_jobs_total", r.WorkerJobs, "Worker jobs by queue and outcome")
	emitHist("gapak_worker_job_duration_seconds", r.WorkerLatency, "Worker job processing latency")
	emitCounter("gapak_websocket_connections_total", r.WSConnections, "WebSocket connections")
	emitCounter("gapak_websocket_disconnects_total", r.WSDisconnects, "WebSocket disconnects")
	emitCounter("gapak_websocket_messages_total", r.WSMessages, "WebSocket messages")
	emitCounter("gapak_websocket_errors_total", r.WSErrors, "WebSocket errors")
	emitCounter("gapak_websocket_slow_consumers_total", r.WSSlowConsumers, "WebSocket slow consumers")
	emitCounter("gapak_media_events_total", r.MediaEvents, "Media lifecycle events")
	emitHist("gapak_media_processing_duration_seconds", r.MediaLatency, "Media processing latency")
	emitCounter("gapak_auth_events_total", r.AuthEvents, "Authentication security events")
	emitGauge("gapak_worker_queue_depth", r.WorkerQueueDepth, "Worker queue depth")
	emitGauge("gapak_websocket_active_connections", r.WSActiveConnections, "Active WebSocket connections")
	ds := r.DBStats()
	fmt.Fprintf(&b, "# HELP gapak_db_pool_connections Current PostgreSQL pool connections\n# TYPE gapak_db_pool_connections gauge\ngapak_db_pool_connections{state=\"total\"} %d\ngapak_db_pool_connections{state=\"idle\"} %d\ngapak_db_pool_connections{state=\"acquired\"} %d\ngapak_db_pool_connections{state=\"max\"} %d\n", ds.TotalConns, ds.IdleConns, ds.AcquiredConns, ds.MaxConns)
	return []byte(b.String())
}

func (r *Registry) ServeHTTP(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	_, _ = w.Write(r.Render())
}

func Labels(pairs ...string) string {
	if len(pairs)%2 != 0 {
		return "{}"
	}
	parts := make([]string, 0, len(pairs)/2)
	for i := 0; i < len(pairs); i += 2 {
		v := strings.ReplaceAll(strings.ReplaceAll(pairs[i+1], "\\", "\\\\"), "\"", "\\\"")
		parts = append(parts, pairs[i]+"=\""+v+"\"")
	}
	sort.Strings(parts)
	return "{" + strings.Join(parts, ",") + "}"
}

func Label(k, v string) string {
	v = strings.ReplaceAll(v, "\\", "\\\\")
	v = strings.ReplaceAll(v, "\"", "\\\"")
	return fmt.Sprintf("{%s=\"%s\"}", k, v)
}

func Seconds(d time.Duration) float64 { return d.Seconds() }
