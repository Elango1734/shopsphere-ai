# Security Contract

Security is enforced at the API and infrastructure boundaries; hiding a UI control is not authorization. Threat-model payment, identity, seller isolation, uploads, support access, and AI tool use before release.

## Identity and access

- Hash passwords with Argon2id using reviewed parameters (or a vetted platform-supported alternative); never log, return, or store plaintext passwords.
- Use short-lived access tokens and rotating, revocable refresh sessions. Store only refresh-token hashes server-side. Mobile stores credentials only in iOS Keychain/Android Keystore-backed secure storage, never AsyncStorage or ordinary local storage.
- Apply role checks plus ownership/resource-level policy to every protected operation. Enforce seller ownership in queries and mutations, and customer ownership for addresses, carts, orders, returns, and tickets. Support access is assignment- and purpose-scoped; administrator actions are audited.
- Avoid account enumeration; rate-limit login, registration, refresh, password reset, search, AI, and sensitive mutations. Require MFA for privileged roles before production launch.

## Input and browser defenses

- Parse and validate all untrusted input on the server with allowlisted schemas, bounds, and explicit DTO mapping. Reject MongoDB operators and unsafe key paths; never pass request objects directly into Mongoose filters or updates.
- Use security headers (including CSP where applicable), strict production CORS origin allowlists, HTTPS, secure cookie attributes, and CSRF defenses for cookie-authenticated browser mutations.
- Escape/render user content safely; sanitize any permitted rich text. Use output encoding and avoid unsafe HTML injection.
- Enforce request size limits, content-type checks, and safe upload policies: allowlisted formats, magic-byte inspection, size limits, generated object names, malware scanning where available, and non-executable private storage. Serve downloads through authorization-aware URLs.

## Secrets, payments, and data

- Keep secrets in deployment secret management, not source, images, logs, mobile bundles, or committed environment files. Rotate credentials and separate dev/test/prod secrets.
- Verify payment webhook signatures against the exact raw request body, enforce timestamp/replay controls as supported, deduplicate event IDs, and validate amount/currency/order association before state transition. Never store card numbers or security codes; use provider-hosted/tokenized collection.
- Use TLS in transit, encrypted managed storage/backups, least-privilege database credentials, restricted network access, and tested restore procedures.
- Redact credentials, payment data, tokens, and unnecessary personal data from structured logs and traces. Keep audit trails for security-sensitive actions without copying secrets into them.
- Define access, retention, deletion, export, and breach-response processes for personal data before launch.

## AI boundary

AI provider credentials and prompts stay server-side. Ground catalog claims in current catalog records and policy answers in approved policy sources. Treat user and retrieved content as untrusted; prevent prompt injection from granting tools or leaking other users' data. AI may propose but must not perform checkout, authorization changes, inventory mutations, payment/refund transitions, or unsupported policy commitments. Tool calls pass through the same authenticated application services and authorization checks as ordinary API requests.

## Operational gates

Before production: dependency and container scanning, secret scanning, security headers/CORS review, authorization tests for cross-tenant access, webhook signature/replay tests, upload abuse tests, rate-limit verification, audit review, and incident/credential-rotation runbooks. Record residual risks and owners; do not claim a control is implemented solely because it appears here.