import type { Request, Response } from 'express';
import { sendSuccess } from '../../http/envelope.js';
import { hashGuestToken } from '../../repositories/cart.repository.js';
import { recordEvents, type IncomingEvent } from '../../repositories/analyticsEvent.repository.js';

/**
 * Ingest is fire-and-forget from the client's point of view: it returns the
 * accepted count and nothing else, so a storefront never waits on analytics
 * and never learns anything from this endpoint it did not already send.
 */
export async function recordEventsHandler(req: Request, res: Response): Promise<void> {
  const events = req.body.events as IncomingEvent[];
  const owner = req.auth?.userId ? { userId: req.auth.userId } : { guestTokenHash: hashGuestToken(req.guestToken) };
  const accepted = await recordEvents(owner, events);
  sendSuccess(res, { accepted }, { status: 202 });
}
