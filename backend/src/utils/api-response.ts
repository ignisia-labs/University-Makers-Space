import type { Response } from "express";

type Meta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export function ok(res: Response, message: string, data: unknown, meta?: Meta) {
  return res.status(200).json({ success: true, message, data, ...(meta ? { meta } : {}) });
}

export function created(res: Response, message: string, data: unknown) {
  return res.status(201).json({ success: true, message, data });
}

export function noContent(res: Response) {
  return res.status(204).send();
}
