# Space Agent Contracts

`@vibechat/space-agent-contracts` owns the provider-neutral, versioned contracts shared by Backend and Space Runtime for Agent identity, definitions, Space bindings, sessions, turns, events, usage, normalized errors, and internal callbacks.

The package is runtime-neutral. It must not import application code, databases, AgentOS, Pi, provider SDKs, credentials, prompts, source files, or provider-native events. Opaque provider session references identify recoverable server-side state; they are not bearer tokens and must never be exposed to browsers or Matrix events.

During S2, `@vibechat/space-app-contracts` re-exports the legacy Agent ID and callback names for compatibility. New Backend and Runtime consumers should import them from this package.
