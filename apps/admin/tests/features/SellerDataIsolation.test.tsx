import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import { api, resetApiMocks } from '../mocks/apiClientMock';
import { SellerOrdersPage } from '../../src/features/seller-dashboard/SellerOrdersPage';
import { SellerDashboardPage } from '../../src/features/seller-dashboard/SellerDashboardPage';

vi.mock('../../src/api/client', async () => import('../mocks/apiClientMock'));

/**
 * The real data-isolation boundary is server-side (`requireActiveSellerForUser`
 * scopes every seller query to the caller's own seller document — see the
 * backend's seller.service.ts and its HTTP tests). What the admin app itself
 * can be responsible for is never routing a seller's screens through an
 * admin-scoped endpoint that could leak cross-seller data; these tests pin
 * that down at the UI wiring level.
 */
describe('Seller dashboard data isolation (client-side wiring)', () => {
  beforeEach(() => {
    resetApiMocks();
    api.seller.listOrders.mockResolvedValue({ data: [], meta: { pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 } } });
    api.seller.getMe.mockResolvedValue({ id: 's1', storeName: 'My Store', slug: 'my-store', status: 'active', createdAt: '2026-01-01T00:00:00.000Z' });
    api.seller.getAnalyticsOverview.mockResolvedValue({
      rangeDays: 30,
      rangeStart: '2026-01-01T00:00:00.000Z',
      rangeEnd: '2026-01-31T00:00:00.000Z',
      currency: 'USD',
      orderCount: 0,
      revenueMinor: 0,
      ordersByFulfillmentStatus: {},
      lowStockVariantCount: 0,
      pendingOrdersCount: 0
    });
  });

  it('SellerOrdersPage only ever calls the seller-scoped orders endpoint, never the admin orders endpoint', async () => {
    renderWithProviders(<SellerOrdersPage />);

    await waitFor(() => expect(api.seller.listOrders).toHaveBeenCalled());
    expect(api.admin.searchOrders).not.toHaveBeenCalled();
  });

  it('SellerDashboardPage reads the seller-scoped analytics endpoint, never the platform-wide admin analytics endpoint', async () => {
    renderWithProviders(<SellerDashboardPage />);

    await screen.findByText('My Store');
    expect(api.seller.getAnalyticsOverview).toHaveBeenCalled();
    expect(api.admin.getAnalyticsOverview).not.toHaveBeenCalled();
  });
});
