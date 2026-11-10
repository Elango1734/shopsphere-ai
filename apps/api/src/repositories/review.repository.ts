import { Types } from 'mongoose';
import { ReviewModel, type ReviewDocument } from '../models/review.model.js';
import { OrderModel } from '../models/order.model.js';
import { ProductModel } from '../models/product.model.js';

export class ReviewEligibilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReviewEligibilityError';
  }
}

/**
 * Verified-purchase eligibility: the customer must own the order, the order
 * must contain the given variant, and fulfillment must have reached
 * `delivered` (a return/pending shipment is not yet a completed purchase).
 * The unique (orderId, orderItemVariantId) index on Review is the hard
 * backstop against the duplicate-review race this check alone cannot close.
 */
export async function assertEligibleForReview(
  customerId: string,
  orderId: string,
  variantId: string
): Promise<void> {
  const order = await OrderModel.findOne({ _id: orderId, customerId });
  if (!order) {
    throw new ReviewEligibilityError('Order not found for this customer');
  }
  if (order.fulfillmentStatus !== 'delivered') {
    throw new ReviewEligibilityError('Order must be delivered before leaving a review');
  }
  const hasVariant = order.items.some((item) => item.variantId.equals(variantId));
  if (!hasVariant) {
    throw new ReviewEligibilityError('Variant was not part of this order');
  }
}

export async function createVerifiedReview(input: {
  productId: string;
  customerId: string;
  orderId: string;
  orderItemVariantId: string;
  rating: number;
  title?: string;
  body?: string;
  isDemoData?: boolean;
}): Promise<ReviewDocument> {
  await assertEligibleForReview(input.customerId, input.orderId, input.orderItemVariantId);

  const review = await ReviewModel.create({ ...input, moderationStatus: 'pending' });
  return review;
}

/**
 * Incremental maintenance for the common case (one review entering/leaving
 * the `approved` set): O(1) update to Product.ratingAggregate rather than
 * rescanning all reviews. Used on single review approve/reject/create.
 */
export async function applyRatingDelta(productId: string, rating: number, sign: 1 | -1): Promise<void> {
  const bucket = rating - 1; // rating 1..5 -> distribution index 0..4

  const updated = await ProductModel.findOneAndUpdate(
    { _id: productId },
    { $inc: { 'ratingAggregate.count': sign, [`ratingAggregate.distribution.${bucket}`]: sign } },
    { new: true }
  );
  if (!updated) return;

  const distribution = updated.ratingAggregate.distribution;
  const count = updated.ratingAggregate.count;
  const weightedSum = distribution.reduce((sum, bucketCount, index) => sum + bucketCount * (index + 1), 0);
  const average = count > 0 ? weightedSum / count : 0;

  await ProductModel.updateOne({ _id: productId }, { $set: { 'ratingAggregate.average': average } });
}

/**
 * Full recompute via aggregation — preferable to the incremental path when
 * moderation bulk-changes reviews, data is seeded/migrated, or drift is
 * suspected, since it is self-correcting rather than compounding small
 * increment errors. More expensive (scans every approved review for the
 * product) so it is not the per-review hot path.
 */
export async function recomputeRatingAggregate(productId: string): Promise<void> {
  const [agg] = await ReviewModel.aggregate([
    { $match: { productId: new Types.ObjectId(productId), moderationStatus: 'approved' } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        average: { $avg: '$rating' },
        distribution: {
          $push: '$rating'
        }
      }
    }
  ]);

  if (!agg) {
    await ProductModel.updateOne(
      { _id: productId },
      { $set: { ratingAggregate: { average: 0, count: 0, distribution: [0, 0, 0, 0, 0] } } }
    );
    return;
  }

  const distribution = [0, 0, 0, 0, 0];
  for (const rating of agg.distribution as number[]) {
    distribution[rating - 1] = (distribution[rating - 1] ?? 0) + 1;
  }

  await ProductModel.updateOne(
    { _id: productId },
    { $set: { ratingAggregate: { average: agg.average, count: agg.count, distribution } } }
  );
}

export async function listApprovedReviewsForProduct(
  productId: string,
  page: number,
  pageSize: number
): Promise<{ reviews: ReviewDocument[]; totalItems: number }> {
  const filter = { productId, moderationStatus: 'approved' as const };
  const skip = (page - 1) * pageSize;
  const [reviews, totalItems] = await Promise.all([
    ReviewModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(pageSize),
    ReviewModel.countDocuments(filter)
  ]);
  return { reviews, totalItems };
}
