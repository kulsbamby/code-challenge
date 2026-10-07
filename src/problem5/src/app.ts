import express from "express";
import type { DatabaseSync } from "node:sqlite";
import { docsRoutes } from "./docs/docs.routes.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { resourceRoutes } from "./resources/resource.routes.js";

export function createApp(db: DatabaseSync) {
  const app = express();
  app.use(express.json());
  app.use(docsRoutes());
  app.use("/resources", resourceRoutes(db));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
