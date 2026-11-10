# Entity and Status Glossary

These terms are the shared language for API, database, admin, mobile, and AI stages. New lifecycle values require a documented transition rule and coordinated contract update; never overload one status field to represent separate processes.

## Shared entities

| Entity | Meaning |
| --- | --- |
| User | Authenticated account and granted roles. A guest is not a persisted user role. |
| Seller | Marketplace business profile; seller access is constrained to owned resources. |
| Product | Catalog-level description, category, brand, specifications, and moderation state. |
| Variant / SKU | Sellable product option with its own identifier, SKU, attributes, price, and inventory reference. |
| Inventory | On-hand and reserved quantities for a variant/SKU. Available quantity is derived, not trusted from clients. |
| Cart | Mutable purchase intent. Cart prices are indicative; checkout recalculates authoritative values. |
| Order item snapshot | Purchase-time name, SKU, attributes, seller, price, discount, quantity, and line values retained for history. |
| Payment | Provider-facing collection/refund lifecycle, separate from fulfillment. |
| Fulfillment | Picking, shipment, delivery, cancellation, and return progression, potentially per seller shipment. |
| Reservation | Temporarily held inventory with an explicit active/committed/released/expired state. |
| Return / Refund | A return request and a monetary reversal are distinct records and transitions. |
| Request ID | Server-generated identifier for correlating a single HTTP request across response and logs. |
| Idempotency key | Client-supplied operation key scoped to identity and operation, preventing duplicate logical checkout/payment mutations. |

## Canonical statuses

| Lifecycle | Values | Notes |
| --- | --- | --- |
| User role | `customer`, `seller`, `support_agent`, `administrator` | Roles grant capabilities, not unconditional resource access. Guest is unauthenticated. |
| Seller | `pending_review`, `active`, `suspended`, `rejected`, `closed` | Only active sellers can perform approved selling operations. |
| Payment | `pending`, `authorized`, `paid`, `failed`, `partially_refunded`, `refunded`, `cancelled` | Change only through trusted server/provider events and guarded transitions. |
| Fulfillment | `pending`, `confirmed`, `processing`, `partially_shipped`, `shipped`, `delivered`, `cancelled`, `return_requested`, `returned` | Does not imply payment success. Multi-seller fulfillment may be tracked per shipment/fulfillment unit. |
| Inventory reservation | `active`, `committed`, `released`, `expired` | Release is an atomic inventory operation; TTL deletion is not release. |
| Return | `requested`, `approved`, `rejected`, `in_transit`, `received`, `refunded`, `closed` | `refunded` references a successful refund; not every return necessarily refunds automatically. |
| Refund | `pending`, `processing`, `succeeded`, `failed`, `cancelled` | May be partial; cumulative successful refunds cannot exceed captured amount. |

## Common conventions

- IDs in public APIs are opaque strings; internal MongoDB IDs are implementation details.
- Persisted/API timestamps are UTC; API representation is ISO 8601.
- Monetary values are integer minor units plus explicit ISO 4217 currency.
- Quantities are positive integers unless a specific stock adjustment operation defines otherwise.
- Status transitions are explicit, authorized, auditable, and idempotent where retried. Invalid transitions return a structured conflict instead of silently rewriting history.