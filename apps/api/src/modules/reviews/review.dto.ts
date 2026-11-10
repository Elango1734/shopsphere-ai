import type { ReviewDocument } from '../../models/review.model.js';
import { toPublicId } from '../../utils/ids.js';

export function toReviewDto(review: ReviewDocument) {
  return {
    id: toPublicId(review._id),
    productId: toPublicId(review.productId),
    customerId: toPublicId(review.customerId),
    rating: review.rating,
    title: review.title,
    body: review.body,
    moderationStatus: review.moderationStatus,
    isVerifiedPurchase: true,
    isDemoData: review.isDemoData,
    createdAt: review.createdAt.toISOString()
  };
}
