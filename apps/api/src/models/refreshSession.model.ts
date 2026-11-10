import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * One document per issued refresh token (per device/session). Separate from
 * User because sessions are unbounded over a user's lifetime, revoked/queried
 * independently ("log out this device"), and never read together with the
 * profile. Only the hash is stored — never the raw refresh token.
 */
const refreshSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, select: false },
    // Rotation chain: when a token is rotated, the new session links back so reuse of a stale token can be detected.
    replacedBySessionId: { type: Schema.Types.ObjectId, ref: 'RefreshSession' },
    deviceLabel: { type: String, trim: true, maxlength: 140 },
    userAgent: { type: String, trim: true, maxlength: 300 },
    ipAddress: { type: String, trim: true, maxlength: 64 },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    revokedReason: { type: String, trim: true, maxlength: 140 }
  },
  { timestamps: true }
);

refreshSessionSchema.index({ userId: 1, revokedAt: 1 });
refreshSessionSchema.index({ tokenHash: 1 }, { unique: true });
// Disposable once expired and already revoked/consumed; TTL cleanup here does not drive business state.
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshSessionDocument = HydratedDocument<InferSchemaType<typeof refreshSessionSchema>>;
export const RefreshSessionModel = model('RefreshSession', refreshSessionSchema, 'refresh_sessions');
