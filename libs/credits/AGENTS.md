# AGENTS.md

## Scope

`libs/credits` is a read-only Backend-internal ledger query module consumed by the Admin transactions API.

## Rules

- Keep all access behind `requireAdminAPI`; never expose cross-user ledger data through a user route.
- Bound pagination and validate query inputs in the API adapter.
- Preserve stable sorting and transaction/user join fields expected by Admin.
- Balance mutation, purchases, bonuses and AI consumption are archived under `legacy/libs/credits`; restore them only with a reviewed billing design, atomicity tests, refund handling and reconciliation metadata.
- Run Admin API/E2E and Backend Node + Workers builds after changes.
