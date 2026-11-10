import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test-utils';
import { api, resetApiMocks } from '../mocks/apiClientMock';
import { CategoriesPage } from '../../src/features/catalog/CategoriesPage';
import { ApiClientError } from '@shopsphere/api-client';

vi.mock('../../src/api/client', async () => import('../mocks/apiClientMock'));

describe('CategoriesPage (catalog CRUD)', () => {
  beforeEach(() => {
    resetApiMocks();
    api.catalog.listCategories.mockResolvedValue([{ id: 'c1', name: 'Electronics', slug: 'electronics', parentId: null }]);
  });

  it('lists existing categories', async () => {
    renderWithProviders(<CategoriesPage />);
    expect(await screen.findByText('Electronics')).toBeInTheDocument();
  });

  it('creates a new category through the modal form and refreshes the list', async () => {
    const user = userEvent.setup();
    api.admin.createCategory.mockResolvedValue({ id: 'c2', name: 'Books', slug: 'books', parentId: null });
    renderWithProviders(<CategoriesPage />);

    await screen.findByText('Electronics');
    await user.click(screen.getByRole('button', { name: /new category/i }));

    await user.type(screen.getByLabelText(/^name/i), 'Books');
    await user.type(screen.getByLabelText(/slug/i), 'books');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => expect(api.admin.createCategory).toHaveBeenCalledWith(expect.objectContaining({ name: 'Books', slug: 'books' })));
  });

  it('shows a readable error with a retry action when the category list fails to load', async () => {
    resetApiMocks();
    api.catalog.listCategories.mockRejectedValue(new ApiClientError(500, 'INTERNAL_ERROR', 'Something broke', [], 'req_1'));
    renderWithProviders(<CategoriesPage />);

    expect(await screen.findByText('Something broke')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
