import { describe, expect, it } from "vitest";

import type {
  SpaceAppClient,
  SpaceAppMember,
  SpaceAppSnapshot,
  SpaceChatMessage,
} from "@vibechat/space-app-sdk";
import {
  createSpaceChatMessageViews,
  createSpaceChatTimelineController,
  renderSpaceChatMessage,
  renderSpaceTypingIndicator,
  spaceChatMessageStyles,
  spaceTypingIndicatorStyles,
} from "@vibechat/space-app-components/chat";
import { createSpaceComponentContext } from "@vibechat/space-app-components/core";

function message(
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
    createdAt: `2026-08-26T10:0${id.length}:00.000Z`,
    status: "sent",
    reactions: [],
    ...options,
  };
}

function snapshot(
  messages: SpaceChatMessage[] = [],
  members: SpaceAppMember[] = [],
): SpaceAppSnapshot {
  return {
    appId: "space-chat-components-test",
    locale: "en",
    meta: {
      id: "space-chat-components-test",
      name: "Chat component test",
      summary: "",
      icon: "V",
      accent: "#ff6b44",
    },
    self: {
      id: "self",
      clientId: "self-client",
      name: "Alice",
      displayName: "Alice Chen",
      handle: "alice",
      presence: "online",
    },
    members,
    mentions: [{
      id: "wayfinder",
      handle: "wayfinder",
      name: "Wayfinder",
      type: "agent",
      available: true,
    }],
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
      messages: [{ id: "private-progress", text: "not a Matrix event" }],
      build: { status: "working" },
      queue: { activeCount: 1, pendingCount: 0 },
    },
  };
}

function fakeSdk(initial: SpaceAppSnapshot) {
  const listeners = new Map<string, Set<(value: unknown) => void>>();
  let current = initial;
  let unsubscribeCount = 0;
  const client = {
    version: 1,
    locale: "en",
    get snapshot() { return current; },
    on(type: string, handler: (value: unknown) => void) {
      const handlers = listeners.get(type) ?? new Set();
      handlers.add(handler);
      listeners.set(type, handlers);
      return () => {
        if (handlers.delete(handler)) unsubscribeCount += 1;
      };
    },
  } as unknown as SpaceAppClient;
  Object.defineProperty(client, "ready", {
    value: Promise.resolve(client),
    enumerable: true,
  });
  return {
    client,
    setSnapshot(value: SpaceAppSnapshot) {
      current = value;
    },
    emit(type: string, value: unknown) {
      for (const handler of listeners.get(type) ?? []) handler(value);
    },
    get unsubscribeCount() { return unsubscribeCount; },
    get listenerTypes() {
      return [...listeners.entries()]
        .filter(([, handlers]) => handlers.size > 0)
        .map(([type]) => type)
        .sort();
    },
  };
}

describe("Space Chat view models", () => {
  it("projects only the ordered Matrix timeline with safe identity and reply fallbacks", () => {
    const messages = [
      message("m1", "self", "Opening note", { edited: true }),
      message("m2", "unknown-user", "Unknown member", {
        replyToId: "missing-event",
        status: "failed",
        reactions: [{ emoji: "spark", userIds: ["self", "self", "unknown-user"] }],
      }),
      message("m3", "agent-matrix-user", "Mapped the route", {
        agent: true,
        agentId: "wayfinder",
        replyToId: "m1",
      }),
      message("m4", "self", "Removed text", { deleted: true, edited: true }),
      message("m5", "self", "Reply after removal", { replyToId: "m4" }),
    ];
    const views = createSpaceChatMessageViews(snapshot(messages));

    expect(views.map((item) => item.id)).toEqual(["m1", "m2", "m3", "m4", "m5"]);
    expect(views).toHaveLength(messages.length);
    expect(views[0]).toMatchObject({
      isOwn: true,
      edited: true,
      author: { presence: "online" },
      actions: {
        reply: true,
        edit: true,
        delete: true,
        retry: false,
        react: true,
      },
    });
    expect(views[1]?.author).toMatchObject({ name: "Member", kind: "member" });
    expect(views[1]?.reply).toMatchObject({ state: "missing", author: null, text: "" });
    expect(views[1]?.reactions[0]).toEqual({
      emoji: "spark",
      count: 2,
      reactedBySelf: true,
    });
    expect(views[2]).toMatchObject({
      isAgent: true,
      isOwn: false,
      author: { id: "wayfinder", name: "Wayfinder", kind: "agent" },
      reply: { state: "available", text: "Opening note" },
      actions: { reply: true, edit: false, delete: false, react: true },
    });
    expect(views[2]?.author).toMatchObject({
      agentStatus: "working",
      agentSummary: null,
      agentActiveCount: 1,
      agentPendingCount: 0,
    });
    expect(views[3]).toMatchObject({
      text: "",
      deleted: true,
      edited: false,
      actions: {
        reply: false,
        edit: false,
        delete: false,
        retry: false,
        react: false,
      },
    });
    expect(views[4]?.reply).toMatchObject({ state: "deleted", text: "" });
    expect(Object.isFrozen(views)).toBe(true);
    expect(Object.isFrozen(views[2])).toBe(true);
  });

  it("escapes declarative Chat markup instead of accepting user HTML", () => {
    const views = createSpaceChatMessageViews(snapshot([
      message("unsafe", "self", '<script>alert("body")</script>', {
        reactions: [{ emoji: '<img onerror="alert(1)">', userIds: ["self"] }],
      }),
    ]));
    const html = renderSpaceChatMessage({
      ...views[0]!,
      author: { ...views[0]!.author, avatarUrl: "javascript:alert(1)" },
    });
    const typing = renderSpaceTypingIndicator([{
      ...views[0]!.author,
      name: '<script>alert("name")</script>',
    }]);

    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img onerror");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('author-presence="online"');
    expect(typing).toContain("&lt;script&gt;");
    expect(typing).not.toContain("<script>");
  });
});

describe("Space Chat timeline controller", () => {
  it("uses targeted subscriptions and keeps messages stable for typing and presence-only updates", async () => {
    const bob: SpaceAppMember = {
      id: "bob",
      clientId: "bob-client",
      name: "Bob",
      displayName: "Bob Stone",
      presence: "online",
    };
    const initial = snapshot([message("m1", "bob", "Hello")], [bob]);
    const sdk = fakeSdk(initial);
    const context = createSpaceComponentContext({ sdk: sdk.client });
    const controller = createSpaceChatTimelineController(context);
    await controller.ready;

    expect(sdk.listenerTypes).toEqual(["agent", "members", "mentions", "messages", "typing"]);
    expect(controller.getSnapshot()).toMatchObject({ ready: true, disposed: false });
    const initialMessages = controller.getSnapshot().messages;

    const withTyping: SpaceAppSnapshot = {
      ...initial,
      chat: { ...initial.chat, typingMemberIds: ["bob"] },
    };
    sdk.setSnapshot(withTyping);
    sdk.emit("typing", ["bob"]);
    expect(controller.getSnapshot().messages).toBe(initialMessages);
    expect(controller.getSnapshot().typingUsers[0]?.name).toBe("Bob Stone");

    const presenceOnly: SpaceAppSnapshot = {
      ...withTyping,
      members: [{ ...bob, presence: "away" }],
    };
    sdk.setSnapshot(presenceOnly);
    sdk.emit("members", presenceOnly.members);
    expect(controller.getSnapshot().messages).toBe(initialMessages);

    const renamed: SpaceAppSnapshot = {
      ...presenceOnly,
      members: [{ ...bob, displayName: "Bob Atlas" }],
    };
    sdk.setSnapshot(renamed);
    sdk.emit("members", renamed.members);
    expect(controller.getSnapshot().messages).not.toBe(initialMessages);
    expect(controller.getSnapshot().messages[0]?.author.name).toBe("Bob Atlas");

    controller.dispose();
    controller.dispose();
    expect(controller.getSnapshot().disposed).toBe(true);
    expect(sdk.unsubscribeCount).toBe(5);
    expect(sdk.listenerTypes).toEqual([]);
    context.dispose();
    expect(sdk.unsubscribeCount).toBe(5);
  });
});

describe("Space Chat element contracts", () => {
  it("ships flexible text, status, contrast and reduced-motion baselines", () => {
    expect(spaceChatMessageStyles).toContain("minmax(0, 1fr)");
    expect(spaceChatMessageStyles).toContain("overflow-wrap: anywhere");
    expect(spaceChatMessageStyles).toContain("forced-colors");
    expect(spaceTypingIndicatorStyles).toContain("prefers-reduced-motion");
    expect(spaceTypingIndicatorStyles).toContain("forced-colors");
  });
});
