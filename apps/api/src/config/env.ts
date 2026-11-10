import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Shared .env lives at the monorepo root (see .env.example); apps/api does not keep its own copy.
loadDotenv({ path: path.resolve(__dirname, '../../../../.env') });

/**
 * `z.string().default(x)` only applies `x` when the key is absent from
 * `process.env` entirely — an env var explicitly set to `''` (as
 * `.env.example`'s placeholders like `PAYMENT_WEBHOOK_SECRET=` ship) is still
 * `''`, not the default, which would silently turn a secret into an empty
 * string. This treats a blank value the same as an unset one for schema
 * defaulting purposes, which is what every caller of this file actually
 * wants.
 */
function blankable(defaultValue: string) {
  return z.preprocess((value) => (value === '' ? undefined : value), z.string().default(defaultValue));
}

/**
 * Same blank-vs-undefined problem as `blankable()`, but for a field with no
 * sensible default to fall back to (e.g. `SEED_ADMIN_EMAIL` — there is no
 * placeholder admin email) — a blank value means "not provided" and should
 * stay `undefined`, not fail the field's own format validation (`.email()`,
 * `.min(12)`, etc.) against an empty string.
 */
function optionalBlankable<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
}

/**
 * In production, token secrets and the webhook secret must be real random
 * values (not empty, not the `.env.example` placeholder prose). In
 * development/test a short fallback is tolerated so the server can boot
 * without per-developer setup friction, but is never used to accept a
 * production request — see `isProduction()` callers in the auth/webhook
 * modules that re-check this explicitly.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    API_BASE_URL: z.string().default('http://localhost:4000/api/v1'),
    MONGODB_URI: z
      .string()
      .min(1, 'MONGODB_URI is required')
      .default('mongodb://localhost:27017/shopsphere?replicaSet=rs0'),
    MONGODB_DB_NAME: z.string().optional(),
    ACCESS_TOKEN_SECRET: blankable('development-only-access-secret-do-not-use-in-prod'),
    REFRESH_TOKEN_SECRET: blankable('development-only-refresh-secret-do-not-use-in-prod'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).default(15 * 60),
    REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).default(30 * 24 * 60 * 60),
    WEB_ORIGINS: z.string().default('http://localhost:5173'),
    UPLOAD_STORAGE: z.enum(['local', 'development']).default('local'),
    UPLOAD_LOCAL_DIRECTORY: z.string().default('./.local-uploads'),
    PAYMENT_PROVIDER: z.enum(['development']).default('development'),
    PAYMENT_WEBHOOK_SECRET: blankable('development-only-webhook-secret'),
    // Placeholder pricing policy for this stage — see pricing.service.ts's doc comment for why these are flat
    // constants rather than a real tax/shipping-rate integration.
    TAX_RATE_BASIS_POINTS: z.coerce.number().int().min(0).max(10_000).default(800),
    FLAT_SHIPPING_MINOR: z.coerce.number().int().min(0).default(500),
    FREE_SHIPPING_THRESHOLD_MINOR: z.coerce.number().int().min(0).default(7500),
    CHECKOUT_RESERVATION_MINUTES: z.coerce.number().int().min(1).default(15),
    // 'anthropic' only actually activates when AI_API_KEY is also set (see llmProvider.ts) — setting
    // AI_PROVIDER=anthropic with no key still runs the development provider, never a half-configured one.
    AI_PROVIDER: z.enum(['development', 'anthropic']).default('development'),
    AI_API_KEY: z.string().optional(),
    AI_MODEL: z.string().optional(),
    SEED_ADMIN_EMAIL: optionalBlankable(z.string().email()),
    SEED_ADMIN_PASSWORD: optionalBlankable(z.string().min(12))
  })
  .refine(
    (env) =>
      env.NODE_ENV !== 'production' ||
      (env.ACCESS_TOKEN_SECRET.length >= 32 &&
        env.REFRESH_TOKEN_SECRET.length >= 32 &&
        !env.ACCESS_TOKEN_SECRET.startsWith('development-only') &&
        !env.REFRESH_TOKEN_SECRET.startsWith('development-only')),
    { message: 'ACCESS_TOKEN_SECRET/REFRESH_TOKEN_SECRET must be real random 32+ char secrets in production' }
  );

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

/** Parsed once per process; throws with field-level detail on first access if misconfigured. */
export function getEnv(): Env {
  if (!cachedEnv) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
      throw new Error(`Invalid environment configuration: ${details}`);
    }
    cachedEnv = parsed.data;
  }
  return cachedEnv;
}

export function isProduction(): boolean {
  return getEnv().NODE_ENV === 'production';
}

export function isDevelopmentOrTest(): boolean {
  const env = getEnv().NODE_ENV;
  return env === 'development' || env === 'test';
}

export function getWebOrigins(): string[] {
  return getEnv()
    .WEB_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
