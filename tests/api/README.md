# API Permission Tests

This directory contains minimal API permission checks using Vitest + native `fetch`.
No Postman, Bruno, or extra test framework is required.

## What is checked

### 1) Unauthenticated requests must be rejected (401)

File: `tests/api/auth-protection.test.ts`

Checks that protected endpoints return `401` when no session cookie is provided.

Covered endpoint groups:
- Upload: `/api/upload`
- Account and billing: `/api/credits/*`, `/api/orders`, `/api/subscription/*`, `/api/affiliate/*`, `/api/withdrawal/*`
- AI and payments: `/api/chat`, `/api/image-generate`, `/api/video-generate/*`, `/api/payment/*`
- Admin: `/api/admin/users`, `/api/admin/orders`, `/api/admin/subscriptions`, `/api/admin/credits/transactions`, `/api/admin/blog`
- User management: `/api/users/:id` (tested with a fake ID)

### 2) Authenticated non-admin must be forbidden on admin APIs (403)

File: `tests/api/admin-permission.test.ts`

The test creates a normal user via Better Auth, then checks admin-only endpoints return `403`.

Covered endpoints:
- `/api/admin/users`
- `/api/admin/orders`
- `/api/admin/subscriptions`
- `/api/admin/credits/transactions`
- `/api/admin/blog`
- `/api/admin/blog/:id` (tested with a fake ID)
- `/api/users/:id` (admin-only user detail API)

### 3) Public endpoints must stay public (not 401)

File: `tests/api/public-endpoints.test.ts`

Checks that intentionally public endpoints are still accessible without login.
Assertion is `status !== 401` (response may be `200`, `400`, `404`, etc. depending on payload).

Covered endpoints:
- `/api/health`
- `/api/blog`
Payment, AI and user purchase endpoints are active Backend routes. Their unauthenticated and cross-user boundaries are covered by the active permission and ownership suites; provider business behavior is additionally covered by unit and Playwright tests.

This catches IDOR-style regressions where an endpoint accidentally leaks another user's data.

## How to run

1. Start Backend and Web on ports `8002` and `8001`: `pnpm dev:web`
2. Run API tests:
   - `pnpm test:api`

The suite targets the shared Backend directly by default. Browser-host behavior and same-origin gateways are covered by Playwright.

## Scope and non-goals

This suite focuses on permission contracts only:
- `401` for missing auth
- `403` for missing admin permission
- public endpoints not accidentally protected
- ownership boundaries for user-scoped resources (cross-user isolation)

This suite does **not** verify:
- full response schema for each API
- full business logic correctness
- provider-side integrations (Stripe/PayPal/Creem behavior details)
- UI behavior (covered by E2E tests)
