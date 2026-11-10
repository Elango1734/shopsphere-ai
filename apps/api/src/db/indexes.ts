import * as models from '../models/index.js';
import type { Model } from 'mongoose';

const ALL_MODELS: Model<unknown>[] = [
  models.UserModel,
  models.RefreshSessionModel,
  models.AddressModel,
  models.SellerModel,
  models.CategoryModel,
  models.BrandModel,
  models.ProductModel,
  models.ProductVariantModel,
  models.InventoryModel,
  models.InventoryReservationModel,
  models.CartModel,
  models.WishlistModel,
  models.RecentlyViewedModel,
  models.CouponModel,
  models.PromotionModel,
  models.PromotionRedemptionModel,
  models.OrderModel,
  models.PaymentAttemptModel,
  models.WebhookEventModel,
  models.ShipmentModel,
  models.ReturnRequestModel,
  models.RefundModel,
  models.ReviewModel,
  models.ProductQuestionModel,
  models.NotificationModel,
  models.SupportTicketModel,
  models.SupportMessageModel,
  models.AuditLogModel,
  models.AiConversationModel,
  models.AiMessageModel,
  models.IdempotencyRecordModel,
  models.OutboxEventModel
] as unknown as Model<unknown>[];

/** Creates/updates every declared index for every model. Safe to re-run (idempotent). */
export async function syncAllIndexes(): Promise<void> {
  for (const model of ALL_MODELS) {
    await model.syncIndexes();
  }
}

export interface IndexVerificationResult {
  collection: string;
  declaredIndexCount: number;
  actualIndexCount: number;
  missing: string[];
}

/**
 * Compares each model's declared indexes against what actually exists in
 * MongoDB, so `npm run db:indexes:verify` can catch "index declared in code
 * but never created/dropped" drift in CI.
 */
export async function verifyAllIndexes(): Promise<IndexVerificationResult[]> {
  const results: IndexVerificationResult[] = [];
  for (const model of ALL_MODELS) {
    const declaredFieldSpecs = model.schema.indexes().map(([fields]) => fields as Record<string, unknown>);
    const actual = await model.collection.indexes();
    // MongoDB stores a text index's actual key as { _fts: 'text', _ftsx: 1 }, not the declared field names,
    // so a declared text index is matched by presence of any actual text index rather than a literal key match.
    const hasActualTextIndex = actual.some((index) => index.key?._fts === 'text');
    const actualKeys = new Set(actual.map((index) => JSON.stringify(index.key)));

    const missing = declaredFieldSpecs
      .filter((fields) => {
        const isTextIndex = Object.values(fields).includes('text');
        return isTextIndex ? !hasActualTextIndex : !actualKeys.has(JSON.stringify(fields));
      })
      .map((fields) => JSON.stringify(fields));

    results.push({
      collection: model.collection.collectionName,
      declaredIndexCount: declaredFieldSpecs.length,
      actualIndexCount: actual.length,
      missing
    });
  }
  return results;
}
