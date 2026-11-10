import { nanoid } from 'nanoid';
import type { NextFunction, Request, Response } from 'express';
import { isProduction } from '../../config/env.js';

const COOKIE_NAME = 'ss_guest';
const HEADER_NAME = 'x-guest-token';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{16,64}$/;

declare module 'express-serve-static-core' {
  interface Request {
    guestToken: string;
  }
}

function isWellFormedToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_SHAPE.test(value);
}

/**
 * Issues an opaque, random guest identifier on first contact. Browser
 * clients get it as an httpOnly cookie; native clients (which do not reliably
 * persist cookies across app restarts the way a browser does) instead
 * generate and store their own token and send it back via `X-Guest-Token` —
 * this middleware trusts that header only when it matches the same
 * random-token shape a server-issued one would have, and always echoes back
 * whichever token it ends up using via the same response header so a native
 * client can persist what it actually got. Either way the token (never
 * derived from or linked to any customer identity) is hashed before storage
 * — see cart.repository.ts's `hashGuestToken` — so it cannot be guessed into
 * another guest's cart, and a leaked hash cannot be reversed into a usable
 * session (database-design.md).
 */
export function guestTokenMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headerToken = req.header(HEADER_NAME);
  const cookieToken = req.cookies?.[COOKIE_NAME] as string | undefined;

  let token: string;
  if (isWellFormedToken(headerToken)) {
    token = headerToken;
  } else if (isWellFormedToken(cookieToken)) {
    token = cookieToken;
  } else {
    token = nanoid(32);
  }

  if (token !== cookieToken) {
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction(),
      sameSite: 'lax',
      maxAge: MAX_AGE_MS
    });
  }
  res.setHeader('X-Guest-Token', token);

  req.guestToken = token;
  next();
}
