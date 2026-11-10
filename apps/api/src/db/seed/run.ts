import 'dotenv/config';
import type { Model } from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '../connection.js';
import { withTransaction } from '../transaction.js';
import { getEnv, isDevelopmentOrTest } from '../../config/env.js';
import {
  UserModel,
  SellerModel,
  CategoryModel,
  BrandModel,
  ProductModel,
  ProductVariantModel,
  InventoryModel,
  CouponModel,
  PromotionModel,
  AddressModel,
  OrderModel,
  ReviewModel,
  PaymentAttemptModel
} from '../../models/index.js';
import { registerCustomerAccount, hashPassword, grantRole } from '../../repositories/user.repository.js';
import { recomputeProductPriceAndStockCache } from '../../repositories/product.repository.js';
import { recomputeRatingAggregate } from '../../repositories/review.repository.js';

const RESET = process.argv.includes('--reset');

const SEED_COLLECTIONS = [
  UserModel,
  SellerModel,
  CategoryModel,
  BrandModel,
  ProductModel,
  ProductVariantModel,
  InventoryModel,
  CouponModel,
  PromotionModel,
  AddressModel,
  OrderModel,
  ReviewModel,
  PaymentAttemptModel
] as unknown as Model<unknown>[];

/**
 * Development-only seed data. Guarded by NODE_ENV: refuses to run against a
 * `production`-configured environment regardless of flags, per
 * database-design.md ("seed scripts must be idempotent or clearly document
 * how to reset the database... never seed production passwords or
 * unrestricted production admin accounts"). Default (no --reset) mode is
 * idempotent: every write is an upsert keyed by a stable business key (slug,
 * email, SKU) so re-running does not duplicate records. `--reset` instead
 * drops the seeded collections first for a clean slate, and is itself only
 * permitted in development/test.
 */
async function main(): Promise<void> {
  if (!isDevelopmentOrTest()) {
    throw new Error('Refusing to seed: NODE_ENV must be development or test');
  }

  await connectToDatabase();

  if (RESET) {
    console.log('Resetting seeded collections...');
    for (const model of SEED_COLLECTIONS) {
      await model.deleteMany({});
    }
  }

  const admin = await seedDevelopmentAdmin();
  const { customers } = await seedCustomers();
  const { categories } = await seedCategories();
  const { brands } = await seedBrands();
  const { sellers } = await seedSellers();
  const { products } = await seedProducts(categories, brands, sellers);
  await seedCoupons();
  await seedPromotions(categories);
  const addresses = await seedAddresses(customers);
  const orders = await seedOrders(customers, products, addresses);
  await seedReviews(customers, orders);

  console.log('Seed complete.');
  console.log(`  Admin: ${admin.email ?? '(no admin seeded; set SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD)'}`);
  console.log(`  Customers: ${customers.length}, Sellers: ${sellers.length}, Products: ${products.length}`);

  await disconnectFromDatabase();
}

/**
 * The ONLY way an administrator account is seeded: it requires
 * SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to be explicitly set in the local
 * .env (never committed, never a hardcoded default), so there is no
 * unrestricted production-capable admin credential baked into source
 * control. If unset, this step is skipped and logged, not silently defaulted.
 */
async function seedDevelopmentAdmin(): Promise<{ email?: string }> {
  const env = getEnv();
  if (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD) {
    console.warn('SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD not set; skipping development admin provisioning.');
    return {};
  }

  const passwordHash = await hashPassword(env.SEED_ADMIN_PASSWORD);
  const admin = await UserModel.findOneAndUpdate(
    { email: env.SEED_ADMIN_EMAIL },
    {
      $setOnInsert: { email: env.SEED_ADMIN_EMAIL, passwordHash, roles: ['customer'], status: 'active' }
    },
    { upsert: true, new: true }
  );
  await grantRole(admin._id.toString(), 'administrator');
  return { email: env.SEED_ADMIN_EMAIL };
}

async function seedCustomers() {
  const seedCustomerDefs = [
    { email: 'ava.customer@example.test', displayName: 'Ava Thompson' },
    { email: 'liam.customer@example.test', displayName: 'Liam Chen' },
    { email: 'maya.customer@example.test', displayName: 'Maya Rodriguez' }
  ];

  const customers = [];
  for (const def of seedCustomerDefs) {
    let user = await UserModel.findOne({ email: def.email });
    if (!user) {
      user = await registerCustomerAccount({ email: def.email, plainPassword: 'DevPassword!2345', displayName: def.displayName });
      user.status = 'active';
      user.emailVerifiedAt = new Date();
      await user.save();
    }
    customers.push(user);
  }
  return { customers };
}

async function seedCategories() {
  const defs = [
    { name: 'Fashion', slug: 'fashion' },
    { name: 'Electronics', slug: 'electronics' },
    { name: 'Groceries', slug: 'groceries' },
    { name: 'Home', slug: 'home' },
    { name: 'Beauty', slug: 'beauty' },
    { name: 'Sports', slug: 'sports' },
    { name: 'Books', slug: 'books' }
  ];
  const categories = [];
  for (const def of defs) {
    const category = await CategoryModel.findOneAndUpdate(
      { slug: def.slug },
      { $setOnInsert: { name: def.name, slug: def.slug, isActive: true } },
      { upsert: true, new: true }
    );
    categories.push(category);
  }
  return { categories };
}

async function seedBrands() {
  const defs = [
    { name: 'Northwind Apparel', slug: 'northwind-apparel' },
    { name: 'Circuit & Co', slug: 'circuit-and-co' },
    { name: 'HearthHome', slug: 'hearthhome' },
    { name: 'PureGlow', slug: 'pureglow' }
  ];
  const brands = [];
  for (const def of defs) {
    const brand = await BrandModel.findOneAndUpdate(
      { slug: def.slug },
      { $setOnInsert: { name: def.name, slug: def.slug, isActive: true } },
      { upsert: true, new: true }
    );
    brands.push(brand);
  }
  return { brands };
}

async function seedSellers() {
  const defs = [
    { storeName: 'Northwind Trading Co.', slug: 'northwind-trading', email: 'seller.northwind@example.test' },
    { storeName: 'Circuit Supply', slug: 'circuit-supply', email: 'seller.circuit@example.test' }
  ];
  const sellers = [];
  for (const def of defs) {
    let owner = await UserModel.findOne({ email: def.email });
    if (!owner) {
      owner = await UserModel.create({
        email: def.email,
        passwordHash: await hashPassword('DevPassword!2345'),
        roles: ['seller'],
        status: 'active',
        emailVerifiedAt: new Date()
      });
    }
    const seller = await SellerModel.findOneAndUpdate(
      { slug: def.slug },
      {
        $setOnInsert: {
          ownerUserId: owner._id,
          storeName: def.storeName,
          slug: def.slug,
          status: 'active',
          statusHistory: [{ status: 'active', changedAt: new Date(), note: 'Seed data: auto-approved' }]
        }
      },
      { upsert: true, new: true }
    );
    sellers.push(seller);
  }
  return { sellers };
}

interface SeedProductDef {
  name: string;
  slug: string;
  categorySlug: string;
  brandSlug: string;
  sellerIndex: number;
  description: string;
  /**
   * A specific, hand-picked, verified-resolving photo that actually depicts this product
   * (a real t-shirt, real over-ear headphones, a real ceramic pour-over dripper, a real
   * serum-with-dropper bottle) — not a random/generic stock photo. Not a real upload
   * (apps/api has no upload/object-storage endpoint — see README's known limitations);
   * these are Wikimedia Commons (CC BY / CC BY-SA, attribution in the comment below each
   * URL) and Pexels (free license) CDN links, chosen because both host images under terms
   * that permit this kind of reuse and serve them from a stable, always-on CDN.
   */
  imageUrl: string;
  variants: Array<{ sku: string; attributes: Record<string, string>; priceMinor: number; onHand: number }>;
}

async function seedProducts(categories: Awaited<ReturnType<typeof seedCategories>>['categories'], brands: Awaited<ReturnType<typeof seedBrands>>['brands'], sellers: Awaited<ReturnType<typeof seedSellers>>['sellers']) {
  const bySlug = <T extends { slug: string }>(arr: T[], slug: string) => {
    const found = arr.find((x) => x.slug === slug);
    if (!found) throw new Error(`Seed reference not found: ${slug}`);
    return found;
  };

  const defs: SeedProductDef[] = [
    {
      name: 'Classic Cotton Tee',
      slug: 'classic-cotton-tee',
      categorySlug: 'fashion',
      brandSlug: 'northwind-apparel',
      sellerIndex: 0,
      description: 'A breathable everyday cotton t-shirt.',
      // T-shirt-black.jpg, Wikimedia Commons, CC BY-SA 2.5: https://commons.wikimedia.org/wiki/File:T-shirt-black.jpg
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/08/T-shirt-black.jpg',
      variants: [
        { sku: 'TEE-BLK-M', attributes: { color: 'Black', size: 'M' }, priceMinor: 1999, onHand: 40 },
        { sku: 'TEE-BLK-L', attributes: { color: 'Black', size: 'L' }, priceMinor: 1999, onHand: 25 },
        { sku: 'TEE-WHT-M', attributes: { color: 'White', size: 'M' }, priceMinor: 1999, onHand: 0 }
      ]
    },
    {
      name: 'Wireless Noise-Cancelling Headphones',
      slug: 'wireless-noise-cancelling-headphones',
      categorySlug: 'electronics',
      brandSlug: 'circuit-and-co',
      sellerIndex: 1,
      description: 'Over-ear wireless headphones with active noise cancellation.',
      // Sennheiser HD 598 over-ear headphones, Wikimedia Commons, CC BY 2.0, photo by Tony Webster:
      // https://commons.wikimedia.org/wiki/File:Sennheiser_HD_598_over-ear_headphones_(31514940057).jpg
      imageUrl:
        'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ad/Sennheiser_HD_598_over-ear_headphones_%2831514940057%29.jpg/960px-Sennheiser_HD_598_over-ear_headphones_%2831514940057%29.jpg',
      variants: [
        { sku: 'HDPH-BLK', attributes: { color: 'Black' }, priceMinor: 14999, onHand: 15 },
        { sku: 'HDPH-SLV', attributes: { color: 'Silver' }, priceMinor: 14999, onHand: 8 }
      ]
    },
    {
      name: 'Ceramic Pour-Over Coffee Set',
      slug: 'ceramic-pour-over-coffee-set',
      categorySlug: 'home',
      brandSlug: 'hearthhome',
      sellerIndex: 0,
      description: 'A hand-glazed ceramic pour-over dripper and mug set.',
      // Melitta Ceramic Coffee Dripper, Wikimedia Commons, CC BY-SA 4.0, photo by Olga Ernst:
      // https://commons.wikimedia.org/wiki/File:Melitta_Ceramic_Coffee_Dripper.jpg
      imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e2/Melitta_Ceramic_Coffee_Dripper.jpg/960px-Melitta_Ceramic_Coffee_Dripper.jpg',
      variants: [{ sku: 'COFFEE-SET-01', attributes: {}, priceMinor: 3499, onHand: 60 }]
    },
    {
      name: 'Hydrating Vitamin C Serum',
      slug: 'hydrating-vitamin-c-serum',
      categorySlug: 'beauty',
      brandSlug: 'pureglow',
      sellerIndex: 1,
      description: 'A lightweight daily serum with 10% vitamin C.',
      // Minimalist skincare serum bottle flat lay, Pexels, free license, photo by N H Corp:
      // https://www.pexels.com/photo/minimalist-skincare-serum-bottle-flat-lay-31251033/
      imageUrl: 'https://images.pexels.com/photos/31251033/pexels-photo-31251033.jpeg?cs=tinysrgb&w=900',
      variants: [{ sku: 'SERUM-30ML', attributes: { size: '30ml' }, priceMinor: 2599, onHand: 100 }]
    }
  ];

  const products = [];
  for (const def of defs) {
    const category = bySlug(categories, def.categorySlug);
    const brand = bySlug(brands, def.brandSlug);
    const seller = sellers[def.sellerIndex]!;

    const product = await ProductModel.findOneAndUpdate(
      { slug: def.slug },
      {
        $setOnInsert: {
          sellerId: seller._id,
          categoryId: category._id,
          brandId: brand._id,
          name: def.name,
          slug: def.slug,
          description: def.description,
          moderationStatus: 'published'
        },
        // $set (not $setOnInsert): re-running the seed script refreshes the placeholder image on
        // products that already exist from an earlier seed run, rather than only setting it on first insert.
        $set: {
          images: [{ storageKey: def.imageUrl, altText: def.name, sortOrder: 0 }]
        }
      },
      { upsert: true, new: true }
    );

    for (const variantDef of def.variants) {
      const variant = await ProductVariantModel.findOneAndUpdate(
        { sellerId: seller._id, sku: variantDef.sku },
        {
          $setOnInsert: {
            productId: product._id,
            sellerId: seller._id,
            sku: variantDef.sku,
            attributes: variantDef.attributes,
            regularPrice: { amountMinor: variantDef.priceMinor, currency: 'USD' },
            status: 'active'
          }
        },
        { upsert: true, new: true }
      );

      await InventoryModel.findOneAndUpdate(
        { variantId: variant._id },
        { $setOnInsert: { variantId: variant._id, sellerId: seller._id, onHand: variantDef.onHand, reserved: 0 } },
        { upsert: true }
      );
    }

    await recomputeProductPriceAndStockCache(product._id.toString());
    products.push(product);
  }
  return { products };
}

async function seedCoupons() {
  await CouponModel.findOneAndUpdate(
    { code: 'WELCOME10' },
    {
      $setOnInsert: {
        code: 'WELCOME10',
        description: 'Demo coupon: 10% off, first order',
        discountType: 'percentage',
        percentageBasisPoints: 1000,
        maxDiscount: { amountMinor: 2000, currency: 'USD' },
        minOrderAmount: { amountMinor: 1000, currency: 'USD' },
        currency: 'USD',
        startsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isActive: true,
        usageLimit: 1000,
        perUserLimit: 1
      }
    },
    { upsert: true }
  );

  await CouponModel.findOneAndUpdate(
    { code: 'FLAT5' },
    {
      $setOnInsert: {
        code: 'FLAT5',
        description: 'Demo coupon: $5 off orders over $25',
        discountType: 'fixed_amount',
        discountValue: { amountMinor: 500, currency: 'USD' },
        minOrderAmount: { amountMinor: 2500, currency: 'USD' },
        currency: 'USD',
        startsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isActive: true,
        usageLimit: 500,
        perUserLimit: 2
      }
    },
    { upsert: true }
  );
}

async function seedPromotions(categories: Awaited<ReturnType<typeof seedCategories>>['categories']) {
  const electronics = categories.find((c) => c.slug === 'electronics');
  if (!electronics) return;

  await PromotionModel.findOneAndUpdate(
    { name: 'Electronics Flash Sale (Demo)' },
    {
      $setOnInsert: {
        name: 'Electronics Flash Sale (Demo)',
        description: 'Automatic 5% off electronics category, demo campaign',
        discountType: 'percentage',
        percentageBasisPoints: 500,
        currency: 'USD',
        eligibleCategoryIds: [electronics._id],
        startsAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        isActive: true,
        priority: 1
      }
    },
    { upsert: true }
  );
}

async function seedAddresses(customers: Awaited<ReturnType<typeof seedCustomers>>['customers']) {
  const addresses = [];
  for (const customer of customers) {
    let address = await AddressModel.findOne({ ownerUserId: customer._id });
    if (!address) {
      address = await AddressModel.create({
        ownerUserId: customer._id,
        label: 'home',
        isDefault: true,
        fields: {
          recipientName: customer.customerProfile?.displayName ?? 'Demo Customer',
          addressLine1: '123 Market Street',
          locality: 'Springfield',
          region: 'CA',
          postalCode: '94016',
          countryCode: 'US',
          phone: '+14155550123'
        }
      });
    }
    addresses.push(address);
  }
  return addresses;
}

async function seedOrders(
  customers: Awaited<ReturnType<typeof seedCustomers>>['customers'],
  products: Awaited<ReturnType<typeof seedProducts>>['products'],
  addresses: Awaited<ReturnType<typeof seedAddresses>>
) {
  const orders = [];

  // Order 1: delivered (eligible for review), customer 0.
  const customer0 = customers[0]!;
  const address0 = addresses[0]!;
  const product0 = products[0]!;
  const variant0 = await ProductVariantModel.findOne({ productId: product0._id }).sort({ sku: 1 });
  if (variant0) {
    let order = await OrderModel.findOne({ customerId: customer0._id, checkoutIdempotencyKey: 'seed-order-delivered' });
    if (!order) {
      order = await withTransaction(async (session) => {
        const [created] = await OrderModel.create(
          [
            {
              customerId: customer0._id,
              checkoutIdempotencyKey: 'seed-order-delivered',
              items: [
                {
                  productId: product0._id,
                  variantId: variant0._id,
                  sellerId: variant0.sellerId,
                  name: product0.name,
                  sku: variant0.sku,
                  attributes: variant0.attributes,
                  unitPrice: variant0.regularPrice,
                  discount: { amountMinor: 0, currency: 'USD' },
                  taxAmount: { amountMinor: 160, currency: 'USD' },
                  quantity: 1,
                  lineTotal: { amountMinor: variant0.regularPrice.amountMinor + 160, currency: 'USD' }
                }
              ],
              sellerIds: [variant0.sellerId],
              itemSubtotal: variant0.regularPrice,
              discountTotal: { amountMinor: 0, currency: 'USD' },
              taxTotal: { amountMinor: 160, currency: 'USD' },
              shippingTotal: { amountMinor: 500, currency: 'USD' },
              grandTotal: { amountMinor: variant0.regularPrice.amountMinor + 160 + 500, currency: 'USD' },
              shippingAddressSnapshot: address0.fields,
              paymentStatus: 'paid',
              fulfillmentStatus: 'delivered',
              statusHistory: [
                { track: 'payment', status: 'pending', changedAt: new Date(Date.now() - 10 * 86400000) },
                { track: 'payment', status: 'paid', changedAt: new Date(Date.now() - 10 * 86400000) },
                { track: 'fulfillment', status: 'pending', changedAt: new Date(Date.now() - 10 * 86400000) },
                { track: 'fulfillment', status: 'confirmed', changedAt: new Date(Date.now() - 9 * 86400000) },
                { track: 'fulfillment', status: 'shipped', changedAt: new Date(Date.now() - 7 * 86400000) },
                { track: 'fulfillment', status: 'delivered', changedAt: new Date(Date.now() - 4 * 86400000) }
              ],
              placedAt: new Date(Date.now() - 10 * 86400000)
            }
          ],
          { session }
        );
        const createdOrder = created!;
        await PaymentAttemptModel.create(
          [
            {
              orderId: createdOrder._id,
              provider: 'development',
              providerPaymentRef: 'dev_seed_1',
              amount: createdOrder.grandTotal,
              status: 'succeeded',
              idempotencyKey: 'seed-order-delivered-payment',
              confirmedAt: new Date(Date.now() - 10 * 86400000)
            }
          ],
          { session }
        );
        return createdOrder;
      });
    }
    orders.push(order!);
  }

  // Order 2: pending payment, customer 1.
  const customer1 = customers[1]!;
  const address1 = addresses[1]!;
  const product1 = products[1]!;
  const variant1 = await ProductVariantModel.findOne({ productId: product1._id }).sort({ sku: 1 });
  if (variant1) {
    let order = await OrderModel.findOne({ customerId: customer1._id, checkoutIdempotencyKey: 'seed-order-pending' });
    if (!order) {
      order = await OrderModel.create({
        customerId: customer1._id,
        checkoutIdempotencyKey: 'seed-order-pending',
        items: [
          {
            productId: product1._id,
            variantId: variant1._id,
            sellerId: variant1.sellerId,
            name: product1.name,
            sku: variant1.sku,
            attributes: variant1.attributes,
            unitPrice: variant1.regularPrice,
            discount: { amountMinor: 0, currency: 'USD' },
            taxAmount: { amountMinor: 1200, currency: 'USD' },
            quantity: 1,
            lineTotal: { amountMinor: variant1.regularPrice.amountMinor + 1200, currency: 'USD' }
          }
        ],
        sellerIds: [variant1.sellerId],
        itemSubtotal: variant1.regularPrice,
        discountTotal: { amountMinor: 0, currency: 'USD' },
        taxTotal: { amountMinor: 1200, currency: 'USD' },
        shippingTotal: { amountMinor: 0, currency: 'USD' },
        grandTotal: { amountMinor: variant1.regularPrice.amountMinor + 1200, currency: 'USD' },
        shippingAddressSnapshot: address1.fields,
        paymentStatus: 'pending',
        fulfillmentStatus: 'pending',
        statusHistory: [
          { track: 'payment', status: 'pending', changedAt: new Date() },
          { track: 'fulfillment', status: 'pending', changedAt: new Date() }
        ]
      });
    }
    orders.push(order!);
  }

  // Order 3: cancelled, customer 2.
  const customer2 = customers[2]!;
  const address2 = addresses[2]!;
  const product2 = products[2]!;
  const variant2 = await ProductVariantModel.findOne({ productId: product2._id });
  if (variant2) {
    let order = await OrderModel.findOne({ customerId: customer2._id, checkoutIdempotencyKey: 'seed-order-cancelled' });
    if (!order) {
      order = await OrderModel.create({
        customerId: customer2._id,
        checkoutIdempotencyKey: 'seed-order-cancelled',
        items: [
          {
            productId: product2._id,
            variantId: variant2._id,
            sellerId: variant2.sellerId,
            name: product2.name,
            sku: variant2.sku,
            attributes: variant2.attributes,
            unitPrice: variant2.regularPrice,
            discount: { amountMinor: 0, currency: 'USD' },
            taxAmount: { amountMinor: 280, currency: 'USD' },
            quantity: 1,
            lineTotal: { amountMinor: variant2.regularPrice.amountMinor + 280, currency: 'USD' }
          }
        ],
        sellerIds: [variant2.sellerId],
        itemSubtotal: variant2.regularPrice,
        discountTotal: { amountMinor: 0, currency: 'USD' },
        taxTotal: { amountMinor: 280, currency: 'USD' },
        shippingTotal: { amountMinor: 500, currency: 'USD' },
        grandTotal: { amountMinor: variant2.regularPrice.amountMinor + 280 + 500, currency: 'USD' },
        shippingAddressSnapshot: address2.fields,
        paymentStatus: 'cancelled',
        fulfillmentStatus: 'cancelled',
        statusHistory: [
          { track: 'payment', status: 'pending', changedAt: new Date(Date.now() - 2 * 86400000) },
          { track: 'payment', status: 'cancelled', changedAt: new Date(Date.now() - 1 * 86400000) },
          { track: 'fulfillment', status: 'pending', changedAt: new Date(Date.now() - 2 * 86400000) },
          { track: 'fulfillment', status: 'cancelled', changedAt: new Date(Date.now() - 1 * 86400000) }
        ],
        cancelledAt: new Date(Date.now() - 1 * 86400000),
        cancelReason: 'Customer requested cancellation (seed data)'
      });
    }
    orders.push(order!);
  }

  return orders;
}

async function seedReviews(customers: Awaited<ReturnType<typeof seedCustomers>>['customers'], orders: OrderModelDoc[]) {
  const deliveredOrder = orders.find((o) => o && o.fulfillmentStatus === 'delivered');
  if (!deliveredOrder) return;

  const firstItem = deliveredOrder.items[0];
  if (!firstItem) return;

  await ReviewModel.findOneAndUpdate(
    { orderId: deliveredOrder._id, orderItemVariantId: firstItem.variantId },
    {
      $setOnInsert: {
        productId: firstItem.productId,
        customerId: deliveredOrder.customerId,
        orderId: deliveredOrder._id,
        orderItemVariantId: firstItem.variantId,
        rating: 5,
        title: 'Great quality (demo review)',
        body: 'This is seeded demo review content for local development only.',
        moderationStatus: 'approved',
        isDemoData: true
      }
    },
    { upsert: true }
  );

  // Every other path that creates an approved review recomputes the product's cached
  // ratingAggregate (review.repository.ts); this upsert bypassed that, leaving the
  // seeded product's displayed rating permanently stuck at 0/0 despite a real approved
  // review existing — found while manually verifying the AI review-summary endpoint.
  await recomputeRatingAggregate(firstItem.productId.toString());
}

type OrderModelDoc = Awaited<ReturnType<typeof seedOrders>>[number];

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});
