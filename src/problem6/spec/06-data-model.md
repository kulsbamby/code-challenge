# 06 Data model and configuration

## PostgreSQL (migration `001_init.sql`)

```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY,                 -- JWT `sub`
  public_id     TEXT NOT NULL UNIQUE,             -- opaque id shown on the scoreboard
  display_name  TEXT NOT NULL DEFAULT 'Anonymous',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE scores (
  user_id     TEXT PRIMARY KEY REFERENCES users(id),
  score       BIGINT NOT NULL DEFAULT 0 CHECK (score >= 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX scores_rank_idx ON scores (score DESC, user_id ASC);

CREATE TABLE action_tokens (
  jti          UUID PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  action_type  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','used')),
  issued_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ
);
CREATE INDEX action_tokens_user_live_idx ON action_tokens (user_id) WHERE status = 'issued';

CREATE TABLE action_log (                          -- append-only audit trail
  id               BIGSERIAL PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id),
  action_type      TEXT NOT NULL,
  points           INT NOT NULL CHECK (points > 0),
  resulting_score  BIGINT NOT NULL,
  token_jti        UUID NOT NULL UNIQUE REFERENCES action_tokens(jti),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX action_log_user_day_idx ON action_log (user_id, created_at);

CREATE TABLE outbox (
  id            BIGSERIAL PRIMARY KEY,
  type          TEXT NOT NULL,                    -- 'score_changed'
  payload       JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ
);
CREATE INDEX outbox_pending_idx ON outbox (id) WHERE processed_at IS NULL;
```

Rules: `action_log` is never updated or deleted by application code. Cleanup job (SHOULD): delete `action_tokens` with `status='issued'` and `expires_at < now() - 1 day`; delete processed `outbox` rows older than 7 days.

## Redis keys

| Key | Type | Purpose |
|-----|------|---------|
| `leaderboard` | ZSET (member = internal user id, score = total points) | Fast top-N, rebuildable |
| `leaderboard:snapshot` | STRING (JSON) | Latest published snapshot including `version` |
| `leaderboard:version` | STRING (int) | Monotonic version (`INCR`) |
| `leaderboard:updates` | pub/sub channel | New snapshot notifications |
| `rl:{scope}:{id}:{window}` | STRING (counter, TTL) | Rate limits (07) |
| `banned:{userId}` | STRING | Ban flag (01) |

## Configuration (environment variables)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `DATABASE_URL` | none (required) | PostgreSQL connection string |
| `REDIS_URL` | none (required) | Redis connection string |
| `AUTH_JWKS_URL`, `AUTH_ISSUER`, `AUTH_AUDIENCE` | none (required) | JWT verification (01) |
| `ACTION_TOKEN_SECRET` | none (required) | HMAC key for action tokens; supports `kid:secret` list for rotation |
| `TOKEN_TTL_SECONDS` | `300` | Action token lifetime |
| `MAX_OUTSTANDING_TOKENS` | `3` | Live tokens per user |
| `DAILY_POINT_CAP` | `5000` | Max points per user per UTC day |
| `ACTION_TYPES` | `{"default":{"points":10,"minDurationMs":3000}}` | JSON: points and min duration per action type |
| `MAX_SSE_CONNECTIONS` | `5000` | Per instance |
| `MAX_SSE_PER_IP` | `10` | Per IP |

The app must fail fast at startup if a required variable is missing or invalid. Provide `.env.example` and a `docker-compose.yml` with PostgreSQL and Redis (same approach as Problem 5).

## Acceptance criteria

| ID | Priority | Given / When / Then |
|----|----------|---------------------|
| AC-DATA-01 | MUST | Migrations run on an empty database and are re-runnable (idempotent or tracked). |
| AC-DATA-02 | MUST | Inserting two `action_log` rows with the same `token_jti` fails (unique constraint). |
| AC-DATA-03 | MUST | A negative score cannot be stored (check constraint). |
| AC-DATA-04 | MUST | Starting the app with a missing required env var exits with a clear error message. |
| AC-DATA-05 | MUST | `docker compose up` brings up the API, PostgreSQL and Redis; the app is usable with seed data (10 users) via `npm run seed`. |
| AC-DATA-06 | MUST | Rebuilding the `leaderboard` ZSET from `scores` yields the same top 10 as the DB query in 04. |
