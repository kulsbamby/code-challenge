# Problem 5: CRUD API (ExpressJS + TypeScript + SQLite)

A resource CRUD service. Data is persisted in SQLite via Node's built-in `node:sqlite` module (no native dependencies).

## Requirements

- Node.js >= 22.13

## Quick start

### With Docker (no Node install needed)

```bash
cp .env.example .env   # optional; defaults work without it
docker compose up --build
```

API: <http://localhost:3000>, docs: <http://localhost:3000/docs>. Data persists in the `db-data` volume (`docker compose down -v` wipes it).

### Without Docker

```bash
npm install
npm run dev          # dev server with reload
# or
npm run build && npm start
npm run seed         # optional: load 10 sample resources (only if table is empty)
npm test             # run tests
```

Configuration (environment variables, see `.env.example`; `.env` is loaded by Docker Compose only; for local runs export the variables in your shell):

| Variable  | Default       | Description          |
|-----------|---------------|----------------------|
| `PORT`    | `3000`        | HTTP port            |
| `SEED_ON_START` | `false` (`true` in Docker Compose) | Insert 10 sample resources on startup if the table is empty |
| `DB_FILE` | `data/app.db` | SQLite file location (fixed to a volume path in Docker) |

The database file and table are created automatically on startup.

## API docs (Swagger)

Interactive docs at <http://localhost:3000/docs>; raw spec at `/openapi.json`.

## Project structure

```
src/
├── index.ts                  # entry: load config, open DB, listen
├── app.ts                    # builds the Express app (wiring only)
├── config.ts                 # env vars (PORT, DB_FILE)
├── seed.ts                   # sample data (seed.cli.ts = `npm run seed`)
├── db.ts                     # SQLite connection and schema
├── errors.ts                 # HttpError
├── middleware/
│   └── errorHandler.ts       # 404 and error handlers
├── docs/
│   ├── openapi.ts            # OpenAPI spec
│   └── docs.routes.ts        # /docs and /openapi.json
└── resources/                # one folder per feature
    ├── resource.types.ts
    ├── resource.validation.ts  # parse body, id and query
    ├── resource.repository.ts  # SQL only
    ├── resource.service.ts     # business logic, 404s
    ├── resource.controller.ts  # HTTP in/out
    └── resource.routes.ts      # wires repository, service and controller
test/
└── api.test.ts               # integration test
```

Request flow: routes -> controller (validation) -> service -> repository -> SQLite.

## Resource

```json
{ "id": 1, "name": "Widget", "description": "", "status": "active",
  "created_at": "...", "updated_at": "..." }
```

`status` is `active` (default) or `inactive`.

## Endpoints

| Method | Path             | Description                                        |
|--------|------------------|----------------------------------------------------|
| POST   | `/resources`     | Create (`name` required; `description`, `status`)  |
| GET    | `/resources`     | List with filters                                  |
| GET    | `/resources/:id` | Get details                                        |
| PATCH  | `/resources/:id` | Partial update                                     |
| PUT    | `/resources/:id` | Full update (`name` required)                      |
| DELETE | `/resources/:id` | Delete (204)                                       |

List query params: `status`, `name` (substring), `q` (substring of name or description), `limit` (1-100, default 20), `offset` (default 0).
Response: `{ "data": [...], "total": N, "limit": 20, "offset": 0 }`.

Errors return `{ "error": "message" }` with 400 (validation), 404, or 500.

## Example

```bash
curl -X POST localhost:3000/resources -H 'content-type: application/json' -d '{"name":"Widget"}'
curl 'localhost:3000/resources?status=active&q=wid'
curl -X PATCH localhost:3000/resources/1 -H 'content-type: application/json' -d '{"status":"inactive"}'
curl -X DELETE localhost:3000/resources/1
```
