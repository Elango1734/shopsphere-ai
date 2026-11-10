# ShopSphere AI

**Discover Better. Shop Smarter.**

ShopSphere AI is a multi-vendor commerce platform for mobile customers and a web-based seller and operations experience. `apps/api` implements a working MongoDB/Mongoose data layer and Express REST API (auth, catalog, cart, checkout, payments, orders, seller and admin operations, reviews, support, notifications, and a grounded AI module) — see `apps/api/README.md` for setup and test commands. `apps/mobile` implements the full customer-facing React Native (Expo) app against that API — see `apps/mobile/README.md`. `apps/admin` implements the React/Vite operations console for administrators, sellers, and support agents — see `apps/admin/README.md`. External live-provider integrations (real payment/LLM credentials) remain blocked per the task checklist.

## Start here

- [Product requirements](docs/product-requirements.md)
- [Architecture](docs/architecture.md)
- [Database design](docs/database-design.md)
- [API specification](docs/api-specification.md)
- [Security](docs/security.md)
- [Testing](docs/testing.md)
- [Deployment](docs/deployment.md)
- [Master task checklist](docs/task-checklist.md)
- [Entity and status glossary](docs/entity-status-glossary.md)

## Workspace

The repository uses npm workspaces. `apps/mobile`, `apps/admin`, and `apps/api` are implementation boundaries; `packages/shared-types`, `packages/validation`, `packages/api-client`, and `packages/config` hold shared contracts and tooling. Infrastructure and CI live outside the application workspaces.

Baseline prerequisites are Node.js 22 LTS and npm 10. Install dependencies with `npm install`. The initial shared contract can be checked with `npm run typecheck:shared-types`.

## Delivery status

The backend API, mobile customer app, and admin/seller/support operations console are implemented and tested against real local infrastructure (a replica-set MongoDB, the actual Express app, and — for mobile and admin — the live API). Live third-party payment and LLM provider integrations remain blocked on real credentials; both run against clearly-labeled development-mode simulators instead. Feature-by-feature status, evidence, and known limitations are tracked in the [master task checklist](docs/task-checklist.md) and must not be inferred from the directory skeleton alone.