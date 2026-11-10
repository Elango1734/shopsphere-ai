import { createHash, randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { RefreshSessionModel, type RefreshSessionDocument } from '../models/refreshSession.model.js';
import { getEnv } from '../config/env.js';

export class RefreshTokenReuseError extends Error {
  constructor() {
    super('Refresh token reuse detected; all sessions for this user have been revoked');
    this.name = 'RefreshTokenReuseError';
  }
}

export class RefreshTokenInvalidError extends Error {
  constructor(message = 'Refresh token is invalid, expired, or revoked') {
    super(message);
    this.name = 'RefreshTokenInvalidError';
  }
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

/** Raw token format is `sessionId.secret` so a lookup is a direct findById, never a full-collection hash scan. */
function encodeRawToken(sessionId: string, secret: string): string {
  return `${sessionId}.${secret}`;
}

function decodeRawToken(rawToken: string): { sessionId: string; secret: string } | null {
  const parts = rawToken.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { sessionId: parts[0], secret: parts[1] };
}

export interface DeviceContext {
  deviceLabel?: string;
  userAgent?: string;
  ipAddress?: string;
}

export async function createRefreshSession(userId: string, device: DeviceContext = {}): Promise<string> {
  const secret = randomBytes(32).toString('hex');
  const env = getEnv();
  const session = await RefreshSessionModel.create({
    userId,
    tokenHash: hashSecret(secret),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_SECONDS * 1000),
    ...device
  });
  return encodeRawToken(session._id.toString(), secret);
}

/**
 * Rotation + reuse detection: a refresh token may only be redeemed once. If
 * the same raw token (or a since-replaced one) is presented again, that is
 * treated as a stolen/replayed token, and every session for the user is
 * revoked as a precaution — security.md requires "detect token reuse where
 * feasible." Returns the new raw token and the owning userId.
 */
export async function rotateRefreshSession(
  rawToken: string,
  device: DeviceContext = {}
): Promise<{ userId: string; rawToken: string }> {
  const decoded = decodeRawToken(rawToken);
  if (!decoded) throw new RefreshTokenInvalidError();

  const session = await RefreshSessionModel.findById(decoded.sessionId).select('+tokenHash');
  if (!session) throw new RefreshTokenInvalidError();

  if (session.revokedAt) {
    // Already-rotated or already-revoked session presented again: reuse. Nuke every session for this user.
    await revokeAllSessionsForUser(session.userId.toString(), 'refresh token reuse detected');
    throw new RefreshTokenReuseError();
  }

  if (session.expiresAt.getTime() < Date.now()) {
    throw new RefreshTokenInvalidError('Refresh token has expired');
  }

  if (session.tokenHash !== hashSecret(decoded.secret)) {
    throw new RefreshTokenInvalidError();
  }

  const newRawToken = await createRefreshSession(session.userId.toString(), device);
  const newDecoded = decodeRawToken(newRawToken)!;

  session.revokedAt = new Date();
  session.revokedReason = 'rotated';
  session.replacedBySessionId = new Types.ObjectId(newDecoded.sessionId);
  await session.save();

  return { userId: session.userId.toString(), rawToken: newRawToken };
}

export async function revokeRefreshSession(rawToken: string): Promise<void> {
  const decoded = decodeRawToken(rawToken);
  if (!decoded) return;
  await RefreshSessionModel.updateOne(
    { _id: decoded.sessionId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokedReason: 'logout' } }
  );
}

export async function revokeAllSessionsForUser(userId: string, reason: string): Promise<void> {
  await RefreshSessionModel.updateMany(
    { userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokedReason: reason } }
  );
}

export async function listActiveSessions(userId: string): Promise<RefreshSessionDocument[]> {
  return RefreshSessionModel.find({ userId, revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } }).sort({
    createdAt: -1
  });
}
