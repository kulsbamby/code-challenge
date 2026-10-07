# 07 Security and rate limits

Implements requirement 5: no score increase without authorisation.

## Defence layers

| Layer | Control | Where enforced |
|-------|---------|----------------|
| Identity | RS256 JWT verified on every write call | 01 |
| Authorisation | Action token bound to `sub`; checked against JWT | 03 step 4 |
| Integrity | Server-computed points; HMAC-signed token | 03 |
| Replay | Atomic single-use claim + `UNIQUE(token_jti)` | 03, 06 |
| Pacing | Min duration per action, max outstanding tokens, daily cap | 02, 03 |
| Volume | Rate limits (below) | middleware |
| Audit | Append-only `action_log` | 06 |

## Rate limits (Redis fixed-window counters, key `rl:{scope}:{id}:{window}`)

| Scope | Limit | Window | Key by |
|-------|-------|--------|--------|
| `POST /actions/start` | 30 | 60 s | user id |
| `POST /actions/complete` | 30 | 60 s | user id |
| All `POST /actions/*` | 120 | 60 s | IP |
| `GET /scoreboard` | 60 | 60 s | IP |
| SSE connect | 10 concurrent | n/a | IP |

Exceeding gives `429 RATE_LIMITED` with `Retry-After: <seconds>`. If Redis is unavailable, **fail closed for writes** (return `503 SERVICE_UNAVAILABLE`) and fail open for reads.

## Other requirements

- HTTPS only in production (HSTS header); CORS allow-list from `CORS_ORIGINS` env.
- Validate every input (type, length, `actionToken` max 2 KB, body max 10 KB); use parameterised SQL only.
- Never log tokens, JWTs or secrets (redact `authorization` header and `actionToken`).
- Security headers (`helmet`).
- Account freeze: setting `banned:{userId}` blocks all write endpoints immediately (01).

## Acceptance criteria

| ID | Priority | Given / When / Then |
|----|----------|---------------------|
| AC-SEC-01 | MUST | Given a user sends 31 `start` calls in 60 s, then the 31st gets `429` with `Retry-After`. |
| AC-SEC-02 | MUST | Given the same IP sends 121 write calls in 60 s across users, then the 121st gets `429`. |
| AC-SEC-03 | MUST | Given Redis is down, then write endpoints return `503` and no points are awarded; `GET /scoreboard` still works from PostgreSQL. |
| AC-SEC-04 | MUST | Given a request body larger than 10 KB, then `413`; given `actionToken` longer than 2 KB, then `400`. |
| AC-SEC-05 | MUST | Given logs after a `complete` call, then they contain no JWT or action token strings. |
| AC-SEC-06 | MUST | Given a SQL injection string in any input, then no query error and no data leak (parameterised queries). |
| AC-SEC-07 | MUST | A user who tries every forgery path (no token, tampered token, other user's token, replay, expired, too fast) never gains points; each returns the documented error. |
| AC-SEC-08 | SHOULD | Given a user repeatedly hitting `ACTION_TOO_FAST` or `ACTION_TOKEN_INVALID` (>10 in 10 min), then a `suspicious_user` log/metric is emitted for review. |
