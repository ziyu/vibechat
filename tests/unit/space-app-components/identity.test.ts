import { afterEach, describe, expect, it, vi } from "vitest";

import type { SpaceAppMember, SpaceAppSnapshot } from "@vibechat/space-app-sdk";
import { defineSpaceElements } from "@vibechat/space-app-components";
import {
  createSpaceAgentIdentityView,
  renderSpaceAgentCard,
  spaceAgentCardStyles,
} from "@vibechat/space-app-components/agent";
import {
  spaceIconButtonStyles,
  spaceStatusDotStyles,
} from "@vibechat/space-app-components/foundation";
import {
  getSpaceIdentityTheme,
  serializeSpaceIdentityTheme,
} from "@vibechat/space-app-components/styles";
import {
  createSpaceUserIdentityView,
  renderSpaceUserInfoCard,
  spaceUserInfoCardStyles,
} from "@vibechat/space-app-components/user";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Space identity view models", () => {
  it("normalizes member identity without trusting executable avatar URLs", () => {
    const member: SpaceAppMember = {
      id: "alice",
      clientId: "alice-client",
      name: "Alice",
      displayName: " Alice Chen ",
      handle: "alice",
      avatarUrl: "javascript:alert(1)",
      presence: "online",
    };

    expect(createSpaceUserIdentityView(member)).toEqual({
      id: "alice",
      name: "Alice Chen",
      handle: "alice",
      avatarUrl: null,
      presence: "online",
    });
  });

  it("derives provider-neutral Agent status from the public snapshot", () => {
    const agent: SpaceAppSnapshot["agent"] = {
      id: "wayfinder",
      name: "Wayfinder",
      messages: [],
      build: null,
      queue: { activeCount: 0, pendingCount: 2 },
    };
    expect(createSpaceAgentIdentityView(agent).status).toBe("queued");
    expect(createSpaceAgentIdentityView({
      ...agent,
      build: { status: "failed" },
    }).status).toBe("failed");
    expect(createSpaceAgentIdentityView({
      messages: [],
      build: null,
      queue: { activeCount: 0, pendingCount: 0 },
    }).status).toBe("unavailable");
  });

  it("escapes declarative User and Agent card markup", () => {
    const user = createSpaceUserIdentityView({
      id: "unsafe-user",
      clientId: "unsafe-user-client",
      name: '<img src=x onerror="alert(1)">',
      handle: "member<script>",
      presence: "away",
    });
    const agent = createSpaceAgentIdentityView({
      id: "unsafe-agent",
      name: 'Agent <script>alert("x")</script>',
      messages: [],
      build: null,
      queue: { activeCount: 0, pendingCount: 0 },
    }, { summary: 'Reads "safe" text only <script>' });

    const userHtml = renderSpaceUserInfoCard(user);
    const agentHtml = renderSpaceAgentCard(agent);
    expect(userHtml).toContain("&lt;img");
    expect(userHtml).not.toContain("<script>");
    expect(agentHtml).toContain("&lt;script&gt;");
    expect(agentHtml).not.toContain("<script>");
  });
});

describe("Space identity element contracts", () => {
  it("registers the complete element surface idempotently and remains SSR-safe", () => {
    class FakeHTMLElement {}
    vi.stubGlobal("HTMLElement", FakeHTMLElement);
    const definitions = new Map<string, CustomElementConstructor>();
    const registry = {
      get(name: string) { return definitions.get(name); },
      define(name: string, constructor: CustomElementConstructor) {
        definitions.set(name, constructor);
      },
    };

    expect(defineSpaceElements(registry)).toBe(true);
    expect(defineSpaceElements(registry)).toBe(true);
    expect([...definitions.keys()].sort()).toEqual([
      "vc-space-agent-avatar",
      "vc-space-agent-badge",
      "vc-space-agent-card",
      "vc-space-agent-status",
      "vc-space-avatar",
      "vc-space-chat-attachment",
      "vc-space-chat-bubble",
      "vc-space-chat-composer",
      "vc-space-chat-error-state",
      "vc-space-chat-message",
      "vc-space-chat-message-meta",
      "vc-space-chat-timeline",
      "vc-space-icon-button",
      "vc-space-mention-menu",
      "vc-space-message-actions",
      "vc-space-reaction-bar",
      "vc-space-reply-preview",
      "vc-space-status-dot",
      "vc-space-typing-indicator",
      "vc-space-user-avatar",
      "vc-space-user-info-card",
      "vc-space-user-name",
    ]);
  });

  it("ships keyboard, contrast, reduced-motion and flexible-text baselines", () => {
    expect(spaceIconButtonStyles).toContain("min-inline-size: 44px");
    expect(spaceIconButtonStyles).toContain("focus-visible");
    expect(spaceIconButtonStyles).toContain("prefers-reduced-motion");
    expect(spaceStatusDotStyles).toContain("forced-colors");
    expect(spaceStatusDotStyles).toContain(".label");
    expect(spaceUserInfoCardStyles).toContain("minmax(0, 1fr)");
    expect(spaceAgentCardStyles).toContain("overflow-wrap: anywhere");
  });

  it("provides two distinct themes through the same semantic token names", () => {
    const signal = getSpaceIdentityTheme("signal");
    const field = getSpaceIdentityTheme("field-note");
    expect(Object.keys(signal)).toEqual(Object.keys(field));
    expect(signal["--vc-space-color-surface"])
      .not.toBe(field["--vc-space-color-surface"]);
    expect(serializeSpaceIdentityTheme("signal"))
      .toContain("--vc-space-color-accent");
    expect(Object.keys(signal).every((key) => key.startsWith("--vc-space-")))
      .toBe(true);
  });
});
