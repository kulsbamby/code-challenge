# 05 Live updates: SSE stream and outbox worker

## Part A: `GET /v1/scoreboard/stream` (Server-Sent Events)

Public, long-lived connection.

Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`.

Behaviour:
1. On connect, immediately send the current snapshot (same data as file 04).
2. Whenever the worker publishes a new snapshot, send it to every connected client.
3. Send a comment line `: ping` every 15 s.
4. Each event: `id: <version>`, `event: scoreboard`, `data: <same JSON as GET /v1/scoreboard>`.
5. Max `MAX_SSE_CONNECTIONS` (default 5000) per instance and `MAX_SSE_PER_IP` (default 10). Over the limit -> `503 TOO_MANY_CONNECTIONS` / `429 RATE_LIMITED`.
6. Server coalesces pushes: at most 1 event per second per connection (send the latest snapshot).
7. Clean up the connection and listeners on client disconnect (no leaks).

Client rule (document for the frontend): ignore any event whose `version` is lower than the one already rendered.

## Part B: Outbox worker

Runs inside each API instance or as a separate process (one active consumer is enough; use `FOR UPDATE SKIP LOCKED` so several workers are safe).

Loop every 200 ms (or on Postgres `LISTEN/NOTIFY`):
1. In a transaction select up to 100 unprocessed `outbox` rows ordered by `id` `FOR UPDATE SKIP LOCKED`.
2. For each: `ZADD leaderboard <score> <internalUserId>` using the **absolute total** in the payload (idempotent, safe to retry; never use `ZINCRBY`).
3. Read the new top 10 from Redis (`ZREVRANGE leaderboard 0 9 WITHSCORES`, ties by member order, matching rule in 04), load display names (cached `HGET`/PostgreSQL by id).
4. If the top 10 differs from `leaderboard:snapshot`: `INCR leaderboard:version`, store the snapshot JSON, and `PUBLISH leaderboard:updates <version>`.
5. Mark rows processed (`processed_at = now()`), commit.
6. On Redis failure: roll back (rows stay unprocessed), back off exponentially (max 5 s), alert after 60 s.

API instances subscribe to `leaderboard:updates`, read the snapshot, and push to their SSE clients.

Self-healing: every 60 s the worker rebuilds the top 10 from PostgreSQL and compares it with Redis; on mismatch it logs `leaderboard_drift` (metric) and overwrites Redis from PostgreSQL. On startup, if the `leaderboard` ZSET is empty, rebuild it from `scores`.

## Acceptance criteria

| ID | Priority | Given / When / Then |
|----|----------|---------------------|
| AC-LIVE-01 | MUST | Given a connected client, then the first event arrives immediately and equals `GET /v1/scoreboard`. |
| AC-LIVE-02 | MUST | Given a client connected, when a `complete` changes the top 10, then the client receives a new event within 2 s with a higher `version`. |
| AC-LIVE-03 | MUST | Given a `complete` that does not change the top 10 (e.g. user ranked 50th), then no event is sent and `version` is unchanged. |
| AC-LIVE-04 | MUST | Given two API instances, when a score changes via instance A, then clients connected to instance B receive the event. |
| AC-LIVE-05 | MUST | Given an idle connection, then a `: ping` comment arrives every 15 s (±2 s). |
| AC-LIVE-06 | MUST | Given 100 `complete` calls in 1 s, then each client receives at most ~2 events in that second and the final event shows the final state. |
| AC-LIVE-07 | MUST | Given a client disconnects, then the server frees its resources (connection count metric decreases). |
| AC-LIVE-08 | MUST | Given the connection limit is reached, then new connections get `503` and existing ones are unaffected. |
| AC-LIVE-09 | MUST | Given Redis is down then recovers, then pending outbox rows are processed, Redis matches PostgreSQL, and clients receive the latest snapshot. |
| AC-LIVE-10 | MUST | Given the worker processes the same outbox row twice (simulated crash before marking processed), then the leaderboard ends in the same state (idempotent). |
| AC-LIVE-11 | MUST | Given Redis is flushed manually, then within 60 s the drift check restores the correct top 10. |
| AC-LIVE-12 | SHOULD | `Last-Event-ID` on reconnect is accepted; the server simply sends the current snapshot. |
