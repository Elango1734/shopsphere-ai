import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test-utils';
import { api, resetApiMocks } from '../mocks/apiClientMock';
import { CouponsPage } from '../../src/features/coupons/CouponsPage';

vi.mock('../../src/api/client', async () => import('../mocks/apiClientMock'));

const paginatedEmpty = { data: [], meta: { pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 } } };

describe('CouponsPage (coupon validation)', () => {
  beforeEach(() => {
    resetApiMocks();
    api.admin.listCoupons.mockResolvedValue(paginatedEmpty);
  });

  it('rejects a coupon code shorter than the minimum length instead of submitting', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CouponsPage />);

    await user.click(screen.getByRole('button', { name: /new coupon/i }));
    await user.type(screen.getByLabelText(/^code/i), 'AB');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    expect(await screen.findByText(/at least 3 character/i)).toBeInTheDocument();
    expect(api.admin.createCoupon).not.toHaveBeenCalled();
  });

  it('rejects an expiresAt before startsAt', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CouponsPage />);

    await user.click(screen.getByRole('button', { name: /new coupon/i }));
    await user.type(screen.getByLabelText(/^code/i), 'VALIDCODE');
    await user.clear(screen.getByLabelText(/^starts\b/i));
    await user.type(screen.getByLabelText(/^starts\b/i), '2026-06-01');
    await user.clear(screen.getByLabelText(/^expires\b/i));
    await user.type(screen.getByLabelText(/^expires\b/i), '2026-01-01');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    expect(await screen.findByText(/expiresat must be after startsat/i)).toBeInTheDocument();
    expect(api.admin.createCoupon).not.toHaveBeenCalled();
  });

  it('submits a valid coupon', async () => {
    const user = userEvent.setup();
    api.admin.createCoupon.mockResolvedValue({ id: 'coupon1', code: 'VALIDCODE' });
    renderWithProviders(<CouponsPage />);

    await user.click(screen.getByRole('button', { name: /new coupon/i }));
    await user.type(screen.getByLabelText(/^code/i), 'VALIDCODE');
    await user.type(screen.getByLabelText(/percentage \(basis points/i), '1000');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => expect(api.admin.createCoupon).toHaveBeenCalled());
  });
});
