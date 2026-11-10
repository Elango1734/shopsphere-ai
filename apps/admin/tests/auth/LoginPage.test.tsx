import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../test-utils';
import { api, resetApiMocks } from '../mocks/apiClientMock';
import { LoginPage } from '../../src/features/auth/LoginPage';
import { ApiClientError } from '@shopsphere/api-client';

vi.mock('../../src/api/client', async () => import('../mocks/apiClientMock'));

function renderLogin() {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<div>Dashboard landing</div>} />
    </Routes>,
    { initialEntries: ['/login'] }
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    resetApiMocks();
    api.auth.refresh.mockRejectedValue(new Error('no session'));
  });

  it('shows validation errors instead of submitting when required fields are empty', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/either email or phone is required/i)).toBeInTheDocument();
    expect(api.auth.login).not.toHaveBeenCalled();
  });

  it('shows a readable error message when the server rejects the credentials', async () => {
    const user = userEvent.setup();
    api.auth.login.mockRejectedValue(new ApiClientError(401, 'INVALID_CREDENTIALS', 'Invalid credentials', [], 'req_1'));
    renderLogin();

    await user.type(screen.getByLabelText(/email/i), 'wrong@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/incorrect email or password/i)).toBeInTheDocument();
  });

  it('logs in and navigates away from the login page on success', async () => {
    const user = userEvent.setup();
    api.auth.login.mockResolvedValue({
      accessToken: 'token',
      refreshToken: 'refresh',
      user: { id: 'u1', email: 'admin@example.com', roles: ['administrator'], status: 'active', emailVerified: true, phoneVerified: false, createdAt: '2026-01-01T00:00:00.000Z' }
    });
    renderLogin();

    await user.type(screen.getByLabelText(/email/i), 'admin@example.com');
    await user.type(screen.getByLabelText(/password/i), 'CorrectPassw0rd');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText('Dashboard landing')).toBeInTheDocument());
  });
});
