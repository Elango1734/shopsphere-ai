import jwt from 'jsonwebtoken';
import type { UserRole } from '@shopsphere/shared-types';
import { getEnv } from '../../config/env.js';

export interface AccessTokenPayload {
  sub: string;
  roles: UserRole[];
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const env = getEnv();
  return jwt.sign(payload, env.ACCESS_TOKEN_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL_SECONDS });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const env = getEnv();
  const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET);
  if (typeof decoded === 'string' || !decoded.sub || !Array.isArray((decoded as { roles?: unknown }).roles)) {
    throw new jwt.JsonWebTokenError('Malformed access token payload');
  }
  return { sub: decoded.sub, roles: (decoded as { roles: UserRole[] }).roles };
}
