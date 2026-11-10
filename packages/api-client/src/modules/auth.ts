import type { ApiClient } from '../core.js';
import type { AuthResult, UserDto } from '../types.js';

export interface RegisterPayload {
  email?: string;
  phone?: string;
  password: string;
  displayName?: string;
}

export interface LoginPayload {
  email?: string;
  phone?: string;
  password: string;
}

export function createAuthModule(client: ApiClient) {
  return {
    register: (payload: RegisterPayload) => client.request<AuthResult>('POST', '/auth/register', payload),
    login: (payload: LoginPayload) => client.request<AuthResult>('POST', '/auth/login', payload),
    /** `refreshToken` is optional: a browser client omits it and relies on the httpOnly `ss_refresh` cookie sent via `credentials: 'include'`; a native client supplies the token it keeps in secure storage. */
    refresh: (refreshToken?: string) =>
      client.request<AuthResult>('POST', '/auth/refresh', refreshToken ? { refreshToken } : {}),
    logout: (refreshToken?: string) =>
      client.request<{ loggedOut: boolean }>('POST', '/auth/logout', refreshToken ? { refreshToken } : {}),
    me: () => client.request<UserDto>('GET', '/auth/me'),
    changePassword: (currentPassword: string, newPassword: string) =>
      client.request<{ changed: boolean }>('POST', '/auth/change-password', { currentPassword, newPassword })
  };
}
