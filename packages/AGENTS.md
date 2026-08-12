# Package development rules

`packages/*` contains real pnpm workspace packages, not source-alias folders. Every package must own a `package.json`, explicit `exports`, declared dependencies, an isolated TypeScript configuration, build/typecheck scripts, and a README that states its runtime boundary.

## Boundary rules

- Packages must not import `apps/*`, `@/`, `@libs/*`, `@config/*`, framework route modules, server databases, provider secrets, or runtime bindings.
- Declare every cross-package dependency with `workspace:*`; do not rely on root hoisting.
- Keep contracts and core packages free of React, TanStack, Tauri, DOM globals, and provider SDKs unless the package name and README explicitly own that runtime.
- Runtime packages receive host capabilities through constructor/factory arguments or interfaces from `@vibechat/platform-contracts`.
- An app adapter may depend on browser or Tauri APIs; a shared package may only depend on the capability contract it consumes.
- Do not create a package only to mirror a folder. Promote a boundary when at least two hosts/build units need it or when it needs stable exports and independent verification.

## Verification

Run from the repository root:

```bash
pnpm boundaries:check
pnpm typecheck:packages
pnpm build:packages
```

Changes that alter Web behavior must also pass the relevant real-chain E2E suite.
