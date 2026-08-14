# VibeChat Server Authentication

Backend-internal Better Auth implementation for Email OTP, migration-compatible password sign-in, phone/social plugins, Admin roles and session lifecycle. Browser hosts use `@vibechat/auth-client` and must not import this directory.

Required settings are `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and `APP_BASE_URL`; independent Admin deployments also set `ADMIN_APP_ORIGIN`. See `apps/backend/CF-NOTES.md` for Workers preview requirements.
