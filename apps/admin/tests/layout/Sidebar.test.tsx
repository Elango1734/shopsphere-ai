import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import { api, resetApiMocks } from '../mocks/apiClientMock';
import { Sidebar } from '../../src/components/layout/Sidebar';

vi.mock('../../src/api/client', async () => import('../mocks/apiClientMock'));

function renderSidebarAs(roles: string[]) {
  resetApiMocks();
  api.auth.refresh.mockResolvedValue({
    accessToken: 'token',
    refreshToken: 'refresh',
    user: { id: 'u1', email: 'user@example.com', roles, status: 'active', emailVerified: true, phoneVerified: false, createdAt: '2026-01-01T00:00:00.000Z' }
  });
  return renderWithProviders(<Sidebar isOpen onNavigate={() => {}} />);
}

describe('Sidebar permission-based navigation', () => {
  it('shows only seller nav items for a seller-only account, never admin or support items', async () => {
    renderSidebarAs(['customer', 'seller']);

    expect(await screen.findByRole('link', { name: 'Products' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inventory' })).toBeInTheDocument();
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
    expect(screen.queryByText('Support')).not.toBeInTheDocument();
  });

  it('shows the full admin nav, including support, for an administrator account', async () => {
    renderSidebarAs(['customer', 'administrator']);

    expect(await screen.findByRole('link', { name: 'Users' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sellers' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sphere AI' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ticket queue' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Products' })).not.toBeInTheDocument();
  });

  it('shows only the support section for a support-agent-only account', async () => {
    renderSidebarAs(['customer', 'support_agent']);

    expect(await screen.findByRole('link', { name: 'Ticket queue' })).toBeInTheDocument();
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
    expect(screen.queryByText('Seller')).not.toBeInTheDocument();
  });
});
