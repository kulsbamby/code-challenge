# Scoreboard module: implementation spec

Engineering-ready spec. The high-level design is in [../README.md](../README.md) and the review in [../improvement.md](../improvement.md). **Where this folder differs from those, this folder wins** (it already includes the P0/P1 fixes).

## Reading order

| File | Contents |
|------|----------|
| [01-auth.md](./01-auth.md) | Authentication and the request context |
| [02-start-action.md](./02-start-action.md) | `POST /v1/actions/start` |
| [03-complete-action.md](./03-complete-action.md) | `POST /v1/actions/complete` (the core flow) |
| [04-scoreboard-read.md](./04-scoreboard-read.md) | `GET /v1/scoreboard` |
| [05-live-stream.md](./05-live-stream.md) | `GET /v1/scoreboard/stream` (SSE) and the outbox worker |
| [06-data-model.md](./06-data-model.md) | PostgreSQL schema, Redis keys, config |
| [07-security-and-limits.md](./07-security-and-limits.md) | Rate limits, caps, abuse handling |
| [08-errors-nfr-testing.md](./08-errors-nfr-testing.md) | Error contract, non-functional requirements, observability, test plan, definition of done |

## Scope

**In scope:** action start/complete, score updates, top-10 read, live updates, anti-abuse.
**Non-goals:** what the action is; login/registration (a separate auth service issues JWTs); payments or rewards; multi-region; daily/weekly boards (future).

## Assumptions

- 100k users, up to 5k concurrent scoreboard viewers, peak 200 completed actions/s.
- One region, one PostgreSQL primary, one Redis (with persistence off is acceptable: Redis data is rebuildable).
- Stack follows Problem 5: Node 22, TypeScript, Express, layered `routes -> controller -> service -> repository`.
- All times are UTC, ISO-8601 strings in JSON.

## Conventions

- Base path `/v1`. JSON bodies, `Content-Type: application/json`.
- Acceptance criteria (AC) use IDs like `AC-ACT-03` and are written Given/When/Then. Every AC must be covered by an automated test.
- Priority tags: **MUST** (blocks release) / **SHOULD**.
- Error body shape is defined once in file 08.

## Glossary

| Term | Meaning |
|------|---------|
| Action | Something the user does that earns points. Type is a string such as `default`. |
| Action token | Server-issued, signed, single-use credential proving an action was started. |
| `jti` | Unique id of an action token (UUID v4). |
| Snapshot | The full top-10 list plus a `version`. |

## Implementation order (suggested)

1. Schema + migrations + config (06)
2. Auth middleware (01)
3. Start action (02)
4. Complete action incl. concurrency test (03)
5. Outbox worker + Redis leaderboard (05)
6. Scoreboard read + stream (04, 05)
7. Rate limits and caps (07)
8. Errors, metrics, load test (08)
