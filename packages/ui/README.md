# @vibechat/ui

Framework-independent theme tokens, icons and class-name utilities shared by Site, Web, Admin and Docs. React components live in `@vibechat/react-shared`.

## Theme layers

- Common shadcn/Tailwind tokens such as `--background`, `--card`, and `--foreground` remain the base contract for shared UI.
- `src/styles/semantic-tokens.css` maps that contract to stable VibeChat host roles such as canvas, surface, text, border, accent, status, and elevation.
- Files under `src/styles/themes/` provide complete Light/Dark values for each `ColorScheme`. A theme file defines tokens only; component selectors belong to the consuming application.
- Consumers keep importing the single public entry `@vibechat/ui/styles/index.css`.

## Adding or updating a theme

1. Register the scheme in `src/themes.ts`: type union, `COLOR_SCHEMES`, class mapping, cleanup list, and display configuration.
2. Add one theme CSS file with paired Light and Dark definitions for both the common tokens and every host semantic token that it refines.
3. Import the theme through `src/styles/index.css`; do not create a parallel CSS entry, provider, storage key, or theme runtime.
4. Keep theme CSS free of page and component selectors. A consumer may opt into a scheme for a bounded surface without changing the shared application default.
5. Verify both modes, historical scheme fallbacks, responsive host surfaces, and any isolated content boundary before rollout.

Changing a shared default ColorScheme is a separate migration decision. A bounded Web rollout does not authorize changing Site/Admin defaults or overwriting stored user preferences.

## Verification

```bash
pnpm --filter @vibechat/ui typecheck
pnpm --filter @vibechat/ui build
```

For a user-visible rollout, also run the consuming app's typecheck/build and its relevant real-chain E2E suite.
