# AGENTS.md

## Scope

`libs/permissions` is the Backend-internal CASL role/ability module used by `requireAdminAPI`. The current active roles are `admin` and `user`.

## Rules

- Backend authorization is the security boundary; Admin page guards are user experience only.
- Normalize session users with `createAppUser` before calling `can`.
- Every Admin route must return `401` without a session and `403` for a non-admin session.
- Add resource ownership subjects only with explicit API contracts and permission tests.
- Run `tests/unit/permissions` and `tests/api/admin-permission.test.ts` after changes.
