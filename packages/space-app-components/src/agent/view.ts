import type { SpaceAppSnapshot } from "@vibechat/space-app-sdk";
import { sanitizeSpaceMediaUrl } from "../foundation/safety.js";

export type SpaceAgentStatus =
  | "idle"
  | "queued"
  | "working"
  | "unavailable"
  | "failed";

export interface SpaceAgentIdentityView {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly status: SpaceAgentStatus;
  readonly summary: string | null;
  readonly activeCount: number;
  readonly pendingCount: number;
}

export interface CreateSpaceAgentIdentityViewOptions {
  avatarUrl?: string | null;
  status?: SpaceAgentStatus;
  summary?: string | null;
}

function agentBuildFailed(build: Record<string, unknown> | null) {
  const status = typeof build?.status === "string"
    ? build.status.toLowerCase()
    : "";
  return ["error", "failed", "failure"].includes(status);
}

export function createSpaceAgentIdentityView(
  agent: SpaceAppSnapshot["agent"],
  options: CreateSpaceAgentIdentityViewOptions = {},
): SpaceAgentIdentityView {
  const activeCount = Math.max(0, Math.floor(agent.queue.activeCount || 0));
  const pendingCount = Math.max(0, Math.floor(agent.queue.pendingCount || 0));
  const available = Boolean(agent.id || agent.name);
  const status = options.status
    ?? (agentBuildFailed(agent.build)
      ? "failed"
      : agent.build || activeCount > 0
        ? "working"
        : pendingCount > 0
          ? "queued"
          : available
            ? "idle"
            : "unavailable");
  return Object.freeze({
    id: agent.id || "",
    name: agent.name?.trim() || "Agent",
    avatarUrl: sanitizeSpaceMediaUrl(options.avatarUrl),
    status,
    summary: options.summary?.trim() || null,
    activeCount,
    pendingCount,
  });
}
