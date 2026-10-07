const statusEnum = ["active", "inactive"];
const idParam = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "integer", minimum: 1 },
};
const err = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});
const resourceBody = (required: string[]) => ({
  required: true,
  content: {
    "application/json": {
      schema: {
        type: "object",
        required,
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: statusEnum },
        },
      },
    },
  },
});
const resourceOk = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Resource" } } },
});

export const openapi = {
  openapi: "3.0.3",
  info: { title: "Resources API", version: "1.0.0" },
  paths: {
    "/resources": {
      post: {
        summary: "Create a resource",
        requestBody: resourceBody(["name"]),
        responses: { 201: resourceOk("Created"), 400: err("Validation error") },
      },
      get: {
        summary: "List resources",
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: statusEnum } },
          { name: "name", in: "query", description: "Name substring", schema: { type: "string" } },
          {
            name: "q",
            in: "query",
            description: "Substring of name or description",
            schema: { type: "string" },
          },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
        ],
        responses: {
          200: {
            description: "Page of resources",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Resource" } },
                    total: { type: "integer" },
                    limit: { type: "integer" },
                    offset: { type: "integer" },
                  },
                },
              },
            },
          },
          400: err("Invalid query"),
        },
      },
    },
    "/resources/{id}": {
      get: {
        summary: "Get a resource",
        parameters: [idParam],
        responses: { 200: resourceOk("The resource"), 400: err("Invalid id"), 404: err("Not found") },
      },
      patch: {
        summary: "Partially update a resource",
        parameters: [idParam],
        requestBody: resourceBody([]),
        responses: { 200: resourceOk("Updated"), 400: err("Validation error"), 404: err("Not found") },
      },
      put: {
        summary: "Replace a resource",
        parameters: [idParam],
        requestBody: resourceBody(["name"]),
        responses: { 200: resourceOk("Updated"), 400: err("Validation error"), 404: err("Not found") },
      },
      delete: {
        summary: "Delete a resource",
        parameters: [idParam],
        responses: { 204: { description: "Deleted" }, 400: err("Invalid id"), 404: err("Not found") },
      },
    },
  },
  components: {
    schemas: {
      Resource: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: statusEnum },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      Error: { type: "object", properties: { error: { type: "string" } } },
    },
  },
};
