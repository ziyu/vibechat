# AGENTS.md

## Scope

`@vibechat/validators` owns framework-neutral Zod schemas shared by browser applications and Backend API handlers.

## Rules

- Keep schemas independent from React, routers and server providers.
- Reuse `@vibechat/api-contracts` for API DTOs and `@vibechat/i18n` for translated form errors.
- Parse every untrusted API or form input before use; keep response contracts stable.
- Add or update unit tests for validation boundary changes.
- Run `pnpm --filter @vibechat/validators typecheck` and `pnpm --filter @vibechat/validators build` after changes.
