import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@shopsphere/shared-types';
import { verifyAccessToken } from '../../modules/auth/jwt.js';
import { UnauthorizedError, ForbiddenError } from '../errors.js';

export interface AuthContext {
  userId: string;
  roles: UserRole[];
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

/** Populates `req.auth` when a valid bearer token is present; never rejects — use `requireAuth` to enforce. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    next();
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub, roles: payload.roles };
  } catch {
    // An invalid/expired token on an optional-auth route is treated as anonymous, not an error.
  }
  next();
}

/**
 * Establishes identity; it does NOT by itself authorize access to any
 * specific resource — api-specification.md requires per-resource checks on
 * top of this (ownership, role). Use `requireRole` or a repository-level
 * ownership assertion for that.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    next(new UnauthorizedError());
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub, roles: payload.roles };
    next();
  } catch {
    next(new UnauthorizedError('Access token is invalid or expired'));
  }
}

/** Role check ONLY — "`seller` role alone does not grant access to another seller's records" still applies on top of this. */
export function requireRole(...allowed: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new UnauthorizedError());
      return;
    }
    if (!req.auth.roles.some((role) => allowed.includes(role))) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}
