import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const REVIEW_MODERATION_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ReviewModerationStatus = (typeof REVIEW_MODERATION_STATUSES)[number];

/**
 * `orderItemVariantId` ties a review to the specific purchased line (order +
 * variant), which is both the verified-purchase proof and the duplicate-review
 * guard: a customer may review a given variant once per order it was
 * delivered in (unique index below), not once per product for life — a
 * customer who separately bought two different variants of the same product
 * may leave two reviews. `Product.ratingAggregate` is recomputed by
 * repositories/review.repository.ts from `approved` reviews only; it is never
 * trusted from client input and this schema never stores an aggregate itself.
 */
const reviewSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    orderItemVariantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 140 },
    body: { type: String, trim: true, maxlength: 5000 },
    moderationStatus: { type: String, enum: REVIEW_MODERATION_STATUSES, required: true, default: 'pending' },
    moderationNote: { type: String, trim: true, maxlength: 500 },
    isDemoData: { type: Boolean, default: false }
  },
  { timestamps: true }
);

reviewSchema.index({ orderId: 1, orderItemVariantId: 1 }, { unique: true });
reviewSchema.index({ productId: 1, moderationStatus: 1, createdAt: -1 });
reviewSchema.index({ customerId: 1, createdAt: -1 });

export type ReviewDocument = HydratedDocument<InferSchemaType<typeof reviewSchema>>;
export const ReviewModel = model('Review', reviewSchema, 'reviews');
