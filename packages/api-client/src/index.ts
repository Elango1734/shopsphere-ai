import { ApiClient, type ApiClientConfig } from './core.js';
import { createAuthModule } from './modules/auth.js';
import { createProfileModule } from './modules/profile.js';
import { createCatalogModule } from './modules/catalog.js';
import { createDiscoveryModule } from './modules/discovery.js';
import { createCartModule } from './modules/cart.js';
import { createCheckoutModule } from './modules/checkout.js';
import { createOrdersModule } from './modules/orders.js';
import { createReviewsModule } from './modules/reviews.js';
import { createSupportModule } from './modules/support.js';
import { createNotificationsModule } from './modules/notifications.js';
import { createAiModule } from './modules/ai.js';
import { createAnalyticsModule } from './modules/analytics.js';
import { createAdminModule } from './modules/admin.js';
import { createSellerModule } from './modules/seller.js';
import { createSupportAgentModule } from './modules/supportAgent.js';

export * from './core.js';
export * from './types.js';
export * from './modules/auth.js';
export * from './modules/profile.js';
export * from './modules/catalog.js';
export * from './modules/cart.js';
export * from './modules/analytics.js';
export * from './modules/checkout.js';
export * from './modules/orders.js';
export * from './modules/reviews.js';
export * from './modules/support.js';
export * from './modules/admin.js';
export * from './modules/seller.js';
export * from './modules/supportAgent.js';

/**
 * The ONLY way an app in this monorepo talks to the API. It holds no
 * credentials of its own (see `ApiClientConfig.getAccessToken` — the caller
 * owns and supplies the token) and carries no business authority: it is pure
 * transport over the documented `/api/v1` contract (architecture.md).
 */
export function createApiClient(config: ApiClientConfig) {
  const client = new ApiClient(config);
  return {
    auth: createAuthModule(client),
    profile: createProfileModule(client),
    catalog: createCatalogModule(client),
    discovery: createDiscoveryModule(client),
    cart: createCartModule(client),
    checkout: createCheckoutModule(client),
    orders: createOrdersModule(client),
    reviews: createReviewsModule(client),
    support: createSupportModule(client),
    notifications: createNotificationsModule(client),
    ai: createAiModule(client),
    analytics: createAnalyticsModule(client),
    admin: createAdminModule(client),
    seller: createSellerModule(client),
    supportAgent: createSupportAgentModule(client)
  };
}

export type ShopSphereApiClient = ReturnType<typeof createApiClient>;
