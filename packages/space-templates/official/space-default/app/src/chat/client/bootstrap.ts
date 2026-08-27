import type { SpaceSdk } from "../../browser/sdk.js";
import type {
  SpaceChatComponentEventDetailMap,
  SpaceChatComposerElement,
  SpaceChatController,
  SpaceChatErrorStateElement,
  SpaceChatMessageView,
  SpaceChatTimelineElement,
  SpaceMentionMenuElement,
  SpaceMentionRange,
} from "@vibechat/space-app-components/chat";
import type { SpaceComponentContext } from "@vibechat/space-app-components/core";
import { getChatCopy } from "./copy.js";

interface SpaceChatComponentModule {
  createSpaceComponentContext(options: { sdk: SpaceSdk }): SpaceComponentContext;
  createSpaceChatController(context: SpaceComponentContext): SpaceChatController;
  spaceChatEventNames: typeof import("@vibechat/space-app-components/chat").spaceChatEventNames;
}

export async function bootstrapChat(
  space: SpaceSdk,
  components: SpaceChatComponentModule,
  mode: "full" | "dock",
) {
  const requireElement = <T extends Element>(selector: string) => {
    const element = document.querySelector<T>(selector);
    if (!element) throw new Error(`Default Chat App is missing ${selector}`);
    return element;
  };
  const eventDetail = <T>(event: Event) => (event as CustomEvent<T>).detail;
  const root = requireElement<HTMLElement>("#vcc-root");
  const launch = requireElement<HTMLButtonElement>("#vcc-launch");
  const launchLabel = requireElement<HTMLElement>("#vcc-launch-label");
  const shell = requireElement<HTMLElement>("#vcc-shell");
  const close = requireElement<HTMLButtonElement>("#vcc-close");
  const unread = requireElement<HTMLElement>("#vcc-unread");
  const mark = requireElement<HTMLElement>("#vcc-mark");
  const roomName = requireElement<HTMLElement>("#vcc-room-name");
  const memberCount = requireElement<HTMLElement>("#vcc-member-count");
  const opening = requireElement<HTMLElement>("#vcc-opening");
  const openingMark = requireElement<HTMLElement>("#vcc-opening-mark");
  const openingTitle = requireElement<HTMLElement>("#vcc-opening-title");
  const openingSummary = requireElement<HTMLElement>("#vcc-opening-summary");
  const openingAgent = requireElement<HTMLElement>("#vcc-opening-agent");
  const build = requireElement<HTMLElement>("#vcc-build");
  const buildTitle = requireElement<HTMLElement>("#vcc-build-title");
  const buildStage = requireElement<HTMLElement>("#vcc-build-stage");
  const hint = requireElement<HTMLElement>("#vcc-hint");
  const timeline = requireElement<SpaceChatTimelineElement>("#vcc-timeline");
  const composer = requireElement<SpaceChatComposerElement>("#vcc-composer");
  const mentions = requireElement<SpaceMentionMenuElement>("#vcc-mentions");
  const error = requireElement<SpaceChatErrorStateElement>("#vcc-error");
  const context = components.createSpaceComponentContext({ sdk: space });
  const chat = components.createSpaceChatController(context);
  const events = components.spaceChatEventNames;
  let mentionRange: SpaceMentionRange | null = null;
  let renderedDraft: string | null = null;
  let renderedMentionIds = "";
  let renderedMessages: readonly SpaceChatMessageView[] | null = null;
  let renderedTypingUsers: SpaceChatTimelineElement["typingUsers"] | null = null;
  let lastMessageCount = chat.getSnapshot().messages.length;
  let unreadCount = 0;
  let lastMarkedReadMessageId: string | null = null;

  root.dataset.mode = mode;
  root.dataset.open = String(mode === "full");
  timeline.interactive = true;
  timeline.reactionChoices = ["♥", "✨", "🌙"];

  const markLatestRead = () => {
    const latestMessageId = chat.getSnapshot().messages.at(-1)?.id;
    if (
      !space.chat.permissions.markRead
      || !latestMessageId
      || latestMessageId === lastMarkedReadMessageId
      || root.dataset.open !== "true"
      || document.visibilityState !== "visible"
    ) return;
    lastMarkedReadMessageId = latestMessageId;
    void chat.markRead().then(() => {
      const current = chat.getSnapshot();
      const currentMessageId = current.messages.at(-1)?.id;
      if (current.error?.command === "mark-read" && currentMessageId === latestMessageId) {
        lastMarkedReadMessageId = null;
      }
      if (currentMessageId !== latestMessageId) {
        markLatestRead();
      }
    });
  };

  const render = () => {
    const state = chat.getSnapshot();
    const snapshot = space.snapshot;
    const copy = getChatCopy(space);
    const locale = space.locale || snapshot.locale || "en";
    document.documentElement.lang = locale;
    document.title = `${snapshot.meta.name || "Space"} · ${copy.title}`;
    for (const element of [timeline, composer, mentions, error]) {
      element.setAttribute("locale", locale);
    }
    launch.setAttribute("aria-label", copy.open);
    launchLabel.textContent = copy.title;
    shell.setAttribute("aria-label", copy.region);
    close.setAttribute("aria-label", copy.close);
    close.title = copy.close;
    timeline.setAttribute("aria-label", copy.timeline);
    mark.textContent = snapshot.meta.icon || "V";
    roomName.textContent = snapshot.meta.name || "Space";
    memberCount.textContent =
      `${snapshot.members.length} ${copy.members} · ${copy.connected}`;
    openingMark.textContent = snapshot.meta.icon || "V";
    openingTitle.textContent = snapshot.meta.name || "Space";
    openingSummary.textContent = snapshot.meta.summary || copy.empty;
    openingAgent.textContent =
      `Matrix Chat Core · @${snapshot.agent.id || "agent"}`;
    hint.textContent = copy.hint;
    opening.hidden = state.messages.length > 0;

    const buildSnapshot = snapshot.agent.build;
    build.hidden = !buildSnapshot;
    buildTitle.textContent = buildSnapshot
      ? `${snapshot.agent.name || snapshot.agent.id || "Agent"} ${copy.working}`
      : "";
    buildStage.textContent = buildSnapshot && typeof buildSnapshot.stage === "string"
      ? buildSnapshot.stage
      : "";

    timeline.state = state.error && !state.ready
      ? "error"
      : state.ready
        ? "ready"
        : "loading";
    timeline.error = state.error && !state.ready ? state.error.message : null;
    if (renderedMessages !== state.messages) {
      renderedMessages = state.messages;
      timeline.messages = state.messages;
    }
    if (renderedTypingUsers !== state.typingUsers) {
      renderedTypingUsers = state.typingUsers;
      timeline.typingUsers = state.typingUsers;
    }
    if (renderedDraft !== state.draft) {
      renderedDraft = state.draft;
      composer.draft = state.draft;
    }
    const mentionIds = state.mentionIds.join("\u0000");
    if (renderedMentionIds !== mentionIds) {
      renderedMentionIds = mentionIds;
      composer.mentionIds = state.mentionIds;
    }
    composer.pending = state.pending !== null;
    composer.sendDisabled = !space.chat.permissions.send;
    composer.attachmentDisabled = !space.chat.permissions.attach;
    timeline.interactionDisabled = state.pending !== null;
    composer.context = state.context
      ? {
          kind: state.context.kind,
          messageId: state.context.message.id,
          author: state.context.message.author.name,
          text: state.context.message.text,
        }
      : null;
    mentions.targets = state.mentionTargets;
    error.error = state.error;

    if (root.dataset.open !== "true" && state.messages.length > lastMessageCount) {
      unreadCount += state.messages.length - lastMessageCount;
    } else if (root.dataset.open === "true") {
      unreadCount = 0;
    }
    unread.textContent = String(unreadCount);
    lastMessageCount = state.messages.length;
    markLatestRead();
  };

  launch.addEventListener("click", () => {
    root.dataset.open = "true";
    unreadCount = 0;
    unread.textContent = "0";
    markLatestRead();
  });
  close.addEventListener("click", () => {
    root.dataset.open = "false";
  });
  composer.addEventListener(events.submit, (event) => {
    const detail = eventDetail<
      SpaceChatComponentEventDetailMap[typeof events.submit]
    >(event);
    chat.setDraft(detail.text, detail.mentionIds);
    void chat.send();
  });
  composer.addEventListener(events.attach, (event) => {
    void chat.attach(eventDetail<
      SpaceChatComponentEventDetailMap[typeof events.attach]
    >(event).file);
  });
  composer.addEventListener(events.typing, (event) => {
    if (!space.chat.permissions.typing) return;
    void chat.setTyping(
      eventDetail<SpaceChatComponentEventDetailMap[typeof events.typing]>(event)
        .isTyping,
    );
  });
  composer.addEventListener(events.mentionQuery, (event) => {
    const detail = eventDetail<
      SpaceChatComponentEventDetailMap[typeof events.mentionQuery]
    >(event);
    mentionRange = detail.range;
    mentions.hidden = detail.query === null;
    if (detail.query !== null) chat.searchMentions(detail.query);
  });
  composer.addEventListener(events.cancelContext, () => {
    chat.cancelContext();
  });
  mentions.addEventListener(events.mentionSelect, (event) => {
    const target = eventDetail<
      SpaceChatComponentEventDetailMap[typeof events.mentionSelect]
    >(event).target;
    chat.selectMention(target);
    composer.insertMention(target, mentionRange);
    mentionRange = null;
    mentions.hidden = true;
  });
  mentions.addEventListener(events.mentionDismiss, () => {
    mentionRange = null;
    mentions.hidden = true;
  });
  timeline.addEventListener(events.reply, (event) => {
    chat.beginReply(eventDetail<
      SpaceChatComponentEventDetailMap[typeof events.reply]
    >(event).messageId);
    composer.focus();
  });
  timeline.addEventListener(events.edit, (event) => {
    chat.beginEdit(eventDetail<
      SpaceChatComponentEventDetailMap[typeof events.edit]
    >(event).messageId);
    composer.focus();
  });
  timeline.addEventListener(events.delete, (event) => {
    void chat.delete(eventDetail<
      SpaceChatComponentEventDetailMap[typeof events.delete]
    >(event).messageId);
  });
  timeline.addEventListener(events.retry, (event) => {
    void chat.retry(eventDetail<
      SpaceChatComponentEventDetailMap[typeof events.retry]
    >(event).messageId);
  });
  timeline.addEventListener(events.reaction, (event) => {
    const detail = eventDetail<
      SpaceChatComponentEventDetailMap[typeof events.reaction]
    >(event);
    void chat.toggleReaction(detail.messageId, detail.emoji);
  });
  error.addEventListener(events.dismissError, () => {
    chat.clearError();
  });

  const unsubscribe = chat.subscribe(render);
  const handleVisibilityChange = () => markLatestRead();
  document.addEventListener("visibilitychange", handleVisibilityChange);
  await chat.ready;
  render();
  window.addEventListener("pagehide", () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    unsubscribe();
    chat.dispose();
    context.dispose();
  }, { once: true });
}
