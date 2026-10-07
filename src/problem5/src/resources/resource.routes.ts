import { Router } from "express";
import type { DatabaseSync } from "node:sqlite";
import { ResourceController } from "./resource.controller.js";
import { ResourceRepository } from "./resource.repository.js";
import { ResourceService } from "./resource.service.js";

export function resourceRoutes(db: DatabaseSync): Router {
  const c = new ResourceController(new ResourceService(new ResourceRepository(db)));
  const router = Router();
  router.route("/").post(c.create).get(c.list);
  router.route("/:id").get(c.get).patch(c.patch).put(c.replace).delete(c.remove);
  return router;
}
