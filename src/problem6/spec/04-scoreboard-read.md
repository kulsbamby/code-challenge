# 04 Scoreboard read: `GET /v1/scoreboard`

Public. Used for the initial page load and as a fallback if the stream is unavailable.

## Behaviour

- Returns the latest snapshot stored by the outbox worker in Redis (`leaderboard:snapshot`, see 06).
- If the snapshot key is missing (cold start), build it from PostgreSQL:
  `SELECT u.public_id, u.display_name, s.score FROM scores s JOIN users u ON u.id = s.user_id ORDER BY s.score DESC, u.id ASC LIMIT 10`, store it with `version = 0`, then return it.
- **Ordering rule:** score descending, ties broken by `user id` ascending (deterministic). The same rule must be used in Redis and PostgreSQL paths.
- Users with score 0 are not listed.
- Response is cacheable for 1s: `Cache-Control: public, max-age=1`.

## Response `200`

```json
{
  "version": 1042,
  "updatedAt": "2026-10-07T04:00:00Z",
  "data": [
    { "rank": 1, "userId": "pub_7f3a", "name": "Alice", "score": 1280 }
  ]
}
```

- `userId` is the **public id** (opaque), never the internal id.
- `data` has at most 10 items; ranks are `1..n` (ties still get consecutive ranks).

## Acceptance criteria

| ID | Priority | Given / When / Then |
|----|----------|---------------------|
| AC-BOARD-01 | MUST | Given 15 users with scores, then exactly 10 entries are returned, highest first, ranks 1..10. |
| AC-BOARD-02 | MUST | Given two users with equal scores, then the one with the lower internal id ranks first, every time. |
| AC-BOARD-03 | MUST | Given fewer than 10 scoring users, then only those users are returned; given none, `data: []`. |
| AC-BOARD-04 | MUST | The response contains no internal user id, email, or other fields beyond `rank`, `userId` (public), `name`, `score`. |
| AC-BOARD-05 | MUST | Given an empty Redis, then the snapshot is rebuilt from PostgreSQL and returned (no error). |
| AC-BOARD-06 | MUST | After a successful `complete` that changes the top 10, `GET /v1/scoreboard` reflects it within 2s. |
| AC-BOARD-07 | MUST | No authentication is required; the endpoint is rate limited per IP (07). |
| AC-BOARD-08 | SHOULD | `version` never decreases between consecutive calls. |
