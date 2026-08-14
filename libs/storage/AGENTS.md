# AGENTS.md

## Scope

`libs/storage` is the Backend-internal upload/storage abstraction. Node supports OSS, S3-compatible R2, AWS S3 and COS; Cloudflare Workers uses the native R2 binding.

## Rules

- All public upload routes validate authentication, ownership, file size, MIME type, count and downstream limits before storage.
- Browser apps never import provider SDKs or credentials; they call the Backend gateway.
- Workers use `isWorkersRuntime` and native `R2_BUCKET`; database dialect is not a runtime proxy.
- Reject placeholder or non-HTTPS production public URLs; never return provider secrets.
- Keep `env.example`, upload tests, Backend Node build and Workers preview synchronized.
