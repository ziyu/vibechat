# Space Agents

`libs/space-agents` is the Product DB Agent domain boundary. It resolves immutable Agent Definitions, per-Space bindings, session generations, invocation policy, and audit events without depending on Pi, AgentOS, Matrix, credits, HTTP, or UI implementations.

S2 keeps compatibility with existing Spaces in this order:

1. an explicit Space binding, including an explicit disabled binding;
2. `room_index.default_agent_id` when no binding exists;
3. the built-in Pi bootstrap when neither record exists.

The compatibility sources are temporary. S3 will persist the resolved Definition, binding policy, and session generation on the existing `space_runtime_turn` before Runtime execution.
