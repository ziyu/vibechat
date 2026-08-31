import { createHash } from "node:crypto";
import { assertAppId } from "../../app-id.js";
import type { AgentExecutionTarget } from "../contract.js";

export function agentExecutionActorKey(target: AgentExecutionTarget) {
  assertAppId(target.spaceInstanceId);
  const agentId = target.agentId.trim();
  if (!agentId) throw new TypeError("agentId is required");

  // Preserve the existing Pi actor key so current sessions remain reachable.
  // Other adapters receive a stable, collision-resistant Space × Agent key.
  if (agentId === "pi") return `space-${target.spaceInstanceId}`;
  const agentKey = createHash("sha256").update(agentId).digest("hex").slice(0, 16);
  return `space-${target.spaceInstanceId}-agent-${agentKey}`;
}
