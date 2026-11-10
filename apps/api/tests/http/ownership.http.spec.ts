import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import request from 'supertest';
import { startMemoryReplicaSet, stopMemoryReplicaSet, clearAllCollections } from '../setup/memoryReplSet.js';
import { createApp } from '../../src/app.js';
import { registerCustomer, makeAdmin, makeActiveSeller, createPublishedProductWithStock, addAddress } from '../setup/fixtures.js';

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

describe('Cross-tenant access boundaries (testing.md high-risk case)', () => {
  it('customer B cannot read, cancel, or return customer A\'s order', async () => {
    const admin = await makeAdmin(app, 'admin@example.com');
    const seller = await makeActiveSeller(app, 'seller@example.com', 'Boundary Store');
    const { variantId } = await createPublishedProductWithStock(app, {
      sellerAccessToken: seller.accessToken,
      adminAccessToken: admin.accessToken,
      name: 'Boundary Product',
      priceMinor: 1500,
      onHand: 5
    });

    const customerA = await registerCustomer(app, 'customer-a@example.com');
    await request(app).post('/api/v1/cart/items').set('Authorization', `Bearer ${customerA.accessToken}`).send({ variantId, quantity: 1 });
    const addressId = await addAddress(app, customerA.accessToken);
    const checkoutRes = await request(app)
      .post('/api/v1/checkout')
      .set('Authorization', `Bearer ${customerA.accessToken}`)
      .set('Idempotency-Key', 'boundary-key')
      .send({ shippingAddressId: addressId, simulate: 'success' });
    const orderId = checkoutRes.body.data.orderId as string;

    const customerB = await registerCustomer(app, 'customer-b@example.com');

    const readAttempt = await request(app).get(`/api/v1/orders/${orderId}`).set('Authorization', `Bearer ${customerB.accessToken}`);
    expect(readAttempt.status).toBe(403);

    const cancelAttempt = await request(app).post(`/api/v1/orders/${orderId}/cancel`).set('Authorization', `Bearer ${customerB.accessToken}`);
    expect(cancelAttempt.status).toBe(403);

    const returnAttempt = await request(app)
      .post('/api/v1/returns')
      .set('Authorization', `Bearer ${customerB.accessToken}`)
      .send({ orderId, items: [{ variantId, quantity: 1 }] });
    expect(returnAttempt.status).toBe(403);

    // The true owner, meanwhile, can read it fine.
    const ownerRead = await request(app).get(`/api/v1/orders/${orderId}`).set('Authorization', `Bearer ${customerA.accessToken}`);
    expect(ownerRead.status).toBe(200);
  });

  it('customer B cannot read or modify customer A\'s address', async () => {
    const customerA = await registerCustomer(app, 'addr-a@example.com');
    const addressId = await addAddress(app, customerA.accessToken);
    const customerB = await registerCustomer(app, 'addr-b@example.com');

    const readAttempt = await request(app).get(`/api/v1/me/addresses/${addressId}`).set('Authorization', `Bearer ${customerB.accessToken}`);
    expect(readAttempt.status).toBe(404); // ownership-scoped lookup: not found, not 403, to avoid confirming existence

    const deleteAttempt = await request(app)
      .delete(`/api/v1/me/addresses/${addressId}`)
      .set('Authorization', `Bearer ${customerB.accessToken}`);
    expect(deleteAttempt.status).toBe(403);
  });

  it('seller B cannot update seller A\'s product, even knowing its ID', async () => {
    const admin = await makeAdmin(app, 'admin2@example.com');
    const sellerA = await makeActiveSeller(app, 'seller-a@example.com', 'Seller A Store');
    const sellerB = await makeActiveSeller(app, 'seller-b@example.com', 'Seller B Store');

    const { productId } = await createPublishedProductWithStock(app, {
      sellerAccessToken: sellerA.accessToken,
      adminAccessToken: admin.accessToken,
      name: 'Seller A Product',
      priceMinor: 999,
      onHand: 1
    });

    const attempt = await request(app)
      .patch(`/api/v1/seller/products/${productId}`)
      .set('Authorization', `Bearer ${sellerB.accessToken}`)
      .send({ name: 'Hijacked Name' });
    expect(attempt.status).toBe(404); // seller-scoped query finds nothing for a non-owning seller

    const unchanged = await request(app).get(`/api/v1/products/${productId}`);
    void unchanged;
  });

  it('seller B cannot view or update fulfillment on seller A\'s order', async () => {
    const admin = await makeAdmin(app, 'admin3@example.com');
    const sellerA = await makeActiveSeller(app, 'seller-a2@example.com', 'Seller A2 Store');
    const sellerB = await makeActiveSeller(app, 'seller-b2@example.com', 'Seller B2 Store');
    const { variantId } = await createPublishedProductWithStock(app, {
      sellerAccessToken: sellerA.accessToken,
      adminAccessToken: admin.accessToken,
      name: 'Seller A2 Product',
      priceMinor: 1200,
      onHand: 5
    });

    const buyer = await registerCustomer(app, 'fulfillment-buyer@example.com');
    await request(app).post('/api/v1/cart/items').set('Authorization', `Bearer ${buyer.accessToken}`).send({ variantId, quantity: 1 });
    const addressId = await addAddress(app, buyer.accessToken);
    const checkoutRes = await request(app)
      .post('/api/v1/checkout')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .set('Idempotency-Key', 'seller-boundary-key')
      .send({ shippingAddressId: addressId, simulate: 'success' });
    const orderId = checkoutRes.body.data.orderId as string;

    const viewAttempt = await request(app).get(`/api/v1/seller/orders/${orderId}`).set('Authorization', `Bearer ${sellerB.accessToken}`);
    expect(viewAttempt.status).toBe(404);

    const updateAttempt = await request(app)
      .patch(`/api/v1/seller/orders/${orderId}/fulfillment`)
      .set('Authorization', `Bearer ${sellerB.accessToken}`)
      .send({ status: 'confirmed' });
    expect(updateAttempt.status).toBe(404);

    const legitimateView = await request(app).get(`/api/v1/seller/orders/${orderId}`).set('Authorization', `Bearer ${sellerA.accessToken}`);
    expect(legitimateView.status).toBe(200);
  });
});

describe('Role enforcement', () => {
  it('a plain customer cannot call seller-only or admin-only routes', async () => {
    const customer = await registerCustomer(app, 'plain-customer@example.com');
    const sellerAttempt = await request(app)
      .get('/api/v1/seller/me')
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(sellerAttempt.status).toBe(403);

    const adminAttempt = await request(app).get('/api/v1/admin/users').set('Authorization', `Bearer ${customer.accessToken}`);
    expect(adminAttempt.status).toBe(403);
  });
});
