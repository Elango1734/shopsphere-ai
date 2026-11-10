import { Types } from 'mongoose';
import { AiConversationModel, type AiConversationDocument } from '../../models/aiConversation.model.js';
import { AiMessageModel } from '../../models/aiMessage.model.js';
import { listPublishedProducts, findPublishedProductsByIds, findPublishedProductBySlug } from '../../repositories/product.repository.js';
import { listApprovedReviewsForProduct } from '../../repositories/review.repository.js';
import { getOwnedOrder } from '../orders/order.service.js';
import { toProductSummaryDto } from '../catalog/catalog.dto.js';
import { NotFoundError, ForbiddenError } from '../../http/errors.js';
import { extractIntent, matchFaq } from './developmentProvider.js';
import { composeReplyWithFallback } from './llmProvider.js';
import type { ProductDocument } from '../../models/product.model.js';

export interface OwnerKey {
  userId?: string;
  guestTokenHash?: string;
}

async function getOrCreateConversation(owner: OwnerKey, purpose: 'discovery' | 'compare' | 'support', conversationId?: string) {
  if (conversationId) {
    const existing = await AiConversationModel.findById(conversationId);
    if (!existing) throw new NotFoundError('Conversation not found');
    const ownsIt = owner.userId ? existing.userId?.toString() === owner.userId : existing.guestTokenHash === owner.guestTokenHash;
    if (!ownsIt) throw new ForbiddenError();
    return existing;
  }
  return AiConversationModel.create({
    ...(owner.userId ? { userId: owner.userId } : { guestTokenHash: owner.guestTokenHash }),
    purpose
  });
}

async function storeMessage(
  conversation: AiConversationDocument,
  role: 'user' | 'assistant',
  content: string,
  groundedProductIds: Types.ObjectId[] = []
) {
  await AiMessageModel.create({ conversationId: conversation._id, role, content, groundedProductIds, expireAt: conversation.retainUntil });
  conversation.lastMessageAt = new Date();
  await conversation.save();
}

function productLine(p: ProductDocument): string {
  const price = p.minPriceMinor != null ? `${(p.minPriceMinor / 100).toFixed(2)} ${p.currency}` : 'price unavailable';
  return `${p.name}: ${price}, rating ${p.ratingAggregate.average.toFixed(1)} (${p.ratingAggregate.count} reviews)`;
}

export async function discover(owner: OwnerKey, message: string, conversationId?: string) {
  const conversation = await getOrCreateConversation(owner, 'discovery', conversationId);
  await storeMessage(conversation, 'user', message);

  const intent = extractIntent(message);
  const searchText = intent.keywords.join(' ');
  const { products } = await listPublishedProducts(
    {
      ...(intent.maxPriceMinor != null ? { maxPriceMinor: intent.maxPriceMinor } : {}),
      ...(searchText ? { searchText } : {})
    },
    1,
    5
  );

  const fallbackReply =
    products.length > 0
      ? `I found ${products.length} product${products.length === 1 ? '' : 's'} that might match: ${products.map((p) => p.name).join(', ')}.`
      : "I couldn't find a catalog match for that — try a different search or browse categories.";

  const reply = await composeReplyWithFallback({
    purpose: 'discovery',
    userMessage: message,
    context: { matchedProducts: products.map((p) => productLine(p)), fallbackReply }
  });

  await storeMessage(
    conversation,
    'assistant',
    reply,
    products.map((p) => p._id)
  );

  return { conversationId: conversation._id.toString(), reply, products: products.map(toProductSummaryDto) };
}

export async function compare(owner: OwnerKey, productIds: string[], conversationId?: string) {
  const conversation = await getOrCreateConversation(owner, 'compare', conversationId);
  await storeMessage(conversation, 'user', `Compare: ${productIds.join(', ')}`);

  const products = await findPublishedProductsByIds(productIds);
  const lines = products.map((p) => productLine(p));
  const fallbackReply = products.length >= 2 ? `Here's a comparison: ${lines.join(' | ')}` : 'I need at least two valid products to compare.';

  const reply =
    products.length >= 2
      ? await composeReplyWithFallback({ purpose: 'compare', userMessage: `Compare: ${products.map((p) => p.name).join(', ')}`, context: { products: lines, fallbackReply } })
      : fallbackReply;

  await storeMessage(
    conversation,
    'assistant',
    reply,
    products.map((p) => p._id)
  );

  return { conversationId: conversation._id.toString(), reply, products: products.map(toProductSummaryDto) };
}

export async function support(owner: OwnerKey, message: string, orderId?: string, conversationId?: string) {
  const conversation = await getOrCreateConversation(owner, 'support', conversationId);
  await storeMessage(conversation, 'user', message);

  let fallbackReply: string;
  let llmContext: Record<string, unknown>;
  if (orderId) {
    if (!owner.userId) throw new ForbiddenError('Sign in to get help with a specific order');
    const order = await getOwnedOrder(owner.userId, orderId);
    fallbackReply = `Your order is currently ${order.fulfillmentStatus.replace('_', ' ')} (payment: ${order.paymentStatus}).`;
    llmContext = { orderFulfillmentStatus: order.fulfillmentStatus, orderPaymentStatus: order.paymentStatus, fallbackReply };
  } else {
    const faqAnswer = matchFaq(message);
    fallbackReply = faqAnswer ?? "I'm not certain about that — please open a support ticket and an agent will help.";
    llmContext = { faqAnswer: faqAnswer ?? null, fallbackReply };
  }

  const reply = await composeReplyWithFallback({ purpose: 'support', userMessage: message, context: llmContext });

  await storeMessage(conversation, 'assistant', reply);
  return { conversationId: conversation._id.toString(), reply };
}

export async function getConversationHistory(owner: OwnerKey, conversationId: string) {
  const conversation = await getOrCreateConversation(owner, 'discovery', conversationId);
  const messages = await AiMessageModel.find({ conversationId: conversation._id }).sort({ createdAt: 1 });
  return messages;
}

/** User-controlled deletion (product-requirements.md): immediate, not just a lazily-enforced TTL. */
export async function deleteConversation(owner: OwnerKey, conversationId: string): Promise<void> {
  const conversation = await getOrCreateConversation(owner, 'discovery', conversationId);
  await AiMessageModel.deleteMany({ conversationId: conversation._id });
  conversation.deletedAt = new Date();
  conversation.retainUntil = new Date();
  await conversation.save();
}

/**
 * Same-category, in-stock, published products excluding the one the
 * customer is looking at — no conversation/message storage, since this is a
 * stateless product-detail-page feature, not a chat turn.
 */
export async function getRelatedProducts(slug: string) {
  const product = await findPublishedProductBySlug(slug);
  if (!product) throw new NotFoundError('Product not found');

  const { products } = await listPublishedProducts(
    { categoryId: product.categoryId.toString(), inStockOnly: true },
    1,
    7,
    { 'ratingAggregate.average': -1 }
  );
  const related = products.filter((p) => p._id.toString() !== product._id.toString()).slice(0, 6);
  return related.map(toProductSummaryDto);
}

/**
 * An extractive, deterministic summary (rating distribution + up to 3 real
 * review excerpts, verbatim) is computed first and is ALWAYS what gets
 * returned when no real LLM is configured, or if one errors — "summaries"
 * never means inventing opinions no reviewer actually expressed. When a real
 * provider is configured, it is only asked to smooth the same excerpts into
 * prose, never to add claims beyond them.
 */
export async function summarizeReviews(slug: string) {
  const product = await findPublishedProductBySlug(slug);
  if (!product) throw new NotFoundError('Product not found');

  const { reviews, totalItems } = await listApprovedReviewsForProduct(product._id.toString(), 1, 50);

  if (totalItems === 0) {
    return {
      productId: product._id.toString(),
      reviewCount: 0,
      ratingAverage: 0,
      ratingDistribution: [0, 0, 0, 0, 0],
      summary: 'No reviews yet for this product.'
    };
  }

  const excerpts = reviews
    .filter((r) => r.body && r.body.trim().length > 0)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3)
    .map((r) => `"${r.body!.trim().slice(0, 200)}" (${r.rating}/5)`);

  const fallbackSummary =
    excerpts.length > 0
      ? `Based on ${totalItems} review${totalItems === 1 ? '' : 's'} averaging ${product.ratingAggregate.average.toFixed(1)}/5: ${excerpts.join(' ')}`
      : `${totalItems} review${totalItems === 1 ? '' : 's'} averaging ${product.ratingAggregate.average.toFixed(1)}/5.`;

  const summary = await composeReplyWithFallback({
    purpose: 'review-summary',
    userMessage: `Summarize the customer reviews for ${product.name}`,
    context: { reviewExcerpts: excerpts, ratingAverage: product.ratingAggregate.average, reviewCount: totalItems, fallbackReply: fallbackSummary }
  });

  return {
    productId: product._id.toString(),
    reviewCount: totalItems,
    ratingAverage: product.ratingAggregate.average,
    ratingDistribution: product.ratingAggregate.distribution,
    summary
  };
}
