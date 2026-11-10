import { createHmac } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import request from 'supertest';
import { startMemoryReplicaSet, stopMemoryReplicaSet, clearAllCollections } from '../setup/memoryReplSet.js';
import { createApp } from '../../src/app.js';
import { registerCustomer, makeAdmin, makeActiveSeller, createPublishedProductWithStock, addAddress } from '../setup/fixtures.js';
import { getEnv } from '../../src/config/env.js';
import { withTransaction } from '../../src/db/transaction.js';
import { createOrder } from '../../src/repositories/order.repository.js';
import { PaymentAttemptModel } from '../../src/models/paymentAttempt.model.js';
import { ProductVariantModel } from '../../src/models/productVariant.model.js';

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

function sign(body: string): string {
  const hmac = createHmac('sha256', getEnv().PAYMENT_WEBHOOK_SECRET).update(body).digest('hex');
  return `sha256=${hmac}`;
}

async function placeFailedOrder() {
  const admin = await makeAdmin(app, 'wh-admin@example.com');
  const seller = await makeActiveSeller(app, 'wh-seller@example.com', 'Webhook Store');
  const { variantId } = await createPublishedProductWithStock(app, {
    sellerAccessToken: seller.accessToken,
    adminAccessToken: admin.accessToken,
    name: 'Webhook Product',
    priceMinor: 2500,
    onHand: 5
  });
  const buyer = await registerCustomer(app, 'wh-buyer@example.com');
  await request(app).post('/api/v1/cart/items').set('Authorization', `Bearer ${buyer.accessToken}`).send({ variantId, quantity: 1 });
  const addressId = await addAddress(app, buyer.accessToken);

  // simulate: 'failure' so paymentStatus ends up 'failed', leaving a payment attempt we can confirm via webhook.
  const checkoutRes = await request(app)
    .post('/api/v1/checkout')
    .set('Authorization', `Bearer ${buyer.accessToken}`)
    .set('Idempotency-Key', 'webhook-test-key')
    .send({ shippingAddressId: addressId, simulate: 'failure' });

  return {
    orderId: checkoutRes.body.data.orderId as string,
    paymentAttemptId: checkoutRes.body.data.paymentAttemptId as string,
    // The captured amount is the order's grandTotal (item price + tax + shipping), not the bare item price.
    amountMinor: checkoutRes.body.data.grandTotal.amountMinor as number
  };
}

/**
 * The development payment provider resolves synchronously inside checkout, so there is no public-API path to
 * an order sitting in `paymentStatus: 'pending'` awaiting a webhook — that window only exists for a real async
 * provider. To exercise the genuine first-time "processed" confirmation (as opposed to the "ignored"
 * already-resolved case covered above), this constructs a pending order directly through the same
 * `createOrder` repository checkout itself uses, with a matching `pending` PaymentAttempt.
 */
async function placePendingOrder() {
  const admin = await makeAdmin(app, 'wh-admin2@example.com');
  const seller = await makeActiveSeller(app, 'wh-seller2@example.com', 'Webhook Pending Store');
  const { variantId } = await createPublishedProductWithStock(app, {
    sellerAccessToken: seller.accessToken,
    adminAccessToken: admin.accessToken,
    name: 'Webhook Pending Product',
    priceMinor: 3000,
    onHand: 5
  });
  const buyer = await registerCustomer(app, 'wh-buyer2@example.com');
  const addressId = await addAddress(app, buyer.accessToken);
  const addressRes = await request(app).get(`/api/v1/me/addresses/${addressId}`).set('Authorization', `Bearer ${buyer.accessToken}`);
  const variant = await ProductVariantModel.findById(variantId);

  const money = { amountMinor: 3000, currency: 'USD' };
  const order = await withTransaction((session) =>
    createOrder(
      {
        customerId: buyer.userId,
        checkoutIdempotencyKey: 'pending-fixture-key',
        items: [
          {
            productId: variant!.productId.toString(),
            variantId,
            sellerId: variant!.sellerId.toString(),
            name: 'Webhook Pending Product',
            sku: variant!.sku,
            attributes: {},
            unitPrice: money,
            discount: { amountMinor: 0, currency: 'USD' },
            taxAmount: { amountMinor: 0, currency: 'USD' },
            quantity: 1,
            lineTotal: money
          }
        ],
        itemSubtotal: money,
        discountTotal: { amountMinor: 0, currency: 'USD' },
        taxTotal: { amountMinor: 0, currency: 'USD' },
        shippingTotal: { amountMinor: 0, currency: 'USD' },
        grandTotal: money,
        shippingAddressSnapshot: addressRes.body.data.fields
      },
      session
    )
  );

  const paymentAttempt = await PaymentAttemptModel.create({
    orderId: order._id,
    provider: 'development',
    amount: money,
    status: 'pending',
    idempotencyKey: 'pending-fixture-payment-key'
  });

  return { orderId: order._id.toString(), paymentAttemptId: paymentAttempt._id.toString(), amountMinor: money.amountMinor };
}

describe('Payment webhook (testing.md high-risk case)', () => {
  it('rejects a request with an invalid signature', async () => {
    const body = JSON.stringify({ eventId: 'e1', eventType: 'payment.succeeded', orderId: 'x', paymentAttemptId: 'y', amountMinor: 100, currency: 'USD' });
    const res = await request(app)
      .post('/api/v1/webhooks/payments/development')
      .set('Content-Type', 'text/plain')
      .set('X-ShopSphere-Signature', 'sha256=0000000000000000000000000000000000000000000000000000000000000000')
      .send(body);
    expect(res.status).toBe(401);
  });

  it('rejects amount/currency mismatch against the real payment attempt', async () => {
    const { orderId, paymentAttemptId, amountMinor } = await placeFailedOrder();
    const body = JSON.stringify({ eventId: 'e2', eventType: 'payment.succeeded', orderId, paymentAttemptId, amountMinor: 999999, currency: 'USD' });
    const res = await request(app)
      .post('/api/v1/webhooks/payments/development')
      .set('Content-Type', 'text/plain')
      .set('X-ShopSphere-Signature', sign(body))
      .send(body);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PAYMENT_MISMATCH');
  });

  it('marks a pending order paid on a correctly-signed succeeded event, and dedupes a replay', async () => {
    const { orderId, paymentAttemptId, amountMinor } = await placePendingOrder();
    const body = JSON.stringify({ eventId: 'e3', eventType: 'payment.succeeded', orderId, paymentAttemptId, amountMinor, currency: 'USD' });
    const signature = sign(body);

    const first = await request(app)
      .post('/api/v1/webhooks/payments/development')
      .set('Content-Type', 'text/plain')
      .set('X-ShopSphere-Signature', signature)
      .send(body);
    expect(first.status).toBe(200);
    expect(first.body.data.status).toBe('processed');

    const duplicate = await request(app)
      .post('/api/v1/webhooks/payments/development')
      .set('Content-Type', 'text/plain')
      .set('X-ShopSphere-Signature', signature)
      .send(body);
    expect(duplicate.body.data.status).toBe('duplicate');
  });

  it('ignores (does not error on) an out-of-order event for an order that is no longer in a compatible state', async () => {
    const { orderId, paymentAttemptId, amountMinor } = await placeFailedOrder();
    const succeedBody = JSON.stringify({ eventId: 'e4a', eventType: 'payment.succeeded', orderId, paymentAttemptId, amountMinor, currency: 'USD' });
    await request(app)
      .post('/api/v1/webhooks/payments/development')
      .set('Content-Type', 'text/plain')
      .set('X-ShopSphere-Signature', sign(succeedBody))
      .send(succeedBody);

    // A second, different event replaying "succeeded" again (different eventId, same logical outcome) must not error.
    const replaySucceedBody = JSON.stringify({ eventId: 'e4b', eventType: 'payment.succeeded', orderId, paymentAttemptId, amountMinor, currency: 'USD' });
    const res = await request(app)
      .post('/api/v1/webhooks/payments/development')
      .set('Content-Type', 'text/plain')
      .set('X-ShopSphere-Signature', sign(replaySucceedBody))
      .send(replaySucceedBody);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ignored');
  });
});
