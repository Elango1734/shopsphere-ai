import type { ApiClient } from '../core.js';
import type { RecentlyViewedItemDto, WishlistItemDto } from '../types.js';

export function createDiscoveryModule(client: ApiClient) {
  return {
    getWishlist: () => client.request<WishlistItemDto[]>('GET', '/wishlist'),
    toggleWishlist: (productId: string, variantId?: string) =>
      client.request<{ action: 'added' | 'removed' }>('POST', '/wishlist/toggle', { productId, variantId }),
    getRecentlyViewed: () => client.request<RecentlyViewedItemDto[]>('GET', '/recently-viewed')
  };
}
