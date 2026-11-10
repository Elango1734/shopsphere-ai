import type { Request } from 'express';

/** Express 5 types a route param as `string | string[]` (repeatable wildcard segments); routes here never use those. */
export function reqParam(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0]! : (value as string);
}
