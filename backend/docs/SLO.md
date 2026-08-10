# GAPAK SLOs

These are initial production budgets. Tune them from real traffic after a stable baseline is collected; do not silently relax them to hide regressions.

| Service signal | Target | Alert budget |
|---|---:|---:|
| API availability | 99.95% monthly | page when 5m error budget burn is high |
| Read API p95 | < 300 ms | warn at 250 ms, page at 500 ms |
| Read API p99 | < 800 ms | page at 1.5 s |
| Mutation API p95 | < 500 ms | warn at 400 ms, page at 1 s |
| HTTP 5xx rate | < 0.1% | page at sustained 1% |
| PostgreSQL query p95 | < 100 ms | warn at 75 ms |
| Redis command p95 | < 25 ms | warn at 20 ms |
| Worker queue delay | < 30 s | page at 2 min |
| Media processing failures | < 1% | page at 5% sustained |
| Realtime delivery p95 | < 500 ms | page at 2 s |
| WebSocket unexpected disconnect rate | < 2% / hour | investigate sustained spikes |

## Error budget

For a 99.95% availability SLO, the monthly error budget is approximately 21.9 minutes. Product releases that consume the majority of the remaining budget should be paused until reliability is restored.

## Measurement rules

- Exclude `/health/live` and `/metrics` from user-facing latency SLOs.
- Use route templates, not raw paths.
- Measure success/failure from the final HTTP response after middleware.
- For realtime delivery, measure durable event persistence separately from client delivery.
