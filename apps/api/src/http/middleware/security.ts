import cors from 'cors';
import helmet from 'helmet';
import { getWebOrigins, isProduction } from '../../config/env.js';

export const helmetMiddleware = helmet({
  contentSecurityPolicy: isProduction()
    ? {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"]
        }
      }
    : false
});

/** Strict production allowlist from WEB_ORIGINS; non-production stays permissive for local tooling (Swagger UI, mobile dev). */
export const corsMiddleware = cors({
  origin: isProduction() ? getWebOrigins() : true,
  credentials: true,
  exposedHeaders: ['X-Request-Id', 'X-Guest-Token']
});
