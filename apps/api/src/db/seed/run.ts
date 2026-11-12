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
    { name: 'PureGlow', slug: 'pureglow' },
    { name: 'FreshFields Market', slug: 'freshfields-market' },
    { name: 'Lantern Press', slug: 'lantern-press' },
    { name: 'TrailForge Sports', slug: 'trailforge-sports' }
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
    { storeName: 'Circuit Supply', slug: 'circuit-supply', email: 'seller.circuit@example.test' },
    { storeName: 'Harvest Grocers', slug: 'harvest-grocers', email: 'seller.harvest@example.test' }
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
   * A specific, hand-picked photo that actually depicts this product (a real t-shirt, real
   * over-ear headphones, a real ceramic pour-over dripper, a real serum-with-dropper bottle)
   * — not a random/generic stock photo.
   *
   * Each one is served from this API's own `public/products/` as an 800px-square PNG whose
   * background has been removed, so the catalog renders as consistent cut-outs on whatever
   * surface the client paints behind them (the mobile app's product tiles are a grey panel).
   * Still not a real upload — apps/api has no upload/object-storage endpoint (see README's
   * known limitations) — these are fixture assets committed alongside the seed.
   *
   * Every cut-out is a derivative of a freely licensed original (Wikimedia Commons CC BY /
   * CC BY-SA / CC0 / public domain, or Pexels free license); the original is credited in the
   * comment above each URL, and those credits carry over to the derivative.
   */
  imageUrl: string;
  variants: Array<{ sku: string; attributes: Record<string, string>; priceMinor: number; onHand: number }>;
}

const assetBaseUrl = getEnv().ASSET_BASE_URL.replace(/\/$/, '');

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
      imageUrl: `${assetBaseUrl}/static/products/classic-cotton-tee.png`,
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
      // Cut-out of Action-Max-Stereo-Headphones.jpg, Wikimedia Commons, Public domain, by Evan-Amos:
      // https://commons.wikimedia.org/wiki/File%3AAction-Max-Stereo-Headphones.jpg
      imageUrl: `${assetBaseUrl}/static/products/wireless-noise-cancelling-headphones.png`,
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
      imageUrl: `${assetBaseUrl}/static/products/ceramic-pour-over-coffee-set.png`,
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
      imageUrl: `${assetBaseUrl}/static/products/hydrating-vitamin-c-serum.png`,
      variants: [{ sku: 'SERUM-30ML', attributes: { size: '30ml' }, priceMinor: 2599, onHand: 100 }]
    },
    // --- Fashion: dresses + one accessory + one pair of shoes, sellerIndex 0 (Northwind Trading Co.) ---
    {
      name: 'Little Black Evening Dress',
      slug: 'little-black-evening-dress',
      categorySlug: 'fashion',
      brandSlug: 'northwind-apparel',
      sellerIndex: 0,
      description: 'A fitted black evening dress in flowing jersey, cut for a flattering silhouette day to night.',
      // Little Black Dress (Unsplash), Wikimedia Commons, CC0, photo by Kira Ikonnikova:
      // https://commons.wikimedia.org/wiki/File:Little_Black_Dress_(Unsplash).jpg
      imageUrl: `${assetBaseUrl}/static/products/little-black-evening-dress.png`,
      variants: [
        { sku: 'DRS-BLK-S', attributes: { color: 'Black', size: 'S' }, priceMinor: 4999, onHand: 30 },
        { sku: 'DRS-BLK-M', attributes: { color: 'Black', size: 'M' }, priceMinor: 4999, onHand: 35 },
        { sku: 'DRS-BLK-L', attributes: { color: 'Black', size: 'L' }, priceMinor: 4999, onHand: 18 }
      ]
    },
    {
      name: 'Floral Print Summer Dress',
      slug: 'floral-print-summer-dress',
      categorySlug: 'fashion',
      brandSlug: 'northwind-apparel',
      sellerIndex: 0,
      description: 'A lightweight floral midi dress with adjustable straps, made for warm-weather days.',
      // Laughing woman in floral dress (Unsplash), Wikimedia Commons, CC0, photo by Brooke Cagle:
      // https://commons.wikimedia.org/wiki/File:Laughing_woman_in_floral_dress_(Unsplash).jpg
      imageUrl: `${assetBaseUrl}/static/products/floral-print-summer-dress.png`,
      variants: [
        { sku: 'DRS-FLR-S', attributes: { color: 'Floral', size: 'S' }, priceMinor: 3899, onHand: 28 },
        { sku: 'DRS-FLR-M', attributes: { color: 'Floral', size: 'M' }, priceMinor: 3899, onHand: 32 },
        { sku: 'DRS-FLR-L', attributes: { color: 'Floral', size: 'L' }, priceMinor: 3899, onHand: 14 }
      ]
    },
    {
      name: 'Patterned Midi Dress',
      slug: 'patterned-midi-dress',
      categorySlug: 'fashion',
      brandSlug: 'northwind-apparel',
      sellerIndex: 0,
      description: 'A patterned midi dress with a fitted bodice and a flared skirt, suited to both day and evening wear.',
      // Summer dress, Wikimedia Commons, public domain (USAID Africa Bureau):
      // https://commons.wikimedia.org/wiki/File:Summer_dress_(5634765615).jpg
      imageUrl: `${assetBaseUrl}/static/products/patterned-midi-dress.png`,
      variants: [
        { sku: 'DRS-PTN-S', attributes: { size: 'S' }, priceMinor: 4499, onHand: 20 },
        { sku: 'DRS-PTN-M', attributes: { size: 'M' }, priceMinor: 4499, onHand: 24 },
        { sku: 'DRS-PTN-L', attributes: { size: 'L' }, priceMinor: 4499, onHand: 11 }
      ]
    },
    {
      name: 'Handcrafted Leather Satchel Bag',
      slug: 'handcrafted-leather-satchel-bag',
      categorySlug: 'fashion',
      brandSlug: 'northwind-apparel',
      sellerIndex: 0,
      description: 'A hand-stitched full-grain leather satchel with an adjustable strap and a flap closure.',
      // Leather handbag by Les cuirs d'Agathe (DSC07738), Wikimedia Commons, CC BY 4.0, photo by Trougnouf (Benoit Brummer):
      // https://commons.wikimedia.org/wiki/File:Leather_handbag_by_Les_cuirs_d%27Agathe_(DSC07738).jpg
      imageUrl: `${assetBaseUrl}/static/products/handcrafted-leather-satchel-bag.png`,
      variants: [{ sku: 'BAG-LTHR-COG', attributes: { color: 'Cognac' }, priceMinor: 8999, onHand: 15 }]
    },
    {
      name: 'Classic White Canvas Sneakers',
      slug: 'classic-white-canvas-sneakers',
      categorySlug: 'fashion',
      brandSlug: 'northwind-apparel',
      sellerIndex: 0,
      description: 'Everyday platform canvas sneakers with a lace-up front and a durable rubber sole.',
      // Superga COTW LINEA UP & DOWN Sneaker, Wikimedia Commons, CC BY 2.0, photo by SPERA.de Designerschuhe:
      // https://commons.wikimedia.org/wiki/File:Superga_COTW_LINEA_UP_%26_DOWN_Sneaker_mit_Plateau_2790A_Canvas_wei%C3%9F_(white)_(1).jpg
      imageUrl: `${assetBaseUrl}/static/products/classic-white-canvas-sneakers.png`,
      variants: [
        { sku: 'SNK-WHT-8', attributes: { color: 'White', size: '8' }, priceMinor: 5499, onHand: 26 },
        { sku: 'SNK-WHT-9', attributes: { color: 'White', size: '9' }, priceMinor: 5499, onHand: 30 },
        { sku: 'SNK-WHT-10', attributes: { color: 'White', size: '10' }, priceMinor: 5499, onHand: 19 }
      ]
    },
    // --- Groceries, sellerIndex 2 (Harvest Grocers) ---
    {
      name: 'Sliced Whole Wheat Bread',
      slug: 'sliced-whole-wheat-bread',
      categorySlug: 'groceries',
      brandSlug: 'freshfields-market',
      sellerIndex: 2,
      description: 'A fresh-baked whole wheat loaf, sliced and ready for sandwiches or toast.',
      // Fresh made bread 05, Wikimedia Commons, CC BY-SA 4.0, photo by FranHogan:
      // https://commons.wikimedia.org/wiki/File:Fresh_made_bread_05.jpg
      imageUrl: `${assetBaseUrl}/static/products/sliced-whole-wheat-bread.png`,
      variants: [{ sku: 'GRO-BREAD-WW', attributes: { size: '680g loaf' }, priceMinor: 349, onHand: 80 }]
    },
    {
      name: 'Farm Fresh Eggs (Dozen)',
      slug: 'farm-fresh-eggs-dozen',
      categorySlug: 'groceries',
      brandSlug: 'freshfields-market',
      sellerIndex: 2,
      description: 'A dozen farm-fresh grade-A eggs, carton-packed for safe delivery.',
      // Egg cartons with chicken eggs 03, Wikimedia Commons, CC BY-SA 4.0, photo by Krzysztof Golik:
      // https://commons.wikimedia.org/wiki/File:Egg_cartons_with_chicken_eggs_03.jpg
      imageUrl: `${assetBaseUrl}/static/products/farm-fresh-eggs-dozen.png`,
      variants: [{ sku: 'GRO-EGGS-12', attributes: { size: '12-count' }, priceMinor: 429, onHand: 70 }]
    },
    {
      name: 'Fresh Red Bell Peppers (3-Pack)',
      slug: 'fresh-red-bell-peppers-3-pack',
      categorySlug: 'groceries',
      brandSlug: 'freshfields-market',
      sellerIndex: 2,
      description: 'Three crisp, ripe red bell peppers, sold by the pack.',
      // Cut-out of Red bell pepper.jpg, Wikimedia Commons, CC BY-SA 4.0, by AntanO:
      // https://commons.wikimedia.org/wiki/File%3ARed_bell_pepper.jpg
      imageUrl: `${assetBaseUrl}/static/products/fresh-red-bell-peppers-3-pack.png`,
      variants: [{ sku: 'GRO-PEPPER-3PK', attributes: { size: '3-pack' }, priceMinor: 399, onHand: 65 }]
    },
    {
      name: 'Fresh Bananas (Bunch)',
      slug: 'fresh-bananas-bunch',
      categorySlug: 'groceries',
      brandSlug: 'freshfields-market',
      sellerIndex: 2,
      description: 'A bunch of ripe, ready-to-eat bananas.',
      // Bunch of bananas on sale, Wikimedia Commons, CC0, photo by Wilfredor:
      // https://commons.wikimedia.org/wiki/File:Bunch_of_bananas_on_sale.jpg
      imageUrl: `${assetBaseUrl}/static/products/fresh-bananas-bunch.png`,
      variants: [{ sku: 'GRO-BANANA-BUNCH', attributes: { size: '~1.5kg bunch' }, priceMinor: 199, onHand: 90 }]
    },
    {
      name: 'Fresh Mandarin Oranges (Bag)',
      slug: 'fresh-mandarin-oranges-bag',
      categorySlug: 'groceries',
      brandSlug: 'freshfields-market',
      sellerIndex: 2,
      description: 'A bag of sweet, juicy mandarin oranges.',
      // Pile of mandarin oranges on red cloth, Indonesia, Wikimedia Commons, CC BY-SA 4.0, photo by Undeka 11:
      // https://commons.wikimedia.org/wiki/File:Pile_of_mandarin_oranges_on_red_cloth,_Indonesia.jpg
      imageUrl: `${assetBaseUrl}/static/products/fresh-mandarin-oranges-bag.png`,
      variants: [{ sku: 'GRO-MANDARIN-1KG', attributes: { size: '1kg bag' }, priceMinor: 449, onHand: 55 }]
    },
    // --- Beauty, brandSlug pureglow, sellerIndex 1 (Circuit Supply, matching the existing serum entry) ---
    {
      name: 'Everyday Volumizing Shampoo',
      slug: 'everyday-volumizing-shampoo',
      categorySlug: 'beauty',
      brandSlug: 'pureglow',
      sellerIndex: 1,
      description: 'A sulfate-free daily shampoo that adds volume without weighing hair down.',
      // Shampoo Bottle made of PLA-Blend Bio-Flex, Wikimedia Commons, CC BY-SA 2.0 de, photo by F. Kesselring, FKuR Willich:
      // https://commons.wikimedia.org/wiki/File:Shampoo_Bottle_made_of_PLA-Blend_Bio-Flex.jpg
      imageUrl: `${assetBaseUrl}/static/products/everyday-volumizing-shampoo.png`,
      variants: [{ sku: 'BTY-SHMP-300', attributes: { size: '300ml' }, priceMinor: 899, onHand: 60 }]
    },
    {
      name: 'Floral Eau de Parfum',
      slug: 'floral-eau-de-parfum',
      categorySlug: 'beauty',
      brandSlug: 'pureglow',
      sellerIndex: 1,
      description: 'A light floral eau de parfum in a glass flacon, suited to everyday wear.',
      // Cut-out of Rain - Eau de Parfum, by Clean classic 2.jpg, Wikimedia Commons, CC BY 4.0, by W.carter:
      // https://commons.wikimedia.org/wiki/File%3ARain_-_Eau_de_Parfum%2C_by_Clean_classic_2.jpg
      imageUrl: `${assetBaseUrl}/static/products/floral-eau-de-parfum.png`,
      variants: [{ sku: 'BTY-PERF-50', attributes: { size: '50ml' }, priceMinor: 3499, onHand: 24 }]
    },
    {
      name: 'Purifying Charcoal Face Mask',
      slug: 'purifying-charcoal-face-mask',
      categorySlug: 'beauty',
      brandSlug: 'pureglow',
      sellerIndex: 1,
      description: 'A deep-cleansing activated charcoal mask that draws out impurities.',
      // Activated charcoal mask in glass jar, CC0, via Rawpixel/Openverse (no attribution required).
      imageUrl: `${assetBaseUrl}/static/products/purifying-charcoal-face-mask.png`,
      variants: [{ sku: 'BTY-MASK-50', attributes: { size: '50g' }, priceMinor: 1499, onHand: 45 }]
    },
    {
      name: 'Tinted Rose Lip Balm',
      slug: 'tinted-rose-lip-balm',
      categorySlug: 'beauty',
      brandSlug: 'pureglow',
      sellerIndex: 1,
      description: 'A moisturizing lip balm with a sheer rose tint.',
      // Pink homemade-style lip balm pot, CC0, via Rawpixel/Openverse (no attribution required).
      imageUrl: `${assetBaseUrl}/static/products/tinted-rose-lip-balm.png`,
      variants: [{ sku: 'BTY-LIPB-ROSE', attributes: { shade: 'Rose' }, priceMinor: 599, onHand: 90 }]
    },
    // --- Books, brandSlug lantern-press, sellerIndex 0 (Northwind Trading Co.) ---
    {
      name: 'Linen Hardcover Journal',
      slug: 'linen-hardcover-journal',
      categorySlug: 'books',
      brandSlug: 'lantern-press',
      sellerIndex: 0,
      description: 'A blank hardcover journal bound in natural linen cloth, for notes or a daily diary.',
      // Cut-out of " 12 - ITALY - MOLESKINE - notebook - pocket book - agenda 2012 3 black.JPG, Wikimedia Commons, CC BY-SA 3.0 it, by Pava:
      // https://commons.wikimedia.org/wiki/File%3A%22_12_-_ITALY_-_MOLESKINE_-_notebook_-_pocket_book_-_agenda_2012_3_black.JPG
      imageUrl: `${assetBaseUrl}/static/products/linen-hardcover-journal.png`,
      variants: [{ sku: 'BK-JRNL-LINEN', attributes: {}, priceMinor: 2499, onHand: 40 }]
    },
    {
      name: 'Golden-Paged Classic Novel',
      slug: 'golden-paged-classic-novel',
      categorySlug: 'books',
      brandSlug: 'lantern-press',
      sellerIndex: 0,
      description: 'A gift-edition hardcover novel with gilded page edges.',
      // Open book with gilded pages, CC0, via Rawpixel/Openverse (no attribution required).
      imageUrl: `${assetBaseUrl}/static/products/golden-paged-classic-novel.png`,
      variants: [{ sku: 'BK-NOVL-GOLD', attributes: {}, priceMinor: 1299, onHand: 55 }]
    },
    {
      name: 'Ruled Pocket Notebook',
      slug: 'ruled-pocket-notebook',
      categorySlug: 'books',
      brandSlug: 'lantern-press',
      sellerIndex: 0,
      description: 'A ruled pocket notebook with an elastic closure band, sized for a bag or coat pocket.',
      // Open ruled notebook with pen on a desk, CC0, via Rawpixel/Openverse (no attribution required).
      imageUrl: `${assetBaseUrl}/static/products/ruled-pocket-notebook.png`,
      variants: [{ sku: 'BK-NTBK-RULED', attributes: {}, priceMinor: 799, onHand: 75 }]
    },
    {
      name: 'Illustrated Family Cookbook',
      slug: 'illustrated-family-cookbook',
      categorySlug: 'books',
      brandSlug: 'lantern-press',
      sellerIndex: 0,
      description: 'A numbered-recipe family cookbook covering everyday home cooking.',
      // Cut-out of Mrs. Welch's Cookbook, published in 1884.jpg, Wikimedia Commons, Public domain, by Unknown authorUnknown author:
      // https://commons.wikimedia.org/wiki/File%3AMrs._Welch%27s_Cookbook%2C_published_in_1884.jpg
      imageUrl: `${assetBaseUrl}/static/products/illustrated-family-cookbook.png`,
      variants: [{ sku: 'BK-COOK-FAM', attributes: {}, priceMinor: 1999, onHand: 38 }]
    },
    {
      name: 'Assorted Paperback Fiction Bundle',
      slug: 'assorted-paperback-fiction-bundle',
      categorySlug: 'books',
      brandSlug: 'lantern-press',
      sellerIndex: 0,
      description: 'A curated bundle of five assorted paperback fiction titles.',
      // Cut-out of Books-on-Table-SGBerlin.png, Wikimedia Commons, CC BY-SA 4.0, by Studio GOOD Berlin:
      // https://commons.wikimedia.org/wiki/File%3ABooks-on-Table-SGBerlin.png
      imageUrl: `${assetBaseUrl}/static/products/assorted-paperback-fiction-bundle.png`,
      variants: [{ sku: 'BK-BUNDLE-5PK', attributes: { size: '5-book set' }, priceMinor: 2299, onHand: 22 }]
    },
    // --- Electronics, brandSlug circuit-and-co, sellerIndex 1 (Circuit Supply, matching the existing headphones) ---
    {
      name: 'Portable Bluetooth Speaker',
      slug: 'portable-bluetooth-speaker',
      categorySlug: 'electronics',
      brandSlug: 'circuit-and-co',
      sellerIndex: 1,
      description: 'A compact portable Bluetooth speaker for everyday listening.',
      // Cut-out of Jamo Power 250R Hi-Fi box from 1980s - with white frame.jpg, Wikimedia Commons, CC BY-SA 4.0, by Pittigrilli:
      // https://commons.wikimedia.org/wiki/File%3AJamo_Power_250R_Hi-Fi_box_from_1980s_-_with_white_frame.jpg
      imageUrl: `${assetBaseUrl}/static/products/portable-bluetooth-speaker.png`,
      variants: [{ sku: 'ELC-SPKR-BLK', attributes: { color: 'Black' }, priceMinor: 3999, onHand: 32 }]
    },
    {
      name: 'Round Dial Smartwatch',
      slug: 'round-dial-smartwatch',
      categorySlug: 'electronics',
      brandSlug: 'circuit-and-co',
      sellerIndex: 1,
      description: 'A round-dial smartwatch with a metal band and customizable watch faces.',
      // Cut-out of Montre en bois DWYT.jpg, Wikimedia Commons, CC BY-SA 4.0, by Dwyt watch:
      // https://commons.wikimedia.org/wiki/File%3AMontre_en_bois_DWYT.jpg
      imageUrl: `${assetBaseUrl}/static/products/round-dial-smartwatch.png`,
      variants: [{ sku: 'ELC-WATCH-RND', attributes: {}, priceMinor: 8999, onHand: 17 }]
    },
    {
      name: 'Wireless Optical Mouse',
      slug: 'wireless-optical-mouse',
      categorySlug: 'electronics',
      brandSlug: 'circuit-and-co',
      sellerIndex: 1,
      description: 'A 2.4GHz wireless optical mouse with a comfortable contoured grip.',
      // Black wireless computer mouse on a desk, CC0, via Rawpixel/Openverse (no attribution required).
      imageUrl: `${assetBaseUrl}/static/products/wireless-optical-mouse.png`,
      variants: [{ sku: 'ELC-MOUSE-BLK', attributes: { color: 'Black' }, priceMinor: 1999, onHand: 50 }]
    },
    {
      name: 'USB-C Fast Wall Charger',
      slug: 'usb-c-fast-wall-charger',
      categorySlug: 'electronics',
      brandSlug: 'circuit-and-co',
      sellerIndex: 1,
      description: 'A compact USB-C fast-charging wall adapter with a 1.2m braided cable.',
      // Cut-out of Casio-PV-1000-Power-Supply.jpg, Wikimedia Commons, Public domain, by Evan-Amos:
      // https://commons.wikimedia.org/wiki/File%3ACasio-PV-1000-Power-Supply.jpg
      imageUrl: `${assetBaseUrl}/static/products/usb-c-fast-wall-charger.png`,
      variants: [{ sku: 'ELC-CHRG-USBC', attributes: {}, priceMinor: 2499, onHand: 65 }]
    },
    // --- Home, brandSlug hearthhome, sellerIndex 0 (Northwind Trading Co., matching the existing coffee set) ---
    {
      name: 'Soy Wax Glass Jar Candle',
      slug: 'soy-wax-glass-jar-candle',
      categorySlug: 'home',
      brandSlug: 'hearthhome',
      sellerIndex: 0,
      description: 'A hand-poured soy wax candle in a clear glass jar with a cotton wick.',
      // Single plain soy candle, Wikimedia Commons, CC BY-SA 2.0, photo by mikehipp:
      // https://commons.wikimedia.org/wiki/File:Single_plain_soy_candle.jpg
      imageUrl: `${assetBaseUrl}/static/products/soy-wax-glass-jar-candle.png`,
      variants: [{ sku: 'HOM-CNDL-SOY', attributes: {}, priceMinor: 1699, onHand: 55 }]
    },
    {
      name: 'Multicolor Cotton Bath Towel Set',
      slug: 'multicolor-cotton-bath-towel-set',
      categorySlug: 'home',
      brandSlug: 'hearthhome',
      sellerIndex: 0,
      description: 'A five-piece set of soft cotton hand towels in assorted colors.',
      // Zusammengelegte Handtücher (folded towels), Wikimedia Commons, public domain, photo by User:Mattes:
      // https://commons.wikimedia.org/wiki/File:Zusammengelegte_Handt%C3%BCcher.jpg
      imageUrl: `${assetBaseUrl}/static/products/multicolor-cotton-bath-towel-set.png`,
      variants: [{ sku: 'HOM-TWL-5PK', attributes: { size: '5-piece set' }, priceMinor: 2999, onHand: 34 }]
    },
    {
      name: 'Hand-Glazed Ceramic Vase',
      slug: 'hand-glazed-ceramic-vase',
      categorySlug: 'home',
      brandSlug: 'hearthhome',
      sellerIndex: 0,
      description: 'A hand-glazed ceramic vase with a rounded body, suited to dried or fresh stems.',
      // Elegant minimalist white ceramic vase, CC0, via Rawpixel/Openverse (no attribution required).
      imageUrl: `${assetBaseUrl}/static/products/hand-glazed-ceramic-vase.png`,
      variants: [{ sku: 'HOM-VASE-CER', attributes: {}, priceMinor: 2799, onHand: 26 }]
    },
    {
      name: 'Copper Pendant Bedside Lamp',
      slug: 'copper-pendant-bedside-lamp',
      categorySlug: 'home',
      brandSlug: 'hearthhome',
      sellerIndex: 0,
      description: 'A minimalist copper-finish pendant lamp for a nightstand or reading corner.',
      // Cut-out of Jaren 80 – 2009-046-294 (9624486954).jpg, Wikimedia Commons, CC0, by Studio Alijn:
      // https://commons.wikimedia.org/wiki/File%3AJaren_80_%E2%80%93_2009-046-294_%289624486954%29.jpg
      imageUrl: `${assetBaseUrl}/static/products/copper-pendant-bedside-lamp.png`,
      variants: [{ sku: 'HOM-LAMP-CPR', attributes: {}, priceMinor: 4499, onHand: 19 }]
    },
    // --- Sports, brandSlug trailforge-sports, sellerIndex 0 (Northwind Trading Co.) ---
    {
      name: 'Non-Slip Yoga Mat',
      slug: 'non-slip-yoga-mat',
      categorySlug: 'sports',
      brandSlug: 'trailforge-sports',
      sellerIndex: 0,
      description: 'A 5mm non-slip yoga mat with a textured surface for grip.',
      // Rolled teal yoga mat, CC0, via Rawpixel/Openverse (no attribution required).
      imageUrl: `${assetBaseUrl}/static/products/non-slip-yoga-mat.png`,
      variants: [{ sku: 'SPT-YOGA-TEAL', attributes: { color: 'Teal' }, priceMinor: 1899, onHand: 48 }]
    },
    {
      name: 'Adjustable Dumbbell Set',
      slug: 'adjustable-dumbbell-set',
      categorySlug: 'sports',
      brandSlug: 'trailforge-sports',
      sellerIndex: 0,
      description: 'A pair of adjustable-weight dumbbells for home strength training.',
      // Adjustable dumbbells on a gym floor, CC0, via Rawpixel/Openverse (no attribution required).
      imageUrl: `${assetBaseUrl}/static/products/adjustable-dumbbell-set.png`,
      variants: [{ sku: 'SPT-DMBL-PAIR', attributes: { size: 'Pair' }, priceMinor: 5499, onHand: 21 }]
    },
    {
      name: 'Official Size Basketball',
      slug: 'official-size-basketball',
      categorySlug: 'sports',
      brandSlug: 'trailforge-sports',
      sellerIndex: 0,
      description: 'An official size-7 basketball with a durable rubber cover for indoor or outdoor play.',
      // Basketball on grass, CC0, via Rawpixel/Openverse (no attribution required).
      imageUrl: `${assetBaseUrl}/static/products/official-size-basketball.png`,
      variants: [{ sku: 'SPT-BBALL-7', attributes: { size: '7' }, priceMinor: 2199, onHand: 40 }]
    },
    {
      name: 'Insulated Sports Water Bottle',
      slug: 'insulated-sports-water-bottle',
      categorySlug: 'sports',
      brandSlug: 'trailforge-sports',
      sellerIndex: 0,
      description: 'A leak-proof insulated water bottle with a flip-top straw lid.',
      // Pink insulated sports water bottle, CC0, via Rawpixel/Openverse (no attribution required).
      imageUrl: `${assetBaseUrl}/static/products/insulated-sports-water-bottle.png`,
      variants: [{ sku: 'SPT-BTL-PINK', attributes: { color: 'Pink' }, priceMinor: 1199, onHand: 58 }]
    },
    {
      name: 'Match Soccer Ball',
      slug: 'match-soccer-ball',
      categorySlug: 'sports',
      brandSlug: 'trailforge-sports',
      sellerIndex: 0,
      description: 'A size-5 match-quality soccer ball for training or play.',
      // Cut-out of UEFA Euro 2024 Match Ball Fussballliebe.jpg, Wikimedia Commons, CC0, by Bildersindtoll:
      // https://commons.wikimedia.org/wiki/File%3AUEFA_Euro_2024_Match_Ball_Fussballliebe.jpg
      imageUrl: `${assetBaseUrl}/static/products/match-soccer-ball.png`,
      variants: [{ sku: 'SPT-SOCCER-5', attributes: { size: '5' }, priceMinor: 1999, onHand: 44 }]
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
  const bySlug = (slug: string) => categories.find((c) => c.slug === slug);
  const days = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

  /**
   * Demo campaigns, surfaced by GET /promotions and applied automatically at
   * checkout by pricing.service.ts — the storefront's "Special Offers" screen
   * renders exactly these, so there is no invented promo copy in the client.
   */
  const demos = [
    {
      name: 'Electronics Flash Sale (Demo)',
      description: 'Automatic 5% off electronics category, demo campaign',
      categorySlug: 'electronics',
      percentageBasisPoints: 500,
      startsAt: days(-1),
      expiresAt: days(14),
      priority: 1
    },
    {
      name: 'Fashion Week Deal (Demo)',
      description: 'Automatic 20% off everything in fashion, demo campaign',
      categorySlug: 'fashion',
      percentageBasisPoints: 2000,
      startsAt: days(-2),
      expiresAt: days(10),
      priority: 3
    },
    {
      name: 'Home Refresh (Demo)',
      description: 'Automatic 15% off home and kitchen, demo campaign',
      categorySlug: 'home',
      percentageBasisPoints: 1500,
      startsAt: days(-3),
      expiresAt: days(21),
      priority: 2
    },
    {
      name: 'Reading Week (Demo)',
      description: 'Automatic 10% off books, demo campaign',
      categorySlug: 'books',
      percentageBasisPoints: 1000,
      startsAt: days(-1),
      expiresAt: days(7),
      priority: 0
    }
  ];

  for (const demo of demos) {
    const category = bySlug(demo.categorySlug);
    if (!category) continue;
    await PromotionModel.findOneAndUpdate(
      { name: demo.name },
      {
        $setOnInsert: {
          name: demo.name,
          discountType: 'percentage',
          currency: 'USD',
          eligibleCategoryIds: [category._id],
          isActive: true
        },
        // $set so re-running the seed slides the demo windows forward instead of
        // leaving campaigns that have since expired sitting inactive.
        $set: {
          description: demo.description,
          percentageBasisPoints: demo.percentageBasisPoints,
          startsAt: demo.startsAt,
          expiresAt: demo.expiresAt,
          priority: demo.priority
        }
      },
      { upsert: true }
    );
  }
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
