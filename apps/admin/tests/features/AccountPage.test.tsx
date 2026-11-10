import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../test-utils';
import { api, resetApiMocks } from '../mocks/apiClientMock';
import { AccountPage } from '../../src/features/account/AccountPage';

vi.mock('../../src/api/client', async () => import('../mocks/apiClientMock'));

function renderAccountPage() {
  resetApiMocks();
  api.auth.refresh.mockResolvedValue({
    accessToken: 'token',
    refreshToken: 'refresh',
    user: { id: 'u1', email: 'admin@example.com', roles: ['administrator'], status: 'active', emailVerified: true, phoneVerified: false, createdAt: '2026-01-01T00:00:00.000Z' }
  });
  return renderWithProviders(
    <Routes>
      <Route path="/account" element={<AccountPage />} />
      <Route path="/login" element={<div>Login page</div>} />
    </Routes>,
    { initialEntries: ['/account'] }
  );
}

describe('AccountPage (change password)', () => {
  beforeEach(() => {
    resetApiMocks();
  });

  it('shows the signed-in user\'s own account details', async () => {
    renderAccountPage();
    expect(await screen.findByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByText('administrator')).toBeInTheDocument();
  });

  it('rejects a new password that does not meet the complexity requirement', async () => {
    const user = userEvent.setup();
    renderAccountPage();

    await screen.findByText('admin@example.com');
    await user.type(screen.getByLabelText(/current password/i), 'CurrentPassw0rd');
    await user.type(screen.getByLabelText(/^new password/i), 'short');
    await user.type(screen.getByLabelText(/confirm new password/i), 'short');
    await user.click(screen.getByRole('button', { name: /change password/i }));

    expect(await screen.findByText(/at least 10 characters/i)).toBeInTheDocument();
    expect(api.auth.changePassword).not.toHaveBeenCalled();
  });

  it('rejects a confirmation that does not match the new password', async () => {
    const user = userEvent.setup();
    renderAccountPage();

    await screen.findByText('admin@example.com');
    await user.type(screen.getByLabelText(/current password/i), 'CurrentPassw0rd');
    await user.type(screen.getByLabelText(/^new password/i), 'NewPassw0rd1');
    await user.type(screen.getByLabelText(/confirm new password/i), 'NewPassw0rd2');
    await user.click(screen.getByRole('button', { name: /change password/i }));

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(api.auth.changePassword).not.toHaveBeenCalled();
  });

  it('shows the server error when the current password is wrong', async () => {
    const user = userEvent.setup();
    const { ApiClientError } = await import('@shopsphere/api-client');
    renderAccountPage();
    api.auth.changePassword.mockRejectedValue(new ApiClientError(401, 'UNAUTHORIZED', 'Current password is incorrect', [], 'req_1'));

    await screen.findByText('admin@example.com');
    await user.type(screen.getByLabelText(/current password/i), 'WrongPassw0rd');
    await user.type(screen.getByLabelText(/^new password/i), 'NewPassw0rd1');
    await user.type(screen.getByLabelText(/confirm new password/i), 'NewPassw0rd1');
    await user.click(screen.getByRole('button', { name: /change password/i }));

    expect(await screen.findByText(/current password is incorrect/i)).toBeInTheDocument();
  });

  it('on success, calls the API with the right values and signs the user out', async () => {
    const user = userEvent.setup();
    renderAccountPage();
    api.auth.changePassword.mockResolvedValue({ changed: true });
    api.auth.logout.mockResolvedValue({ loggedOut: true });

    await screen.findByText('admin@example.com');
    await user.type(screen.getByLabelText(/current password/i), 'CurrentPassw0rd');
    await user.type(screen.getByLabelText(/^new password/i), 'NewPassw0rd1');
    await user.type(screen.getByLabelText(/confirm new password/i), 'NewPassw0rd1');
    await user.click(screen.getByRole('button', { name: /change password/i }));

    await waitFor(() => expect(api.auth.changePassword).toHaveBeenCalledWith('CurrentPassw0rd', 'NewPassw0rd1'));
    await waitFor(() => expect(screen.getByText('Login page')).toBeInTheDocument(), { timeout: 3000 });
    expect(api.auth.logout).toHaveBeenCalled();
  });
});
