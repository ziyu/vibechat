import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  SpaceAppClient,
  SpaceAppSnapshot,
} from "@vibechat/space-app-sdk";
import {
  createSpaceComponentContext,
  createSpaceSnapshotController,
} from "@vibechat/space-app-components/core";
import {
  defineSpaceElements,
  renderSpaceAvatar,
  sanitizeSpaceMediaUrl,
  spaceAvatarElementName,
  spaceAvatarInitials,
} from "@vibechat/space-app-components/foundation";

function snapshot(name: string): SpaceAppSnapshot {
  return {
    appId: "space-components-test",
    locale: "en",
    meta: {
      id: "space-components-test",
      name,
      summary: "",
      icon: "V",
      accent: "#ff6b44",
    },
    self: null,
    members: [],
    mentions: [],
    messages: [],
    app: { revision: 0, state: {}, presence: [] },
    chat: { messages: [], typingMemberIds: [] },
    agent: {
      id: "agent",
      name: "Agent",
      messages: [],
      build: null,
      queue: { activeCount: 0, pendingCount: 0 },
    },
  };
}

function fakeSdk(initial = snapshot("Initial")) {
  const listeners = new Map<string, Set<(value: unknown) => void>>();
  let current = initial;
  let unsubscribeCount = 0;
  const client = {
    locale: "en",
    ready: Promise.resolve(undefined),
    get snapshot() {
      return current;
    },
    on(type: string, handler: (value: unknown) => void) {
      const handlers = listeners.get(type) ?? new Set();
      handlers.add(handler);
      listeners.set(type, handlers);
      return () => {
        if (handlers.delete(handler)) unsubscribeCount += 1;
      };
    },
  } as unknown as SpaceAppClient;
  return {
    client,
    emit(type: string, value: unknown) {
      if (type === "snapshot") current = value as SpaceAppSnapshot;
      for (const handler of listeners.get(type) ?? []) handler(value);
    },
    get unsubscribeCount() {
      return unsubscribeCount;
    },
    get listenerCount() {
      return [...listeners.values()].reduce(
        (count, handlers) => count + handlers.size,
        0,
      );
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Space component context", () => {
  it("injects one SDK instance and disposes subscriptions exactly once", () => {
    const sdk = fakeSdk();
    const context = createSpaceComponentContext({ sdk: sdk.client });
    let updates = 0;
    context.listen("members", () => updates += 1);

    sdk.emit("members", []);
    expect(updates).toBe(1);
    expect(context.translate("space.components.avatar.label", { name: "Alice" }))
      .toBe("Alice avatar");
    expect(context.translate("space.components.agent.status.working"))
      .toBe("Working");

    context.dispose();
    context.dispose();
    sdk.emit("members", []);
    expect(updates).toBe(1);
    expect(sdk.unsubscribeCount).toBe(1);
    expect(context.signal.aborted).toBe(true);
  });

  it("projects SDK snapshots without taking ownership of platform state", async () => {
    const sdk = fakeSdk();
    const context = createSpaceComponentContext({ sdk: sdk.client });
    const controller = createSpaceSnapshotController(context);
    let updates = 0;
    controller.subscribe(() => updates += 1);
    await controller.ready;

    const next = snapshot("Next");
    sdk.emit("snapshot", next);
    expect(controller.getSnapshot().meta.name).toBe("Next");
    expect(updates).toBeGreaterThan(0);

    controller.dispose();
    sdk.emit("snapshot", snapshot("Ignored"));
    expect(controller.getSnapshot().meta.name).toBe("Next");
    context.dispose();
    expect(sdk.unsubscribeCount).toBe(1);
  });

  it("does not subscribe a controller created from a disposed context", async () => {
    const sdk = fakeSdk();
    const context = createSpaceComponentContext({ sdk: sdk.client });
    context.dispose();

    const controller = createSpaceSnapshotController(context);
    await controller.ready;

    expect(controller.disposed).toBe(true);
    expect(sdk.listenerCount).toBe(0);
    expect(sdk.unsubscribeCount).toBe(0);
  });
});

describe("Space avatar foundation", () => {
  it("renders escaped SSR markup and rejects executable media URLs", () => {
    expect(spaceAvatarInitials("林夕")).toBe("林夕");
    expect(spaceAvatarInitials("Alice Chen")).toBe("AC");
    expect(sanitizeSpaceMediaUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeSpaceMediaUrl("/v1/media/avatar.png"))
      .toBe("/v1/media/avatar.png");

    const html = renderSpaceAvatar({
      name: 'Alice <script>alert("x")</script>',
      src: "javascript:alert(1)",
      status: "online",
    });
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<script>");
  });

  it("registers custom elements idempotently and stays SSR import-safe", () => {
    class FakeHTMLElement {}
    vi.stubGlobal("HTMLElement", FakeHTMLElement);
    const definitions = new Map<string, CustomElementConstructor>();
    const registry = {
      get(name: string) {
        return definitions.get(name);
      },
      define(name: string, constructor: CustomElementConstructor) {
        definitions.set(name, constructor);
      },
    };

    expect(defineSpaceElements(registry)).toBe(true);
    expect(defineSpaceElements(registry)).toBe(true);
    expect([...definitions]).toHaveLength(1);
    expect(definitions.has(spaceAvatarElementName)).toBe(true);
  });
});
