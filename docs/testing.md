# Testing Strategy

Tests must prove behavior at the owning boundary. Any test suite introduced with a stage must run in CI and use deterministic fixtures, isolated data, and no real payment/LLM credentials by default.

## Layers

- **Shared contracts:** TypeScript strict typecheck; Zod schema tests; OpenAPI/schema drift checks.
- **API unit:** domain calculations and state transitions (money, promotions, eligibility, authorization policy) with provider interfaces mocked at the boundary.
- **API integration:** Jest and Supertest against an isolated MongoDB replica set, covering routes, validation, persistence, request IDs, errors, and authorization. Replica-set transactions must be exercised, not mocked away.
- **Web:** Vitest and React Testing Library for accessible interaction, forms, loading/error/empty states, and role-aware flows.
- **Mobile:** Jest and React Native Testing Library for navigation, secure-session behavior, forms, and customer workflows; mock network at the client boundary.
- **End-to-end:** suitable browser/device tooling (Playwright for admin web and an appropriate mobile E2E runner) against a seeded non-production environment.
- **Non-functional:** accessibility checks, performance budgets, dependency/security scanning, and focused load tests for search and checkout before launch.

## Required high-risk cases

- Server rejects client-tampered prices, discounts, taxes, shipping, roles, stock, and payment status.
- Seller/customer cross-tenant access fails for every relevant resource and HTTP method.
- Concurrent checkout cannot oversell; idempotent retries do not create duplicate orders or charges; expired reservations release exactly once.
- Webhook invalid signatures, duplicate/replayed events, wrong amount/currency, and out-of-order events cannot incorrectly mark an order paid.
- Payment status and fulfillment status transition independently; return/refund eligibility and partial refunds follow explicit transitions.
- API errors remain safe and structured, with request IDs and no stack/secret leakage. Pagination has bounds and deterministic ordering.
- AI outputs are grounded, distinguish uncertainty, resist retrieved-content instruction injection, and cannot bypass domain authorization or mutations.

## Commands and gates

The initial stage only provides `npm run typecheck:shared-types`; feature test commands are added with their owning packages. CI must install from the committed lockfile, run formatting/linting, type checks, unit and integration tests, OpenAPI validation, and security checks. Merge gates may not silently skip failed or unavailable required checks. Document environment prerequisites and report unverified suites honestly.