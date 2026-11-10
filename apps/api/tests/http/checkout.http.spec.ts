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

describe('Golden path: browse -> guest cart -> register merges cart -> checkout', () => {
  it('completes an end-to-end purchase and reflects it in order history', async () => {
    const admin = await makeAdmin(app, 'admin@example.com');
    const seller = await makeActiveSeller(app, 'seller@example.com', 'Golden Path Store');
    const { variantId } = await createPublishedProductWithStock(app, {
      sellerAccessToken: seller.accessToken,
      adminAccessToken: admin.accessToken,
      name: 'Golden Path Product',
      priceMinor: 2000,
      onHand: 10
    });

    const agent = request.agent(app);

    // Guest browses and adds to cart before ever authenticating.
    await agent.get(`/api/v1/products`);
    const addRes = await agent.post('/api/v1/cart/items').send({ variantId, quantity: 2 });
    expect(addRes.status).toBe(201);

    // Registering merges the guest cart (cart.service.mergeGuestCartOnLogin, wired in auth.controller).
    const registerRes = await agent.post('/api/v1/auth/register').send({ email: 'buyer@example.com', password: 'Buyer!2345' });
    expect(registerRes.status).toBe(201);
    const accessToken = registerRes.body.data.accessToken as string;

    const cartRes = await agent.get('/api/v1/cart').set('Authorization', `Bearer ${accessToken}`);
    expect(cartRes.body.data.items).toHaveLength(1);
    expect(cartRes.body.data.items[0].quantity).toBe(2);

    const addressId = await addAddress(app, accessToken);

    const checkoutRes = await agent
      .post('/api/v1/checkout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', 'golden-path-key-1')
      .send({ shippingAddressId: addressId, simulate: 'success' });

    expect(checkoutRes.status).toBe(201);
    expect(checkoutRes.body.data.paymentStatus).toBe('paid');
    const orderId = checkoutRes.body.data.orderId as string;

    const orderRes = await request(app).get(`/api/v1/orders/${orderId}`).set('Authorization', `Bearer ${accessToken}`);
    expect(orderRes.status).toBe(200);
    expect(orderRes.body.data.grandTotal.amountMinor).toBe(checkoutRes.body.data.grandTotal.amountMinor);
    expect(orderRes.body.data.items[0].quantity).toBe(2);

    const listRes = await request(app).get('/api/v1/orders').set('Authorization', `Bearer ${accessToken}`);
    expect(listRes.body.data).toHaveLength(1);
  });
});

describe('Checkout idempotency over HTTP', () => {
  it('replays the same result for an identical retried request, and 409s a conflicting one', async () => {
    const admin = await makeAdmin(app, 'admin2@example.com');
    const seller = await makeActiveSeller(app, 'seller2@example.com', 'Idempotency Store');
    const { variantId } = await createPublishedProductWithStock(app, {
      sellerAccessToken: seller.accessToken,
      adminAccessToken: admin.accessToken,
      name: 'Idempotency Product',
      priceMinor: 1000,
      onHand: 5
    });

    const buyer = await registerCustomer(app, 'idempotent-buyer@example.com');
    await request(app).post('/api/v1/cart/items').set('Authorization', `Bearer ${buyer.accessToken}`).send({ variantId, quantity: 1 });
    const addressId = await addAddress(app, buyer.accessToken);

    const body = { shippingAddressId: addressId, simulate: 'success' };
    const first = await request(app)
      .post('/api/v1/checkout')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .set('Idempotency-Key', 'http-idem-key')
      .send(body);
    expect(first.status).toBe(201);

    const replay = await request(app)
      .post('/api/v1/checkout')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .set('Idempotency-Key', 'http-idem-key')
      .send(body);
    expect(replay.status).toBe(201);
    expect(replay.body.data.orderId).toBe(first.body.data.orderId);

    const conflicting = await request(app)
      .post('/api/v1/checkout')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .set('Idempotency-Key', 'http-idem-key')
      .send({ ...body, couponCode: 'SOMETHING-ELSE' });
    expect(conflicting.status).toBe(409);
    expect(conflicting.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('rejects checkout without an Idempotency-Key header', async () => {
    const buyer = await registerCustomer(app, 'no-key-buyer@example.com');
    const res = await request(app).post('/api/v1/checkout').set('Authorization', `Bearer ${buyer.accessToken}`).send({});
    expect(res.status).toBe(400);
  });

  it('rejects checkout with an empty cart', async () => {
    const buyer = await registerCustomer(app, 'empty-cart-buyer@example.com');
    const res = await request(app)
      .post('/api/v1/checkout')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .set('Idempotency-Key', 'empty-cart-key')
      .send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CART_EMPTY');
  });
});
