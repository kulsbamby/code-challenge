import type { DatabaseSync } from "node:sqlite";
import type { ListFilters, Resource, ResourceInput } from "./resource.types.js";

const like = (v: string) => `%${v.replace(/[\\%_]/g, "\\$&")}%`;

export class ResourceRepository {
  constructor(private db: DatabaseSync) {}

  findById(id: number): Resource | undefined {
    return this.db.prepare("SELECT * FROM resources WHERE id = ?").get(id) as unknown as
      | Resource
      | undefined;
  }

  list(f: ListFilters): { data: Resource[]; total: number } {
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (f.status) {
      where.push("status = ?");
      params.push(f.status);
    }
    if (f.name !== undefined) {
      where.push("name LIKE ? ESCAPE '\\'");
      params.push(like(f.name));
    }
    if (f.q !== undefined) {
      where.push("(name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')");
      params.push(like(f.q), like(f.q));
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const { total } = this.db
      .prepare(`SELECT COUNT(*) AS total FROM resources ${clause}`)
      .get(...params) as unknown as { total: number };
    const data = this.db
      .prepare(`SELECT * FROM resources ${clause} ORDER BY id LIMIT ? OFFSET ?`)
      .all(...params, f.limit, f.offset) as unknown as Resource[];
    return { data, total };
  }

  insert(input: Required<ResourceInput>): Resource {
    const now = new Date().toISOString();
    const info = this.db
      .prepare(
        "INSERT INTO resources (name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(input.name, input.description, input.status, now, now);
    return this.findById(Number(info.lastInsertRowid))!;
  }

  update(id: number, input: Required<ResourceInput>): void {
    this.db
      .prepare(
        "UPDATE resources SET name = ?, description = ?, status = ?, updated_at = ? WHERE id = ?",
      )
      .run(input.name, input.description, input.status, new Date().toISOString(), id);
  }

  delete(id: number): void {
    this.db.prepare("DELETE FROM resources WHERE id = ?").run(id);
  }
}
