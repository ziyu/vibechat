import type { SpaceSdk } from "../../browser/sdk.js";
import {
  attachSelectedFile,
  chooseMention,
  clearChatContext,
  handleTimelineAction,
  submitChatMessage,
  updateComposerMentions,
} from "./composer.js";
import { closestDataTarget, getChatElements } from "./dom.js";
import { getAllMessages } from "./messages.js";
import { createChatState, renderChat } from "./render.js";

export async function loadEarlierMessages(
  space: SpaceSdk,
  elements: ReturnType<typeof getChatElements>,
  state: ReturnType<typeof createChatState>,
) {
  if (state.historyLoading || !state.historyHasMore) return;
  const before = getAllMessages(space)[0]?.id;
  if (!before) {
    state.historyHasMore = false;
    renderChat(space, elements, state);
    return;
  }

  state.historyLoading = true;
  state.historyError = false;
  renderChat(space, elements, state);
  state.historyAnchor = {
    scrollHeight: elements.timeline.scrollHeight,
    scrollTop: elements.timeline.scrollTop,
  };
  try {
    const page = await space.chat.recent({ limit: 30, before });
    state.historyHasMore = page.hasMore;
  } catch {
    state.historyError = true;
  } finally {
    state.historyLoading = false;
    renderChat(space, elements, state);
  }
}

export async function bootstrapChat(
  space: SpaceSdk,
  mode: "full" | "dock",
) {
  const elements = getChatElements();
  const state = createChatState();
  elements.root.dataset.mode = mode;
  elements.root.dataset.open = String(mode === "full");

  elements.launch.addEventListener("click", () => {
    elements.root.dataset.open = "true";
    elements.unread.textContent = "0";
    void space.chat.markRead();
    renderChat(space, elements, state);
  });
  elements.close.addEventListener("click", () => {
    elements.root.dataset.open = "false";
  });
  elements.attach.addEventListener("click", () => elements.file.click());
  elements.history.addEventListener("click", () => {
    void loadEarlierMessages(space, elements, state);
  });
  elements.timeline.addEventListener("click", (event) => {
    void handleTimelineAction(space, elements, state, event);
  });
  elements.context.addEventListener("click", (event) => {
    const target = closestDataTarget(event, '[data-action="cancel"]');
    if (target) clearChatContext(elements, state, true);
  });
  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitChatMessage(space, elements, state);
  });
  elements.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      elements.form.requestSubmit();
    }
  });
  elements.input.addEventListener("input", () => {
    updateComposerMentions(space, elements, state);
  });
  elements.mentions.addEventListener("click", (event) => {
    chooseMention(elements, event);
  });
  elements.file.addEventListener("change", () => {
    void attachSelectedFile(space, elements);
  });

  await space.ready;
  renderChat(space, elements, state);
  void space.chat.markRead();
  for (const event of ["snapshot", "messages", "typing", "agent"]) {
    space.on(event, () => renderChat(space, elements, state));
  }
}
