import type {
  SpaceAppMember,
  SpaceAppSnapshot,
  SpaceChatMessage,
} from "@vibechat/space-app-sdk";
import {
  createSpaceAgentIdentityView,
  type SpaceAgentStatus,
} from "../agent/view.js";
import type { SpaceAvatarStatus } from "../foundation/avatar.js";
import { sanitizeSpaceMediaUrl } from "../foundation/safety.js";

export type SpaceChatAuthorKind = "member" | "agent";

export interface SpaceChatAuthorView {
  readonly id: string;
  readonly kind: SpaceChatAuthorKind;
  readonly name: string;
  readonly handle: string | null;
  readonly avatarUrl: string | null;
  readonly isSelf: boolean;
  /** Current member presence when the SDK identifies this author as a member. */
  readonly presence?: SpaceAvatarStatus;
  /** Provider-neutral Agent identity fields used by the shared author card. */
  readonly agentStatus?: SpaceAgentStatus;
  readonly agentSummary?: string | null;
  readonly agentActiveCount?: number;
  readonly agentPendingCount?: number;
}

export interface SpaceChatReactionView {
  readonly emoji: string;
  readonly count: number;
  readonly reactedBySelf: boolean;
}

export type SpaceChatAttachmentKind = "image" | "file";

export interface SpaceChatAttachmentView {
  readonly name: string;
  readonly kind: SpaceChatAttachmentKind;
  readonly mediaType: string | null;
  readonly size: number | null;
  readonly downloadUrl: string | null;
  readonly previewUrl: string | null;
}

export type SpaceChatReplyState = "available" | "deleted" | "missing";

export interface SpaceChatReplyView {
  readonly messageId: string;
  readonly state: SpaceChatReplyState;
  readonly author: SpaceChatAuthorView | null;
  readonly text: string;
}

export interface SpaceChatActionAvailability {
  readonly reply: boolean;
  readonly edit: boolean;
  readonly delete: boolean;
  readonly retry: boolean;
  readonly react: boolean;
}

export interface SpaceChatMessageView {
  readonly id: string;
  readonly roomId: string;
  readonly author: SpaceChatAuthorView;
  readonly text: string;
  readonly createdAt: string;
  readonly status: SpaceChatMessage["status"];
  readonly isOwn: boolean;
  readonly isAgent: boolean;
  readonly edited: boolean;
  readonly deleted: boolean;
  readonly reply: SpaceChatReplyView | null;
  readonly reactions: readonly SpaceChatReactionView[];
  /** Host-authorized actions after applying message ownership and state. */
  readonly actions?: SpaceChatActionAvailability;
  readonly hasAttachment: boolean;
  /** Safe, provider-neutral metadata when the SDK exposes an attachment. */
  readonly attachment?: SpaceChatAttachmentView | null;
}

function optionalString(
  source: Readonly<Record<string, unknown>>,
  ...keys: readonly string[]
) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** Normalizes SDK attachment metadata without exposing unsafe media URLs. */
export function createSpaceChatAttachmentView(
  attachment: Readonly<Record<string, unknown>> | null | undefined,
): SpaceChatAttachmentView | null {
  if (!attachment) return null;
  const mediaType = optionalString(attachment, "mimeType", "mediaType", "type");
  const rawSize = attachment.size;
  const size = typeof rawSize === "number" && Number.isFinite(rawSize)
    ? Math.max(0, Math.floor(rawSize))
    : null;
  const downloadUrl = sanitizeSpaceMediaUrl(
    optionalString(attachment, "downloadUrl", "url", "href"),
  );
  const previewUrl = sanitizeSpaceMediaUrl(
    optionalString(attachment, "previewUrl", "thumbnailUrl", "downloadUrl", "url"),
  );
  const explicitKind = optionalString(attachment, "kind");
  const kind = explicitKind === "image" || mediaType?.startsWith("image/")
    ? "image"
    : "file";
  const fallbackName = kind === "image" ? "Image" : "Attachment";
  return Object.freeze({
    name: optionalString(attachment, "name", "fileName", "filename") || fallbackName,
    kind,
    mediaType,
    size,
    downloadUrl,
    previewUrl: kind === "image" ? previewUrl : null,
  });
}

function normalizedMemberName(member: SpaceAppMember) {
  return member.displayName?.trim()
    || member.name?.trim()
    || member.handle?.trim()
    || "Member";
}

function memberAuthor(
  member: SpaceAppMember,
  selfId: string | undefined,
): SpaceChatAuthorView {
  return Object.freeze({
    id: member.id,
    kind: "member" as const,
    name: normalizedMemberName(member),
    handle: member.handle?.trim() || null,
    avatarUrl: sanitizeSpaceMediaUrl(member.avatarUrl),
    isSelf: member.id === selfId,
    presence: member.presence ?? "offline",
  });
}

function agentAuthor(
  snapshot: SpaceAppSnapshot,
  id: string,
): SpaceChatAuthorView {
  const target = snapshot.mentions.find(
    (item) => item.type === "agent" && item.id === id,
  );
  const isSnapshotAgent = !snapshot.agent.id || snapshot.agent.id === id;
  const identity = isSnapshotAgent
    ? createSpaceAgentIdentityView(snapshot.agent)
    : null;
  return Object.freeze({
    id,
    kind: "agent" as const,
    name: target?.name?.trim()
      || (isSnapshotAgent ? snapshot.agent.name?.trim() : "")
      || "Agent",
    handle: target?.handle?.trim() || null,
    avatarUrl: identity?.avatarUrl ?? null,
    isSelf: false,
    agentStatus: identity?.status
      ?? (target?.available === false ? "unavailable" : "idle"),
    agentSummary: identity?.summary ?? null,
    agentActiveCount: identity?.activeCount ?? 0,
    agentPendingCount: identity?.pendingCount ?? 0,
  });
}

export function resolveSpaceChatAuthor(
  snapshot: SpaceAppSnapshot,
  id: string,
  kind: SpaceChatAuthorKind = "member",
): SpaceChatAuthorView {
  if (kind === "agent") return agentAuthor(snapshot, id);
  const member = [snapshot.self, ...snapshot.members]
    .find((item): item is SpaceAppMember => Boolean(item && item.id === id));
  if (member) return memberAuthor(member, snapshot.self?.id);
  return Object.freeze({
    id,
    kind: "member" as const,
    name: "Member",
    handle: null,
    avatarUrl: null,
    isSelf: id.length > 0 && id === snapshot.self?.id,
    presence: "offline",
  });
}

function isAgentMessage(message: SpaceChatMessage) {
  return message.agent === true || Boolean(message.agentId);
}

function messageAuthor(
  snapshot: SpaceAppSnapshot,
  message: SpaceChatMessage,
) {
  const agent = isAgentMessage(message);
  return resolveSpaceChatAuthor(
    snapshot,
    agent ? message.agentId || message.senderId : message.senderId,
    agent ? "agent" : "member",
  );
}

function reactionViews(
  message: SpaceChatMessage,
  selfId: string | undefined,
) {
  return Object.freeze((Array.isArray(message.reactions) ? message.reactions : [])
    .filter((reaction) => typeof reaction?.emoji === "string")
    .map((reaction) => {
      const userIds = [...new Set(
        (Array.isArray(reaction.userIds) ? reaction.userIds : [])
          .filter((id): id is string => typeof id === "string"),
      )];
      return Object.freeze({
        emoji: reaction.emoji,
        count: userIds.length,
        reactedBySelf: Boolean(selfId && userIds.includes(selfId)),
      });
    }));
}

function replyView(
  snapshot: SpaceAppSnapshot,
  message: SpaceChatMessage,
  sourceById: ReadonlyMap<string, SpaceChatMessage>,
): SpaceChatReplyView | null {
  if (!message.replyToId) return null;
  const source = sourceById.get(message.replyToId);
  if (!source) {
    return Object.freeze({
      messageId: message.replyToId,
      state: "missing" as const,
      author: null,
      text: "",
    });
  }
  const deleted = source.deleted === true;
  return Object.freeze({
    messageId: source.id,
    state: deleted ? "deleted" as const : "available" as const,
    author: messageAuthor(snapshot, source),
    text: deleted ? "" : String(source.text ?? ""),
  });
}

function actionAvailability(
  snapshot: SpaceAppSnapshot,
  message: SpaceChatMessage,
  isOwn: boolean,
  deleted: boolean,
): SpaceChatActionAvailability {
  const permissions = snapshot.chat?.permissions;
  const sent = message.status === "sent";
  return Object.freeze({
    reply: permissions?.reply === true && sent && !deleted,
    edit: permissions?.editOwn === true && isOwn && sent && !deleted,
    delete: permissions?.deleteOwn === true && isOwn && sent && !deleted,
    retry: permissions?.retryOwn === true
      && isOwn
      && message.status === "failed"
      && !deleted,
    react: permissions?.react === true && sent && !deleted,
  });
}

/**
 * Projects the Matrix-backed Chat timeline without merging Agent build or
 * progress records. The incoming SDK order is preserved exactly.
 */
export function createSpaceChatMessageViews(
  snapshot: SpaceAppSnapshot,
): readonly SpaceChatMessageView[] {
  const messages = Array.isArray(snapshot.chat?.messages)
    ? snapshot.chat.messages
    : [];
  const sourceById = new Map(messages.map((message) => [message.id, message]));
  return Object.freeze(messages.map((message) => {
    const author = messageAuthor(snapshot, message);
    const agent = author.kind === "agent";
    const deleted = message.deleted === true;
    const isOwn = !agent && author.isSelf;
    const attachment = createSpaceChatAttachmentView(message.attachment);
    return Object.freeze({
      id: message.id,
      roomId: message.roomId,
      author,
      text: deleted ? "" : String(message.text ?? ""),
      createdAt: message.createdAt,
      status: message.status,
      isOwn,
      isAgent: agent,
      edited: !deleted && message.edited === true,
      deleted,
      reply: replyView(snapshot, message, sourceById),
      reactions: reactionViews(message, snapshot.self?.id),
      actions: actionAvailability(snapshot, message, isOwn, deleted),
      hasAttachment: Boolean(message.attachment),
      attachment,
    });
  }));
}
