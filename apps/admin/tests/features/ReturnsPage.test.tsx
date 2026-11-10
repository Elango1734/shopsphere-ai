import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test-utils';
import { api, resetApiMocks } from '../mocks/apiClientMock';
import { ReturnsPage } from '../../src/features/returns/ReturnsPage';

vi.mock('../../src/api/client', async () => import('../mocks/apiClientMock'));

const returnRequest = {
  id: 'return123456',
  orderId: 'order123456',
  status: 'requested',
  items: [{ variantId: 'v1', quantity: 1, reason: 'wrong size' }],
  requestedAmount: { amountMinor: 2000, currency: 'USD' },
  approvedAmount: null,
  reason: 'wrong size',
  statusHistory: [],
  createdAt: '2026-01-01T00:00:00.000Z'
};

describe('ReturnsPage (return & refund review workflow)', () => {
  beforeEach(() => {
    resetApiMocks();
    api.admin.listReturns.mockResolvedValue({
      data: [returnRequest],
      meta: { pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } }
    });
  });

  it('approves a return with the full requested amount when no override is entered', async () => {
    const user = userEvent.setup();
    api.admin.reviewReturn.mockResolvedValue({ ...returnRequest, status: 'approved' });
    renderWithProviders(<ReturnsPage />);

    await user.click(await screen.findByRole('button', { name: /review/i }));
    await user.click(screen.getByRole('button', { name: /^approve$/i }));

    await waitFor(() =>
      expect(api.admin.reviewReturn).toHaveBeenCalledWith(returnRequest.id, 'approved', undefined, undefined)
    );
  });

  it('rejects a return request', async () => {
    const user = userEvent.setup();
    api.admin.reviewReturn.mockResolvedValue({ ...returnRequest, status: 'rejected' });
    renderWithProviders(<ReturnsPage />);

    await user.click(await screen.findByRole('button', { name: /review/i }));
    await user.click(screen.getByRole('button', { name: /^reject$/i }));

    await waitFor(() => expect(api.admin.reviewReturn).toHaveBeenCalledWith(returnRequest.id, 'rejected', undefined, undefined));
  });

  it('approves with a partial override amount converted to minor units', async () => {
    const user = userEvent.setup();
    api.admin.reviewReturn.mockResolvedValue({ ...returnRequest, status: 'approved' });
    renderWithProviders(<ReturnsPage />);

    await user.click(await screen.findByRole('button', { name: /review/i }));
    await user.type(screen.getByLabelText(/approved amount/i), '15.00');
    await user.click(screen.getByRole('button', { name: /^approve$/i }));

    await waitFor(() =>
      expect(api.admin.reviewReturn).toHaveBeenCalledWith(
        returnRequest.id,
        'approved',
        { amountMinor: 1500, currency: 'USD' },
        undefined
      )
    );
  });
});
