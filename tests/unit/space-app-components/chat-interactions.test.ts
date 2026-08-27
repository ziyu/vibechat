import { describe, expect, it, vi } from "vitest";

import type {
  SpaceAppClient,
  SpaceAppSnapshot,
  SpaceChatMessage,
} from "@vibechat/space-app-sdk";
import {
  createSpaceChatAttachmentView,
  createSpaceChatController,
  createSpaceChatMessageViews,
  getSpaceChatMessageGroupPositions,
  renderSpaceChatAttachment,
  spaceChatComposerStyles,
  spaceChatEventNames,
  spaceChatTimelineStyles,
  spaceMentionMenuStyles,
  spaceMessageActionsStyles,
  spaceReactionBarStyles,
} from "@vibechat/space-app-components/chat";
import { createSpaceComponentContext } from "@vibechat/space-app-components/core";
import {
  mountChatDrawerRecipe,
  type SpaceChatRecipeElements,
} from "@vibechat/space-app-components/recipes";

function chatMessage(
  id: string,
  senderId: string,
  text: string,
  options: Partial<SpaceChatMessage> = {},
): SpaceChatMessage {
  return {
    id,
    roomId: "room-1",
    senderId,
    text,
    createdAt: "2026-08-26T10:00:00.000Z",
    status: "sent",
    reactions: [],
    ...options,
  };
}

function chatSnapshot(): SpaceAppSnapshot {
  const messages = [
    chatMessage("member-message", "bob", "Original note"),
    chatMessage("own-message", "self", "Own note"),
  ];
  return {
    appId: "chat-interactions",
    locale: "en",
    meta: {
      id: "chat-interactions",
      name: "Chat interactions",
      summary: "",
      icon: "V",
      accent: "#d95835",
    },
    self: {
      id: "self",
      clientId: "self-client",
      name: "Alice",
      displayName: "Alice",
      handle: "alice",
    },
    members: [{
      id: "bob",
      clientId: "bob-client",
      name: "Bob",
      displayName: "Bob",
      handle: "bob",
    }],
    mentions: [
      { id: "bob", handle: "bob", name: "Bob", type: "member", available: true },
      { id: "wayfinder", handle: "wayfinder", name: "Wayfinder", type: "agent", available: true },
      { id: "offline", handle: "offline", name: "Offline", type: "agent", available: false },
    ],
    messages,
    app: { revision: 0, state: {}, presence: [] },
    chat: {
      messages,
      typingMemberIds: [],
      permissions: {
        send: true,
        attach: true,
        reply: true,
        editOwn: true,
        deleteOwn: true,
        react: true,
        retryOwn: true,
        typing: true,
        markRead: true,
      },
    },
    agent: {
      id: "wayfinder",
      name: "Wayfinder",
      messages: [],
      build: null,
      queue: { activeCount: 0, pendingCount: 0 },
    },
  };
}

function interactiveSdk() {
  const snapshot = chatSnapshot();
  const listeners = new Map<string, Set<(value: unknown) => void>>();
  const chat = {
    messages: snapshot.chat.messages,
    typingMemberIds: snapshot.chat.typingMemberIds,
    send: vi.fn(async () => ({ eventId: "event-1" })),
    attach: vi.fn(async () => ({ eventId: "event-attachment" })),
    edit: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    toggleReaction: vi.fn(async () => undefined),
    retry: vi.fn(async () => undefined),
    setTyping: vi.fn(async () => undefined),
    markRead: vi.fn(async () => undefined),
    on: vi.fn(() => () => {}),
  };
  const client = {
    version: 1,
    locale: "en",
    snapshot,
    chat,
    mention: {
      search(query = "") {
        const normalized = query.toLowerCase();
        return snapshot.mentions.filter((target) =>
          target.handle.toLowerCase().includes(normalized)
          || target.name.toLowerCase().includes(normalized));
      },
      on: vi.fn(() => () => {}),
    },
    on(type: string, handler: (value: unknown) => void) {
      const handlers = listeners.get(type) ?? new Set();
      handlers.add(handler);
      listeners.set(type, handlers);
      return () => { handlers.delete(handler); };
    },
  } as unknown as SpaceAppClient;
  Object.defineProperty(client, "ready", {
    value: Promise.resolve(client),
    enumerable: true,
  });
  return { client, chat, snapshot, listeners };
}

class RecipeTestElement extends EventTarget {
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  ownerDocument!: Document;
  textContent = "";
  title = "";
  hidden = false;
  state = "loading";
  error: unknown = null;
  messages: readonly unknown[] = [];
  typingUsers: readonly unknown[] = [];
  draft = "";
  mentionIds: readonly string[] = [];
  pending = false;
  sendDisabled = false;
  attachmentDisabled = false;
  interactionDisabled = false;
  interactive = false;
  reactionChoices: readonly string[] = [];
  context: unknown = null;
  targets: readonly unknown[] = [];
  focus = vi.fn();
  insertMention = vi.fn();

  setAttribute(name: string, value: string) {
    this.attributes.set(name, String(value));
  }
}

function recipeFixture() {
  const documentTarget = new EventTarget() as Document & {
    visibilityState: DocumentVisibilityState;
    defaultView: Window | null;
    documentElement: { lang: string };
    title: string;
  };
  documentTarget.visibilityState = "visible";
  documentTarget.defaultView = null;
  documentTarget.documentElement = { lang: "" };
  documentTarget.title = "";
  const element = () => {
    const value = new RecipeTestElement();
    value.ownerDocument = documentTarget;
    return value;
  };
  const elements = {
    root: element(),
    launch: element(),
    launchLabel: element(),
    shell: element(),
    close: element(),
    unread: element(),
    mark: element(),
    roomName: element(),
    memberCount: element(),
    opening: element(),
    openingMark: element(),
    openingTitle: element(),
    openingSummary: element(),
    openingAgent: element(),
    build: element(),
    buildTitle: element(),
    buildStage: element(),
    hint: element(),
    timeline: element(),
    composer: element(),
    mentions: element(),
    error: element(),
  } as unknown as SpaceChatRecipeElements;
  return { document: documentTarget, elements };
}

function recipeEvent<T>(type: string, detail: T) {
  const event = new Event(type);
  Object.defineProperty(event, "detail", { value: detail });
  return event;
}

describe("Space Chat migration-ready controller", () => {
  it("delegates the complete Chat command surface and preserves structured mentions", async () => {
    const sdk = interactiveSdk();
    const context = createSpaceComponentContext({ sdk: sdk.client });
    const controller = createSpaceChatController(context);
    await controller.ready;

    const [agent] = controller.searchMentions("way");
    expect(agent?.type).toBe("agent");
    controller.selectMention(agent!);
    controller.setDraft("Map this route @wayfinder", controller.getSnapshot().mentionIds);
    await controller.send();
    expect(sdk.chat.send).toHaveBeenCalledWith({
      text: "Map this route @wayfinder",
      replyToId: undefined,
      mentionIds: ["wayfinder"],
    });
    expect(controller.getSnapshot()).toMatchObject({
      draft: "",
      mentionIds: [],
      context: null,
      pending: null,
      error: null,
    });

    controller.beginReply("member-message");
    controller.setDraft("Reply text");
    await controller.send();
    expect(sdk.chat.send).toHaveBeenLastCalledWith({
      text: "Reply text",
      replyToId: "member-message",
      mentionIds: undefined,
    });

    controller.beginEdit("own-message");
    expect(controller.getSnapshot().draft).toBe("Own note");
    controller.setDraft("Edited note");
    await controller.send();
    expect(sdk.chat.edit).toHaveBeenCalledWith("own-message", "Edited note");
    expect(controller.getSnapshot().draft).toBe("");

    const file = new File(["route"], "route.txt", { type: "text/plain" });
    await controller.attach(file);
    await controller.edit("own-message", "Direct edit");
    await controller.delete("own-message");
    await controller.toggleReaction("member-message", "signal");
    await controller.retry("own-message");
    await controller.markRead();
    expect(sdk.chat.attach).toHaveBeenCalledWith(file);
    expect(sdk.chat.edit).toHaveBeenLastCalledWith("own-message", "Direct edit");
    expect(sdk.chat.delete).toHaveBeenCalledWith("own-message");
    expect(sdk.chat.toggleReaction).toHaveBeenCalledWith("member-message", "signal");
    expect(sdk.chat.retry).toHaveBeenCalledWith("own-message");
    expect(sdk.chat.markRead).toHaveBeenCalledTimes(1);
    controller.dispose();
    context.dispose();
  });

  it("retains draft/context on failure and exposes recoverable command errors", async () => {
    const sdk = interactiveSdk();
    sdk.chat.send.mockRejectedValueOnce(new Error("Matrix is unavailable"));
    const context = createSpaceComponentContext({ sdk: sdk.client });
    const controller = createSpaceChatController(context);
    await controller.ready;
    controller.beginReply("member-message");
    controller.setDraft("Keep this draft");

    await controller.send();
    expect(controller.getSnapshot()).toMatchObject({
      draft: "Keep this draft",
      context: { kind: "reply", message: { id: "member-message" } },
      pending: null,
      error: { command: "send", message: "Matrix is unavailable" },
    });
    controller.clearError();
    expect(controller.getSnapshot().error).toBeNull();
    await controller.send();
    expect(controller.getSnapshot().draft).toBe("");
    controller.dispose();
    context.dispose();
  });

  it("deduplicates typing=true and sends typing=false during dispose", async () => {
    const sdk = interactiveSdk();
    const context = createSpaceComponentContext({ sdk: sdk.client });
    const controller = createSpaceChatController(context);
    await controller.ready;

    await controller.setTyping(true);
    await controller.setTyping(true);
    expect(sdk.chat.setTyping).toHaveBeenCalledTimes(1);
    expect(sdk.chat.setTyping).toHaveBeenLastCalledWith(true);
    controller.dispose();
    await Promise.resolve();
    expect(sdk.chat.setTyping).toHaveBeenCalledTimes(2);
    expect(sdk.chat.setTyping).toHaveBeenLastCalledWith(false);
    expect(controller.getSnapshot()).toMatchObject({ disposed: true, typing: false });
    expect([...sdk.listeners.values()].every((handlers) => handlers.size === 0)).toBe(true);
    context.dispose();
  });

  it("deduplicates non-blocking read receipts without occupying command pending state", async () => {
    const sdk = interactiveSdk();
    let finishRead: (() => void) | undefined;
    sdk.chat.markRead.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishRead = resolve;
    }));
    const context = createSpaceComponentContext({ sdk: sdk.client });
    const controller = createSpaceChatController(context);
    await controller.ready;

    const first = controller.markRead();
    const second = controller.markRead();
    await Promise.resolve();
    expect(first).toBe(second);
    expect(sdk.chat.markRead).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().pending).toBeNull();

    finishRead?.();
    await first;
    await controller.markRead();
    expect(sdk.chat.markRead).toHaveBeenCalledTimes(2);
    controller.dispose();
    context.dispose();
  });
});

describe("Space Chat recipes", () => {
  it("mounts one drawer lifecycle, tracks unread/read state, and removes every listener", async () => {
    const sdk = interactiveSdk();
    const fixture = recipeFixture();
    const context = createSpaceComponentContext({ sdk: sdk.client });
    const recipe = mountChatDrawerRecipe({
      context,
      elements: fixture.elements,
      copy: () => ({
        connected: "connected",
        members: "members",
        empty: "Empty",
        hint: "Type a message",
        working: "is working",
        title: "Chat",
        open: "Open Chat",
        close: "Close Chat",
        region: "Space Chat",
        timeline: "Message timeline",
      }),
    });
    await recipe.ready;

    expect(recipe.mode).toBe("dock");
    expect(recipe.open).toBe(false);
    expect(sdk.chat.markRead).not.toHaveBeenCalled();
    fixture.elements.launch.dispatchEvent(new Event("click"));
    await Promise.resolve();
    expect(recipe.open).toBe(true);
    expect(sdk.chat.markRead).toHaveBeenCalledTimes(1);
    await recipe.controller.markRead();

    fixture.elements.close.dispatchEvent(new Event("click"));
    sdk.snapshot.chat.messages.push(chatMessage("new-message", "bob", "New note"));
    for (const listener of sdk.listeners.get("messages") ?? []) listener(undefined);
    expect(recipe.unreadCount).toBe(1);
    expect(fixture.elements.unread.textContent).toBe("1");

    fixture.document.visibilityState = "hidden";
    recipe.show();
    await Promise.resolve();
    expect(sdk.chat.markRead).toHaveBeenCalledTimes(1);
    fixture.document.visibilityState = "visible";
    recipe.show();
    await Promise.resolve();
    expect(sdk.chat.markRead).toHaveBeenCalledTimes(2);

    fixture.elements.composer.dispatchEvent(recipeEvent(spaceChatEventNames.submit, {
      text: "Recipe message",
      mentionIds: [],
    }));
    await Promise.resolve();
    expect(sdk.chat.send).toHaveBeenCalledTimes(1);

    recipe.dispose();
    recipe.dispose();
    fixture.elements.composer.dispatchEvent(recipeEvent(spaceChatEventNames.submit, {
      text: "Must not send",
      mentionIds: [],
    }));
    await Promise.resolve();
    expect(recipe.disposed).toBe(true);
    expect(sdk.chat.send).toHaveBeenCalledTimes(1);
    expect([...sdk.listeners.values()].every((handlers) => handlers.size === 0)).toBe(true);
    context.dispose();
  });
});

describe("Space Chat migration-ready view contracts", () => {
  it("groups only adjacent messages from the same author inside the time window", () => {
    const base = chatSnapshot();
    const messages = [
      chatMessage("bob-1", "bob", "One", { createdAt: "2026-08-26T10:00:00.000Z" }),
      chatMessage("bob-2", "bob", "Two", { createdAt: "2026-08-26T10:02:00.000Z" }),
      chatMessage("bob-3", "bob", "Three", { createdAt: "2026-08-26T10:04:00.000Z" }),
      chatMessage("bob-4", "bob", "Later", { createdAt: "2026-08-26T10:10:00.000Z" }),
      chatMessage("self-1", "self", "Mine", { createdAt: "2026-08-26T10:11:00.000Z" }),
      chatMessage("self-2", "self", "Also mine", { createdAt: "2026-08-26T10:12:00.000Z" }),
    ];
    const views = createSpaceChatMessageViews({
      ...base,
      messages,
      chat: { ...base.chat, messages },
    });

    expect(getSpaceChatMessageGroupPositions(views)).toEqual([
      "first",
      "middle",
      "last",
      "single",
      "first",
      "last",
    ]);
  });

  it("normalizes attachment metadata and strips unsafe protocols", () => {
    const unsafe = createSpaceChatAttachmentView({
      name: '<img onerror="alert(1)">',
      kind: "image",
      mimeType: "image/png",
      size: 2048.8,
      downloadUrl: "javascript:alert(1)",
      previewUrl: "https://cdn.example.test/preview.png",
    });
    expect(unsafe).toEqual({
      name: '<img onerror="alert(1)">',
      kind: "image",
      mediaType: "image/png",
      size: 2048,
      downloadUrl: null,
      previewUrl: "https://cdn.example.test/preview.png",
    });
    const html = renderSpaceChatAttachment(unsafe!);
    expect(html).toContain("&lt;img onerror=");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<img onerror");
  });

  it("publishes stable events and responsive accessible style baselines", () => {
    expect(Object.values(spaceChatEventNames)).toEqual(expect.arrayContaining([
      "vc-space-chat-submit",
      "vc-space-chat-attach",
      "vc-space-mention-select",
      "vc-space-chat-reaction",
      "vc-space-chat-dismiss-error",
    ]));
    for (const styles of [
      spaceChatComposerStyles,
      spaceMentionMenuStyles,
      spaceReactionBarStyles,
      spaceMessageActionsStyles,
      spaceChatTimelineStyles,
    ]) {
      expect(styles).toContain("forced-colors");
      expect(styles).toContain("min-inline-size");
    }
    expect(spaceChatComposerStyles).toContain("min-block-size:2.75rem");
    expect(spaceChatTimelineStyles).toContain("overflow:auto");
    expect(spaceChatTimelineStyles).toContain("inline-size:fit-content");
    expect(spaceReactionBarStyles).toContain(":host([hidden])");
    expect(spaceMessageActionsStyles).toContain("position:fixed");
    expect(spaceMessageActionsStyles).toContain(".menu::backdrop");
    expect(spaceMessageActionsStyles).toContain("prefers-reduced-motion");
    expect(spaceMessageActionsStyles).toContain(".danger");
  });
});
