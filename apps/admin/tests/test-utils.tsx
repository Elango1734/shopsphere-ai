import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../src/components/ui/ToastProvider';
import { AuthProvider } from '../src/auth/AuthContext';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
}

/** Wraps a tree with the same providers `App.tsx` does (minus the router, which callers configure via `initialEntries`), so feature components under test see the same context shape as production. */
export function renderWithProviders(ui: ReactNode, { initialEntries = ['/'] }: { initialEntries?: string[] } = {}) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <AuthProvider>{ui}</AuthProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
