import argon2 from 'argon2';
import { ClientSession } from 'mongoose';
import { UserModel, type UserDocument } from '../models/user.model.js';
import type { UserRole } from '@shopsphere/shared-types';
import { withSession } from '../utils/session.js';

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1
};

export async function hashPassword(plainPassword: string): Promise<string> {
  return argon2.hash(plainPassword, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, plainPassword: string): Promise<boolean> {
  return argon2.verify(passwordHash, plainPassword);
}

export interface RegisterCustomerInput {
  email?: string;
  phone?: string;
  plainPassword: string;
  displayName?: string;
}

/**
 * The ONLY path for public self-registration. It never reads a role from the
 * caller — roles is hardcoded to ['customer'] regardless of what a request
 * body might contain, satisfying "public registration must never create an
 * administrator" (security.md, database-design.md). Privilege elevation is a
 * distinct, admin-only operation: `grantRole` below.
 */
export async function registerCustomerAccount(input: RegisterCustomerInput): Promise<UserDocument> {
  const passwordHash = await hashPassword(input.plainPassword);
  return UserModel.create({
    email: input.email,
    phone: input.phone,
    passwordHash,
    roles: ['customer'],
    status: 'pending_verification',
    customerProfile: input.displayName ? { displayName: input.displayName } : {}
  });
}

/**
 * Privilege elevation is intentionally a separate function from registration
 * so no self-service registration code path can reach it. Callers (service
 * layer, Prompt 3) must themselves restrict this to administrator-authorized
 * flows — this function only guarantees the elevation is explicit and
 * audited by the caller, not that it checks the caller's own permission.
 */
export async function grantRole(
  userId: string,
  role: UserRole,
  options: { session?: ClientSession } = {}
): Promise<UserDocument | null> {
  return UserModel.findByIdAndUpdate(userId, { $addToSet: { roles: role } }, { new: true, ...withSession(options.session) });
}

export async function revokeRole(userId: string, role: UserRole): Promise<UserDocument | null> {
  return UserModel.findByIdAndUpdate(userId, { $pull: { roles: role } }, { new: true });
}

export async function findByEmail(email: string): Promise<UserDocument | null> {
  return UserModel.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
}

export async function findByPhone(phone: string): Promise<UserDocument | null> {
  return UserModel.findOne({ phone: phone.trim() }).select('+passwordHash');
}

export async function findById(userId: string): Promise<UserDocument | null> {
  return UserModel.findOne({ _id: userId, deletedAt: { $exists: false } });
}

export interface UpdateCustomerProfileInput {
  displayName?: string;
  preferredCurrency?: string;
  marketingOptIn?: boolean;
}

export async function updateCustomerProfile(userId: string, patch: UpdateCustomerProfileInput): Promise<UserDocument | null> {
  const $set: Record<string, unknown> = {};
  if (patch.displayName !== undefined) $set['customerProfile.displayName'] = patch.displayName;
  if (patch.preferredCurrency !== undefined) $set['customerProfile.preferredCurrency'] = patch.preferredCurrency;
  if (patch.marketingOptIn !== undefined) $set['customerProfile.marketingOptIn'] = patch.marketingOptIn;
  if (Object.keys($set).length === 0) return findById(userId);
  return UserModel.findByIdAndUpdate(userId, { $set }, { new: true });
}

export async function recordFailedLogin(userId: string, lockUntil?: Date): Promise<void> {
  await UserModel.updateOne(
    { _id: userId },
    {
      $inc: { 'security.failedLoginAttempts': 1 },
      ...(lockUntil ? { $set: { 'security.lockedUntil': lockUntil } } : {})
    }
  );
}

export async function recordSuccessfulLogin(userId: string): Promise<void> {
  await UserModel.updateOne(
    { _id: userId },
    { $set: { 'security.failedLoginAttempts': 0, 'security.lastLoginAt': new Date() }, $unset: { 'security.lockedUntil': 1 } }
  );
}

/**
 * Minimizes/pseudonymizes personal data while preserving the account record
 * that financial/order history still references (database-design.md's data
 * lifecycle requirement). Orders already snapshot their own address/customer
 * name data, so this does not corrupt historical order rendering.
 */
export async function anonymizeUser(userId: string): Promise<void> {
  await UserModel.updateOne(
    { _id: userId },
    {
      $set: {
        deletedAt: new Date(),
        status: 'deleted',
        'customerProfile.displayName': 'Deleted User'
      },
      $unset: { email: 1, phone: 1 }
    }
  );
}
