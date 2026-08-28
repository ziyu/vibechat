import { describe, expect, it, vi } from "vitest";

import type { SpaceAppClient, SpaceAppSnapshot } from "@vibechat/space-app-sdk";
import {
  createSpaceAgentActivityView,
  createSpaceAgentController,
  renderSpaceAgentActivity,
  spaceAgentActivityStyles,
  spaceAgentQueueStatusStyles,
  type SpaceAgentActivityElement,
} from "@vibechat/space-app-components/agent";
import { createSpaceComponentContext } from "@vibechat/space-app-components/core";
import { mountAgentActivityPanelRecipe } from "@vibechat/space-app-components/recipes";

function agentSnapshot(
  agent: Partial<SpaceAppSnapshot["agent"]> = {},
): SpaceAppSnapshot {
  return {
    appId: "agent-activity",
    locale: "en",
    meta: {
      id: "agent-activity",
      name: "Agent activity",
      summary: "",
      icon: "A",
      accent: "#d95835",
    },
    self: null,
    members: [],
    mentions: [],
    messages: [],
    app: { revision: 0, state: {}, presence: [] },
    chat: {
      messages: [],
      typingMemberIds: [],
      permissions: {
        send: false,
        attach: false,
        reply: false,
        editOwn: false,
        deleteOwn: false,
        react: false,
        retryOwn: false,
        typing: false,
        markRead: false,
      },
    },
    agent: {
      id: "wayfinder",
      name: "Wayfinder",
      messages: [],
      build: null,
      queue: { activeCount: 0, pendingCount: 0 },
      ...agent,
    },
  };
}

function agentSdk() {
  const snapshot = agentSnapshot();
  const listeners = new Map<string, Set<(value: unknown) => void>>();
  const client = {
    version: 1,
    locale: "en",
    snapshot,
    on(type: string, listener: (value: unknown) => void) {
      const handlers = listeners.get(type) ?? new Set();
      handlers.add(listener);
      listeners.set(type, handlers);
      return () => handlers.delete(listener);
    },
  } as unknown as SpaceAppClient;
  Object.defineProperty(client, "ready", {
    value: Promise.resolve(client),
    enumerable: true,
  });
  return {
    client,
    listeners,
    update(agent: SpaceAppSnapshot["agent"]) {
      snapshot.agent = agent;
      for (const listener of listeners.get("agent") ?? []) listener(agent);
    },
  };
}

class AgentActivityTestElement extends EventTarget {
  activity = null as ReturnType<typeof createSpaceAgentActivityView> | null;
  readonly attributes = new Map<string, string>();

  setAttribute(name: string, value: string) {
    this.attributes.set(name, String(value));
  }
}

describe("Space Agent activity view", () => {
  it("projects only bounded provider-neutral activity fields", () => {
    const view = createSpaceAgentActivityView(agentSnapshot({
      build: {
        stage: " Mapping routes ",
        activities: [
          {
            id: "read-map",
            tool: "Read shared map",
            summary: "Three paths loaded",
            status: "completed",
            input: { secret: "must-not-leak" },
            output: "provider payload",
          },
          {
            title: "Mark quiet path",
            detail: "Comparing noise levels",
            state: "running",
            arguments: ["private"],
          },
        ],
      },
      queue: { activeCount: 1.9, pendingCount: 2.7 },
    }).agent, { maxActivities: 2 });

    expect(view).toMatchObject({
      active: true,
      stage: "Mapping routes",
      queue: { activeCount: 1, pendingCount: 2 },
      activities: [
        {
          id: "read-map",
          label: "Read shared map",
          detail: "Three paths loaded",
          status: "completed",
        },
        {
          id: "activity-2",
          label: "Mark quiet path",
          detail: "Comparing noise levels",
          status: "active",
        },
      ],
    });
    expect(JSON.stringify(view)).not.toContain("must-not-leak");
    expect(JSON.stringify(view)).not.toContain("provider payload");
    expect(JSON.stringify(view)).not.toContain("private");
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.activities)).toBe(true);
  });

  it("escapes declarative activity state and ships contrast/motion baselines", () => {
    const view = createSpaceAgentActivityView(agentSnapshot({
      name: '<img src=x onerror="alert(1)">',
      build: { stage: '"><script>alert(1)</script>' },
    }).agent);
    const html = renderSpaceAgentActivity(view);
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(spaceAgentActivityStyles).toContain("forced-colors");
    expect(spaceAgentActivityStyles).toContain("prefers-reduced-motion");
    expect(spaceAgentActivityStyles).toContain("overflow-wrap: anywhere");
    expect(spaceAgentQueueStatusStyles).toContain("prefers-contrast");
  });
});

describe("Space Agent controller and recipe", () => {
  it("publishes meaningful Agent changes once and disposes idempotently", async () => {
    const sdk = agentSdk();
    const context = createSpaceComponentContext({ sdk: sdk.client });
    const controller = createSpaceAgentController(context);
    const listener = vi.fn();
    controller.subscribe(listener);
    await controller.ready;

    sdk.update(agentSnapshot().agent);
    expect(listener).not.toHaveBeenCalled();
    sdk.update(agentSnapshot({
      build: { stage: "Composing", activities: [] },
      queue: { activeCount: 1, pendingCount: 0 },
    }).agent);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({
      active: true,
      stage: "Composing",
      queue: { activeCount: 1, pendingCount: 0 },
    });

    controller.dispose();
    controller.dispose();
    expect(controller.disposed).toBe(true);
    expect([...sdk.listeners.values()].every((handlers) => handlers.size === 0)).toBe(true);
    context.dispose();
  });

  it("mounts a read-only activity panel without creating a second SDK client", async () => {
    const sdk = agentSdk();
    const context = createSpaceComponentContext({ sdk: sdk.client });
    const element = new AgentActivityTestElement();
    const recipe = mountAgentActivityPanelRecipe({
      context,
      element: element as unknown as SpaceAgentActivityElement,
      maxActivities: 3,
    });
    await recipe.ready;

    expect(element.activity?.agent.name).toBe("Wayfinder");
    expect(element.attributes.get("locale")).toBe("en");
    sdk.update(agentSnapshot({
      build: { stage: "Reviewing", activities: [] },
      queue: { activeCount: 1, pendingCount: 4 },
    }).agent);
    expect(element.activity).toMatchObject({
      stage: "Reviewing",
      queue: { activeCount: 1, pendingCount: 4 },
    });

    recipe.dispose();
    recipe.dispose();
    expect(recipe.disposed).toBe(true);
    expect(recipe.controller.disposed).toBe(true);
    context.dispose();
  });
});
