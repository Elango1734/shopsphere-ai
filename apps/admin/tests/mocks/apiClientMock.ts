import { vi } from 'vitest';

/**
 * A hand-rolled stand-in for `src/api/client.ts`'s exports. Every feature
 * page imports `{ api }` from that module, so mocking it here (via
 * `vi.mock('../../src/api/client', ...)` in each test file) intercepts every
 * call the component under test makes — no real network/backend involved.
 */
export const api = {
  auth: {
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    me: vi.fn(),
    changePassword: vi.fn()
  },
  admin: {
    getAnalyticsOverview: vi.fn(),
    listUsers: vi.fn(),
    getUser: vi.fn(),
    changeUserStatus: vi.fn(),
    listSellers: vi.fn(),
    getSeller: vi.fn(),
    changeSellerStatus: vi.fn(),
    createCategory: vi.fn(),
    createBrand: vi.fn(),
    listProducts: vi.fn(),
    moderateProduct: vi.fn(),
    searchOrders: vi.fn(),
    getOrder: vi.fn(),
    listPaymentAttempts: vi.fn(),
    listReturns: vi.fn(),
    reviewReturn: vi.fn(),
    processRefund: vi.fn(),
    moderateReview: vi.fn(),
    listCoupons: vi.fn(),
    createCoupon: vi.fn(),
    listAuditLogs: vi.fn(),
    getAiOverview: vi.fn(),
    listAiConversations: vi.fn(),
    getAiConversation: vi.fn()
  },
  seller: {
    onboard: vi.fn(),
    getMe: vi.fn(),
    getAnalyticsOverview: vi.fn(),
    listProducts: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    submitProductForReview: vi.fn(),
    listVariants: vi.fn(),
    createVariant: vi.fn(),
    updateVariant: vi.fn(),
    updateInventory: vi.fn(),
    listLowStock: vi.fn(),
    listOrders: vi.fn(),
    getOrder: vi.fn(),
    updateFulfillment: vi.fn(),
    createShipment: vi.fn()
  },
  supportAgent: {
    listAssignedTickets: vi.fn(),
    listUnassignedTickets: vi.fn(),
    assignTicket: vi.fn(),
    listMessages: vi.fn(),
    addMessage: vi.fn(),
    updateTicketStatus: vi.fn()
  },
  catalog: {
    listCategories: vi.fn(),
    listBrands: vi.fn(),
    listProducts: vi.fn(),
    getProduct: vi.fn()
  }
};

export function setAccessToken(_token: string | null): void {}
export function getAccessToken(): string | null {
  return null;
}
export function setOnUnauthorized(_cb: (() => void) | null): void {}

/**
 * Every test renders through `AuthProvider` (via `renderWithProviders`),
 * which calls `api.auth.refresh()` unconditionally on mount to restore a
 * session from the (in real life, httpOnly-cookie-backed) refresh flow. A
 * bare `vi.fn()` resolves to `undefined`, and `undefined.then(...)` throws —
 * so every test needs a working default here unless it deliberately
 * overrides `api.auth.refresh` to test the signed-out path.
 */
export function resetApiMocks(): void {
  for (const group of Object.values(api)) {
    for (const fn of Object.values(group)) {
      (fn as ReturnType<typeof vi.fn>).mockReset();
    }
  }
  api.auth.refresh.mockRejectedValue(new Error('no session'));
}
