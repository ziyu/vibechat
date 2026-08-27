import { describe, expect, it, vi } from "vitest";

import type {
  SpaceAppClient,
  SpaceAppSnapshot,
  SpaceChatMessage,
} from "@vibechat/space-app-sdk";
import {
  createSpaceChatAttachmentView,
  createSpaceChatController,
  renderSpaceChatAttachment,
  spaceChatComposerStyles,
  spaceChatEventNames,
  spaceChatTimelineStyles,
  spaceMentionMenuStyles,
  spaceMessageActionsStyles,
  spaceReactionBarStyles,
} from "@vibechat/space-app-components/chat";
import { createSpaceComponentContext } from "@vibechat/space-app-components/core";

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

describe("Space Chat migration-ready view contracts", () => {
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
  });
});
