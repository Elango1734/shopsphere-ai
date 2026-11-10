import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import type { UserRole } from '@shopsphere/shared-types';

export const ACCOUNT_STATUSES = ['pending_verification', 'active', 'suspended', 'deleted'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const USER_ROLES: readonly UserRole[] = ['customer', 'seller', 'support_agent', 'administrator'] as const;

/**
 * CustomerProfile is embedded, not a separate collection: it is small, bounded,
 * owned exclusively by the user, and always read/written together with the
 * account (preferences screen, checkout defaults). A SellerProfile is the
 * opposite shape — independently moderated, queried by admins without loading
 * the user, and lifecycle-managed on its own — so it is the separate `sellers`
 * collection (seller.model.ts) referencing this user by ownerUserId instead.
 */
const customerProfileSchema = new Schema(
  {
    displayName: { type: String, trim: true, maxlength: 140 },
    defaultAddressId: { type: Schema.Types.ObjectId, ref: 'Address' },
    marketingOptIn: { type: Boolean, default: false },
    locale: { type: String, trim: true, default: 'en-US' },
    preferredCurrency: { type: String, trim: true, uppercase: true, match: /^[A-Z]{3}$/, default: 'USD' }
  },
  { _id: false }
);

const securitySchema = new Schema(
  {
    failedLoginAttempts: { type: Number, default: 0, min: 0 },
    lockedUntil: { type: Date },
    lastLoginAt: { type: Date }
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format']
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20,
      match: [/^\+?[1-9]\d{6,14}$/, 'Invalid phone format (E.164 expected)']
    },
    passwordHash: { type: String, required: true, select: false },
    roles: {
      type: [{ type: String, enum: USER_ROLES }],
      required: true,
      default: ['customer'],
      validate: {
        validator: (roles: string[]) => roles.length > 0 && new Set(roles).size === roles.length,
        message: 'roles must be a non-empty set of unique values'
      }
    },
    status: { type: String, enum: ACCOUNT_STATUSES, required: true, default: 'pending_verification' },
    emailVerifiedAt: { type: Date },
    phoneVerifiedAt: { type: Date },
    customerProfile: { type: customerProfileSchema, default: () => ({}) },
    security: { type: securitySchema, default: () => ({}) },
    deletedAt: { type: Date }
  },
  { timestamps: true }
);

// At least one verified-capable identifier is required; enforced here in addition to the service layer.
userSchema.pre('validate', function (next) {
  if (!this.email && !this.phone) {
    this.invalidate('email', 'Either email or phone is required');
  }
  next();
});

// Case-insensitive uniqueness on normalized email/phone. Sparse because either may be absent.
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ phone: 1 }, { unique: true, sparse: true });
userSchema.index({ roles: 1 });
userSchema.index({ status: 1, createdAt: -1 });

export type UserDocument = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const UserModel = model('User', userSchema, 'users');
