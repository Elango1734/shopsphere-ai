import type { ApiClient } from '../core.js';
import type { CartDto } from '../types.js';

export function createCartModule(client: ApiClient) {
  return {
    getCart: () => client.request<CartDto>('GET', '/cart'),
    addItem: (variantId: string, quantity: number) => client.request<CartDto>('POST', '/cart/items', { variantId, quantity }),
    updateItem: (variantId: string, quantity: number) =>
      client.request<CartDto>('PATCH', `/cart/items/${variantId}`, { quantity }),
    removeItem: (variantId: string) => client.request<CartDto>('DELETE', `/cart/items/${variantId}`)
  };
}
