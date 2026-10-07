# Review notes and improvements for the Scoreboard spec

A critical review of `README.md`. Each item says what is weak, why it matters, and the proposed fix. Priority: **P0** = fix before implementation, **P1** = should be in v1, **P2** = later.

> Status: P0 items 1-3 and most P1 items are now implemented in [spec/](./spec/README.md).

## Summary

| # | Area | Issue | Priority |
|---|------|-------|----------|
| 1 | Correctness | Token is consumed in Redis before the DB commit, so a failure loses the user's points | P0 |
| 2 | Security | A valid user can still farm points by looping `start` then `complete` | P0 |
| 3 | Correctness | Client retry after a lost response gets `409` although the points were credited | P0 |
| 4 | Consistency | Redis/pub-sub update after commit can be lost | P1 |
| 5 | Security | JWT details are undefined (algorithm, expiry, revocation, storage) | P1 |
| 6 | Real-time | Stream has no ordering/version; tie-break not implemented in Redis | P1 |
| 7 | Privacy / abuse | Public endpoints expose user ids and can be scraped or used to exhaust connections | P1 |
| 8 | Scalability | Fan-out and DB write path have no sizing assumptions | P2 |
| 9 | Doc quality | No non-goals, assumptions, testing or rollout plan | P1 |

## 1. Token consumption is not atomic with the score update (P0)

**Problem.** Step 3 deletes the `jti` from Redis, and step 5 commits to PostgreSQL afterwards. If the DB write fails or the server crashes in between, the token is gone, the user retries, gets `409`, and the points are lost. The reverse order allows double credit.

**Fix.** Make PostgreSQL the authority and Redis only a fast pre-check:
1. Fast path: check the `jti` exists in Redis (rejects most replays cheaply).
2. In one DB transaction: `INSERT INTO action_log (..., token_jti)`. The `UNIQUE` constraint is the real replay guard. If it conflicts, return the existing result (see item 3). Otherwise update `scores`.
3. After commit, delete the `jti` from Redis (best effort; TTL cleans up anyway).

The same applies to the `ZINCRBY` step (item 4).

## 2. Valid users can still farm points (P0)

**Problem.** The design stops forgery and replay, but an authenticated bot can call `start` and `complete` in a loop. The README mentions a minimum duration only as optional, and the server cannot see whether the action really happened.

**Fix (layered).**
- Make the minimum duration per `actionType` mandatory, and reject `complete` earlier than that.
- Limit outstanding tokens per user (e.g. 1–3) and total points per user per hour/day (a daily cap limits damage from a compromised account).
- If actions have a verifiable result, send proof (e.g. a server-validated game result) and verify it in `complete`. Otherwise state clearly in the spec that point integrity depends on rate limits and caps.
- Add anomaly detection: flag users whose score growth is a statistical outlier, and a way to freeze and review them.

## 3. Retries and idempotency (P0)

**Problem.** If `complete` succeeds but the response is lost, the client retries and receives `409`, which looks like a failure even though the user was credited.

**Fix.** Make `complete` idempotent per `jti`: a repeat call with the same token by the same user returns the original `200` result (look it up via `action_log.token_jti`). Keep `409` only for a token that belongs to someone else or is otherwise invalid.

## 4. Redis and pub/sub can drift from PostgreSQL (P1)

**Problem.** The README says a reconciliation job exists but not how often, and a lost publish means clients show stale data until the next change.

**Fix.**
- Use a **transactional outbox**: write an `outbox` row in the same DB transaction and have a worker apply `ZINCRBY` and publish. This removes the "commit succeeded, Redis failed" gap.
- Run a full ZSET rebuild on startup and a periodic check (e.g. every minute: compare the top 10 from Redis vs. PostgreSQL, alert on mismatch).
- Remember Redis pub/sub is fire-and-forget; that is acceptable because every event is a full snapshot (see item 6) and a periodic snapshot is also pushed.

## 5. Authentication details are missing (P1)

**Problem.** The spec says "JWT" without saying how it is issued, validated or revoked.

**Fix.** Define:
- Out of scope vs. in scope: state whether login/registration exists elsewhere (assumed: a separate auth service issues the JWT).
- Pin the algorithm (e.g. RS256 or HS256, never `none`), validate `iss`, `aud`, `exp`; short access token lifetime (e.g. 15 min) with refresh.
- Revocation: a deny-list in Redis keyed by `jti`/`userId` for banned accounts, checked on `/actions/*`.
- Client storage: prefer an `HttpOnly; Secure; SameSite` cookie over `localStorage` to reduce XSS exposure; if cookies are used, add CSRF protection.
- Action-token signing key is separate from the JWT key and rotated with a `kid`.

## 6. Live stream ordering and tie-breaks (P1)

**Problem.**
- Events carry no version, so a client that reconnects or receives events out of order may render an older snapshot after a newer one.
- The README proposes tie-breaking by earliest `updated_at`, but a Redis ZSET orders ties lexicographically by member, so the rule is not implemented.

**Fix.**
- Add a monotonically increasing `version` (Redis `INCR`, or the outbox id) to every snapshot and to `GET /scoreboard`; clients ignore snapshots with a lower version. Use it as the SSE `id:` so `Last-Event-ID` works.
- For ties, encode the score as `score * 1e6 + (1e6 - secondsSinceEpochOffset)` or use a composite score; or fetch the top 11–20 from Redis and let PostgreSQL order the final 10 (`ORDER BY score DESC, updated_at ASC`).
- Coalesce pushes (max 1–2 per second) and add a periodic full snapshot as self-healing.

## 7. Public endpoints: privacy and abuse (P1)

**Problem.** `GET /scoreboard` and the stream are public, so anyone can scrape them or hold thousands of idle SSE connections.

**Fix.**
- Expose a display name and an opaque public id, not the internal `userId`; let users opt out of being shown.
- Per-IP limits on connections and requests; cap total SSE connections per instance; serve `GET /scoreboard` from a short cache (1s) or CDN.
- Set `Cache-Control`, CORS to the known origin, and disable response buffering for the stream in the reverse proxy.

## 8. Sizing and scalability assumptions (P2)

**Problem.** The spec says "horizontally scalable" without numbers, so design choices cannot be checked.

**Fix.** State assumptions, for example: 100k registered users, 5k concurrent viewers, 200 score updates/s peak. From these, validate: one Redis node is enough; SSE fan-out of 5k connections per instance is fine; the DB write path (one transaction per action) holds at 200/s. Revisit batching writes or sharding only if the numbers grow.

## 9. Documentation gaps (P1)

Add to `README.md`:
- **Non-goals:** what the action is, login/registration, anti-cheat inside the client, payments/rewards.
- **Assumptions:** the sizing numbers above, a single region, a separate auth service.
- **Error contract:** one shared error shape with machine-readable `code` (e.g. `TOKEN_EXPIRED`) in addition to the message.
- **Versioning:** prefix routes with `/v1`.
- **Testing plan:** unit tests for token validation (expired, wrong user, replay, tampered); integration tests for the concurrency case (two parallel `complete` calls with one token must credit once); load test for SSE fan-out.
- **Rollout and operations:** feature flag, migration order, dashboards and alerts (reject rates by reason, publish lag, stream connections, Redis vs. DB drift), and a runbook for rebuilding the leaderboard.
- **Rate limit numbers:** concrete defaults (e.g. 30 `start`/min/user, 3 outstanding tokens) so the team does not guess.

## Suggested next step

Apply P0 items 1–3 to the main README (they change the `complete` algorithm and the API contract), then the P1 items as a second pass.
