import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../test-utils';
import { api, resetApiMocks } from '../mocks/apiClientMock';
import { OrderDetailPage } from '../../src/features/orders/OrderDetailPage';

vi.mock('../../src/api/client', async () => import('../mocks/apiClientMock'));

const order = {
  id: 'order123456789',
  paymentStatus: 'paid',
  fulfillmentStatus: 'delivered',
  grandTotal: { amountMinor: 5000, currency: 'USD' },
  itemCount: 1,
  placedAt: '2026-01-01T00:00:00.000Z',
  items: [
    {
      productId: 'p1',
      variantId: 'v1',
      sellerId: 's1',
      name: 'Widget',
      sku: 'WID-1',
      attributes: {},
      unitPrice: { amountMinor: 5000, currency: 'USD' },
      discount: { amountMinor: 0, currency: 'USD' },
      taxAmount: { amountMinor: 0, currency: 'USD' },
      quantity: 1,
      lineTotal: { amountMinor: 5000, currency: 'USD' }
    }
  ],
  itemSubtotal: { amountMinor: 5000, currency: 'USD' },
  discountTotal: { amountMinor: 0, currency: 'USD' },
  taxTotal: { amountMinor: 0, currency: 'USD' },
  shippingTotal: { amountMinor: 0, currency: 'USD' },
  shippingAddress: {
    recipientName: 'Jane Doe',
    addressLine1: '1 Main St',
    locality: 'Springfield',
    region: 'IL',
    postalCode: '62701',
    countryCode: 'US'
  },
  statusHistory: [],
  cancelledAt: null,
  cancelReason: null
};

const paymentAttempt = {
  id: 'attempt1',
  orderId: order.id,
  provider: 'development',
  amount: { amountMinor: 5000, currency: 'USD' },
  status: 'succeeded' as const,
  confirmedAt: '2026-01-01T00:05:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z'
};

function renderOrderDetail() {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/orders/:orderId" element={<OrderDetailPage />} />
    </Routes>,
    { initialEntries: [`/admin/orders/${order.id}`] }
  );
}

describe('OrderDetailPage (order management & refund workflow)', () => {
  beforeEach(() => {
    resetApiMocks();
    api.admin.getOrder.mockResolvedValue(order);
    api.admin.listPaymentAttempts.mockResolvedValue([paymentAttempt]);
  });

  it('shows order totals, items, and a refund action for a succeeded payment attempt', async () => {
    renderOrderDetail();

    expect(await screen.findByText(/order 23456789/i)).toBeInTheDocument();
    expect(screen.getByText('Widget')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /^refund$/i })).toBeInTheDocument();
  });

  it('processes a refund through the modal and calls the API with the amount converted to minor units', async () => {
    const user = userEvent.setup();
    api.admin.processRefund.mockResolvedValue({ id: 'refund1', status: 'succeeded' });
    renderOrderDetail();

    await user.click(await screen.findByRole('button', { name: /^refund$/i }));
    await user.type(screen.getByLabelText(/amount \(usd/i), '12.50');
    await user.click(screen.getByRole('button', { name: /confirm refund/i }));

    await waitFor(() =>
      expect(api.admin.processRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentAttemptId: 'attempt1',
          requestedAmount: { amountMinor: 1250, currency: 'USD' }
        })
      )
    );
  });
});
