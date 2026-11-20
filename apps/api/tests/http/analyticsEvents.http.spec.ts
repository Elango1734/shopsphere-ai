import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import request from 'supertest';
import { startMemoryReplicaSet, stopMemoryReplicaSet, clearAllCollections } from '../setup/memoryReplSet.js';
import { createApp } from '../../src/app.js';
import { registerCustomer, makeAdmin, makeActiveSeller, createPublishedProductWithStock } from '../setup/fixtures.js';
import { AnalyticsEventModel } from '../../src/models/analyticsEvent.model.js';
import { getFunnelForRange } from '../../src/repositories/analyticsEvent.repository.js';

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

describe('storefront event ingest', () => {
  it('accepts events from a guest with no account and attributes the seller server-side', async () => {
    const admin = await makeAdmin(app, 'ev-admin@example.com');
    const seller = await makeActiveSeller(app, 'ev-seller@example.com', 'Event Store');
    const { productId } = await createPublishedProductWithStock(app, {
      sellerAccessToken: seller.accessToken,
      adminAccessToken: admin.accessToken,
      name: 'Tracked Product',
      priceMinor: 2500,
      onHand: 10
    });

    const res = await request(app)
      .post('/api/v1/analytics/events')
      .send({
        events: [
          { type: 'session_start', sessionId: 'sess-guest-0001' },
          { type: 'product_view', sessionId: 'sess-guest-0001', productId }
        ]
      });

    expect(res.status).toBe(202);
    expect(res.body.data.accepted).toBe(2);

    const stored = await AnalyticsEventModel.find({ sessionId: 'sess-guest-0001' });
    expect(stored).toHaveLength(2);

    // The client never sent a sellerId; it was derived from the product.
    const view = stored.find((e) => e.type === 'product_view')!;
    expect(view.sellerId?.toString()).toBe(seller.sellerId);
    // A guest is stored as a hash, never as a raw token, and carries no userId.
    expect(view.guestTokenHash).toEqual(expect.any(String));
    expect(view.guestTokenHash).not.toBe('');
    expect(view.userId).toBeUndefined();
  });

  it('refuses an unknown event type rather than storing free-form strings', async () => {
    const res = await request(app)
      .post('/api/v1/analytics/events')
      .send({ events: [{ type: 'definitely_not_a_real_event', sessionId: 'sess-guest-0002' }] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await AnalyticsEventModel.countDocuments()).toBe(0);
  });

  it('clamps an event claiming to be from the future to now', async () => {
    const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post('/api/v1/analytics/events')
      .send({ events: [{ type: 'session_start', sessionId: 'sess-guest-0003', occurredAt: future }] });

    expect(res.status).toBe(202);
    const stored = await AnalyticsEventModel.findOne({ sessionId: 'sess-guest-0003' });
    expect(stored!.occurredAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('attributes an authenticated shopper to their user id', async () => {
    const buyer = await registerCustomer(app, 'ev-buyer@example.com');

    await request(app)
      .post('/api/v1/analytics/events')
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ events: [{ type: 'session_start', sessionId: 'sess-user-0001' }] });

    const stored = await AnalyticsEventModel.findOne({ sessionId: 'sess-user-0001' });
    expect(stored!.userId?.toString()).toBe(buyer.userId);
    expect(stored!.guestTokenHash).toBeUndefined();
  });
});

describe('funnel maths', () => {
  const start = new Date('2026-04-01T00:00:00.000Z');
  const end = new Date('2026-04-02T00:00:00.000Z');

  async function seed(sessionId: string, types: string[]) {
    await AnalyticsEventModel.insertMany(
      types.map((type) => ({ type, sessionId, occurredAt: new Date('2026-04-01T12:00:00.000Z') }))
    );
  }

  it('counts conversion per session, so browsing more does not lower it', async () => {
    // One session that viewed six products and bought once.
    await seed('busy-session', ['session_start', 'product_view', 'product_view', 'product_view', 'product_view', 'product_view', 'product_view', 'add_to_cart', 'order_placed']);
    // One session that looked once and left.
    await seed('bounce-session', ['session_start', 'product_view']);

    const funnel = await getFunnelForRange(start, end);

    expect(funnel.sessions).toBe(2);
    expect(funnel.productViews).toBe(7);
    expect(funnel.ordersPlaced).toBe(1);
    // 1 of 2 sessions converted — not 1 of 7 views.
    expect(funnel.conversionRatePct).toBe(50);
  });

  it('reports an unmeasured day as null rather than as zero percent', async () => {
    const funnel = await getFunnelForRange(start, end);

    expect(funnel.sessions).toBe(0);
    expect(funnel.conversionRatePct).toBeNull();
    expect(funnel.cartAbandonmentRatePct).toBeNull();
  });

  it('counts cart abandonment as carts that never became orders', async () => {
    await seed('abandoned-1', ['add_to_cart']);
    await seed('abandoned-2', ['add_to_cart', 'checkout_start']);
    await seed('converted-1', ['add_to_cart', 'order_placed']);

    const funnel = await getFunnelForRange(start, end);

    expect(funnel.addToCarts).toBe(3);
    // 2 of the 3 carting sessions never ordered.
    expect(funnel.cartAbandonmentRatePct).toBeCloseTo(66.7, 1);
  });

  it('scopes the funnel to one seller when asked', async () => {
    const admin = await makeAdmin(app, 'funnel-admin@example.com');
    const sellerA = await makeActiveSeller(app, 'funnel-a@example.com', 'Funnel A');
    const sellerB = await makeActiveSeller(app, 'funnel-b@example.com', 'Funnel B');
    const a = await createPublishedProductWithStock(app, {
      sellerAccessToken: sellerA.accessToken,
      adminAccessToken: admin.accessToken,
      name: 'A Product',
      priceMinor: 1000,
      onHand: 5
    });
    const b = await createPublishedProductWithStock(app, {
      sellerAccessToken: sellerB.accessToken,
      adminAccessToken: admin.accessToken,
      name: 'B Product',
      priceMinor: 1000,
      onHand: 5
    });

    await request(app)
      .post('/api/v1/analytics/events')
      .send({
        events: [
          { type: 'product_view', sessionId: 'sess-split-1', productId: a.productId, occurredAt: '2026-04-01T12:00:00.000Z' },
          { type: 'product_view', sessionId: 'sess-split-2', productId: b.productId, occurredAt: '2026-04-01T12:00:00.000Z' },
          { type: 'product_view', sessionId: 'sess-split-3', productId: b.productId, occurredAt: '2026-04-01T12:00:00.000Z' }
        ]
      });

    const onlyA = await getFunnelForRange(start, end, sellerA.sellerId);
    const onlyB = await getFunnelForRange(start, end, sellerB.sellerId);

    expect(onlyA.productViews).toBe(1);
    expect(onlyB.productViews).toBe(2);
  });
});
