export const STATUSES = ["active", "inactive"] as const;
export type Status = (typeof STATUSES)[number];

export interface Resource {
  id: number;
  name: string;
  description: string;
  status: Status;
  created_at: string;
  updated_at: string;
}

export interface ResourceInput {
  name?: string;
  description?: string;
  status?: Status;
}

export interface ListFilters {
  status?: Status;
  name?: string;
  q?: string;
  limit: number;
  offset: number;
}

export interface ListResult {
  data: Resource[];
  total: number;
  limit: number;
  offset: number;
}
