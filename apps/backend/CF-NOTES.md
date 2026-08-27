# VibeChat Backend — Cloudflare Workers Notes

Known pitfalls and constraints when running TanStack Start on Cloudflare Workers.

## Verification commands

| Command | What it checks |
|---------|---------------|
| `pnpm dev:cf` | Local dev with `@cloudflare/vite-plugin` (workerd SSR) |
| `pnpm preview:cf` | Full build + `wrangler dev` (closest to production) |
| `pnpm build` | Production build (CF_DEPLOY=1 enabled by default) |

Better Auth refuses its default secret in the Workers production preset. Local preview must inject a non-default development secret through a Wrangler binding (or `.dev.vars`), for example:

```bash
pnpm run build:cf
pnpm exec wrangler dev --port 8012 --var 'BETTER_AUTH_SECRET:local-preview-secret-at-least-32-chars'
```

Setting a parent-shell variable without `--var` does not guarantee that it reaches the workerd environment. Never commit a production secret; production uses `wrangler secret put BETTER_AUTH_SECRET`.

## Known pitfalls

### 1. Duplicate React instances → "Invalid hook call"

**Symptom:** `TypeError: Cannot read properties of null (reading 'useContext')` during SSR.

**Root cause:** Vite's SSR dependency scanner fails, so dependencies are discovered on-demand
and React ends up in multiple chunks. Each chunk has its own `ReactSharedInternals`, so hooks
registered by `react-dom/server` are invisible to components loaded from other chunks.

**Common triggers:**
- Importing a module that doesn't exist (e.g., `vinxi/http` — removed in TanStack Start 1.x).
  This crashes the entire dep scan: `Failed to run dependency scan. Skipping dependency pre-bundling.`
- `vite-tsconfig-paths` v6 has a bug where it doesn't follow path aliases during the dep scan
  ([workers-sdk#11825](https://github.com/cloudflare/workers-sdk/issues/11825)).
  **Fix:** Pin `vite-tsconfig-paths` to v5.1.4.

### 2. `require is not defined`

**Symptom:** Runtime error in Workers/workerd because `require()` is CJS-only.

**Rule:** Never use `require()` in any code reachable from the TanStack app.
Use `await import()` for dynamic imports or static `import` for everything else.

### 3. Accessing Cloudflare bindings (D1, KV, R2, etc.)

**Correct way (TanStack Start ≥ 1.x without Vinxi):**
```ts
import { env } from 'cloudflare:workers'
const db = env.DB  // D1 binding
```

**Wrong way (legacy — will crash dependency scan):**
```ts
import { getEvent } from 'vinxi/http'  // ❌ vinxi is removed
```

`cloudflare:workers` is a virtual module handled by `@cloudflare/vite-plugin` in dev
and by the workerd runtime in production. It does not need installation.

### 4. Native Node.js modules

Packages like `better-sqlite3` and `pg` contain native C++ addons that cannot run in Workers.
They must be tree-shaken out of the CF build. The current architecture uses `getDialect()`
guards so that only the D1 code path is included when `DB_DIALECT=d1`.

Do **not** add these to `ssr.external` — it conflicts with `@cloudflare/vite-plugin`'s
bundling strategy and causes build failures.

### 5. Plugin order in vite.config.ts

`cloudflare()` must be the **first** plugin in the `plugins` array.

### 6. Runtime vs database dialect

**Do not use `DB_DIALECT` as a proxy for Workers runtime.**

| Concern | Use |
|---------|-----|
| R2 binding uploads, `cloudflare:workers` imports | `isWorkersRuntime` from `@libs/database` |
| D1 batch writes instead of Drizzle transactions | `isD1Dialect()` from `@libs/database` |

Supported storage providers by runtime:

| Runtime | Upload providers |
|---------|------------------|
| Cloudflare Workers (`isWorkersRuntime`) | Native R2 binding only (`provider=r2`) |
| Node / local dev | `oss`, `s3`, `r2` (S3 API), `cos` via `createStorageProvider()` |

Workers uploads require:

1. `r2_buckets` binding (`R2_BUCKET`) in `wrangler.jsonc`
2. A real HTTPS custom domain in `R2_PUBLIC_URL` (`.dev.vars` locally, Wrangler vars/secrets in deploy). Placeholder `example.com` URLs are rejected before upload.

Space Runtime always uses the existing `R2_BUCKET` binding for private, content-addressed `space-runtime/objects/<sha256>` source objects. Product DB stores Project/Revision/Release pointers, Instance snapshots, Turn/Lease/Fencing and Outbox rows, plus Agent Definition/Binding/Session/Audit metadata; migrate D1 through the latest journal entry, currently `libs/database/drizzle-sqlite/0017_public_wrecker.sql`, before starting Space Runtime or enabling Agent domain reads. Migration `0017` makes Template lineage nullable for blank Spaces; Default Chat bootstrap must not write a false market lineage. The local Node Backend uses ignored `.data/space-runtime-objects` instead of R2 while preserving the same HTTP/Object Store contract.

### 7. D1 transactions and credit ledger writes

Drizzle's `db.transaction()` emits `BEGIN` / `SAVEPOINT` statements that the D1 Workers binding rejects. For atomic balance + ledger writes, use `runD1Batch()` from `@libs/database` when `isD1Dialect()` is true.

`consumeCredits()` uses a conditional `INSERT ... WHERE changes() > 0` so ledger rows are only written when the balance update succeeds.
