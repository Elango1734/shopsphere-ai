import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import request from 'supertest';
import { Types } from 'mongoose';
import { startMemoryReplicaSet, stopMemoryReplicaSet, clearAllCollections } from '../setup/memoryReplSet.js';
import { createApp } from '../../src/app.js';
import { registerCustomer, makeAdmin, makeActiveSeller, createPublishedProductWithStock } from '../setup/fixtures.js';
import { OrderModel } from '../../src/models/order.model.js';

const app = createApp();

const REPORT_DATE = '2026-03-10';
const PRIOR_DATE = '2026-03-09';

const ADDRESS = {
  recipientName: 'Test Buyer',
  addressLine1: '1 Test Way',
  locality: 'Testville',
  postalCode: '12345',
  countryCode: 'US'
};

const money = (amountMinor: number) => ({ amountMinor, currency: 'USD' });

/**
 * Orders are inserted directly rather than driven through checkout: the point
 * under test is the aggregation's treatment of payment status, seller scoping
 * and day boundaries, and only direct insertion can place an order on a
 * specific historical day.
 */
async function placeOrder(options: {
  customerId: string;
  sellerId: string;
  productId: string;
  variantId: string;
  placedAt: string;
  paymentStatus: 'paid' | 'cancelled' | 'pending';
  lineTotalMinor: number;
  quantity?: number;
  extraSellerLine?: { sellerId: string; productId: string; variantId: string; lineTotalMinor: number };
}) {
  const quantity = options.quantity ?? 1;
  const items = [
    {
      productId: new Types.ObjectId(options.productId),
      variantId: new Types.ObjectId(options.variantId),
      sellerId: new Types.ObjectId(options.sellerId),
      name: 'Reported Product',
      sku: 'RPT-1',
      unitPrice: money(options.lineTotalMinor / quantity),
      discount: money(0),
      taxAmount: money(0),
      quantity,
      lineTotal: money(options.lineTotalMinor)
    }
  ];
  const sellerIds = [new Types.ObjectId(options.sellerId)];

  if (options.extraSellerLine) {
    items.push({
      productId: new Types.ObjectId(options.extraSellerLine.productId),
      variantId: new Types.ObjectId(options.extraSellerLine.variantId),
      sellerId: new Types.ObjectId(options.extraSellerLine.sellerId),
      name: 'Other Seller Product',
      sku: 'OTH-1',
      unitPrice: money(options.extraSellerLine.lineTotalMinor),
      discount: money(0),
      taxAmount: money(0),
      quantity: 1,
      lineTotal: money(options.extraSellerLine.lineTotalMinor)
    });
    sellerIds.push(new Types.ObjectId(options.extraSellerLine.sellerId));
  }

  const itemTotal = items.reduce((sum, i) => sum + i.lineTotal.amountMinor, 0);

  return OrderModel.create({
    customerId: new Types.ObjectId(options.customerId),
    items,
    sellerIds,
    itemSubtotal: money(itemTotal),
    discountTotal: money(0),
    taxTotal: money(0),
    shippingTotal: money(0),
    grandTotal: money(itemTotal),
    paymentStatus: options.paymentStatus,
    fulfillmentStatus: 'pending',
    shippingAddressSnapshot: ADDRESS,
    checkoutIdempotencyKey: `test-${new Types.ObjectId().toString()}`,
    placedAt: new Date(`${options.placedAt}T10:00:00.000Z`)
  });
}

beforeAll(async () => {
  await startMemoryReplicaSet();
}, 120_000);
afterAll(async () => {
  await stopMemoryReplicaSet();
});
afterEach(async () => {
  await clearAllCollections();
});

describe('seller daily report — grounded in captured orders only', () => {
  it('counts only captured payments, scopes revenue to the seller own lines, and compares with the prior day', async () => {
    const admin = await makeAdmin(app, 'report-admin@example.com');
    const seller = await makeActiveSeller(app, 'report-seller@example.com', 'Report Store');
    const otherSeller = await makeActiveSeller(app, 'report-other@example.com', 'Other Store');
    const buyer = await registerCustomer(app, 'report-buyer@example.com');

    const { productId, variantId } = await createPublishedProductWithStock(app, {
      sellerAccessToken: seller.accessToken,
      adminAccessToken: admin.accessToken,
      name: 'Reported Product',
      priceMinor: 1000,
      onHand: 50
    });
    const other = await createPublishedProductWithStock(app, {
      sellerAccessToken: otherSeller.accessToken,
      adminAccessToken: admin.accessToken,
      name: 'Other Seller Product',
      priceMinor: 9999,
      onHand: 5
    });

    const sellerId = seller.sellerId;
    const otherSellerId = otherSeller.sellerId;

    // Counts: a paid order on the report date, carrying another seller's line too.
    await placeOrder({
      customerId: buyer.userId,
      sellerId,
      productId,
      variantId,
      placedAt: REPORT_DATE,
      paymentStatus: 'paid',
      lineTotalMinor: 2000,
      quantity: 2,
      extraSellerLine: { sellerId: otherSellerId, productId: other.productId, variantId: other.variantId, lineTotalMinor: 9999 }
    });
    // Ignored: cancelled payment on the same day.
    await placeOrder({
      customerId: buyer.userId,
      sellerId,
      productId,
      variantId,
      placedAt: REPORT_DATE,
      paymentStatus: 'cancelled',
      lineTotalMinor: 5000
    });
    // Baseline: a paid order on the prior day.
    await placeOrder({
      customerId: buyer.userId,
      sellerId,
      productId,
      variantId,
      placedAt: PRIOR_DATE,
      paymentStatus: 'paid',
      lineTotalMinor: 1000
    });

    const res = await request(app)
      .get(`/api/v1/seller/ai/daily-report?date=${REPORT_DATE}`)
      .set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.status).toBe(200);
    const report = res.body.data;

    expect(report.date).toBe(REPORT_DATE);
    expect(report.comparedTo).toBe(PRIOR_DATE);
    // 2000 from the paid order's own line only — never the 9999 belonging to the other seller,
    // and never the 5000 from the cancelled order.
    expect(report.revenueMinor.current).toBe(2000);
    expect(report.revenueMinor.previous).toBe(1000);
    expect(report.revenueMinor.deltaPct).toBe(100);
    expect(report.orderCount.current).toBe(1);
    expect(report.unitsSold.current).toBe(2);
    expect(report.averageOrderValueMinor.current).toBe(2000);

    expect(report.topProducts).toHaveLength(1);
    expect(report.topProducts[0].name).toBe('Reported Product');
    expect(report.summary).toEqual(expect.any(String));
    expect(report.summary.length).toBeGreaterThan(0);
  });

  it('reports a day with no sales without inventing activity', async () => {
    const seller = await makeActiveSeller(app, 'quiet-seller@example.com', 'Quiet Store');

    const res = await request(app)
      .get(`/api/v1/seller/ai/daily-report?date=${REPORT_DATE}`)
      .set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.revenueMinor).toEqual({ current: 0, previous: 0, deltaPct: null });
    expect(res.body.data.topProducts).toEqual([]);
    expect(res.body.data.summary).toContain('No orders');
  });

  it('rejects a malformed date rather than silently defaulting', async () => {
    const seller = await makeActiveSeller(app, 'baddate-seller@example.com', 'Bad Date Store');

    const res = await request(app)
      .get('/api/v1/seller/ai/daily-report?date=10-03-2026')
      .set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('is not reachable by a customer who has no seller profile', async () => {
    const buyer = await registerCustomer(app, 'nosell-buyer@example.com');

    const res = await request(app)
      .get(`/api/v1/seller/ai/daily-report?date=${REPORT_DATE}`)
      .set('Authorization', `Bearer ${buyer.accessToken}`);

    expect(res.status).toBe(403);
  });
});
