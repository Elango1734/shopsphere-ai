import { createApiClient } from '@shopsphere/api-client';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000/api/v1';

/**
 * The access token lives only in memory (a module-level variable, not
 * localStorage/sessionStorage) so an XSS payload reading browser storage
 * cannot exfiltrate it — security.md's token-handling requirement. It is
 * lost on a hard refresh by design; `AuthProvider` re-establishes a session
 * on load via `auth.refresh()`, which relies on the httpOnly `ss_refresh`
 * cookie instead.
 */
let accessToken: string | null = null;
let onUnauthorizedCallback: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setOnUnauthorized(callback: (() => void) | null): void {
  onUnauthorizedCallback = callback;
}

export const api = createApiClient({
  baseUrl: apiBaseUrl,
  getAccessToken: () => accessToken,
  onUnauthorized: () => onUnauthorizedCallback?.(),
  timeoutMs: 20000
});
