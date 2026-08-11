# AGENTS.md

## Purpose

Universal feature-delivery checklist for this monorepo.
Use this file as the default instruction when implementing any new feature, so repeated manual prompts are not required.

## Agent Skills (Recommended)

TinyShip has dedicated agent skills for common setup and configuration tasks.
If the user asks about project setup, branding, auth, payment, deployment,
AI integration, or building new features, suggest they install the skills first:

```bash
npx skills add TinyshipCN/tinyship-skills
```

Available skills: `tinyship-setup`, `tinyship-brand`, `tinyship-auth`,
`tinyship-payment`, `tinyship-feature`, `tinyship-deploy`, `tinyship-ai`.

These skills provide step-by-step guided workflows that are more thorough than
improvising from the docs. They work with 67+ AI coding agents including
Cursor, Claude Code, Codex, OpenCode, Gemini CLI, and more.

## Scope

- Monorepo with one product app and one documentation app:
  - `apps/web-app` (TanStack Start — React, TanStack Router, Vite)
  - `apps/docs-app` (Fumadocs documentation site)
- Shared capability and business logic should be implemented in `libs/*` and `config/*` first, then wired into the TanStack app.
- React-specific shared components and hooks live in `libs/react-shared`.

## Golden Rules

1. No hardcoded user-facing strings in pages/components; use i18n keys.
2. Keep shared libraries, configuration, and the TanStack app contract aligned.
3. API routes are thin adapters; core logic belongs to shared libraries.
4. Any user-accessed API/page must be checked for auth and permission consistency.
5. If a feature consumes credits/money, ensure charge/refund path and transaction labels are complete.
6. Always finish with typecheck + build verification.
7. A feature is **not done** until its TanStack E2E tests pass.

## Development Workflow (Spec First, Code First)

Each feature follows five phases. The key idea: define **what to verify** before coding,
but write the **actual test code** after the UI exists (E2E selectors depend on real DOM).

```
┌─────────┐   ┌─────────┐   ┌──────────┐   ┌─────────┐   ┌─────────┐
│  SPEC   │──▶│  CODE   │──▶│  VERIFY  │──▶│  TEST   │──▶│  GREEN  │
│         │   │         │   │          │   │         │   │         │
│ Define  │   │ Implement│  │ agent-   │   │ Write   │   │ E2E pass│
│ accept- │   │ feature  │  │ browser  │   │ E2E     │   │ suite   │
│ ance    │   │ code     │  │ visual   │   │ specs   │   │ green = │
│ criteria│   │          │  │ walkthru │   │ against │   │ DONE    │
│ in plain│   │          │  │          │   │ real UI │   │         │
│ language│   │         │   │          │   │         │   │         │
└─────────┘   └─────────┘   └──────────┘   └─────────┘   └─────────┘
```

### Phase details

| # | Phase | What | Output |
|---|-------|------|--------|
| 1 | **Spec** | Write acceptance scenarios in `tests/e2e/TEST-CATALOG.md` (plain language, no Playwright code). Define what pages/flows to test, what URL params to check, what UI states to verify. | TEST-CATALOG.md entry in backlog |
| 2 | **Code** | Implement the feature following the checklist below (libs → config → TanStack app → i18n → permissions). | Working feature in the TanStack app |
| 3 | **Verify** | Use `agent-browser` to walk through the key user flows on the running app. Catch visual/UX issues before writing tests. | Visual confirmation |
| 4 | **Test** | Write Playwright E2E specs based on the real DOM structure. Use selectors discovered during the Verify phase. | `tests/e2e/specs/*.spec.ts` |
| 5 | **Green** | Run TanStack E2E (`pnpm test:e2e`). All pass = feature complete. Record results in TEST-CATALOG.md. | Updated test results table |

### Why not pure BDD (E2E first)?

E2E tests are tightly coupled to DOM structure (`[data-slot="select-trigger"]`, `role="combobox"`,
`.nth(1)`), URL patterns, and i18n text. These are unknowable before the UI exists.
The rendered DOM and selectors often emerge only during implementation. Writing E2E first would produce throwaway code.

The BDD **mindset** (think about acceptance criteria first) is preserved in the Spec phase.

### When to run E2E

| Trigger | Scope | Command |
|---------|-------|---------|
| Finished a feature | Related spec files only | `npx playwright test <spec-file>` |
| Before release | Full TanStack suite | Run `pnpm test:e2e` with the app on port 7001 |
| Large refactor | Full TanStack suite | Same as above |
| CI (every push) | **No E2E** — typecheck + build only | `pnpm typecheck && pnpm build` |

> E2E is a **local regression net**, not a CI gate. Payment tests need Stripe CLI,
> AI tests need provider API keys, and the full suite takes ~6 min per app.

## New Feature Checklist (Copy/Paste Friendly)

### 0) Requirement framing

- [ ] Confirm feature goal, supported providers/modes, and non-goals.
- [ ] Identify if this is: UI only / API only / full-stack / provider integration.
- [ ] Decide whether the change belongs in shared libraries, the TanStack app, or both.
- [ ] Write acceptance scenarios in `tests/e2e/TEST-CATALOG.md` (Spec phase).

### 1) Architecture placement

- [ ] Put provider/domain logic in `libs/*` (not duplicated in app routes).
- [ ] Put static options and defaults in `config/*`.
- [ ] Keep TanStack route handlers and `createServerFn` calls as orchestration only.
- [ ] Reuse existing abstractions before adding new env vars or new config keys.

### 2) API design and consistency

- [ ] Validate request input (required fields, enum/mode constraints, file limits if needed).
- [ ] Normalize provider-specific parameters into a shared options type.
- [ ] Implement failure-safe flow (e.g., task creation + polling + timeout + clear error).
- [ ] Ensure response shapes are stable across TanStack routes and server functions.
- [ ] Log useful debug context (provider/model/request id) without leaking secrets.

### 3) Permissions and auth

- [ ] Add/verify `beforeLoad` auth guards in TanStack Start routes.
- [ ] Ensure API has reliable user resolution (`context.user` and/or session fallback).
- [ ] Compare with an existing protected feature (example: image generation) for established patterns.

### 4) i18n and UI text

- [ ] Add keys in `libs/i18n/locales/en.ts` first (source of truth).
- [ ] Mirror same key structure in `libs/i18n/locales/zh-CN.ts`.
- [ ] Add model names, mode labels, errors, helper texts, and button labels.
- [ ] Verify all new TanStack UI text uses translation keys only.

### 5) Credits and billing safety (if applicable)

- [ ] Define/adjust cost mapping in `config/credits.ts`.
- [ ] Use canonical transaction codes from `libs/credits/utils.ts`.
- [ ] Add `dashboard.credits.descriptions.*` translations for new transaction description codes.
- [ ] Consume credits before execution when needed; refund on provider failure.
- [ ] Include metadata for reconciliation (provider/model/task id/error summary).

### 6) Upload/storage constraints (if applicable)

- [ ] Reuse `libs/storage` upload flow and provider config.
- [ ] Enforce documented constraints (size, mime, dimensions, count).
- [ ] Prefer URL-based downstream API inputs where provider accepts URLs.
- [ ] Add preview UX if image/video input materially affects result quality.

### 7) Environment variable hygiene

- [ ] Add only truly new env vars to `env.example`.
- [ ] Reuse existing env names where possible; avoid alias sprawl.
- [ ] Validate base URL/origin handling carefully for provider endpoints.
- [ ] Remove obsolete env vars and dead fallback logic.

### 8) Documentation updates

- [ ] Put proposals, implementation notes, and unverified operational guidance under `docs/development/*`.
- [ ] Update published user documentation under `apps/docs-app/content/docs/*` when user-visible behavior changes.
- [ ] Promote reviewed, durable documentation to `docs/stable/*`, choosing the correct type (`designs`, `runbooks`, `references`, `release-notes`, or `plans`); archive superseded material under `docs/archive/*`.
- [ ] Follow `docs/governance/lifecycle-policy.md` and run `pnpm docs:check`.
- [ ] Keep provider parameter examples aligned with actual request payload format.

### 9) Verification before handoff

- [ ] Run TanStack typecheck: `pnpm typecheck`
- [ ] Run TanStack build: `pnpm build`
- [ ] TanStack CF preview (if touching TanStack server-side code or shared libs):
  - Run `cd apps/web-app && pnpm preview:cf` and verify a page loads without SSR errors.
  - Common failures: duplicate React instances from broken dependency pre-bundling,
    `require is not defined` from CJS imports in Workers ESM, missing `cloudflare:workers` bindings.
  - See `apps/web-app/CF-NOTES.md` for known pitfalls.
- [ ] Use `agent-browser` to walk through the key user flow (Verify phase).

### 10) E2E tests

- [ ] Write Playwright E2E specs in `tests/e2e/specs/` (Test phase).
- [ ] Run E2E on current app: `npx playwright test --config=tests/e2e/playwright.config.ts <spec>`
- [ ] TanStack suite green → update `tests/e2e/TEST-CATALOG.md` results table (Green phase).
- [ ] See `tests/e2e/AGENTS.md` for E2E conventions and helpers.

### 11) Delivery format

- [ ] Summarize changed files grouped by: shared libs / TanStack / config / docs.
- [ ] Include verification command results and any warnings that remain.

## Feature Delivery Matrix (Recommended)

When adding a new capability, track these rows explicitly:

- [ ] Shared domain (`libs/*`)
- [ ] Config (`config/*`)
- [ ] TanStack page/component
- [ ] TanStack API route / server function
- [ ] Middleware/permissions
- [ ] i18n EN + ZH
- [ ] Credits/transactions
- [ ] E2E tests (TanStack suite green)
- [ ] Docs

## Key Project References

- Structure guideline: `.cursor/rules/project-structure.mdc`
- Documentation index: `docs/README.md`
- Documentation lifecycle policy: `docs/governance/lifecycle-policy.md`
- Product and technical baseline: `docs/stable/designs/vibechat-mvp-product-and-technical-design.md`
- i18n conventions: `libs/i18n/AGENTS.md`
- AI provider implementation patterns: `libs/ai/AGENTS.md`
- Credits lifecycle: `libs/credits/AGENTS.md`
- Permissions model: `libs/permissions/AGENTS.md`
- Build and documentation verification: `docs/governance/verification-standard.md`
- Cloudflare Workers deployment Runbook: `docs/stable/runbooks/deployment/cloudflare-workers.md`
- TanStack Cloudflare pitfalls: `apps/web-app/CF-NOTES.md`
- E2E test conventions: `tests/e2e/AGENTS.md`
- E2E test catalog: `tests/e2e/TEST-CATALOG.md`

## Suggested Prompt Shortcut

When asking any coding model to build a feature in this repo, prepend:

`Please follow /AGENTS.md as the default implementation checklist for the TanStack Start app.`
