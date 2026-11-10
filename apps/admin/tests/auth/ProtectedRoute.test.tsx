import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../test-utils';
import { api, resetApiMocks } from '../mocks/apiClientMock';
import { ProtectedRoute } from '../../src/routes/ProtectedRoute';

vi.mock('../../src/api/client', async () => import('../mocks/apiClientMock'));

function AdminOnlyPage() {
  return <div>Admin content</div>;
}

function LoginStub() {
  return <div>Login page</div>;
}

function renderGuardedRoute(initialEntries: string[]) {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginStub />} />
      <Route element={<ProtectedRoute requireAnyOf={['admin']} />}>
        <Route path="/admin" element={<AdminOnlyPage />} />
      </Route>
    </Routes>,
    { initialEntries }
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    resetApiMocks();
  });

  it('redirects to /login when there is no session', async () => {
    api.auth.refresh.mockRejectedValue(new Error('no session'));

    renderGuardedRoute(['/admin']);

    await waitFor(() => expect(screen.getByText('Login page')).toBeInTheDocument());
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });

  it('renders an access-denied state for an authenticated user lacking the required role', async () => {
    api.auth.refresh.mockResolvedValue({
      accessToken: 'token',
      refreshToken: 'refresh',
      user: { id: 'u1', email: 'seller@example.com', roles: ['customer', 'seller'], status: 'active', emailVerified: true, phoneVerified: false, createdAt: '2026-01-01T00:00:00.000Z' }
    });

    renderGuardedRoute(['/admin']);

    await waitFor(() => expect(screen.getByText('Access denied')).toBeInTheDocument());
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });

  it('renders the protected content for a user with the required role', async () => {
    api.auth.refresh.mockResolvedValue({
      accessToken: 'token',
      refreshToken: 'refresh',
      user: { id: 'u1', email: 'admin@example.com', roles: ['customer', 'administrator'], status: 'active', emailVerified: true, phoneVerified: false, createdAt: '2026-01-01T00:00:00.000Z' }
    });

    renderGuardedRoute(['/admin']);

    await waitFor(() => expect(screen.getByText('Admin content')).toBeInTheDocument());
  });
});
