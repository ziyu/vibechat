/**
 * Node/Vite adapter for Cloudflare's runtime-only virtual module.
 *
 * Node code paths must not consume Workers bindings. Providing an empty env
 * keeps Vite's cold-start dependency scan deterministic while preserving the
 * existing runtime checks and "binding not found" errors if a Workers-only
 * database dialect is selected accidentally.
 */
export const env: Record<string, unknown> = {}
