# AGENTS.md

## Scope

`libs/auth` is the Backend-only Better Auth implementation. It owns database-backed sessions, Email OTP/password/phone/social plugins, lifecycle hooks and Matrix device revocation. Browser React calls live in `@vibechat/auth-client`.

## Rules

- Import this module only from Backend server code; browser apps use `@vibechat/auth-client` and same-origin gateways.
- Production and Workers preview require a non-default `BETTER_AUTH_SECRET`.
- Keep `APP_BASE_URL`, `BETTER_AUTH_URL` and `ADMIN_APP_ORIGIN` explicit; only allow localhost origins automatically in development.
- Do not log credentials, OTPs outside the guarded development response, session cookies or Matrix access tokens.
- Session deletion must enqueue/drain Matrix device revocation.
- Run auth E2E, Admin cross-origin E2E, Backend Node build and Workers preview after changes.
