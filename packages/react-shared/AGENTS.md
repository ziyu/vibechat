# AGENTS.md

## Scope

`@vibechat/react-shared` is a real workspace package for React 19 components, hooks and providers shared by Site, Web and Admin.

## Rules

- Keep components framework-neutral: no app route imports, server providers or direct database/auth implementations.
- Inject routing, translation, public branding and theme options through props or `SharedAppProvider`.
- Use `@vibechat/ui` for theme CSS and class merging.
- Add package dependencies here instead of relying on a consuming app's transitive dependencies.
- Product-specific AI/payment screens stay in `apps/web-app`; promote only genuinely cross-host, framework-neutral primitives into this package.
- Run `pnpm --filter @vibechat/react-shared typecheck` and `pnpm --filter @vibechat/react-shared build` after changes.
