# AGENTS.md

## Scope

`@vibechat/i18n` is the framework-neutral translation contract shared by Site, Web, Admin, Docs and React shared components. It is a real workspace package with its own exports, typecheck and build gate.

## Rules

- Add user-visible keys to `src/locales/en.ts` first; its shape is the TypeScript source of truth.
- Mirror every key in `src/locales/zh-CN.ts` before delivery.
- Keep framework routing, cookies and rendering adapters in the consuming app.
- Do not import application code, server providers or `config/*` from this package.
- Run `pnpm --filter @vibechat/i18n typecheck` and `pnpm --filter @vibechat/i18n build` after changes.
