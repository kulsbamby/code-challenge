# 08 Errors, non-functional requirements, testing

## Error contract

All errors return:

```json
{ "error": { "code": "ACTION_TOKEN_EXPIRED", "message": "Action token has expired" } }
```

`code` is stable and machine-readable; `message` is human-readable and may change.

| HTTP | `code` | When |
|------|--------|------|
| 400 | `VALIDATION_ERROR` | Bad body/query |
| 400 | `ACTION_TOKEN_INVALID` | Bad signature, tampered, unknown jti |
| 401 | `UNAUTHENTICATED` | Missing/invalid JWT |
| 403 | `USER_BANNED` | Banned user |
| 403 | `ACTION_TOKEN_FORBIDDEN` | Token belongs to another user |
| 409 | `ACTION_TOKEN_USED` | Lost a concurrent claim race |
| 410 | `ACTION_TOKEN_EXPIRED` | Token past `expires_at` |
| 413 | `PAYLOAD_TOO_LARGE` | Body too big |
| 422 | `ACTION_TOO_FAST` | Completed before min duration |
| 422 | `DAILY_CAP_REACHED` | Daily point cap |
| 429 | `RATE_LIMITED` | Rate limit (has `Retry-After`) |
| 429 | `TOO_MANY_OUTSTANDING_ACTIONS` | 3 live tokens |
| 500 | `INTERNAL_ERROR` | Unexpected (no internals leaked) |
| 503 | `SERVICE_UNAVAILABLE` / `TOO_MANY_CONNECTIONS` | Dependency down / SSE cap |

## Non-functional requirements

| Area | Requirement |
|------|-------------|
| Latency | `start`, `complete`, `GET /scoreboard`: p95 < 100 ms at 200 req/s |
| Live delay | Score change to client event: p95 < 2 s |
| Availability | API continues serving `GET /scoreboard` if Redis is down |
| Stateless | No in-process state needed for correctness; SSE connections are the only per-instance state |
| Consistency | PostgreSQL is the source of truth; Redis is rebuildable |
| Graceful shutdown | On SIGTERM stop accepting, close SSE streams, finish in-flight requests (max 10 s) |
| Health | `GET /healthz` (process up) and `GET /readyz` (PostgreSQL and Redis reachable) |

## Observability

Structured JSON logs with request id. Metrics (Prometheus names):

- `actions_started_total`, `actions_completed_total`, `actions_rejected_total{reason}`
- `sse_connections`, `leaderboard_publish_total`, `outbox_lag_seconds`, `leaderboard_drift_total`
- `http_request_duration_seconds{route,status}`

Alerts: `outbox_lag_seconds > 10` for 1 min; any `leaderboard_drift_total` increase; `actions_rejected_total{reason="ACTION_TOKEN_INVALID"}` spike.

## Test plan

| Level | What | Covers |
|-------|------|--------|
| Unit | Token sign/verify (expired, tampered, wrong kid), points lookup, tie ordering | AC-START, AC-COMP-03, AC-BOARD-02 |
| Integration (real PostgreSQL + Redis, e.g. testcontainers/compose) | Full start -> complete -> scoreboard flow; every AC in files 01-07 | All AC |
| Concurrency | 20 parallel `complete` with one token (AC-COMP-07); outbox double-processing (AC-LIVE-10) | Replay safety |
| Failure injection | Redis down, DB error mid-transaction, worker crash | AC-COMP-09/11, AC-LIVE-09, AC-SEC-03 |
| Load | k6/autocannon: 200 complete/s with 5k SSE clients; verify p95 targets | NFR |
| Security | Forgery matrix from AC-SEC-07; log scan for secrets | AC-SEC |

## Definition of done

- Every MUST AC has an automated test that passes in CI.
- `docker compose up` starts the full stack; the README describes setup, env vars and a curl/demo walkthrough.
- OpenAPI document generated or hand-written for all endpoints (as in Problem 5).
- Metrics and health endpoints in place; load test results recorded.
- No P0 item from [../improvement.md](../improvement.md) left open.
