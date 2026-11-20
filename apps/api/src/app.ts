import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import { requestIdMiddleware } from './http/middleware/requestId.js';
import { httpLogger } from './http/middleware/logger.js';
import { helmetMiddleware, corsMiddleware } from './http/middleware/security.js';
import { sanitizeInputMiddleware } from './http/middleware/sanitizeInput.js';
import { errorHandlerMiddleware } from './http/middleware/errorHandler.js';
import { notFoundMiddleware } from './http/middleware/notFound.js';
import { mountOpenApiDocs } from './openapi/serve.js';

import { healthRouter } from './modules/health/health.routes.js';
import { webhookRouter } from './modules/webhooks/webhook.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { profileRouter } from './modules/profile/profile.routes.js';
import { catalogRouter } from './modules/catalog/catalog.routes.js';
import { discoveryRouter } from './modules/discovery/discovery.routes.js';
import { cartRouter } from './modules/cart/cart.routes.js';
import { checkoutRouter } from './modules/checkout/checkout.routes.js';
import { orderRouter, returnRouter } from './modules/orders/order.routes.js';
import { reviewRouter } from './modules/reviews/review.routes.js';
import { sellerRouter } from './modules/sellers/seller.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { supportRouter, supportAgentRouter } from './modules/support/support.routes.js';
import { notificationRouter } from './modules/notifications/notification.routes.js';
import { aiRouter } from './modules/ai/ai.routes.js';
import { analyticsRouter } from './modules/analytics/analytics.routes.js';

const MAX_BODY_SIZE = '1mb';
/** `public/` holds the seeded catalog cut-outs; this file lives in src/, so go up one. */
const PUBLIC_DIRECTORY = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestIdMiddleware);
  app.use(httpLogger);
  app.use(helmetMiddleware);
  app.use(corsMiddleware);

  // Webhook routes need the raw body for signature verification, so they are mounted BEFORE the global
  // JSON body parser below — see webhook.routes.ts's own comment.
  app.use('/api/v1/webhooks', webhookRouter);

  app.use(express.json({ limit: MAX_BODY_SIZE }));
  // A request with no body (or a non-JSON content-type) leaves req.body as undefined rather than {} —
  // every controller in this app treats req.body as at least an empty object, so normalize it once here
  // instead of guarding it in every handler that accepts an all-optional body (e.g. POST /orders/:id/cancel).
  app.use((req, _res, next) => {
    if (req.body === undefined) req.body = {};
    next();
  });
  app.use(cookieParser());
  app.use(sanitizeInputMiddleware);

  // Static catalog imagery (see db/seed/run.ts). There is still no upload/object-storage
  // endpoint — these are fixture assets committed with the seed, not user uploads.
  app.use('/static', express.static(PUBLIC_DIRECTORY, { maxAge: '1h', fallthrough: true }));

  mountOpenApiDocs(app);

  app.use('/api/v1', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/me', profileRouter);
  app.use('/api/v1', catalogRouter);
  app.use('/api/v1', discoveryRouter);
  app.use('/api/v1/cart', cartRouter);
  app.use('/api/v1/checkout', checkoutRouter);
  app.use('/api/v1/orders', orderRouter);
  app.use('/api/v1/returns', returnRouter);
  app.use('/api/v1/reviews', reviewRouter);
  app.use('/api/v1/seller', sellerRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/support', supportRouter);
  app.use('/api/v1/support-agent', supportAgentRouter);
  app.use('/api/v1/notifications', notificationRouter);
  app.use('/api/v1/ai', aiRouter);
  app.use('/api/v1/analytics', analyticsRouter);

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
}
