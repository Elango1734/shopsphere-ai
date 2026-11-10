import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import type { SellerStatus } from '@shopsphere/shared-types';

export const SELLER_STATUSES: readonly SellerStatus[] = [
  'pending_review',
  'active',
  'suspended',
  'rejected',
  'closed'
] as const;

const verificationSchema = new Schema(
  {
    legalBusinessName: { type: String, trim: true, maxlength: 200 },
    taxId: { type: String, trim: true, maxlength: 64, select: false },
    documentStorageKeys: { type: [String], default: [] },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true, maxlength: 1000 }
  },
  { _id: false }
);

/**
 * Separate collection from User: sellers have an independent approval
 * lifecycle, are queried by admins/catalog without touching user accounts,
 * and carry sensitive verification data that must be projectable away from
 * ordinary seller-profile reads (`taxId` is `select: false`).
 */
const sellerSchema = new Schema(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    storeName: { type: String, required: true, trim: true, maxlength: 140 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    status: { type: String, enum: SELLER_STATUSES, required: true, default: 'pending_review' },
    description: { type: String, trim: true, maxlength: 2000 },
    supportEmail: { type: String, trim: true, lowercase: true, maxlength: 254 },
    commissionRateBasisPoints: { type: Number, min: 0, max: 10_000, default: 1000 },
    verification: { type: verificationSchema, default: () => ({}) },
    statusHistory: {
      type: [
        new Schema(
          {
            status: { type: String, enum: SELLER_STATUSES, required: true },
            changedAt: { type: Date, required: true, default: () => new Date() },
            changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
            note: { type: String, trim: true, maxlength: 500 }
          },
          { _id: false }
        )
      ],
      default: []
    }
  },
  { timestamps: true }
);

sellerSchema.index({ ownerUserId: 1 }, { unique: true });
sellerSchema.index({ slug: 1 }, { unique: true });
sellerSchema.index({ status: 1, createdAt: -1 });

export type SellerDocument = HydratedDocument<InferSchemaType<typeof sellerSchema>>;
export const SellerModel = model('Seller', sellerSchema, 'sellers');
