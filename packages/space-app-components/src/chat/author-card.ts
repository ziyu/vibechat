import type { SpaceAgentIdentityView, SpaceAgentStatus } from "../agent/view.js";
import type { SpaceAvatarStatus } from "../foundation/avatar.js";
import { sanitizeSpaceMediaUrl } from "../foundation/safety.js";
import type { SpaceUserIdentityView } from "../user/view.js";
import type { SpaceChatAuthorView } from "./view.js";

export const spaceChatAuthorCardEventNames = Object.freeze({
  preview: "vc-space-chat-author-card-preview",
  dismiss: "vc-space-chat-author-card-dismiss",
  toggle: "vc-space-chat-author-card-toggle",
} as const);

export interface SpaceChatAuthorCardEventDetail {
  readonly author: SpaceChatAuthorView;
  readonly trigger: HTMLButtonElement;
}

export function emitSpaceChatAuthorCardEvent(
  trigger: HTMLButtonElement,
  name: (typeof spaceChatAuthorCardEventNames)[keyof typeof spaceChatAuthorCardEventNames],
  author: SpaceChatAuthorView,
) {
  return trigger.dispatchEvent(new CustomEvent<SpaceChatAuthorCardEventDetail>(name, {
    bubbles: true,
    composed: true,
    detail: { author, trigger },
  }));
}

function memberPresence(value: SpaceChatAuthorView["presence"]): SpaceAvatarStatus {
  return value === "online" || value === "away" || value === "none"
    ? value
    : "offline";
}

function agentStatus(value: SpaceChatAuthorView["agentStatus"]): SpaceAgentStatus {
  return value === "idle"
    || value === "queued"
    || value === "working"
    || value === "failed"
    ? value
    : "unavailable";
}

function finiteCount(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value ?? 0)) : 0;
}

export function createSpaceChatAuthorUserView(
  author: SpaceChatAuthorView,
): SpaceUserIdentityView {
  return Object.freeze({
    id: author.id,
    name: author.name.trim() || "Member",
    handle: author.handle?.trim() || null,
    avatarUrl: sanitizeSpaceMediaUrl(author.avatarUrl),
    presence: memberPresence(author.presence),
  });
}

export function createSpaceChatAuthorAgentView(
  author: SpaceChatAuthorView,
): SpaceAgentIdentityView {
  return Object.freeze({
    id: author.id,
    name: author.name.trim() || "Agent",
    avatarUrl: sanitizeSpaceMediaUrl(author.avatarUrl),
    status: agentStatus(author.agentStatus),
    summary: author.agentSummary?.trim() || null,
    activeCount: finiteCount(author.agentActiveCount),
    pendingCount: finiteCount(author.agentPendingCount),
  });
}
