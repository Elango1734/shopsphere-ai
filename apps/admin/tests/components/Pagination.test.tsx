import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from '../../src/components/ui/Pagination';

describe('Pagination', () => {
  it('disables Previous on the first page and Next on the last page', () => {
    const { rerender } = render(<Pagination page={1} pageSize={20} totalItems={45} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^next$/i })).not.toBeDisabled();

    rerender(<Pagination page={3} pageSize={20} totalItems={45} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: /previous/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /^next$/i })).toBeDisabled();
  });

  it('calls onPageChange with the next/previous page number', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination page={2} pageSize={10} totalItems={50} onPageChange={onPageChange} />);

    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    await user.click(screen.getByRole('button', { name: /previous/i }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('reports the total item count and page count for screen readers', () => {
    render(<Pagination page={2} pageSize={20} totalItems={45} onPageChange={() => {}} />);
    expect(screen.getByText(/page 2 of 3 \(45 total\)/i)).toBeInTheDocument();
  });
});
