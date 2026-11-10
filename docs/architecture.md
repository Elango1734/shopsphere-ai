# Architecture

## System shape

Start with a **modular monolith**: one versioned Express API and MongoDB deployment, with domain modules and provider interfaces. This keeps checkout, inventory, and order transitions transactionally understandable while the product is early. Split services only when measured scale, ownership, or isolation requirements justify the operational cost.

```text
React Native mobile ─┐
                     ├── REST /api/v1 ── Express domain modules ── MongoDB replica set
React admin web ─────┘                         │
                                               ├── PaymentProvider
                                               ├── AiProvider + catalog/policy retrieval
                                               └── ObjectStorageProvider
```

The API is authoritative for identity, access control, prices, promotions, tax/shipping calculations, inventory, orders, and payment state. Mobile and admin clients consume typed contracts and never access MongoDB or provider secrets directly.

## Workspace ownership

| Path | Responsibility |
| --- | --- |
| `apps/mobile` | React Native customer experience; TanStack Query server state, Zustand client state. |
| `apps/admin` | React/TypeScript/Vite seller and operations experience. |
| `apps/api` | Express REST API, domain services, persistence, provider adapters, OpenAPI. |
| `packages/shared-types` | Transport DTOs, envelopes, stable IDs, money and lifecycle types. |
| `packages/validation` | Zod input schemas shared where practical; API always validates independently. |
| `packages/api-client` | Typed REST client generated or checked against OpenAPI. |
| `packages/config` | Shared lint, TypeScript, and design-token configuration. |
| `infrastructure/docker` | Local and deployment container assets. |
| `docs` | Product and engineering contracts. |

## Domain boundaries

Keep modules aligned to identity/access, catalog, inventory, cart/promotions, checkout/payments, orders/fulfillment, reviews, seller, support/notifications, administration/audit, and AI. Modules own their persistence operations; cross-domain writes use explicit application services. Avoid direct controller-to-model business logic.

Use MongoDB transactions for multi-document checkout and inventory transitions; production and local MongoDB must use a replica set. Inventory reservations have explicit expiry/release processing; TTL indexes may clean stale reservation records but are not the inventory-release mechanism. Use an outbox or equivalent durable event record for side effects that must survive process restarts.

## Technology baseline

Use Node.js 22 LTS, npm 10, TypeScript 5.8.3, Express 5.1.0, and Mongoose 8.13.2 for the API. For web, use React 19.0.0, Vite 6.3.5, and TanStack Query 5.74.4. For mobile, use Expo SDK 53 with its compatible React Native 0.79 / React 19.0.0 baseline, TanStack Query 5.74.4, and Zustand 5.0.3. Shared forms use React Hook Form 7.56.3 and Zod 3.24.2. Use Vitest 3.1.2 for web, Jest 29.7.0 with the matching React Native preset and React Native Testing Library 13.2.0 for mobile, and Supertest 7.1.0 for API tests.

These are initial compatible baseline pins, not a substitute for a lockfile or security review. At each implementation stage, verify framework peer dependencies and active security support, pin exact resolved versions in package manifests/lockfile, and document any necessary upgrade before adoption. Do not independently upgrade React Native and React.

## Shared design direction

Define design tokens once in `packages/config` (or a dedicated design-token package if platform export requires it): warm ivory, midnight navy, electric coral, typography, spacing, motion, and light/dark semantic color roles. Mobile and web adapt components to native platform conventions while preserving token values and accessible contrast. Use original layouts and licensed/editorial product imagery; never copy a marketplace brand's composition.

## Cross-cutting contracts

- REST base path is `/api/v1`; document operations and schemas in OpenAPI.
- JSON responses use the shared success/error envelopes in [API specification](api-specification.md). Every response has a request ID; collection metadata carries pagination.
- Public IDs are opaque strings. API DTOs are explicit mappings, never raw Mongoose documents.
- Money uses integer minor units and an ISO 4217 currency code. Persist and return timestamps as UTC ISO 8601 strings.
- Authentication establishes identity; server policy checks role, ownership, and resource-level permission on each operation.
- Checkout uses idempotency keys and server-side total calculation. Payment state changes only after a verified provider event or trusted server-side provider confirmation.
- AI tools are read-oriented and policy-constrained by default. Any proposed action must be confirmed through ordinary authenticated APIs and business rules.