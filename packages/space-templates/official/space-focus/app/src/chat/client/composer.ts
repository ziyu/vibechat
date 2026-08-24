import type { SpaceMessage, SpaceSdk } from "../../browser/sdk.js";
import { escapeHtml } from "../../browser/html.js";
import { getChatCopy } from "./copy.js";
import {
  closestDataTarget,
  resizeComposer,
  type ChatElements,
} from "./dom.js";
import { getAllMessages } from "./messages.js";
import type { ChatState } from "./render.js";

export function setChatError(elements: ChatElements, value?: unknown) {
  const message = value
    ? value instanceof Error
      ? value.message
      : String(value)
    : "";
  elements.error.hidden = message.length === 0;
  elements.error.textContent = message;
}

export function showChatContext(
  space: SpaceSdk,
  elements: ChatElements,
  state: ChatState,
  message: SpaceMessage,
  kind: "reply" | "edit",
) {
  const copy = getChatCopy(space);
  state.replyToId = kind === "reply" ? message.id : null;
  state.editingId = kind === "edit" ? message.id : null;
  if (kind === "edit") elements.input.value = message.text || "";
  elements.context.hidden = false;
  elements.context.innerHTML = `
    <span>${escapeHtml(kind === "edit" ? copy.edit : copy.reply)}: ${escapeHtml(message.text || "")}</span>
    <button type="button" data-action="cancel" aria-label="Cancel">×</button>
  `;
  elements.send.disabled = !elements.input.value.trim();
  resizeComposer(elements.input);
  elements.input.focus();
}

export function clearChatContext(
  elements: ChatElements,
  state: ChatState,
  clearInput: boolean,
) {
  state.replyToId = null;
  state.editingId = null;
  elements.context.hidden = true;
  if (clearInput) elements.input.value = "";
  elements.send.disabled = !elements.input.value.trim();
  resizeComposer(elements.input);
}

export async function handleTimelineAction(
  space: SpaceSdk,
  elements: ChatElements,
  state: ChatState,
  event: Event,
) {
  const target = closestDataTarget(event, "[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  const messageId = target.dataset.id || "";
  const message = getAllMessages(space).find((item) => item.id === messageId);

  try {
    setChatError(elements);
    if (action === "reply" && message) {
      showChatContext(space, elements, state, message, "reply");
    } else if (action === "edit" && message) {
      showChatContext(space, elements, state, message, "edit");
    } else if (action === "delete") {
      await space.chat.delete(messageId);
    } else if (action === "reaction") {
      await space.chat.toggleReaction(messageId, target.dataset.emoji);
    } else if (action === "retry") {
      await space.chat.retry(messageId);
    }
  } catch (reason) {
    setChatError(elements, reason);
  }
}

export async function submitChatMessage(
  space: SpaceSdk,
  elements: ChatElements,
  state: ChatState,
) {
  const text = elements.input.value.trim();
  if (!text) return;

  try {
    setChatError(elements);
    elements.send.disabled = true;
    if (state.editingId) {
      await space.chat.edit(state.editingId, text);
    } else {
      const lowered = text.toLowerCase();
      const mentionIds = space.mentions
        .filter((item) => lowered.includes(`@${item.handle.toLowerCase()}`))
        .map((item) => item.id);
      await space.chat.send({
        text,
        replyToId: state.replyToId || undefined,
        mentionIds,
      });
    }

    elements.input.value = "";
    clearChatContext(elements, state, false);
    await space.chat.setTyping(false);
  } catch (reason) {
    elements.send.disabled = !elements.input.value.trim();
    setChatError(elements, reason);
  }
}

export function updateComposerMentions(
  space: SpaceSdk,
  elements: ChatElements,
  state: ChatState,
) {
  elements.send.disabled = !elements.input.value.trim();
  resizeComposer(elements.input);
  if (state.typingTimer !== null) window.clearTimeout(state.typingTimer);
  void space.chat.setTyping(Boolean(elements.input.value.trim()));
  state.typingTimer = window.setTimeout(() => {
    void space.chat.setTyping(false);
  }, 3500);

  const match = elements.input.value.match(/(?:^|\s)@([^\s@]*)$/);
  if (!match) {
    elements.root.dataset.mentions = "false";
    return;
  }

  const copy = getChatCopy(space);
  const targets = space.mention.search(match[1] || "");
  elements.mentions.innerHTML = targets.map((item) => `
    <button type="button" class="vcc-mention" data-handle="${escapeHtml(item.handle)}">
      <b>${escapeHtml(item.initials || item.name.slice(0, 2))}</b>
      <span>
        <strong>${escapeHtml(item.name)}</strong>
        <small>@${escapeHtml(item.handle)}</small>
      </span>
      <em>${escapeHtml(item.type === "agent" ? copy.agent : copy.person)}</em>
    </button>
  `).join("");
  elements.root.dataset.mentions = String(targets.length > 0);
}

export function chooseMention(elements: ChatElements, event: Event) {
  const target = closestDataTarget(event, "[data-handle]");
  if (!target?.dataset.handle) return;
  elements.input.value = elements.input.value.replace(
    /@[^\s@]*$/,
    `@${target.dataset.handle} `,
  );
  elements.root.dataset.mentions = "false";
  elements.send.disabled = !elements.input.value.trim();
  resizeComposer(elements.input);
  elements.input.focus();
}

export async function attachSelectedFile(
  space: SpaceSdk,
  elements: ChatElements,
) {
  const selected = elements.file.files?.[0];
  if (!selected) return;
  try {
    setChatError(elements);
    await space.chat.attach(selected);
  } catch (reason) {
    setChatError(elements, reason);
  } finally {
    elements.file.value = "";
  }
}
