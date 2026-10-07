import type { Request, Response } from "express";
import type { ResourceService } from "./resource.service.js";
import { parseBody, parseId, parseListQuery } from "./resource.validation.js";

export class ResourceController {
  constructor(private service: ResourceService) {}

  create = (req: Request, res: Response) => {
    res.status(201).json(this.service.create(parseBody(req.body, true)));
  };

  list = (req: Request, res: Response) => {
    res.json(this.service.list(parseListQuery(req.query)));
  };

  get = (req: Request, res: Response) => {
    res.json(this.service.get(parseId(req.params.id as string)));
  };

  patch = (req: Request, res: Response) => {
    const id = parseId(req.params.id as string);
    res.json(this.service.patch(id, parseBody(req.body, false)));
  };

  replace = (req: Request, res: Response) => {
    const id = parseId(req.params.id as string);
    res.json(this.service.replace(id, parseBody(req.body, true)));
  };

  remove = (req: Request, res: Response) => {
    this.service.remove(parseId(req.params.id as string));
    res.status(204).end();
  };
}
