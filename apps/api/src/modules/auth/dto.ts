import type { UserDocument } from '../../models/user.model.js';
import { toPublicId } from '../../utils/ids.js';

/**
 * The only way a User document becomes client-visible. Never return a
 * Mongoose document directly — api-specification.md and database-design.md
 * both forbid it, and this is where `passwordHash`/`security` are dropped.
 */
export function toUserDto(user: UserDocument) {
  return {
    id: toPublicId(user._id),
    email: user.email,
    phone: user.phone,
    roles: user.roles,
    status: user.status,
    emailVerified: Boolean(user.emailVerifiedAt),
    phoneVerified: Boolean(user.phoneVerifiedAt),
    displayName: user.customerProfile?.displayName,
    preferredCurrency: user.customerProfile?.preferredCurrency,
    createdAt: user.createdAt.toISOString()
  };
}

export type UserDto = ReturnType<typeof toUserDto>;
