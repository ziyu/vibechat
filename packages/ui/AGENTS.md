# AGENTS.md

## Scope

`@vibechat/ui` owns framework-independent theme tokens, CSS, icons and the `cn` utility. React components belong in `@vibechat/react-shared`.

## Rules

- Consumers import CSS through `@vibechat/ui/styles/index.css`, never through a repository-relative path.
- Keep themes based on CSS variables and compatible with light/dark mode.
- Do not add React, router or server dependencies.
- Export new public assets explicitly through `package.json` or `src/index.ts`.
- Run `pnpm --filter @vibechat/ui typecheck` and `pnpm --filter @vibechat/ui build` after changes.
