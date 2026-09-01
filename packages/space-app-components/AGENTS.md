# Space App component package rules

`@vibechat/space-app-components` owns browser-safe, framework-neutral Space App UI controllers, Web Components, recipes, styles, bundle metadata and test harnesses.

## Boundaries

- Receive the existing `SpaceAppClient` through explicit context injection. Never create a second SDK instance or connect directly to Matrix, Backend privileged APIs, Agent providers or Runtime control APIs.
- Keep platform truth in `@vibechat/space-app-sdk`; components only derive view state and invoke SDK commands.
- Do not import `apps/*`, `libs/*`, TanStack, React, provider SDKs, credentials or runtime bindings.
- Public browser modules must be safe to import during SSR. Browser globals may only be read inside lifecycle or registration functions.
- Public package subpaths are semantic (`/foundation`, `/user`, `/agent`, `/chat`, `/register/*`). Do not expose Registry storage terms such as `/artifacts` or a version directory in an App import.
- `dist/` and package archives are generated and gitignored. The tracked `managed-release.json` may contain only current release metadata and integrity; compiled package files belong to the managed Registry/Object Store.
- The `./node` workspace-only export may use Node.js and `@vibechat/space-app-dependencies` to hash, validate and serve the locally built published package, but it must never enter the browser bundle or the published Space-facing package.
- Auto-registration is limited to `/register` and `/register/*` and must be declared as a package side effect. All domain entries remain SSR-safe and side-effect free.
- Use `vc-space-*` custom-element names and `--vc-space-*` CSS tokens. Public slots, parts, attributes, events and tokens are compatibility contracts.
- User-controlled values are text by default. Do not add unsanitized HTML, arbitrary URLs, remote scripts or floating CDN dependencies.

## Verification

```bash
pnpm --filter @vibechat/space-app-components typecheck
pnpm --filter @vibechat/space-app-components build
pnpm --filter @vibechat/space-app-components check:bundle
```

Run the matching unit tests, package boundary checks and repository documentation gates for every public API change.
