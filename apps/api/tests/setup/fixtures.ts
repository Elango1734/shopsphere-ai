import type { Express } from 'express';
import request from 'supertest';
import { grantRole } from '../../src/repositories/user.repository.js';
import { transitionSellerStatus } from '../../src/repositories/seller.repository.js';
import { CategoryModel } from '../../src/models/category.model.js';

/** Registers a customer and returns both tokens plus the user id — the building block every other fixture uses. */
export async function registerCustomer(app: Express, email: string) {
  const res = await request(app).post('/api/v1/auth/register').send({ email, password: 'FixtureTest!2345' });
  return {
    userId: res.body.data.user.id as string,
    accessToken: res.body.data.accessToken as string,
    refreshToken: res.body.data.refreshToken as string
  };
}

/** Mints a fresh access token reflecting the user's CURRENT roles — needed after granting a role out of band. */
export async function refreshAccessToken(app: Express, refreshToken: string) {
  const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
  return { accessToken: res.body.data.accessToken as string, refreshToken: res.body.data.refreshToken as string };
}

/**
 * There is no public "become administrator" endpoint by design (security.md).
 * Tests that need an admin principal grant the role directly through the
 * repository layer, exactly like the development seed script does — never
 * through a client-facing API, since one should not exist.
 */
export async function makeAdmin(app: Express, email: string) {
  const customer = await registerCustomer(app, email);
  await grantRole(customer.userId, 'administrator');
  const refreshed = await refreshAccessToken(app, customer.refreshToken);
  return { userId: customer.userId, accessToken: refreshed.accessToken };
}

export async function makeActiveSeller(app: Express, email: string, storeName: string) {
  const customer = await registerCustomer(app, email);
  const onboardRes = await request(app)
    .post('/api/v1/seller/onboard')
    .set('Authorization', `Bearer ${customer.accessToken}`)
    .send({ storeName });
  const sellerId = onboardRes.body.data.id as string;

  await transitionSellerStatus(sellerId, 'active', customer.userId, 'fixture auto-approve');
  const refreshed = await refreshAccessToken(app, customer.refreshToken);
  return { userId: customer.userId, sellerId, accessToken: refreshed.accessToken };
}

export async function ensureCategory(slug: string, name: string): Promise<string> {
  const existing = await CategoryModel.findOne({ slug });
  if (existing) return existing._id.toString();
  const created = await CategoryModel.create({ name, slug, isActive: true });
  return created._id.toString();
}

/** Full seller → variant → admin-publish pipeline, returning a ready-to-purchase variant. */
export async function createPublishedProductWithStock(
  app: Express,
  options: { sellerAccessToken: string; adminAccessToken: string; name: string; priceMinor: number; onHand: number }
) {
  const categoryId = await ensureCategory('fixtures', 'Fixtures');

  const productRes = await request(app)
    .post('/api/v1/seller/products')
    .set('Authorization', `Bearer ${options.sellerAccessToken}`)
    .send({ categoryId, name: options.name });
  const productId = productRes.body.data.id as string;

  const variantRes = await request(app)
    .post(`/api/v1/seller/products/${productId}/variants`)
    .set('Authorization', `Bearer ${options.sellerAccessToken}`)
    .send({ sku: `FIX-${Date.now()}`, regularPrice: { amountMinor: options.priceMinor, currency: 'USD' }, initialOnHand: options.onHand });
  const variantId = variantRes.body.data.id as string;

  await request(app).post(`/api/v1/seller/products/${productId}/submit`).set('Authorization', `Bearer ${options.sellerAccessToken}`);
  await request(app)
    .patch(`/api/v1/admin/products/${productId}/moderate`)
    .set('Authorization', `Bearer ${options.adminAccessToken}`)
    .send({ status: 'published' });

  return { productId, variantId };
}

export async function addAddress(app: Express, accessToken: string) {
  const res = await request(app)
    .post('/api/v1/me/addresses')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ fields: { recipientName: 'Test User', addressLine1: '1 Test St', locality: 'Testville', postalCode: '00000', countryCode: 'US' } });
  return res.body.data.id as string;
}
