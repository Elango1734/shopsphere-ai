import type { CouponDocument } from '../../models/coupon.model.js';
import type { AuditLogDocument } from '../../models/auditLog.model.js';
import type { AiConversationDocument } from '../../models/aiConversation.model.js';
import type { AiMessageDocument } from '../../models/aiMessage.model.js';
import type { ProductDocument } from '../../models/product.model.js';
import type { PaymentAttemptDocument } from '../../models/paymentAttempt.model.js';
import { toPublicId } from '../../utils/ids.js';

/** No raw card/instrument data ever lived on this document (payment.service.ts), so nothing here needs redaction beyond the provider's own opaque reference. */
export function toPaymentAttemptDto(attempt: PaymentAttemptDocument) {
  return {
    id: toPublicId(attempt._id),
    orderId: toPublicId(attempt.orderId),
    provider: attempt.provider,
    providerPaymentRef: attempt.providerPaymentRef,
    amount: attempt.amount,
    status: attempt.status,
    paymentMethodDisplay: attempt.paymentMethodDisplay,
    failureReason: attempt.failureReason,
    confirmedAt: attempt.confirmedAt?.toISOString() ?? null,
    createdAt: attempt.createdAt.toISOString()
  };
}

/** Includes `moderationStatus`/`moderationNote`/`sellerId` — fields the public-facing `toProductSummaryDto` omits because customers never see them — so the admin moderation queue can show what it needs. */
export function toAdminProductDto(product: ProductDocument) {
  return {
    id: toPublicId(product._id),
    name: product.name,
    slug: product.slug,
    sellerId: toPublicId(product.sellerId),
    categoryId: toPublicId(product.categoryId),
    brandId: product.brandId ? toPublicId(product.brandId) : null,
    moderationStatus: product.moderationStatus,
    moderationNote: product.moderationNote,
    hasAvailableStock: product.hasAvailableStock,
    createdAt: product.createdAt.toISOString()
  };
}

export function toCouponDto(coupon: CouponDocument) {
  return {
    id: toPublicId(coupon._id),
    code: coupon.code,
    description: coupon.description,
    discountType: coupon.discountType,
    percentageBasisPoints: coupon.percentageBasisPoints,
    discountValue: coupon.discountValue,
    maxDiscount: coupon.maxDiscount,
    minOrderAmount: coupon.minOrderAmount,
    currency: coupon.currency,
    startsAt: coupon.startsAt.toISOString(),
    expiresAt: coupon.expiresAt.toISOString(),
    isActive: coupon.isActive,
    usageLimit: coupon.usageLimit,
    usedCount: coupon.usedCount,
    perUserLimit: coupon.perUserLimit
  };
}

/** Metadata only — no `content` field — so the admin conversations LIST never carries raw user/assistant text. */
export function toAiConversationSummaryDto(conversation: AiConversationDocument, messageCount: number) {
  return {
    id: toPublicId(conversation._id),
    ownerType: conversation.userId ? ('user' as const) : ('guest' as const),
    ownerUserId: conversation.userId ? toPublicId(conversation.userId) : null,
    purpose: conversation.purpose,
    messageCount,
    lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
    retainUntil: conversation.retainUntil.toISOString(),
    deletedAt: conversation.deletedAt?.toISOString() ?? null,
    createdAt: conversation.createdAt.toISOString()
  };
}

/** Full detail INCLUDING message content — only reachable via the single-conversation drill-in route, which is audit-logged. */
export function toAiMessageDto(message: AiMessageDocument) {
  return {
    id: toPublicId(message._id),
    role: message.role,
    content: message.content,
    groundedProductIds: message.groundedProductIds.map((id) => toPublicId(id)),
    createdAt: message.createdAt.toISOString()
  };
}

export function toAuditLogDto(log: AuditLogDocument) {
  return {
    id: toPublicId(log._id),
    actorUserId: log.actorUserId ? toPublicId(log.actorUserId) : null,
    actorRole: log.actorRole,
    action: log.action,
    resourceType: log.resourceType,
    resourceId: toPublicId(log.resourceId),
    requestId: log.requestId,
    beforeSummary: log.beforeSummary,
    afterSummary: log.afterSummary,
    createdAt: log.createdAt.toISOString()
  };
}
