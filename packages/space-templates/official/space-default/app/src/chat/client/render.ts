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
  historyLoading: boolean;
  historyHasMore: boolean;
  historyError: boolean;
  historyAnchor: { scrollHeight: number; scrollTop: number } | null;
}

export function createChatState(): ChatState {
  return {
    replyToId: null,
    editingId: null,
    typingTimer: null,
    lastCount: 0,
    lastTimelineSignature: "",
    historyLoading: false,
    historyHasMore: true,
    historyError: false,
    historyAnchor: null,
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
  elements.history.textContent = state.historyLoading
    ? copy.loadingHistory
    : state.historyHasMore
      ? copy.loadEarlier
      : copy.noEarlier;
  elements.history.disabled = state.historyLoading
    || !state.historyHasMore
    || messages.length === 0;
  elements.historyStatus.hidden = !state.historyError;
  elements.historyStatus.textContent = state.historyError ? copy.historyFailed : "";

  const signature = JSON.stringify([
    space.locale,
    meta,
    messages,
    space.agent.build || null,
    state.historyLoading,
    state.historyHasMore,
    state.historyError,
  ]);

  if (signature !== state.lastTimelineSignature) {
    const previousScrollHeight = elements.timeline.scrollHeight;
    const previousScrollTop = elements.timeline.scrollTop;
    const wasNearBottom = previousScrollHeight === 0
      || previousScrollHeight - previousScrollTop - elements.timeline.clientHeight < 48;
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
    if (state.historyAnchor) {
      elements.timeline.scrollTop = state.historyAnchor.scrollTop
        + elements.timeline.scrollHeight
        - state.historyAnchor.scrollHeight;
      state.historyAnchor = null;
    } else if (wasNearBottom) {
      elements.timeline.scrollTop = elements.timeline.scrollHeight;
    } else {
      elements.timeline.scrollTop = previousScrollTop;
    }
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
