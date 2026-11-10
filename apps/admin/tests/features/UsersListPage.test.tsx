import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../test-utils';
import { api, resetApiMocks } from '../mocks/apiClientMock';
import { UsersListPage } from '../../src/features/users/UsersListPage';

vi.mock('../../src/api/client', async () => import('../mocks/apiClientMock'));

function page(items: Array<{ id: string; email: string; roles: string[]; status: string; createdAt: string }>, totalItems: number) {
  return { data: items, meta: { pagination: { page: 1, pageSize: 20, totalItems, totalPages: Math.ceil(totalItems / 20) } } };
}

describe('UsersListPage (pagination & filters)', () => {
  beforeEach(() => {
    resetApiMocks();
  });

  it('requests the filtered role/status combination when a filter changes', async () => {
    const user = userEvent.setup();
    api.admin.listUsers.mockResolvedValue(
      page([{ id: 'u1', email: 'seller@example.com', roles: ['seller'], status: 'active', createdAt: '2026-01-01T00:00:00.000Z' }], 1)
    );

    renderWithProviders(
      <Routes>
        <Route path="/admin/users" element={<UsersListPage />} />
      </Routes>,
      { initialEntries: ['/admin/users'] }
    );

    await waitFor(() => expect(api.admin.listUsers).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 20 })));

    await user.selectOptions(screen.getByLabelText(/^role$/i), 'seller');

    await waitFor(() => expect(api.admin.listUsers).toHaveBeenCalledWith(expect.objectContaining({ role: 'seller', page: 1 })));
  });

  it('requests page 2 when Next is clicked, with totals reflecting multiple pages', async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 1 }, (_, i) => ({
      id: `u${i}`,
      email: `user${i}@example.com`,
      roles: ['customer'],
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z'
    }));
    api.admin.listUsers.mockResolvedValue(page(rows, 45));

    renderWithProviders(
      <Routes>
        <Route path="/admin/users" element={<UsersListPage />} />
      </Routes>,
      { initialEntries: ['/admin/users'] }
    );

    await screen.findByText(/page 1 of 3/i);
    await user.click(screen.getByRole('button', { name: /^next$/i }));

    await waitFor(() => expect(api.admin.listUsers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
  });
});
