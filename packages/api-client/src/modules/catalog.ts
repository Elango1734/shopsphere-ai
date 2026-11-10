import type { ApiClient } from '../core.js';
import type { BrandDto, CategoryDto, PaginationMeta, ProductDetailDto, ProductSummaryDto, QuestionDto, ReviewDto } from '../types.js';

export interface ProductListQuery {
  page?: number;
  pageSize?: number;
  categoryId?: string;
  brandId?: string;
  sellerId?: string;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  q?: string;
  inStockOnly?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
}

export function createCatalogModule(client: ApiClient) {
  return {
    listCategories: () => client.request<CategoryDto[]>('GET', '/categories'),
    listBrands: () => client.request<BrandDto[]>('GET', '/brands'),

    listProducts: (query: ProductListQuery = {}) =>
      client.requestWithMeta<ProductSummaryDto[], { pagination: PaginationMeta }>('GET', '/products', undefined, {
        query: query as Record<string, string | number | boolean | undefined>
      }),

    getProduct: (slug: string) => client.request<ProductDetailDto>('GET', `/products/${encodeURIComponent(slug)}`),

    compareProducts: (ids: string[]) =>
      client.request<ProductDetailDto[]>('GET', '/products/compare', undefined, { query: { ids: ids.join(',') } }),

    listProductReviews: (slug: string, page = 1, pageSize = 20) =>
      client.requestWithMeta<ReviewDto[], { pagination: PaginationMeta }>(
        'GET',
        `/products/${encodeURIComponent(slug)}/reviews`,
        undefined,
        { query: { page, pageSize } }
      ),

    listProductQuestions: (slug: string, page = 1, pageSize = 20) =>
      client.requestWithMeta<QuestionDto[], { pagination: PaginationMeta }>(
        'GET',
        `/products/${encodeURIComponent(slug)}/questions`,
        undefined,
        { query: { page, pageSize } }
      ),

    askQuestion: (slug: string, body: string) =>
      client.request<QuestionDto>('POST', `/products/${encodeURIComponent(slug)}/questions`, { body })
  };
}
