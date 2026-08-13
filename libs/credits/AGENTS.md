# AGENTS.md

## Scope

`libs/credits` is the Backend-internal credit ledger used by user APIs, AI billing, payment fulfillment, affiliate rewards and Admin queries.

## Rules

- User routes may expose only the authenticated user's balance and ledger; global queries remain behind `requireAdminAPI`.
- Every mutation requires a stable transaction ID. Retries must return the existing outcome and never duplicate a ledger row.
- Balance mutation and ledger insertion remain atomic on PostgreSQL, SQLite and D1; conditional consumption must not overdraw.
- AI and provider failures use a deterministic refund transaction ID and reconciliation metadata.
- Bound pagination and validate query inputs in the API adapter; preserve Admin sorting and join fields.
- Run credit/unit, user ownership, Admin API/E2E and Backend Node + Workers builds after changes.
