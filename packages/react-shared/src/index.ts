/**
 * Shared React component library for VibeChat browser hosts.
 *
 * This workspace package exposes stable component, hook and provider paths.
 *
 * Exports:
 *   - ui/*           shadcn/Radix UI primitives (Button, Card, Dialog, etc.)
 *   - hooks/*        Shared React hooks (useIsMobile, useTheme, etc.)
 *   - providers/*    SharedAppProvider (translation + locale context)
 *   - components/*   Feature components (AI chat elements, MagicUI)
 */

export { SharedAppProvider, useSharedApp } from './providers/app-context'
export { ThemeProvider, useTheme } from './hooks/use-theme'
export { useIsMobile } from './hooks/use-mobile'
