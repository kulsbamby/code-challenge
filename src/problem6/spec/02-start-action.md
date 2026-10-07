# 02 Start action: `POST /v1/actions/start`

Called when the user begins an action. Returns a signed single-use token.

## Request

Auth required. Body:

```json
{ "actionType": "default" }
```

- `actionType`: string, must exist in the server `ACTION_TYPES` config (see file 06). Defaults to `"default"` if omitted.

## Behaviour

1. Authenticate (01), rate limit (07).
2. Reject if the user already has `MAX_OUTSTANDING_TOKENS` (3) tokens with `status='issued'` and `expires_at > now()`.
3. Insert `action_tokens` row: `jti` (uuid v4), `user_id`, `action_type`, `issued_at = now()`, `expires_at = now() + TOKEN_TTL` (300s), `status = 'issued'`.
4. Sign the token and return it.

Token format: JWT, `HS256` with `ACTION_TOKEN_SECRET` (separate from the auth keys), header `kid` = key id for rotation, claims:

```json
{ "jti": "…", "sub": "u_42", "act": "default", "iat": 1790000000, "exp": 1790000300 }
```

## Response `201`

```json
{ "actionToken": "<jwt>", "expiresAt": "2026-10-07T04:05:00Z", "minDurationMs": 3000 }
```

`minDurationMs` is informational for the client UI. The server enforces it in `complete`.

## Acceptance criteria

| ID | Priority | Given / When / Then |
|----|----------|---------------------|
| AC-START-01 | MUST | Given an authenticated user and valid `actionType`, then `201`, a row exists in `action_tokens` with `status='issued'`, and the token's `jti`/`sub`/`act` match that row. |
| AC-START-02 | MUST | Given `expiresAt`, then it equals `issued_at + 300s`. |
| AC-START-03 | MUST | Given an unknown `actionType`, then `400 VALIDATION_ERROR`. |
| AC-START-04 | MUST | Given the user already has 3 live tokens, then `429 TOO_MANY_OUTSTANDING_ACTIONS`; no row inserted. |
| AC-START-05 | MUST | Given expired or used tokens, they do not count toward the limit in AC-START-04. |
| AC-START-06 | MUST | Given no/invalid JWT, then `401`. Given the user is rate limited (07), then `429 RATE_LIMITED` with `Retry-After`. |
| AC-START-07 | MUST | The token is signed with `ACTION_TOKEN_SECRET`; changing any claim invalidates it (verified in file 03). |
| AC-START-08 | SHOULD | Body must be a JSON object; any other shape gives `400 VALIDATION_ERROR`. |
