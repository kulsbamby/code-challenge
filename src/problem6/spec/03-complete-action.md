# 03 Complete action: `POST /v1/actions/complete`

The core flow. The client sends only the token. **It never sends points or a score.**

## Request

Auth required.

```json
{ "actionToken": "<jwt from /actions/start>" }
```

## Algorithm (follow in this order)

1. Authenticate (01), rate limit (07).
2. Validate body (`actionToken` is a non-empty string).
3. Verify token signature with `ACTION_TOKEN_SECRET` (select key by `kid`). Invalid -> `400 ACTION_TOKEN_INVALID`. Do **not** reject on `exp` yet (step 5 handles expiry, so idempotent replays work).
4. If `token.sub != req.user.id` -> `403 ACTION_TOKEN_FORBIDDEN`.
5. Start a DB transaction (`READ COMMITTED`):
   1. `SELECT * FROM action_log WHERE token_jti = $jti`. If found (same user guaranteed by step 4): **replay**, return the stored result with `200` and header `Idempotent-Replay: true`. Do not change anything.
   2. Atomically claim the token:
      ```sql
      UPDATE action_tokens
         SET status = 'used', used_at = now()
       WHERE jti = $1 AND user_id = $2 AND status = 'issued'
         AND expires_at > now() AND issued_at + ($3 || ' ms')::interval <= now()
      RETURNING action_type;
      ```
      (`$3` = min duration for the action type.) If 0 rows, find out why with a follow-up `SELECT` and respond:
      - row missing -> `400 ACTION_TOKEN_INVALID`
      - `expires_at <= now()` -> `410 ACTION_TOKEN_EXPIRED`
      - `status = 'used'` -> `409 ACTION_TOKEN_USED` (a concurrent request won; the retry will hit the replay path)
      - too early -> `422 ACTION_TOO_FAST`
   3. Points = `ACTION_TYPES[action_type].points` (server config).
   4. Daily cap: `SUM(points)` from `action_log` for the user since UTC midnight + points must be `<= DAILY_POINT_CAP`, otherwise roll back and `422 DAILY_CAP_REACHED`.
   5. `UPDATE scores SET score = score + $points, updated_at = now() WHERE user_id = $1 RETURNING score`.
   6. `INSERT INTO action_log (user_id, action_type, points, token_jti, resulting_score)`.
   7. `INSERT INTO outbox (type, payload)` with `{ "userId": …, "score": <new total> }`.
6. Commit. Compute `rank` = `1 + COUNT(*) FROM scores WHERE score > $score` (or Redis `ZREVRANK` if available; DB is acceptable for v1).
7. Return `200`.

Redis and the live stream are updated **after commit** by the outbox worker (05). The request never blocks on Redis.

## Response `200`

```json
{ "score": 1290, "pointsAwarded": 10, "rank": 3 }
```

## Acceptance criteria

| ID | Priority | Given / When / Then |
|----|----------|---------------------|
| AC-COMP-01 | MUST | Given a fresh valid token after the min duration, when completing, then `200`, `scores.score` increases by exactly the configured points, one `action_log` row and one `outbox` row exist, `action_tokens.status='used'`. |
| AC-COMP-02 | MUST | Given a body containing `score`, `points`, `delta` or `userId`, then those fields are ignored (points always come from server config). |
| AC-COMP-03 | MUST | Given a token with a tampered claim or wrong signature, then `400 ACTION_TOKEN_INVALID` and no DB change. |
| AC-COMP-04 | MUST | Given a token issued to user A sent by user B, then `403 ACTION_TOKEN_FORBIDDEN` and no DB change. |
| AC-COMP-05 | MUST | Given an expired token that was never used, then `410 ACTION_TOKEN_EXPIRED` and no DB change. |
| AC-COMP-06 | MUST | Given the same token sent again by the same user after success, then `200`, identical body to the first response, header `Idempotent-Replay: true`, and the score is **not** increased again. |
| AC-COMP-07 | MUST | Given 20 parallel `complete` calls with one token, then exactly one credits points; the others return either `200` with `Idempotent-Replay: true` or `409 ACTION_TOKEN_USED`; the total score increase equals one award. |
| AC-COMP-08 | MUST | Given `complete` is called before `minDuration` has elapsed, then `422 ACTION_TOO_FAST`, token remains `issued`, and calling again after the duration succeeds. |
| AC-COMP-09 | MUST | Given the DB write fails (simulate error after the claim), then the whole transaction rolls back: token is still `issued`, no points, and a retry succeeds. |
| AC-COMP-10 | MUST | Given awarding would exceed `DAILY_POINT_CAP`, then `422 DAILY_CAP_REACHED`, no change, token stays `issued`. |
| AC-COMP-11 | MUST | Given Redis is down, `complete` still succeeds (200); the outbox row is processed when Redis recovers. |
| AC-COMP-12 | MUST | Given `score` and `rank` in the response, then `score` equals `scores.score` after the update and `rank` is consistent with it. |
| AC-COMP-13 | SHOULD | The response time p95 is under 100 ms at 200 req/s on the reference environment (see 08). |
