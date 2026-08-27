# Space App managed dependency rules

`@vibechat/space-app-dependencies` owns the portable dependency lock, registry
provider contract and deterministic build materialization used by every Space
App Project.

## Boundaries

- Resolve only exact versions with an exact `sha256:` integrity from
  `space-app-dependencies.json`.
- Never fetch npm, a CDN or an arbitrary URL. Registry access is injected.
- Never mutate the stored source Project. Generated package files exist only in
  a prepared build artifact and are covered by its hash.
- Unknown, missing, incompatible or drifting managed packages fail closed.
- Preserve Projects without a managed dependency lock byte-for-byte.

## Verification

```bash
pnpm --filter @vibechat/space-app-dependencies typecheck
pnpm --filter @vibechat/space-app-dependencies build
```

Run the matching Runtime and component dependency tests for every contract
change.
