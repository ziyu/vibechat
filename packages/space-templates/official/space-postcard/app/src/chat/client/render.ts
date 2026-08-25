import type { SpaceSdk } from "../../browser/sdk.js";
import { escapeHtml } from "../../browser/html.js";
import { getChatCopy } from "./copy.js";
import type { ChatElements } from "./dom.js";
import {
  findMember,
  getAllMessages,
  renderMessageHtml,
} from "./messages.js";

export interface ChatState {
  replyToId: string | null;
  editingId: string | null;
  typingTimer: number | null;
  lastCount: number;
  lastTimelineSignature: string;
}

export function createChatState(): ChatState {
  return {
    replyToId: null,
    editingId: null,
    typingTimer: null,
    lastCount: 0,
    lastTimelineSignature: "",
  };
}

export function renderChat(
  space: SpaceSdk,
  elements: ChatElements,
  state: ChatState,
) {
  const copy = getChatCopy(space);
  const messages = getAllMessages(space);
  const meta = space.meta || {};

  elements.mark.textContent = meta.icon || "V";
  elements.roomName.textContent = meta.name || "Space";
  elements.memberCount.textContent = `${space.members.length} ${copy.members} · ${copy.connected}`;
  elements.input.placeholder = copy.placeholder;
  elements.attach.setAttribute("aria-label", copy.attachFile);
  elements.hint.textContent = copy.hint;

  const signature = JSON.stringify([
    space.locale,
    meta,
    messages,
    space.agent.build || null,
  ]);

  if (signature !== state.lastTimelineSignature) {
    state.lastTimelineSignature = signature;
    const opening = `
      <section class="vcc-opening">
        <b>${escapeHtml(meta.icon || "V")}</b>
        <h1>${escapeHtml(meta.name || "Space")}</h1>
        <p>${escapeHtml(meta.summary || copy.empty)}</p>
        <span>Matrix Chat Core · @${escapeHtml(space.agent.id || "agent")}</span>
      </section>
    `;
    const build = space.agent.build ? `
      <div class="vcc-build">
        <i></i>
        <span>
          <b>${escapeHtml(space.agent.name || space.agent.id || "Agent")} ${copy.working}</b>
          <small>${escapeHtml(space.agent.build.stage || "")}</small>
        </span>
      </div>
    ` : "";

    elements.timeline.innerHTML = [
      opening,
      ...messages.map((message) =>
        renderMessageHtml(space, message, messages, copy)),
      build,
    ].join("");
    requestAnimationFrame(() => {
      elements.timeline.scrollTop = elements.timeline.scrollHeight;
    });
  }

  if (elements.root.dataset.open !== "true" && messages.length > state.lastCount) {
    elements.unread.textContent = String(messages.length - state.lastCount);
  }
  state.lastCount = messages.length;

  const typingNames = (space.chat.typingMemberIds || [])
    .map((id) => {
      const current = findMember(space, id);
      return current.name || current.displayName;
    })
    .filter(Boolean);
  elements.typing.hidden = typingNames.length === 0;
  elements.typing.textContent = `${typingNames.join("、")} ${copy.typing}`;
}
