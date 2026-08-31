# Space Agents Domain Rules

This library owns Product DB-backed Agent definitions, Space bindings, session metadata, invocation policy, and bounded audit records.

- Keep every public type provider-neutral and reuse `@vibechat/space-agent-contracts`.
- Do not import AgentOS, Pi, provider SDKs, Hono, Matrix, credits, or UI code.
- Repositories may import `@libs/database`; services depend on repository ports.
- During S2, resolution order is active/disabled binding first, then the legacy `room_index.default_agent_id`, then the Pi bootstrap. A disabled binding must not silently fall through.
- Do not create a second Turn queue. Turn ownership remains in `libs/space-runtime-control`.
- Opaque provider session references must never be returned to browser or Matrix contracts.
