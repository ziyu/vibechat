# AGENTS.md

## Scope

`libs/email` is a Backend-internal email service with Resend and Cloudflare REST providers. MJML templates compile to static HTML so Node and Workers runtime paths do not load MJML/CommonJS dependencies.

## Rules

- Keep provider credentials server-only and read them through `config/email.ts`.
- Compile template changes with `pnpm email:compile`; do not hand-edit generated HTML.
- User-facing email text must remain localized in English and Simplified Chinese.
- Log provider/request context without recipient content, tokens or secrets.
- Run email unit tests, Backend build and Workers preview after runtime changes.
