import type { Request, Response } from 'express';
import type { RegisterInput, LoginInput, RefreshInput } from '@shopsphere/validation';
import { isProduction } from '../../config/env.js';
import { sendSuccess } from '../../http/envelope.js';
import { UnauthorizedError } from '../../http/errors.js';
import * as authService from './auth.service.js';
import { mergeGuestCartOnLogin } from '../cart/cart.service.js';

const REFRESH_COOKIE = 'ss_refresh';

function deviceContext(req: Request): { userAgent?: string; ipAddress?: string } {
  const userAgent = req.header('user-agent');
  const ipAddress = req.ip;
  return { ...(userAgent ? { userAgent } : {}), ...(ipAddress ? { ipAddress } : {}) };
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: 30 * 24 * 60 * 60 * 1000
  });
}

function readRefreshToken(req: Request): string | undefined {
  return (req.body as { refreshToken?: string })?.refreshToken ?? (req.cookies?.[REFRESH_COOKIE] as string | undefined);
}

async function mergeGuestCartIfPresent(req: Request, userId: string): Promise<void> {
  if (req.guestToken) {
    await mergeGuestCartOnLogin(userId, req.guestToken);
  }
}

export async function registerHandler(req: Request, res: Response): Promise<void> {
  const result = await authService.register(req.body as RegisterInput, deviceContext(req));
  await mergeGuestCartIfPresent(req, result.user.id);
  setRefreshCookie(res, result.refreshToken);
  sendSuccess(res, result, { status: 201 });
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body as LoginInput, deviceContext(req));
  await mergeGuestCartIfPresent(req, result.user.id);
  setRefreshCookie(res, result.refreshToken);
  sendSuccess(res, result);
}

export async function refreshHandler(req: Request, res: Response): Promise<void> {
  const rawToken = readRefreshToken(req);
  if (!rawToken) throw new UnauthorizedError('A refresh token is required');

  const result = await authService.refresh(rawToken, deviceContext(req));
  setRefreshCookie(res, result.refreshToken);
  sendSuccess(res, result);
}

export async function logoutHandler(req: Request, res: Response): Promise<void> {
  const rawToken = readRefreshToken(req);
  if (rawToken) await authService.logout(rawToken);
  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
  sendSuccess(res, { loggedOut: true });
}

export async function meHandler(req: Request, res: Response): Promise<void> {
  const profile = await authService.getProfile(req.auth!.userId);
  sendSuccess(res, profile);
}

export async function changePasswordHandler(req: Request, res: Response): Promise<void> {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  await authService.changePassword(req.auth!.userId, currentPassword, newPassword);
  sendSuccess(res, { changed: true });
}

export type { RefreshInput };
