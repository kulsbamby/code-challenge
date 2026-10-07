import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../errors.js";

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new HttpError(404, "Not found"));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof SyntaxError) return res.status(400).json({ error: "Invalid JSON" });
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
