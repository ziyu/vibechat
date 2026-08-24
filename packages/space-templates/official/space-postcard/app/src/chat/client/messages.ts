import type {
  SpaceMember,
  SpaceMessage,
  SpaceSdk,
} from "../../browser/sdk.js";
import { escapeHtml } from "../../browser/html.js";
import type { ChatCopy } from "./copy.js";
import { formatMessageTime } from "./dom.js";

export function findMember(space: SpaceSdk, id: string): SpaceMember {
  return [space.self, ...space.members].find((item) => item?.id === id) || {
    id,
    name: id === space.agent.id ? space.agent.name || "Agent" : "Member",
    initials: "?",
  };
}

export function getAllMessages(space: SpaceSdk): SpaceMessage[] {
  const matrixMessages = Array.isArray(space.chat.messages)
    ? space.chat.messages
    : [];
  const agentMessages = Array.isArray(space.agent.messages)
    ? space.agent.messages
      .filter((item) => item.type !== "user")
      .map((item) => ({
        id: `agent:${item.id}`,
        senderId: item.authorId || space.agent.id || "agent",
        text: item.text,
        createdAt: item.createdAt,
        status: "sent",
        reactions: [],
        agent: true,
      } satisfies SpaceMessage))
    : [];

  return [...matrixMessages, ...agentMessages].sort((left, right) =>
    String(left.createdAt).localeCompare(String(right.createdAt)));
}

export function renderMessageHtml(
  space: SpaceSdk,
  message: SpaceMessage,
  messages: SpaceMessage[],
  copy: ChatCopy,
) {
  const sender = findMember(space, message.senderId);
  const own = message.senderId === space.self?.id && !message.agent;
  const replied = messages.find((item) => item.id === message.replyToId);
  const repliedBy = replied ? findMember(space, replied.senderId) : null;
  const attachment = message.attachment;
  const safe = escapeHtml;

  const reactionHtml = (message.reactions || []).map((reaction) => `
    <button
      type="button"
      data-action="reaction"
      data-id="${safe(message.id)}"
      data-emoji="${safe(reaction.emoji)}"
      data-reacted="${String((reaction.userIds || []).includes(space.self?.id || ""))}"
    >${safe(reaction.emoji)} ${(reaction.userIds || []).length}</button>
  `).join("");

  const delivery = message.status === "failed"
    ? `${copy.failed} · ${copy.retry}`
    : message.status === "sending"
      ? copy.sending
      : message.status === "sent"
        ? copy.sent
        : "";

  const actions = !message.deleted && !message.agent ? `
    <div class="vcc-actions">
      <button type="button" data-action="reply" data-id="${safe(message.id)}">↩ ${copy.reply}</button>
      <button type="button" data-action="reaction" data-id="${safe(message.id)}" data-emoji="♥">♥</button>
      <button type="button" data-action="reaction" data-id="${safe(message.id)}" data-emoji="✨">✨</button>
      <button type="button" data-action="reaction" data-id="${safe(message.id)}" data-emoji="🌙">🌙</button>
      ${own ? `
        <button type="button" data-action="edit" data-id="${safe(message.id)}">${copy.edit}</button>
        <button type="button" data-action="delete" data-id="${safe(message.id)}">${copy.remove}</button>
      ` : ""}
    </div>
  ` : "";

  const attachmentHtml = attachment ? `
    <a
      class="vcc-attachment"
      data-testid="message-attachment"
      href="${safe(attachment.downloadUrl || "#")}"
      target="_blank"
      rel="noreferrer"
    >
      ${attachment.kind === "image" && attachment.downloadUrl
        ? `<img src="${safe(attachment.downloadUrl)}" alt="${safe(attachment.name)}">`
        : ""}
      <span>
        <b>${safe(attachment.name)}</b>
        <small>${safe(attachment.mimeType || copy.attach)}</small>
      </span>
    </a>
  ` : "";

  return `
    <article
      class="vcc-message"
      data-testid="chat-message"
      data-own="${String(own)}"
      data-agent="${String(Boolean(message.agent))}"
    >
      ${own ? "" : `<span class="vcc-avatar">${safe(sender.initials || sender.name?.slice(0, 2) || "?")}</span>`}
      <div class="vcc-main">
        <div class="vcc-meta">
          <strong>${safe(sender.name || sender.displayName)}</strong>
          <time>${safe(formatMessageTime(space, message.createdAt))}</time>
        </div>
        <div class="vcc-bubble">
          ${replied ? `<blockquote><b>${safe(repliedBy?.name || repliedBy?.displayName)}</b>${safe(replied.text)}</blockquote>` : ""}
          ${attachmentHtml}
          <p data-testid="message-body">${safe(message.deleted ? copy.deleted : message.text)}</p>
          ${message.edited && !message.deleted ? `<small class="vcc-edited">${copy.edited}</small>` : ""}
          ${own ? `
            <small
              class="vcc-status"
              data-failed="${String(message.status === "failed")}"
              data-action="retry"
              data-testid="${message.status === "failed" ? "retry-message" : "delivery-status"}"
              data-id="${safe(message.id)}"
            >${safe(delivery)}</small>
          ` : ""}
          ${actions}
        </div>
        ${reactionHtml ? `<div class="vcc-reactions">${reactionHtml}</div>` : ""}
      </div>
    </article>
  `;
}
