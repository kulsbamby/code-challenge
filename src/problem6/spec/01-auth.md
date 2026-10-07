# 01 Authentication

Login is out of scope. A separate auth service issues JWT access tokens; this module only **verifies** them.

## Requirements

- Header: `Authorization: Bearer <JWT>`.
- Algorithm: **RS256 only** (reject `none`/HS*). Public keys fetched from the auth service JWKS URL (`AUTH_JWKS_URL`), cached 10 min, refreshed on unknown `kid`.
- Validate `iss == AUTH_ISSUER`, `aud == AUTH_AUDIENCE`, `exp`, `nbf` (clock skew tolerance 30s).
- `sub` is the user id (string, maps to `users.id`).
- Optional ban check: if Redis key `banned:{userId}` exists, reject.
- Applies to: `POST /v1/actions/*`. Public (no auth): `GET /v1/scoreboard`, `GET /v1/scoreboard/stream`.
- On success set `req.user = { id }`.

## Acceptance criteria

| ID | Priority | Given / When / Then |
|----|----------|---------------------|
| AC-AUTH-01 | MUST | Given no `Authorization` header, when calling a protected endpoint, then `401 UNAUTHENTICATED`. |
| AC-AUTH-02 | MUST | Given a JWT with a bad signature, wrong `iss`/`aud`, or expired `exp`, then `401 UNAUTHENTICATED`. |
| AC-AUTH-03 | MUST | Given a JWT signed with `alg: none` or HS256, then `401 UNAUTHENTICATED`. |
| AC-AUTH-04 | MUST | Given a valid JWT whose `sub` is banned (`banned:{sub}` in Redis), then `403 USER_BANNED`. |
| AC-AUTH-05 | MUST | Given a valid JWT for a user not yet in `users`, when first calling a protected endpoint, then the user row and a `scores` row (score 0) are created (upsert) and the request proceeds. |
| AC-AUTH-06 | SHOULD | Given an unknown `kid`, then JWKS is refreshed once before rejecting. |
| AC-AUTH-07 | MUST | The error body never reveals why verification failed (always the same message). |
