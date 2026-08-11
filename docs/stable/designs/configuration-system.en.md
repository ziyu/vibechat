# Configuration System Design

> Lifecycle: Stable
> Document type: Design
> Status: Active
> Updated: 2026-08-11
> Scope: `config.ts`, `config/*`, and `env.example`

## Goal

Vibe Chat exposes one shared configuration contract to the TanStack Start product app, shared libraries, and the documentation app. Static defaults and environment parsing stay centralized instead of being duplicated across routes.

## Structure

| Location | Responsibility |
| --- | --- |
| `config.ts` | Composes app, brand, and domain configuration and exports `config` |
| `config/*.ts` | Domain configuration for auth, payment, credits, database, storage, AI, affiliate, and other capabilities |
| `config/types.ts` | Shared configuration types |
| `config/utils.ts` | Environment lookup and required-variable helpers |
| `env.example` | Secret-free deployment variable examples |

Consumers import the shared contract through `@config`:

```ts
import { config } from '@config'

const appName = config.app.name
const affiliateEnabled = config.affiliate.enabled
```

## Rules

1. Keep brand, locale, theme, and static product choices in `config.ts` or the relevant domain file.
2. Supply secrets and deployment differences through environment variables; commit examples only.
3. Add new domains in `config/<domain>.ts` and compose them in `config.ts`.
4. Define each default value in one place.
5. Never expose server secrets to client code.
6. Do not introduce environment aliases without a documented migration and removal plan.

## Change procedure

1. Decide whether the value is a static product choice or a deployment concern.
2. Add a typed field to the appropriate domain configuration.
3. Update `env.example` when a genuinely new variable is required.
4. Read it through `@config`; do not re-parse it in routes.
5. Run `pnpm typecheck` and `pnpm build`; run the Cloudflare preview when bindings or server runtime behavior changes.

The Chinese source is [配置系统设计](./configuration-system.md).
