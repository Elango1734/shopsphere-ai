# Deployment

## Environments

Keep local, test, staging, and production isolated by credentials, databases, storage, allowed origins, and provider accounts. Use Node.js 22 LTS and a MongoDB replica set for all environments that exercise transactions. The initial repository does not include a deployable API or production configuration.

## Local development

Prerequisites: Node.js 22, npm 10, Docker (once local MongoDB is added). Copy `.env.example` to a local ignored `.env`, replace development secrets with generated random values, and never use production credentials locally. `MONGODB_URI` must point to a replica-set deployment for transaction-dependent stages. Local payment/AI adapters may simulate success only when clearly marked development-only and must never be enabled in production.

## CI/CD target

GitHub Actions should run on pull requests and protected-branch pushes: install with lockfile (`npm ci`), lint/format checks, type checks, unit/integration tests, OpenAPI validation, dependency/secret scanning, and build artifacts. Deploy immutable images/artifacts through staging, run migrations/index changes as controlled jobs, perform smoke checks, then promote with approval and rollback capability. Pin or verify third-party actions and use least-privilege workflow permissions and OIDC where supported.

## Runtime controls

- Store secrets in a managed secret store; inject at runtime, rotate, and keep them out of images and logs.
- Use TLS termination, strict CORS, health/readiness endpoints, graceful shutdown, resource limits, and structured JSON logs with request IDs.
- Run API instances statelessly behind a load balancer. Use managed MongoDB with replica set, backups, encryption, restricted network access, monitoring, and tested restore/point-in-time recovery.
- Use object storage for uploads with private-by-default access, scanning, lifecycle policies, and CDN delivery only for approved public media.
- Monitor API latency/error rate, database saturation, checkout/inventory conflicts, payment webhook lag/failures, queue/outbox age, and provider availability. Alert on actionable thresholds.
- Use backward-compatible schema/index changes and documented rollback plans. Do not assume MongoDB schema changes are transactional across deploys.

## Release readiness

Production launch requires completed security and test gates, provider webhook verification, reconciliation and refund procedures, support/admin access controls, backup-restore evidence, incident contacts, privacy/retention policy, and a rollback plan. Secrets and external credentials are intentionally absent from this foundation; integration status remains blocked until provisioned and verified.