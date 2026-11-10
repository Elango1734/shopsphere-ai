# API

Node.js and Express REST API, versioned under `/api/v1`, backed by MongoDB and Mongoose. This is the authoritative boundary for validation, pricing, stock, authorization, payments, and AI tool access.

**Current stage:** both the MongoDB/Mongoose data layer and the Express HTTP layer (routes, controllers, services, auth, OpenAPI) are implemented and tested end to end — see `docs/task-checklist.md` for per-area status.

## Prerequisites

- Node.js 22 LTS, npm 10 (this environment ran everything under Node 20.20.0 as a known limitation — see below).
- A MongoDB **replica set** (standalone `mongod` cannot run transactions, which checkout/inventory/refunds require). Locally:

```bash
mkdir -p ./.local-mongo/data
cat > ./.local-mongo/mongod.conf <<'EOF'
storage:
  dbPath: ./.local-mongo/data
net:
  port: 27117
  bindIp: 127.0.0.1
replication:
  replSetName: rs0
systemLog:
  destination: file
  path: ./.local-mongo/mongod.log
  logAppend: true
processManagement:
  fork: true
EOF
mongod --config ./.local-mongo/mongod.conf

# Initiate the replica set once (no mongosh needed, any MongoDB client works):
node -e "
const { MongoClient } = require('mongodb');
MongoClient.connect('mongodb://127.0.0.1:27117/?directConnection=true').then(async (c) => {
  await c.db('admin').admin().command({ replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27117' }] } });
  await c.close();
});
"
```

- Copy `.env.example` (repo root) to `.env`. Set `MONGODB_URI=mongodb://127.0.0.1:27117/shopsphere?replicaSet=rs0` (or your own replica-set URI). Generate real random values for `ACCESS_TOKEN_SECRET`/`REFRESH_TOKEN_SECRET`/`PAYMENT_WEBHOOK_SECRET` — a blank or unset value falls back to a clearly-labeled development default (`src/config/env.ts`), and production refuses to boot with that default. Set `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` only if you want a development administrator provisioned by the seed script.

## Install

From the repo root (npm workspaces):

```bash
npm install
```

## Run

```bash
cd apps/api
npm run db:indexes   # first time / after a schema change
npm run db:seed      # optional: realistic development data
npm run dev          # tsx watch src/server.ts — http://localhost:4000/api/v1
```

Health/readiness: `GET /api/v1/health`, `GET /api/v1/ready`. API docs (non-production only): `GET /api/v1/docs` (Swagger UI) / `GET /api/v1/openapi.json`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the API with `tsx watch` against `MONGODB_URI`. |
| `npm run typecheck` | TypeScript strict typecheck of the whole package (models, repositories, HTTP layer, scripts, tests). |
| `npm run db:indexes` / `db:indexes:verify` | Create/update, or verify, every declared Mongoose index. |
| `npm run db:migrate` | Apply pending versioned migrations. |
| `npm run db:seed` / `db:seed:reset` | Idempotent development seed data; `:reset` wipes seeded collections first (refuses outside `development`/`test`). |
| `npm run db:set-admin-credentials -- --current-email=<existing> [--email=<new>] [--password=<new>] [--name=<display name>] [--force]` | Force-sets an existing user's email/password/display name directly in the database — for resetting a locked-out or forgotten dev admin login. Bypasses `/auth/change-password` (no current-password check) and there is no `/auth/change-email` endpoint at all, so this is the only way to change either outside the database directly. Enforces the same password complexity rule the API does by default; `--force` explicitly opts out (dev convenience only — never do this against a real account). See `src/db/scripts/setAdminCredentials.ts` for the full usage comment. |
| `npm run test:unit` | Pure utility and schema-validation tests. |
| `npm run test:integration` | Repository-level integration tests against a real `mongodb-memory-server` replica set (transactions exercised, not mocked). |
| `npm run test:http` | Supertest integration tests against the actual Express app (`src/app.ts`), same real replica set. |
| `npm test` | Everything above. |

## Architecture

```text
src/
  config/env.ts        Zod-validated environment config (blank-env-var-safe defaults; production hardening checks)
  db/                   Connection, transaction helper, index sync/verify, migrations, seed (see database-design.md)
  models/                31 Mongoose collections (see database-design.md)
  repositories/          Atomic / ownership-safe data access shared by every module below
  http/
    envelope.ts           sendSuccess/sendPaginated/sendError — the shared {success,data,meta,requestId} contract
    errors.ts              AppError + typed subclasses (ValidationError, ForbiddenError, ConflictError, ...)
    mapKnownError.ts        Translates every domain/repository error class into the right HTTP status + code
    middleware/             requestId, logger (pino, redacted), security (helmet/CORS), rate limiting (per route
                             group), NoSQL-injection guard, Zod request validation, auth (JWT + roles), guest token
  modules/
    auth/                 Register (customer-only, no client-supplied role), login (lockout after 5 failed
                           attempts), refresh rotation + reuse detection, logout, change password
    profile/               PATCH /me, address book (ownership-scoped CRUD)
    catalog/               Categories, brands, products (list/detail/search/compare), Q&A
    discovery/             Wishlist (atomic toggle), recently-viewed (capped recency)
    cart/                  Guest + authenticated cart, revalidation, guest->user merge on login/register
    checkout/               Pricing engine (coupon + promotion + flat tax/shipping) and the checkout transaction
    payments/              Payment provider interface + development adapter; charge/refund orchestration
    webhooks/              HMAC-signed, deduplicated, amount/currency-validated payment webhooks
    orders/                 List/detail/cancel (restocks), returns
    sellers/               Onboarding, product/variant/inventory CRUD, fulfillment, shipments — all seller-scoped
    admin/                  Users, sellers, categories/brands, product moderation, returns/refunds, coupons, audit
                           log, real MongoDB-aggregation analytics (platform-wide + seller-scoped), AI provider/
                           conversation oversight (metadata-only list, audit-logged single-conversation drill-in)
    reviews/               Verified-purchase review creation
    support/               Customer tickets/messages; agent assignment and internal-note separation
    notifications/         In-app notification list/read
    ai/                    Deterministic catalog/review/order retrieval (never generative) grounds every reply;
                           an optional real LLM (`llmProvider.ts`, Anthropic) only rephrases already-fetched facts
                           into prose when `AI_PROVIDER=anthropic` + `AI_API_KEY` are set, with a strict
                           timeout + automatic fallback to the deterministic reply on any error. Discovery,
                           compare, support (FAQ + authenticated order status), review summaries, related
                           products, and user-deletable conversation history.
  openapi/               openapi.yaml (representative routes) + Swagger UI mount (non-production only)
  app.ts / server.ts     Express app factory (testable without listening) / process entry point
```

Every custom repository error class is mapped in `http/mapKnownError.ts` — controllers just `throw` the domain error and the central error handler applies the right HTTP status/code once.

## Test results

```text
Test Suites: 19 passed, 19 total
Tests:       104 passed, 104 total
Time:        ~96s (--runInBand)
```

Run with `--runInBand` (serial) for a reliable count. Under Jest's default parallel workers, this many `mongodb-memory-server` replica-set instances starting concurrently can occasionally produce a resource-contention flake (an HTTP parse error on an unrelated suite) in this sandboxed environment — an environment characteristic, not a test defect; it does not reproduce serially and has not been observed against a real standalone `mongod`.

(Jest is configured with `forceExit: true` — `mongodb-memory-server`'s spawned `mongod` subprocesses leave a handle open that otherwise keeps the already-finished Jest process from exiting; this does not affect the real server, which shuts down cleanly on SIGINT/SIGTERM.)

Breakdown:
- **Unit** (2 suites): Money arithmetic; the LLM provider adapter (successful/erroring/timed-out real-provider calls, and that a configured-but-failing provider always falls back to the deterministic reply rather than propagating the error).
- **Schema/model** (4 suites): user/product/coupon/review validation, unique constraints, public-registration role safety.
- **DB-repository integration** (7 suites, real `mongodb-memory-server` replica set): inventory reservation concurrency (overselling prevention), checkout idempotency races, coupon usage-limit races, refund-cap enforcement, cart merge, address/seller ownership boundaries, Idempotency-Key semantics.
- **HTTP integration** (6 suites, Supertest against the real Express app + real replica set): auth (registration role-safety, login, refresh rotation/reuse detection), golden-path checkout (guest cart → register-merges-cart → checkout → order history) and idempotency conflict/replay, cross-tenant ownership boundaries (customer-vs-customer, seller-vs-seller, role enforcement), payment webhooks (invalid signature, amount/currency mismatch, first-time processing + dedup, out-of-order-safe ignore), admin coupon/refund-cap/analytics/moderation-queue/payment-attempt/AI-oversight enforcement, AI discovery/compare/support/conversation-privacy/related-products/review-summary grounding.

Also manually smoke-tested against a live local replica set with the real server running (`npm run dev`): full guest→register→cart-merge→address→checkout-with-coupon→payment-capture→inventory-decrement→cancel→restock cycle, seller onboarding→pending-review block→admin-approve→product-create→variant→submit→admin-publish cycle, AI discovery/related-products/review-summary grounded in real seeded catalog and review data, and the admin console's login→cookie-refresh→every-major-screen flow (see `apps/admin/README.md`).

## Known limitations

- Built/tested on Node 20.20.0 against the pinned Node 22 LTS requirement; re-verify on 22 before treating this as a release baseline.
- **Payments remain a development-only provider**, clearly labeled (`DevelopmentPaymentProvider`). Live payment provider integration is blocked on real credentials per `docs/task-checklist.md` — `src/modules/payments/provider.ts` is the seam a real adapter would implement.
- **AI has a real-provider path (`src/modules/ai/llmProvider.ts`, Anthropic) but it is unverified against a live key** in this environment (no `AI_API_KEY` configured) — the adapter, its timeout/fallback behavior, and the architectural grounding guarantee (the model only ever rephrases facts the backend already fetched; it is never given tool access or asked to decide what to retrieve) are unit-tested with a mocked `fetch`, not exercised against the real Anthropic API. `AI_PROVIDER=development` (the default) runs the original deterministic keyword/FAQ-matching provider, which every manual smoke test above actually exercised.
- **Tax and shipping are flat placeholder policies** (`TAX_RATE_BASIS_POINTS`, `FLAT_SHIPPING_MINOR`, `FREE_SHIPPING_THRESHOLD_MINOR` in `.env`), not a real tax-jurisdiction or carrier-rate integration. See `pricing.service.ts`'s doc comment.
- **No file upload / object storage endpoint.** Product images and seller verification documents are storage-key string fields only; nothing in this stage actually accepts or stores a binary upload.
- **No real notification delivery.** Notifications are in-app (list/read) only — no email/SMS/push adapter is wired up, consistent with not claiming an unconfigured integration works.
- **Shipment tracking is a simulator** (`POST /seller/orders/:orderId/shipments` creates a label-created record you can append events to by hand) — no real carrier API integration.
- **OpenAPI coverage is representative, not exhaustive** — `openapi.yaml` documents the shared envelope and one or two routes per group, not every implemented endpoint. Treat the actual Express routers as the source of truth for the full surface.
- **AI review summaries are extractive, not abstractive, under the development provider** — a deterministic rating-average/distribution computation plus up to 3 verbatim review excerpts. A real LLM provider only ever smooths that same data into prose; it is never given license to add a claim no reviewer actually made.
- **No file-upload path for review bodies, FAQ content, or support policy text to ground against beyond the small hardcoded FAQ list** in `developmentProvider.ts` — a real deployment's "policy-based support" would need a genuine policy corpus, not 4 keyword-matched entries.
- **JWT role changes require a token refresh to take effect** — an access token minted before a role grant (e.g. seller onboarding, admin promotion) still carries the old role claims until `/auth/refresh` is called. This is intentional (short-lived tokens, not revocation-checked per request) but worth knowing when testing manually.
- Rate limiting is implemented per route group (`src/http/middleware/rateLimit.ts`) but is skipped under `NODE_ENV=test` for deterministic test runs, and was not separately load-tested.
