import { HttpError } from "../errors.js";
import type { ResourceRepository } from "./resource.repository.js";
import type { ListFilters, ListResult, Resource, ResourceInput } from "./resource.types.js";

export class ResourceService {
  constructor(private repo: ResourceRepository) {}

  create(input: ResourceInput): Resource {
    return this.repo.insert({
      name: input.name!,
      description: input.description ?? "",
      status: input.status ?? "active",
    });
  }

  list(filters: ListFilters): ListResult {
    return { ...this.repo.list(filters), limit: filters.limit, offset: filters.offset };
  }

  get(id: number): Resource {
    const r = this.repo.findById(id);
    if (!r) throw new HttpError(404, "Resource not found");
    return r;
  }

  patch(id: number, input: ResourceInput): Resource {
    const { name, description, status } = { ...this.get(id), ...input };
    this.repo.update(id, { name, description, status });
    return this.get(id);
  }

  replace(id: number, input: ResourceInput): Resource {
    this.get(id);
    this.repo.update(id, {
      name: input.name!,
      description: input.description ?? "",
      status: input.status ?? "active",
    });
    return this.get(id);
  }

  remove(id: number): void {
    this.get(id);
    this.repo.delete(id);
  }
}
