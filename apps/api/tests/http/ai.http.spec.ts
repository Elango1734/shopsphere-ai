import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import request from 'supertest';
import { Types } from 'mongoose';
import { startMemoryReplicaSet, stopMemoryReplicaSet, clearAllCollections } from '../setup/memoryReplSet.js';
import { createApp } from '../../src/app.js';
import { registerCustomer, makeAdmin, makeActiveSeller, createPublishedProductWithStock, addAddress } from '../setup/fixtures.js';
import { ProductModel } from '../../src/models/product.model.js';
import { ReviewModel } from '../../src/models/review.model.js';

const app = createApp();

beforeAll(async () => {
  await startMemoryReplicaSet();
}, 120_000);
afterAll(async () => {
  await stopMemoryReplicaSet();
});
afterEach(async () => {
  await clearAllCollections();
});

describe('AI discovery, compare, and support — grounded in real data only', () => {
  it('discovery never returns a product that does not exist in the catalog', async () => {
    const admin = await makeAdmin(app, 'ai-disc-admin@example.com');
    const seller = await makeActiveSeller(app, 'ai-disc-seller@example.com', 'AI Disc Store');
    await createPublishedProductWithStock(app, {
      sellerAccessToken: seller.accessToken,
      adminAccessToken: admin.accessToken,
      name: 'Wireless Headphones',
      priceMinor: 5000,
      onHand: 10
    });

    const buyer = await registerCustomer(app, 'ai-disc-buyer@example.com');
    const res = await request(app)
      .post('/api/v1/ai/discovery')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ message: 'looking for wireless headphones' });

    expect(res.status).toBe(200);
    expect(res.body.data.conversationId).toBeDefined();
    expect(res.body.data.products.length).toBeGreaterThanOrEqual(1);
    const realProductIds = await ProductModel.find({}).distinct('_id');
    for (const product of res.body.data.products) {
      expect(realProductIds.map((id) => id.toString())).toContain(product.id);
    }
  });

  it('compare rejects fewer than two valid products without calling out to any provider', async () => {
    const buyer = await registerCustomer(app, 'ai-compare-buyer@example.com');
    const res = await request(app)
      .post('/api/v1/ai/compare')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ productIds: ['000000000000000000000001', '000000000000000000000002'] });

    expect(res.status).toBe(200);
    expect(res.body.data.reply).toMatch(/at least two valid products/i);
    expect(res.body.data.products).toHaveLength(0);
  });

  it('support with an orderId requires the caller to own that order', async () => {
    const admin = await makeAdmin(app, 'ai-support-admin@example.com');
    const seller = await makeActiveSeller(app, 'ai-support-seller@example.com', 'AI Support Store');
    const { variantId } = await createPublishedProductWithStock(app, {
      sellerAccessToken: seller.accessToken,
      adminAccessToken: admin.accessToken,
      name: 'Support Product',
      priceMinor: 2000,
      onHand: 5
    });
    const buyer = await registerCustomer(app, 'ai-support-buyer@example.com');
    await request(app).post('/api/v1/cart/items').set('Authorization', `Bearer ${buyer.accessToken}`).send({ variantId, quantity: 1 });
    const addressId = await addAddress(app, buyer.accessToken);
    const checkoutRes = await request(app)
      .post('/api/v1/checkout')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .set('Idempotency-Key', 'ai-support-checkout-key')
      .send({ shippingAddressId: addressId, simulate: 'success' });
    const orderId = checkoutRes.body.data.orderId as string;

    const ownSupportRes = await request(app)
      .post('/api/v1/ai/support')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ message: 'where is my order', orderId });
    expect(ownSupportRes.status).toBe(200);
    expect(ownSupportRes.body.data.reply).toMatch(/order is currently/i);

    const otherBuyer = await registerCustomer(app, 'ai-support-other-buyer@example.com');
    const otherSupportRes = await request(app)
      .post('/api/v1/ai/support')
      .set('Authorization', `Bearer ${otherBuyer.accessToken}`)
      .send({ message: 'where is my order', orderId });
    expect(otherSupportRes.status).toBe(403);
  });

  it('support without an orderId answers from the FAQ, grounded, not from an order lookup', async () => {
    const buyer = await registerCustomer(app, 'ai-faq-buyer@example.com');
    const res = await request(app)
      .post('/api/v1/ai/support')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ message: 'how do I return something' });
    expect(res.status).toBe(200);
    expect(res.body.data.reply).toMatch(/return/i);
  });

  it('lets the owner read and delete their own conversation history', async () => {
    const buyer = await registerCustomer(app, 'ai-history-buyer@example.com');
    const discoverRes = await request(app)
      .post('/api/v1/ai/discovery')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ message: 'anything under 50 dollars' });
    const conversationId = discoverRes.body.data.conversationId as string;

    const historyRes = await request(app)
      .get(`/api/v1/ai/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data.length).toBeGreaterThanOrEqual(2);

    const deleteRes = await request(app)
      .delete(`/api/v1/ai/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(deleteRes.status).toBe(200);

    const historyAfterDeleteRes = await request(app)
      .get(`/api/v1/ai/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(historyAfterDeleteRes.body.data).toHaveLength(0);
  });

  it("rejects reading another owner's conversation", async () => {
    const buyer = await registerCustomer(app, 'ai-privacy-buyer@example.com');
    const discoverRes = await request(app)
      .post('/api/v1/ai/discovery')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ message: 'something nice' });
    const conversationId = discoverRes.body.data.conversationId as string;

    const otherBuyer = await registerCustomer(app, 'ai-privacy-other@example.com');
    const res = await request(app)
      .get(`/api/v1/ai/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${otherBuyer.accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe('AI related products and review summaries', () => {
  it('returns related products from the same category, never the product itself', async () => {
    const admin = await makeAdmin(app, 'ai-related-admin@example.com');
    const seller = await makeActiveSeller(app, 'ai-related-seller@example.com', 'AI Related Store');
    const { productId } = await createPublishedProductWithStock(app, {
      sellerAccessToken: seller.accessToken,
      adminAccessToken: admin.accessToken,
      name: 'Main Product',
      priceMinor: 3000,
      onHand: 5
    });
    await createPublishedProductWithStock(app, {
      sellerAccessToken: seller.accessToken,
      adminAccessToken: admin.accessToken,
      name: 'Sibling Product',
      priceMinor: 3500,
      onHand: 5
    });
    const product = await ProductModel.findById(productId);

    const res = await request(app).get(`/api/v1/ai/products/${product!.slug}/related`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.every((p: { id: string }) => p.id !== productId)).toBe(true);
  });

  it('404s related products for an unknown slug', async () => {
    const res = await request(app).get('/api/v1/ai/products/does-not-exist/related');
    expect(res.status).toBe(404);
  });

  it('summarizes only real, approved reviews — never invents an opinion', async () => {
    const admin = await makeAdmin(app, 'ai-review-admin@example.com');
    const seller = await makeActiveSeller(app, 'ai-review-seller@example.com', 'AI Review Store');
    const { productId } = await createPublishedProductWithStock(app, {
      sellerAccessToken: seller.accessToken,
      adminAccessToken: admin.accessToken,
      name: 'Reviewed Product',
      priceMinor: 4000,
      onHand: 5
    });
    const buyer = await registerCustomer(app, 'ai-review-buyer@example.com');

    await ReviewModel.create({
      productId,
      customerId: buyer.userId,
      orderId: new Types.ObjectId(),
      orderItemVariantId: new Types.ObjectId(),
      rating: 5,
      title: 'Great',
      body: 'This product exceeded my expectations and works perfectly.',
      moderationStatus: 'approved'
    });
    const product = await ProductModel.findById(productId);
    await ProductModel.updateOne({ _id: productId }, { $set: { 'ratingAggregate.average': 5, 'ratingAggregate.count': 1 } });

    const res = await request(app).get(`/api/v1/ai/products/${product!.slug}/review-summary`);
    expect(res.status).toBe(200);
    expect(res.body.data.reviewCount).toBe(1);
    expect(res.body.data.summary).toMatch(/exceeded my expectations/i);
  });

  it('returns a "no reviews yet" summary rather than fabricating one when there are none', async () => {
    const admin = await makeAdmin(app, 'ai-noreview-admin@example.com');
    const seller = await makeActiveSeller(app, 'ai-noreview-seller@example.com', 'AI No Review Store');
    const { productId } = await createPublishedProductWithStock(app, {
      sellerAccessToken: seller.accessToken,
      adminAccessToken: admin.accessToken,
      name: 'Unreviewed Product',
      priceMinor: 1500,
      onHand: 5
    });
    const product = await ProductModel.findById(productId);

    const res = await request(app).get(`/api/v1/ai/products/${product!.slug}/review-summary`);
    expect(res.status).toBe(200);
    expect(res.body.data.reviewCount).toBe(0);
    expect(res.body.data.summary).toMatch(/no reviews yet/i);
  });
});
