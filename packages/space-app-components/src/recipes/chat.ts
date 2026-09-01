import type { SpaceComponentContext } from "../core/context.js";
import {
  createSpaceChatController,
  type SpaceChatController,
} from "../chat/controller.js";
import type { SpaceChatMessageView } from "../chat/view.js";
import {
  spaceChatEventNames,
  type SpaceChatComponentEventDetailMap,
  type SpaceChatComposerElement,
  type SpaceChatErrorStateElement,
  type SpaceChatTimelineElement,
  type SpaceMentionMenuElement,
  type SpaceMentionRange,
} from "../chat/interactive-elements.js";

export type SpaceChatRecipeMode = "full" | "dock";

export interface SpaceChatRecipeCopy {
  readonly connected: string;
  readonly members: string;
  readonly empty: string;
  readonly hint: string;
  /** @deprecated Legacy copy for the detached Chat build compatibility projection. */
  readonly working: string;
  readonly title: string;
  readonly open: string;
  readonly close: string;
  readonly region: string;
  readonly timeline: string;
}

export interface SpaceChatRecipeElements {
  readonly root: HTMLElement;
  readonly launch: HTMLButtonElement;
  readonly launchLabel: HTMLElement;
  readonly shell: HTMLElement;
  readonly close: HTMLButtonElement;
  readonly unread: HTMLElement;
  readonly mark: HTMLElement;
  readonly roomName: HTMLElement;
  readonly memberCount: HTMLElement;
  readonly opening: HTMLElement;
  readonly openingMark: HTMLElement;
  readonly openingTitle: HTMLElement;
  readonly openingSummary: HTMLElement;
  readonly openingAgent: HTMLElement;
  /** @deprecated Mount Agent status with AgentActivityPanelRecipe instead. */
  readonly build: HTMLElement;
  /** @deprecated Mount Agent status with AgentActivityPanelRecipe instead. */
  readonly buildTitle: HTMLElement;
  /** @deprecated Mount Agent status with AgentActivityPanelRecipe instead. */
  readonly buildStage: HTMLElement;
  readonly hint: HTMLElement;
  readonly timeline: SpaceChatTimelineElement;
  readonly composer: SpaceChatComposerElement;
  readonly mentions: SpaceMentionMenuElement;
  readonly error: SpaceChatErrorStateElement;
}

export interface SpaceChatRecipeOptions {
  readonly context: SpaceComponentContext;
  readonly elements: SpaceChatRecipeElements;
  readonly copy: () => SpaceChatRecipeCopy;
  readonly reactionChoices?: readonly string[];
}

export interface SpaceChatRecipeHandle {
  readonly ready: Promise<void>;
  readonly controller: SpaceChatController;
  readonly mode: SpaceChatRecipeMode;
  readonly disposed: boolean;
  readonly open: boolean;
  readonly unreadCount: number;
  show(): void;
  hide(): void;
  dispose(): void;
}

const recipeSelectors = Object.freeze({
  root: "#vcc-root",
  launch: "#vcc-launch",
  launchLabel: "#vcc-launch-label",
  shell: "#vcc-shell",
  close: "#vcc-close",
  unread: "#vcc-unread",
  mark: "#vcc-mark",
  roomName: "#vcc-room-name",
  memberCount: "#vcc-member-count",
  opening: "#vcc-opening",
  openingMark: "#vcc-opening-mark",
  openingTitle: "#vcc-opening-title",
  openingSummary: "#vcc-opening-summary",
  openingAgent: "#vcc-opening-agent",
  build: "#vcc-build",
  buildTitle: "#vcc-build-title",
  buildStage: "#vcc-build-stage",
  hint: "#vcc-hint",
  timeline: "#vcc-timeline",
  composer: "#vcc-composer",
  mentions: "#vcc-mentions",
  error: "#vcc-error",
});

function requireRecipeElement<T extends Element>(
  root: ParentNode,
  selector: string,
  label: string,
) {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`${label} is missing ${selector}`);
  return element;
}

function resolveLegacyBuildRecipeElements(
  root: ParentNode,
  document: Document,
  label: string,
): Pick<SpaceChatRecipeElements, "build" | "buildTitle" | "buildStage"> {
  const build = root.querySelector<HTMLElement>(recipeSelectors.build);
  const buildTitle = root.querySelector<HTMLElement>(recipeSelectors.buildTitle);
  const buildStage = root.querySelector<HTMLElement>(recipeSelectors.buildStage);
  const existingCount = [build, buildTitle, buildStage].filter(Boolean).length;

  if (existingCount === 0) {
    const createPlaceholder = () => {
      const element = document.createElement("span");
      element.hidden = true;
      element.setAttribute("aria-hidden", "true");
      return element;
    };
    return {
      build: createPlaceholder(),
      buildTitle: createPlaceholder(),
      buildStage: createPlaceholder(),
    };
  }

  return {
    build: build ?? requireRecipeElement(root, recipeSelectors.build, label),
    buildTitle: buildTitle ?? requireRecipeElement(root, recipeSelectors.buildTitle, label),
    buildStage: buildStage ?? requireRecipeElement(root, recipeSelectors.buildStage, label),
  };
}

export function resolveSpaceChatRecipeElements(
  root: ParentNode,
  label = "Space Chat recipe",
): SpaceChatRecipeElements {
  const rootElement = requireRecipeElement<HTMLElement>(
    root,
    recipeSelectors.root,
    label,
  );
  const legacyBuild = resolveLegacyBuildRecipeElements(
    root,
    rootElement.ownerDocument,
    label,
  );
  return {
    root: rootElement,
    launch: requireRecipeElement(root, recipeSelectors.launch, label),
    launchLabel: requireRecipeElement(root, recipeSelectors.launchLabel, label),
    shell: requireRecipeElement(root, recipeSelectors.shell, label),
    close: requireRecipeElement(root, recipeSelectors.close, label),
    unread: requireRecipeElement(root, recipeSelectors.unread, label),
    mark: requireRecipeElement(root, recipeSelectors.mark, label),
    roomName: requireRecipeElement(root, recipeSelectors.roomName, label),
    memberCount: requireRecipeElement(root, recipeSelectors.memberCount, label),
    opening: requireRecipeElement(root, recipeSelectors.opening, label),
    openingMark: requireRecipeElement(root, recipeSelectors.openingMark, label),
    openingTitle: requireRecipeElement(root, recipeSelectors.openingTitle, label),
    openingSummary: requireRecipeElement(root, recipeSelectors.openingSummary, label),
    openingAgent: requireRecipeElement(root, recipeSelectors.openingAgent, label),
    ...legacyBuild,
    hint: requireRecipeElement(root, recipeSelectors.hint, label),
    timeline: requireRecipeElement(root, recipeSelectors.timeline, label),
    composer: requireRecipeElement(root, recipeSelectors.composer, label),
    mentions: requireRecipeElement(root, recipeSelectors.mentions, label),
    error: requireRecipeElement(root, recipeSelectors.error, label),
  };
}

function mountSpaceChatRecipe(
  mode: SpaceChatRecipeMode,
  options: SpaceChatRecipeOptions,
): SpaceChatRecipeHandle {
  const { context, elements } = options;
  if (context.disposed) {
    throw new Error("Space Chat recipe requires an active component context");
  }
  if (typeof options.copy !== "function") {
    throw new TypeError("Space Chat recipe requires Template copy");
  }

  const {
    root,
    launch,
    launchLabel,
    shell,
    close,
    unread,
    mark,
    roomName,
    memberCount,
    opening,
    openingMark,
    openingTitle,
    openingSummary,
    openingAgent,
    build,
    buildTitle,
    buildStage,
    hint,
    timeline,
    composer,
    mentions,
    error,
  } = elements;
  const document = root.ownerDocument;
  const view = document.defaultView;
  const chat = createSpaceChatController(context);
  const cleanups: Array<() => void> = [];
  let disposed = false;
  let removeFromContext = () => {};
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
  timeline.reactionChoices = [...(options.reactionChoices ?? ["♥", "✨", "🌙"])];

  const listen = (
    target: EventTarget,
    type: string,
    listener: EventListener,
    eventOptions?: AddEventListenerOptions,
  ) => {
    target.addEventListener(type, listener, eventOptions);
    cleanups.push(() => target.removeEventListener(type, listener, eventOptions));
  };
  const eventDetail = <T>(event: Event) => (event as CustomEvent<T>).detail;

  const markLatestRead = () => {
    if (disposed) return;
    const latestMessageId = chat.getSnapshot().messages.at(-1)?.id;
    if (
      !context.sdk.snapshot.chat.permissions.markRead
      || !latestMessageId
      || latestMessageId === lastMarkedReadMessageId
      || root.dataset.open !== "true"
      || document.visibilityState !== "visible"
    ) return;
    lastMarkedReadMessageId = latestMessageId;
    void chat.markRead().then(() => {
      if (disposed) return;
      const current = chat.getSnapshot();
      const currentMessageId = current.messages.at(-1)?.id;
      if (current.error?.command === "mark-read" && currentMessageId === latestMessageId) {
        lastMarkedReadMessageId = null;
      }
      if (currentMessageId !== latestMessageId) markLatestRead();
    });
  };

  const render = () => {
    if (disposed) return;
    const state = chat.getSnapshot();
    const snapshot = context.sdk.snapshot;
    const copy = options.copy();
    const locale = context.sdk.locale || snapshot.locale || "en";
    if (mode === "full") {
      document.documentElement.lang = locale;
      document.title = `${snapshot.meta.name || "Space"} · ${copy.title}`;
    }
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
    memberCount.textContent = `${snapshot.members.length} ${copy.members} · ${copy.connected}`;
    openingMark.textContent = snapshot.meta.icon || "V";
    openingTitle.textContent = snapshot.meta.name || "Space";
    openingSummary.textContent = snapshot.meta.summary || copy.empty;
    openingAgent.textContent = `Matrix Chat Core · @${snapshot.agent.id || "agent"}`;
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
    composer.sendDisabled = !snapshot.chat.permissions.send;
    composer.attachmentDisabled = !snapshot.chat.permissions.attach;
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

  const show = () => {
    if (disposed) return;
    root.dataset.open = "true";
    unreadCount = 0;
    unread.textContent = "0";
    markLatestRead();
  };
  const hide = () => {
    if (!disposed) root.dataset.open = "false";
  };

  listen(launch, "click", show);
  listen(close, "click", hide);
  listen(composer, spaceChatEventNames.submit, (event) => {
    const detail = eventDetail<
      SpaceChatComponentEventDetailMap[typeof spaceChatEventNames.submit]
    >(event);
    chat.setDraft(detail.text, detail.mentionIds);
    void chat.send();
  });
  listen(composer, spaceChatEventNames.attach, (event) => {
    void chat.attach(eventDetail<
      SpaceChatComponentEventDetailMap[typeof spaceChatEventNames.attach]
    >(event).file);
  });
  listen(composer, spaceChatEventNames.typing, (event) => {
    if (!context.sdk.snapshot.chat.permissions.typing) return;
    void chat.setTyping(eventDetail<
      SpaceChatComponentEventDetailMap[typeof spaceChatEventNames.typing]
    >(event).isTyping);
  });
  listen(composer, spaceChatEventNames.mentionQuery, (event) => {
    const detail = eventDetail<
      SpaceChatComponentEventDetailMap[typeof spaceChatEventNames.mentionQuery]
    >(event);
    mentionRange = detail.range;
    mentions.hidden = detail.query === null;
    if (detail.query !== null) chat.searchMentions(detail.query);
  });
  listen(composer, spaceChatEventNames.cancelContext, () => chat.cancelContext());
  listen(mentions, spaceChatEventNames.mentionSelect, (event) => {
    const target = eventDetail<
      SpaceChatComponentEventDetailMap[typeof spaceChatEventNames.mentionSelect]
    >(event).target;
    chat.selectMention(target);
    composer.insertMention(target, mentionRange);
    mentionRange = null;
    mentions.hidden = true;
  });
  listen(mentions, spaceChatEventNames.mentionDismiss, () => {
    mentionRange = null;
    mentions.hidden = true;
  });
  listen(timeline, spaceChatEventNames.reply, (event) => {
    chat.beginReply(eventDetail<
      SpaceChatComponentEventDetailMap[typeof spaceChatEventNames.reply]
    >(event).messageId);
    composer.focus();
  });
  listen(timeline, spaceChatEventNames.edit, (event) => {
    chat.beginEdit(eventDetail<
      SpaceChatComponentEventDetailMap[typeof spaceChatEventNames.edit]
    >(event).messageId);
    composer.focus();
  });
  listen(timeline, spaceChatEventNames.delete, (event) => {
    void chat.delete(eventDetail<
      SpaceChatComponentEventDetailMap[typeof spaceChatEventNames.delete]
    >(event).messageId);
  });
  listen(timeline, spaceChatEventNames.retry, (event) => {
    void chat.retry(eventDetail<
      SpaceChatComponentEventDetailMap[typeof spaceChatEventNames.retry]
    >(event).messageId);
  });
  listen(timeline, spaceChatEventNames.reaction, (event) => {
    const detail = eventDetail<
      SpaceChatComponentEventDetailMap[typeof spaceChatEventNames.reaction]
    >(event);
    void chat.toggleReaction(detail.messageId, detail.emoji);
  });
  listen(error, spaceChatEventNames.dismissError, () => chat.clearError());

  const unsubscribe = chat.subscribe(render);
  cleanups.push(unsubscribe);
  listen(document, "visibilitychange", markLatestRead);

  let handle: SpaceChatRecipeHandle;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    removeFromContext();
    for (const cleanup of cleanups.splice(0).reverse()) cleanup();
    chat.dispose();
  };
  handle = {
    ready: chat.ready.then(() => render()),
    controller: chat,
    mode,
    get disposed() {
      return disposed;
    },
    get open() {
      return root.dataset.open === "true";
    },
    get unreadCount() {
      return unreadCount;
    },
    show,
    hide,
    dispose,
  };
  removeFromContext = context.addDisposable(dispose);
  if (view) listen(view, "pagehide", dispose, { once: true });
  render();
  return handle;
}

export function mountDefaultChatRecipe(
  options: SpaceChatRecipeOptions,
): SpaceChatRecipeHandle {
  return mountSpaceChatRecipe("full", options);
}

export function mountChatDrawerRecipe(
  options: SpaceChatRecipeOptions,
): SpaceChatRecipeHandle {
  return mountSpaceChatRecipe("dock", options);
}
