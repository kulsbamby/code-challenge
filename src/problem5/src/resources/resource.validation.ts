import { HttpError } from "../errors.js";
import { ListFilters, ResourceInput, STATUSES, Status } from "./resource.types.js";

const statusError = `status must be one of: ${STATUSES.join(", ")}`;

export function parseBody(body: unknown, requireName: boolean): ResourceInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "Body must be a JSON object");
  }
  const b = body as Record<string, unknown>;
  const out: ResourceInput = {};
  if (b.name !== undefined || requireName) {
    if (typeof b.name !== "string" || !b.name.trim()) {
      throw new HttpError(400, "name must be a non-empty string");
    }
    out.name = b.name.trim();
  }
  if (b.description !== undefined) {
    if (typeof b.description !== "string") throw new HttpError(400, "description must be a string");
    out.description = b.description;
  }
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status as Status)) throw new HttpError(400, statusError);
    out.status = b.status as Status;
  }
  return out;
}

export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, "id must be a positive integer");
  return id;
}

function intParam(raw: unknown, name: string, def: number, min: number, max: number): number {
  if (raw === undefined) return def;
  const n = Number(raw);
  if (typeof raw !== "string" || !Number.isInteger(n) || n < min || n > max) {
    throw new HttpError(400, `${name} must be an integer between ${min} and ${max}`);
  }
  return n;
}

function optString(raw: unknown, name: string): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "string") throw new HttpError(400, `${name} must be a string`);
  return raw;
}

export function parseListQuery(query: Record<string, unknown>): ListFilters {
  const status = optString(query.status, "status");
  if (status !== undefined && !STATUSES.includes(status as Status)) {
    throw new HttpError(400, statusError);
  }
  return {
    status: status as Status | undefined,
    name: optString(query.name, "name"),
    q: optString(query.q, "q"),
    limit: intParam(query.limit, "limit", 20, 1, 100),
    offset: intParam(query.offset, "offset", 0, 0, Number.MAX_SAFE_INTEGER),
  };
}
