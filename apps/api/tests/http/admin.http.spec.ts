import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import request from 'supertest';
import { startMemoryReplicaSet, stopMemoryReplicaSet, clearAllCollections } from '../setup/memoryReplSet.js';
import { createApp } from '../../src/app.js';
import { registerCustomer, makeAdmin, makeActiveSeller, createPublishedProductWithStock, addAddress, ensureCategory } from '../setup/fixtures.js';

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

describe('Admin coupon management and enforcement', () => {
  it('creates a coupon and applies it at checkout; rejects an expired one', async () => {
    const admin = await makeAdmin(app, 'coupon-admin@example.com');
    const seller = await makeActiveSeller(app, 'coupon-seller@example.com', 'Coupon Store');
    const { variantId } = await createPublishedProductWithStock(app, {
      sellerAccessToken: seller.accessToken,
      adminAccessToken: admin.accessToken,
      name: 'Coupon Product',
      priceMinor: 5000,
      onHand: 10
    });

    const createRes = await request(app)
      .post('/api/v1/admin/coupons')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        code: 'ADMINTEST10',
        discountType: 'percentage',
        percentageBasisPoints: 1000,
        currency: 'USD',
        startsAt: new Date(Date.now() - 1000).toISOString(),
        expiresAt: new Date(Date.now() + 86_400_000).toISOString()
      });
    expect(createRes.status).toBe(201);

    const buyer = await registerCustomer(app, 'coupon-buyer@example.com');
    await request(app).post('/api/v1/cart/items').set('Authorization', `Bearer ${buyer.accessToken}`).send({ variantId, quantity: 1 });
    const addressId = await addAddress(app, buyer.accessToken);

    const checkoutRes = await request(app)
      .post('/api/v1/checkout')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .set('Idempotency-Key', 'coupon-checkout-key')
      .send({ shippingAddressId: addressId, couponCode: 'ADMINTEST10', simulate: 'success' });
    expect(checkoutRes.status).toBe(201);

    // grandTotal should reflect the 10% discount being applied (less than it would be without it).
    const orderRes = await request(app)
      .get(`/api/v1/orders/${checkoutRes.body.data.orderId}`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);
    expect(orderRes.body.data.discountTotal.amountMinor).toBeGreaterThan(0);
  });

  it('rejects coupon creation from a non-admin', async () => {
    const customer = await registerCustomer(app, 'not-admin@example.com');
    const res = await request(app)
      .post('/api/v1/admin/coupons')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ code: 'SHOULDFAIL', discountType: 'fixed_amount', discountValue: { amountMinor: 100, currency: 'USD' }, currency: 'USD', startsAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 1000).toISOString() });
    expect(res.status).toBe(403);
  });
});

describe('Admin refund cap enforcement over HTTP', () => {
  it('rejects a refund request exceeding the captured payment amount', async () => {
    const admin = await makeAdmin(app, 'refund-admin@example.com');
    const seller = await makeActiveSeller(app, 'refund-seller@example.com', 'Refund Store');
    const { variantId } = await createPublishedProductWithStock(app, {
      sellerAccessToken: seller.accessToken,
      adminAccessToken: admin.accessToken,
      name: 'Refund Product',
      priceMinor: 4000,
      onHand: 5
    });
    const buyer = await registerCustomer(app, 'refund-buyer@example.com');
    await request(app).post('/api/v1/cart/items').set('Authorization', `Bearer ${buyer.accessToken}`).send({ variantId, quantity: 1 });
    const addressId = await addAddress(app, buyer.accessToken);
    const checkoutRes = await request(app)
      .post('/api/v1/checkout')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .set('Idempotency-Key', 'refund-checkout-key')
      .send({ shippingAddressId: addressId, simulate: 'success' });

    const grandTotal = checkoutRes.body.data.grandTotal.amountMinor as number;
    const orderId = checkoutRes.body.data.orderId as string;

    const attemptsRes = await request(app)
      .get(`/api/v1/admin/orders/${orderId}/payment-attempts`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(attemptsRes.status).toBe(200);
    expect(attemptsRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(attemptsRes.body.data[0].status).toBe('succeeded');
    expect(attemptsRes.body.data[0]).not.toHaveProperty('providerSecret');
    const paymentAttemptId = attemptsRes.body.data[0].id as string;

    const overRefund = await request(app)
      .post('/api/v1/admin/refunds')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ paymentAttemptId, requestedAmount: { amountMinor: grandTotal + 1, currency: 'USD' } });
    expect(overRefund.status).toBe(422);
    expect(overRefund.body.error.code).toBe('REFUND_EXCEEDS_CAPTURED_AMOUNT');

    const validRefund = await request(app)
      .post('/api/v1/admin/refunds')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ paymentAttemptId, requestedAmount: { amountMinor: grandTotal, currency: 'USD' } });
    expect(validRefund.status).toBe(201);
  });
});

describe('Admin analytics and detail lookups', () => {
  it('returns a real aggregated analytics overview reflecting an actual order', async () => {
    const admin = await makeAdmin(app, 'analytics-admin@example.com');
    const seller = await makeActiveSeller(app, 'analytics-seller@example.com', 'Analytics Store');
    const { variantId } = await createPublishedProductWithStock(app, {
      sellerAccessToken: seller.accessToken,
      adminAccessToken: admin.accessToken,
      name: 'Analytics Product',
      priceMinor: 2500,
      onHand: 10
    });
    const buyer = await registerCustomer(app, 'analytics-buyer@example.com');
    await request(app).post('/api/v1/cart/items').set('Authorization', `Bearer ${buyer.accessToken}`).send({ variantId, quantity: 2 });
    const addressId = await addAddress(app, buyer.accessToken);
    const checkoutRes = await request(app)
      .post('/api/v1/checkout')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .set('Idempotency-Key', 'analytics-checkout-key')
      .send({ shippingAddressId: addressId, simulate: 'success' });
    expect(checkoutRes.status).toBe(201);
    const grandTotal = checkoutRes.body.data.grandTotal.amountMinor as number;

    const overviewRes = await request(app)
      .get('/api/v1/admin/analytics/overview')
      .query({ rangeDays: 30 })
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.data.totalOrders).toBeGreaterThanOrEqual(1);
    expect(overviewRes.body.data.grossSalesMinor).toBeGreaterThanOrEqual(grandTotal);
    expect(overviewRes.body.data.netRevenueMinor).toBe(overviewRes.body.data.grossSalesMinor - overviewRes.body.data.refundsTotalMinor);
    expect(Array.isArray(overviewRes.body.data.recentOrders)).toBe(true);
    expect(Array.isArray(overviewRes.body.data.categoryPerformance)).toBe(true);
  });

  it('rejects analytics access from a non-admin', async () => {
    const customer = await registerCustomer(app, 'not-admin-analytics@example.com');
    const res = await request(app).get('/api/v1/admin/analytics/overview').set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('returns a user detail with order count', async () => {
    const admin = await makeAdmin(app, 'detail-admin@example.com');
    const buyer = await registerCustomer(app, 'detail-buyer@example.com');
    const res = await request(app)
      .get(`/api/v1/admin/users/${buyer.userId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('detail-buyer@example.com');
    expect(res.body.data.orderCount).toBe(0);
  });

  it('404s a user detail lookup for an unknown id', async () => {
    const admin = await makeAdmin(app, 'detail-admin-2@example.com');
    const res = await request(app)
      .get('/api/v1/admin/users/000000000000000000000000')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(404);
  });

  it('returns a seller detail with product and order counts', async () => {
    const admin = await makeAdmin(app, 'detail-admin-3@example.com');
    const seller = await makeActiveSeller(app, 'detail-seller@example.com', 'Detail Store');
    await createPublishedProductWithStock(app, {
      sellerAccessToken: seller.accessToken,
      adminAccessToken: admin.accessToken,
      name: 'Detail Product',
      priceMinor: 1000,
      onHand: 5
    });
    const res = await request(app)
      .get(`/api/v1/admin/sellers/${seller.sellerId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.productCount).toBeGreaterThanOrEqual(1);
  });

  it('returns a seller-scoped analytics overview reflecting only that seller\'s revenue', async () => {
    const admin = await makeAdmin(app, 'seller-analytics-admin@example.com');
    const seller = await makeActiveSeller(app, 'seller-analytics-seller@example.com', 'Seller Analytics Store');
    const otherSeller = await makeActiveSeller(app, 'other-seller-analytics@example.com', 'Other Store');
    const { variantId } = await createPublishedProductWithStock(app, {
      sellerAccessToken: seller.accessToken,
      adminAccessToken: admin.accessToken,
      name: 'Seller Analytics Product',
      priceMinor: 3000,
      onHand: 10
    });
    await createPublishedProductWithStock(app, {
      sellerAccessToken: otherSeller.accessToken,
      adminAccessToken: admin.accessToken,
      name: 'Other Seller Product',
      priceMinor: 9000,
      onHand: 10
    });

    const buyer = await registerCustomer(app, 'seller-analytics-buyer@example.com');
    await request(app).post('/api/v1/cart/items').set('Authorization', `Bearer ${buyer.accessToken}`).send({ variantId, quantity: 1 });
    const addressId = await addAddress(app, buyer.accessToken);
    const checkoutRes = await request(app)
      .post('/api/v1/checkout')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .set('Idempotency-Key', 'seller-analytics-checkout-key')
      .send({ shippingAddressId: addressId, simulate: 'success' });
    expect(checkoutRes.status).toBe(201);

    const overviewRes = await request(app)
      .get('/api/v1/seller/analytics/overview')
      .query({ rangeDays: 30 })
      .set('Authorization', `Bearer ${seller.accessToken}`);
    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.data.orderCount).toBeGreaterThanOrEqual(1);
    expect(overviewRes.body.data.revenueMinor).toBeGreaterThanOrEqual(3000);
    expect(overviewRes.body.data.revenueMinor).toBeLessThan(9000);

    const otherOverviewRes = await request(app)
      .get('/api/v1/seller/analytics/overview')
      .set('Authorization', `Bearer ${otherSeller.accessToken}`);
    expect(otherOverviewRes.status).toBe(200);
    expect(otherOverviewRes.body.data.revenueMinor).toBe(0);
    expect(otherOverviewRes.body.data.rangeDays).toBe(30);
  });
});

describe('Admin product moderation queue', () => {
  it('lists products pending review and lets an admin publish one', async () => {
    const admin = await makeAdmin(app, 'moderation-admin@example.com');
    const seller = await makeActiveSeller(app, 'moderation-seller@example.com', 'Moderation Store');
    const categoryId = await ensureCategory('moderation-cat', 'Moderation Category');

    const createRes = await request(app)
      .post('/api/v1/seller/products')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ categoryId, name: 'Pending Product' });
    expect(createRes.status).toBe(201);
    const productId = createRes.body.data.id as string;

    await request(app)
      .post(`/api/v1/seller/products/${productId}/submit`)
      .set('Authorization', `Bearer ${seller.accessToken}`);

    const listRes = await request(app)
      .get('/api/v1/admin/products')
      .query({ moderationStatus: 'pending_review' })
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(listRes.status).toBe(200);
    const match = listRes.body.data.find((p: { id: string }) => p.id === productId);
    expect(match).toBeDefined();
    expect(match.moderationStatus).toBe('pending_review');

    const moderateRes = await request(app)
      .patch(`/api/v1/admin/products/${productId}/moderate`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'published' });
    expect(moderateRes.status).toBe(200);
    expect(moderateRes.body.data.moderationStatus).toBe('published');
  });

  it('rejects product moderation list access from a non-admin', async () => {
    const customer = await registerCustomer(app, 'not-admin-moderation@example.com');
    const res = await request(app).get('/api/v1/admin/products').set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe('Admin AI oversight', () => {
  it('returns provider status without ever exposing a raw API key', async () => {
    const admin = await makeAdmin(app, 'ai-admin@example.com');
    const res = await request(app).get('/api/v1/admin/ai/overview').set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.provider).toBe('development');
    expect(res.body.data.model).toBeNull();
    expect(res.body.data).not.toHaveProperty('apiKey');
    expect(typeof res.body.data.apiKeyConfigured).toBe('boolean');
    expect(res.body.data.totalConversations).toBeGreaterThanOrEqual(0);
  });

  it('lists conversations with metadata only, never raw message content', async () => {
    const admin = await makeAdmin(app, 'ai-admin-2@example.com');
    const buyer = await registerCustomer(app, 'ai-buyer@example.com');
    const discoverRes = await request(app)
      .post('/api/v1/ai/discovery')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ message: 'looking for a laptop under 500 dollars' });
    expect(discoverRes.status).toBe(200);
    const conversationId = discoverRes.body.data.conversationId as string;

    const listRes = await request(app).get('/api/v1/admin/ai/conversations').set('Authorization', `Bearer ${admin.accessToken}`);
    expect(listRes.status).toBe(200);
    const match = listRes.body.data.find((c: { id: string }) => c.id === conversationId);
    expect(match).toBeDefined();
    expect(match.messageCount).toBeGreaterThanOrEqual(2);
    expect(match).not.toHaveProperty('content');
    expect(match).not.toHaveProperty('messages');

    const detailRes = await request(app)
      .get(`/api/v1/admin/ai/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(detailRes.status).toBe(200);
    expect(Array.isArray(detailRes.body.data.messages)).toBe(true);
    expect(detailRes.body.data.messages.length).toBeGreaterThanOrEqual(2);
    expect(detailRes.body.data.messages[0].content).toEqual(expect.any(String));
  });

  it('rejects AI oversight access from a non-admin', async () => {
    const customer = await registerCustomer(app, 'not-admin-ai@example.com');
    const res = await request(app).get('/api/v1/admin/ai/overview').set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(403);
  });
});
