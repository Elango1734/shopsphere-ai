# ShopSphere AI — Admin & Seller Operations Console

React 19 + TypeScript + Vite single-page app for platform administrators, sellers, and support agents. Consumes the API exclusively through `@shopsphere/api-client`; holds no business logic of its own beyond client-side UX (every permission check here is also enforced server-side — see "Security model").

## Stack

React 19.0.0 · Vite 6.3.5 · TanStack Query 5.74.4 · React Router 6.28.0 · React Hook Form 7.56.3 + Zod 3.24.2 (schemas imported directly from `@shopsphere/validation` — one source of truth shared with the backend) · Vitest 3.1.2 + React Testing Library 16 for tests.

## Setup

```bash
cd apps/admin
cp .env.example .env.local   # set VITE_API_BASE_URL if the API isn't on localhost:4000
npm install                  # from the monorepo root; this is an npm workspace
npm run dev --workspace=@shopsphere/admin   # http://localhost:5173
```

The API server must be running (MongoDB replica set + `npm run dev --workspace=@shopsphere/api` from the repo root) and its `WEB_ORIGINS` env var must include `http://localhost:5173` (it does by default — see the root `.env.example`).

Sign in with a seeded admin account (`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` in the root `.env`) or register a customer, onboard them as a seller, and approve the seller from an admin account.

### Env vars

| Var | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:4000/api/v1` | Base URL the api-client sends every request to. Vite only exposes `VITE_`-prefixed vars to client code. |

## Commands

```bash
npm run dev --workspace=@shopsphere/admin        # dev server
npm run build --workspace=@shopsphere/admin      # tsc -b && vite build -> dist/
npm run preview --workspace=@shopsphere/admin    # serve the production build locally
npm run typecheck --workspace=@shopsphere/admin  # tsc --noEmit
npm run test --workspace=@shopsphere/admin       # vitest run
```

**Actual results as of this stage:** `typecheck` — clean, zero errors. `test` — **29/29 passing** across 11 files. `vite build` — succeeds (`dist/` ~482 kB JS / ~7 kB CSS, gzipped ~139 kB JS).

## Security model

Every route guard in this app (`ProtectedRoute`, the role-filtered `Sidebar`) is a **UX convenience only**. The actual authorization boundary is server-side: every `/admin/*`, `/seller/*`, and `/support-agent/*` endpoint independently checks the caller's role via Express middleware (`requireRole`), regardless of what this UI renders. A user who guesses a URL for a page they can't use gets a 403 from the API, not leaked data — the UI redirect/access-denied screen is just a nicer failure mode than a raw error toast.

The access token lives in memory only (never `localStorage`), re-established on page load via `POST /auth/refresh` relying on the httpOnly `ss_refresh` cookie (`credentials: 'include'`) rather than a token the app can read. A background timer silently refreshes it every 10 minutes (comfortably inside the default 15-minute access-token TTL).

## Route map

| Path | Access | Page |
|---|---|---|
| `/login` | public | `LoginPage` |
| `/unauthorized` | any authenticated user | access-denied state |
| `/` | redirects by role (admin → `/admin`, seller → `/seller`, support agent → `/support`) | `LandingRedirect` |
| `/admin` | `administrator` | `AdminDashboardPage` — real analytics overview |
| `/admin/analytics` | `administrator` | `AnalyticsPage` — revenue breakdown, CSV export |
| `/admin/users` | `administrator` | `UsersListPage` |
| `/admin/users/:userId` | `administrator` | `UserDetailPage` — suspend/reactivate |
| `/admin/sellers` | `administrator` | `SellersListPage` |
| `/admin/sellers/:sellerId` | `administrator` | `SellerDetailPage` — approve/reject/suspend |
| `/admin/catalog/categories` | `administrator` | `CategoriesPage` |
| `/admin/catalog/brands` | `administrator` | `BrandsPage` |
| `/admin/catalog/products` | `administrator` | `ProductModerationPage` — approve/reject queue |
| `/admin/orders` | `administrator` | `OrdersListPage` |
| `/admin/orders/:orderId` | `administrator` | `OrderDetailPage` — items, payment attempts, refunds |
| `/admin/returns` | `administrator` | `ReturnsPage` — approve/reject return requests |
| `/admin/coupons` | `administrator` | `CouponsPage` |
| `/admin/ai` | `administrator` | `AiAdminPage` — provider status, conversation oversight |
| `/admin/ai/conversations/:conversationId` | `administrator` | `AiConversationDetailPage` — audit-logged drill-in |
| `/seller` | `seller` | `SellerDashboardPage` — own-scoped analytics |
| `/seller/products` | `seller` | `SellerProductsPage` |
| `/seller/products/:productId` | `seller` | `SellerProductDetailPage` — variants/inventory |
| `/seller/orders` | `seller` | `SellerOrdersPage` |
| `/seller/orders/:orderId` | `seller` | `SellerOrderDetailPage` — create shipment |
| `/seller/inventory` | `seller` | `SellerInventoryPage` — low-stock restock |
| `/support` | `support_agent` or `administrator` | `SupportDashboardPage` — assigned/unassigned queues |
| `/support/tickets/:ticketId` | `support_agent` or `administrator` | `TicketDetailPage` — reply, internal notes, resolve/close |
| `*` | — | `NotFoundPage` |

## Component structure

```
src/
  api/              ApiClient wiring (in-memory token), TanStack QueryClient config
  auth/              AuthContext — session bootstrap, login/logout, role checks
  theme/            ThemeProvider — applies @shopsphere/config tokens as CSS vars, light/dark/system
  routes/            router.tsx (route tree), ProtectedRoute, LandingRedirect, NotFoundPage
  components/
    layout/          AppShell, Sidebar (role-filtered nav), Header (theme toggle, logout), Breadcrumbs
    ui/              Button, ControlledField (text/select/textarea via useController, not <Controller>),
                      DataTable, Pagination, FilterBar, StatusBadge, Modal/ConfirmDialog, ToastProvider,
                      StateViews (Loading/Error/Empty/AccessDenied)
  features/          one folder per domain area (auth, dashboard, analytics, users, sellers, catalog,
                      orders, returns, coupons, ai, seller-dashboard, support) — each page owns its
                      TanStack Query calls and, where relevant, its React Hook Form + Zod form
  utils/             money (Intl.NumberFormat over Money), date, csv (client-side export + download)
styles/              global.css (resets, base element styles), components.css (BEM-ish component styles,
                     all colors/spacing via CSS custom properties from ThemeProvider — no literal hex)
tests/               Vitest + RTL suite (see below)
```

## API endpoint mapping

Every call goes through `@shopsphere/api-client`'s typed modules — no raw `fetch` in feature code.

| Client module | Backend mount | Used by |
|---|---|---|
| `api.auth` | `/api/v1/auth` | `AuthContext` (login, refresh, logout) |
| `api.catalog` | `/api/v1/categories`, `/products` (public GETs) | `CategoriesPage`, `BrandsPage`, `SellerProductsPage` (category picker) |
| `api.admin` | `/api/v1/admin/*` | every `/admin/*` page |
| `api.seller` | `/api/v1/seller/*` | every `/seller/*` page |
| `api.supportAgent` | `/api/v1/support-agent/*` | `SupportDashboardPage`, `TicketDetailPage` |

Endpoints added to the backend specifically to support this app (previously missing, now covered by backend HTTP tests in `apps/api/tests/http/admin.http.spec.ts`):
- `GET /admin/analytics/overview`, `GET /seller/analytics/overview` — real MongoDB aggregations, not client-computed sums
- `GET /admin/users/:userId`, `GET /admin/sellers/:sellerId` — detail lookups with derived counts
- `GET /admin/products` — the moderation queue listing (previously only the single-resource moderate action existed)
- `GET /admin/orders/:orderId/payment-attempts` — how the refund UI discovers a `paymentAttemptId`
- `GET /admin/ai/overview`, `GET /admin/ai/conversations`, `GET /admin/ai/conversations/:id` — provider status and conversation oversight, metadata-only in the list, audit-logged on single-conversation drill-in

## Testing

`npm run test --workspace=@shopsphere/admin` (Vitest + jsdom + React Testing Library). 29 tests across 11 files, covering every area the spec calls out:

- **Auth & protected routes** (`tests/auth/ProtectedRoute.test.tsx`): redirects a signed-out user to `/login`, shows access-denied for the wrong role, renders content for the right role. Confirms these are UX gates only — see Security model.
- **Form validation** (`tests/auth/LoginPage.test.tsx`, `tests/features/CouponsPage.test.tsx`): required-field errors, server-rejected credentials, coupon code length, date-order validation.
- **Accessible forms** (`tests/components/ControlledField.test.tsx`): label/input association via `htmlFor`/`id`, `aria-invalid`/`aria-describedby` wiring, `role="alert"` on errors.
- **Permission-based navigation** (`tests/layout/Sidebar.test.tsx`): a seller account never sees admin/support nav items and vice versa.
- **Catalog CRUD** (`tests/features/CategoriesPage.test.tsx`): list, create, and the error+retry path.
- **Seller data isolation** (`tests/features/SellerDataIsolation.test.tsx`): pins down at the client-wiring level that seller screens only ever call seller-scoped endpoints, never admin-scoped ones (the actual isolation boundary is server-side — see `apps/api`'s `requireActiveSellerForUser`).
- **Order management & refund workflow** (`tests/features/OrderDetailPage.test.tsx`): renders items/totals, opens the refund modal, converts major-unit input to minor units correctly.
- **Return review workflow** (`tests/features/ReturnsPage.test.tsx`): approve (full and partial amount), reject.
- **Pagination & filters** (`tests/features/UsersListPage.test.tsx`, `tests/components/Pagination.test.tsx`): filter changes reset to page 1 and refetch with the right params; Previous/Next disable at the bounds.
- **API error states**: every list page's `DataTable` renders a retry-able error state on query failure (exercised directly in the `CategoriesPage` suite).

API calls are mocked via `tests/mocks/apiClientMock.ts` (a hand-rolled stand-in for `src/api/client.ts`) — no real network/backend involved in the test run.

### Manual verification against the live backend

Beyond the automated suite, every major flow was exercised directly against the running API with real seed data during this build: login, cookie-based silent refresh, the admin analytics/AI/product-moderation/payment-attempts endpoints, approving a pending seller, and creating a coupon end-to-end (including the blank-optional-field path — see Known limitations). `npx vite build` was also run to confirm the custom workspace-package resolver (below) works in a production build, not just dev.

## Known limitations

- **AI provider is a rule-based development stub**, not a hosted LLM (`AI_PROVIDER=development` in the backend). The Sphere AI admin page reports this honestly (`provider`, `model: null`, `apiKeyConfigured: false`) rather than faking a richer status. Full provider integration is Prompt 6 scope.
- **Single-currency assumption** in all analytics: `AnalyticsOverview.currency` picks one currency rather than bucketing by currency, matching the single-currency seed data. A genuinely multi-currency deployment would need the backend aggregation reworked first.
- **Gross/net revenue excludes commission and payment-processor fees** — documented in `AnalyticsPage` itself, not just here.
- **No image upload UI.** Product creation captures name/category/description only; `images`/`attributes` arrays exist in the schema and backend but have no form control here yet — a seller would need a future "manage images" page.
- **No admin UI to create a seller or a user directly** — sellers self-onboard via `/seller/onboard` (not exposed in this app, since it's a customer-facing flow) and admins only approve/suspend existing ones.
- **CSV export covers orders and category performance only** (the two tabular datasets the analytics endpoint returns), not every list page.
- **Background session refresh is interval-based (every 10 minutes), not reactive to the access token's actual expiry** — simple and sufficient for an operations console's usage pattern, but a user idle for longer than one interval plus the access-token TTL would need to re-authenticate on their next action rather than being silently carried through.
- **Vite dev/build requires a custom resolver plugin** (`vite.config.ts`'s `workspaceTsExtensionResolver`) because every `@shopsphere/*` package uses Node-ESM-style relative imports ending in `.js` that actually point at sibling `.ts` files — the same convention `apps/api` runs under `tsx` for and `apps/mobile` needed a custom Metro resolver for. Vite/esbuild doesn't redirect an explicit `.js` specifier to `.ts` by default, so this plugin does it by checking the filesystem.
