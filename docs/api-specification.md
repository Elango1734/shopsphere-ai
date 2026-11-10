# API Specification

The API is REST/JSON under `/api/v1`. OpenAPI 3.x is the machine-readable source of truth and is served in non-production or access-controlled environments. Inputs are validated server-side. Controllers map explicit DTOs; database documents are never returned directly.

## Response contract

Successful response:

```json
{
  "success": true,
  "data": {},
  "meta": {},
  "requestId": "req_opaque"
}
```

Failure response:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid",
    "details": [{ "code": "INVALID_FORMAT", "message": "Enter a valid email", "field": "email" }]
  },
  "requestId": "req_opaque"
}
```

All responses include a server-generated request ID. `meta` is always present on success; use `{}` when empty. Collection responses put `page`, `pageSize`, `totalItems`, and `totalPages` in `meta.pagination`. Pagination is one-based, bounded by a server maximum, and stable sorting must include a deterministic tie-breaker. Dates are UTC ISO 8601 strings. Money is `{ "amountMinor": 1299, "currency": "USD" }`; never use floating-point currency values.

Errors use stable uppercase codes, a safe client message, and optional field-level details. Suggested HTTP mapping: 400 malformed request, 401 unauthenticated, 403 unauthorized, 404 missing/not visible, 409 state or idempotency conflict, 422 semantically invalid request, 429 rate limited, 500 unexpected internal error, 503 unavailable dependency. Do not disclose stack traces, database details, provider secrets, or sensitive personal data. Unexpected errors are logged server-side against the request ID.

## Shared types

`@shopsphere/shared-types` defines `ApiResponse`, success/error envelopes, list query/pagination metadata, `Money`, and shared lifecycle vocabulary. Zod request schemas belong in `packages/validation`; types alone do not validate runtime input. The OpenAPI schema must remain aligned with both.

## Endpoint groups (planned)

All collection routes support documented pagination and filtering where useful. The list below defines ownership and scope; it is not a claim that routes exist yet.

| Group | Representative routes |
| --- | --- |
| Auth/profile | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`; `GET/PATCH /me`; customer addresses/preferences. |
| Catalog | `GET /categories`, `/brands`, `/products`, `/products/{productId}`; search, comparison, reviews. |
| Customer discovery | Wishlist, recently viewed, recommendations. |
| Cart/checkout | `GET/POST/PATCH/DELETE /cart`; `POST /checkout` with `Idempotency-Key`. |
| Orders | Customer order list/detail, cancellation request, return request, shipment tracking. |
| Seller | Onboarding/profile, seller-owned products/variants/inventory, seller fulfillment orders. |
| Support/admin | Tickets and assigned work; protected moderation, user/seller governance, analytics, audit access. |
| AI | `POST /ai/discovery`, `/ai/compare`, `/ai/support`; authenticated context and grounded catalog/policy sources. |
| Provider webhooks | `POST /webhooks/payments/{provider}`; signature verification on raw body before state mutation. |

## Trust and operation rules

- Public reads may be anonymous; private routes require an authenticated principal and per-resource authorization. `seller` role alone does not grant access to another seller's records.
- API requests use bearer access tokens; refresh tokens are rotated/revocable and stored securely by clients. Admin web authentication must use an appropriate secure cookie/session strategy if cookies are used, including CSRF defenses.
- Checkout and payment mutations require an `Idempotency-Key` scoped to principal and operation. Reusing a key with different input returns `409 IDEMPOTENCY_CONFLICT`; retries with the same input return the original logical result.
- Totals are recalculated from current server catalog/promotion/tax/shipping rules. A client redirect never establishes payment success. Only verified webhooks or trusted server-to-provider status checks do.
- Webhook event IDs are deduplicated; acknowledge only after durable acceptance. Handle out-of-order and replayed events with explicit transition guards.
- Use consistent HTTP methods and status codes; avoid destructive side effects on GET. Rate-limit authentication, search, AI, checkout, and upload routes according to risk.

## OpenAPI delivery

The API implementation stage must add a checked-in OpenAPI document, schema validation in CI, documented auth schemes/error examples, and contract tests for actual routes. Generated client types are preferable when they reduce drift and remain readable.