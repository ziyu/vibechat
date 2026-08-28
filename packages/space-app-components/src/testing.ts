import { assertSpaceComponentBundle, type SpaceComponentBundle } from "./node.js";
import {
  renderSpaceChatMessage,
  renderSpaceTypingIndicator,
  type SpaceChatAuthorView,
  type SpaceChatMessageView,
} from "./chat/index.js";
import { serializeSpaceIdentityTheme } from "./styles/index.js";

export interface SpaceComponentCatalogOptions {
  bundle: SpaceComponentBundle;
  locale?: "en" | "zh-CN";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderSpaceComponentCatalogDocument(
  options: SpaceComponentCatalogOptions,
) {
  assertSpaceComponentBundle(options.bundle);
  const browserSource = options.bundle.files["browser.js"];
  if (!browserSource) {
    throw new TypeError("Space component catalog requires browser.js");
  }
  const locale = options.locale ?? "en";
  const copy = locale === "zh-CN"
    ? {
        title: "身份与对话，自由换装",
        lead: "同一套 User、Agent 与 Chat 语义，在两种完全不同的 Space 世界中保持清楚、可靠、可组合。",
        signalTitle: "夜间信号",
        signalNote: "适合高密度、实时协作的深色控制面。",
        fieldTitle: "田野札记",
        fieldNote: "适合安静、温暖、长时间停留的浅色空间。",
        note: "这个离线 catalog 固定到同一个组件 artifact；它不会请求 npm、CDN 或宿主能力。",
        action: "打开身份操作",
        identityLabel: "身份信号",
        timelineLabel: "同一条 Matrix 时间线",
        aliceMessage: "我把沿河步道的三条岔路写进共享地图了；即使这段说明很长，消息也应该在窄屏里自然换行。",
        agentMessage: "已标记最安静的一条，并保留 Alice 作为来源作者。",
        agentStage: "正在整理沿河路线",
        agentActivityOne: "读取共享路线图",
        agentActivityTwo: "标记低噪音路径",
        failedMessage: "这条消息保留明确的发送失败文字，不只依赖颜色。",
        deletedMessage: "已删除的原文不会重新暴露。",
        workbenchLabel: "可迁移 Chat 交互",
        interactionIdle: "可用键盘操作 Composer、Mention、Reaction 与消息操作。",
        catalogError: "示例发送失败；草稿仍然保留，可以关闭错误后重试。",
      }
    : {
        title: "Identity and dialogue, carried lightly",
        lead: "One User, Agent and Chat language, carried intact across two Space worlds with radically different atmosphere.",
        signalTitle: "Night relay",
        signalNote: "A high-signal surface for dense, real-time collaboration.",
        fieldTitle: "Field notes",
        fieldNote: "A quiet, warm surface made for longer stays.",
        note: "This offline catalog is pinned to one component artifact. It never requests npm, a CDN, or host capabilities.",
        action: "Open identity actions",
        identityLabel: "Identity signal",
        timelineLabel: "The same Matrix timeline",
        aliceMessage: "I mapped all three forks along the river path. Even this deliberately long field note must reflow naturally on a narrow screen.",
        agentMessage: "Marked the quietest route while keeping Alice visible as the source author.",
        agentStage: "Mapping the river route",
        agentActivityOne: "Reading the shared route map",
        agentActivityTwo: "Marking the quietest path",
        failedMessage: "This message keeps a visible failed-delivery label instead of relying on color alone.",
        deletedMessage: "Deleted source text is never exposed again.",
        workbenchLabel: "Migration-ready Chat interactions",
        interactionIdle: "Use the keyboard to try the Composer, Mention, reaction and message actions.",
        catalogError: "Sample delivery failed. The draft remains available after dismissing this error.",
      };
  const safeBrowserSource = browserSource.replaceAll("</script", "<\\/script");
  const manifest = options.bundle.manifest;

  const identityComponents = `
        <div class="identity-grid">
          <vc-space-user-info-card
            user-id="alice"
            name="Alice Chen — Community Cartographer"
            handle="alice.maps.everywhere"
            presence="online"
            avatar-src="/missing-space-avatar.png"
          >
            <vc-space-icon-button slot="actions" label="${escapeHtml(copy.action)}">
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                <path d="M12 7.25v9.5M7.25 12h9.5"></path>
              </svg>
            </vc-space-icon-button>
          </vc-space-user-info-card>
          <vc-space-agent-card
            agent-id="wayfinder"
            name="Wayfinder"
            status="working"
            active-count="1"
            pending-count="2"
            summary="Maps the conversation, keeps source identity visible, and never impersonates a member."
          ></vc-space-agent-card>
        </div>
        <div class="status-line" aria-label="Agent status vocabulary">
          <vc-space-agent-status name="Wayfinder" status="idle"></vc-space-agent-status>
          <vc-space-agent-status name="Wayfinder" status="queued" pending-count="2"></vc-space-agent-status>
          <vc-space-agent-status name="Wayfinder" status="failed"></vc-space-agent-status>
        </div>
        <vc-space-agent-activity data-catalog-agent-activity></vc-space-agent-activity>`;

  const alice: SpaceChatAuthorView = {
    id: "alice",
    kind: "member",
    name: "Alice Chen — Community Cartographer",
    handle: "alice.maps.everywhere",
    avatarUrl: null,
    isSelf: false,
  };
  const wayfinder: SpaceChatAuthorView = {
    id: "wayfinder",
    kind: "agent",
    name: "Wayfinder",
    handle: "wayfinder",
    avatarUrl: null,
    isSelf: false,
  };
  const self: SpaceChatAuthorView = {
    id: "self",
    kind: "member",
    name: locale === "zh-CN" ? "你" : "You",
    handle: null,
    avatarUrl: null,
    isSelf: true,
  };
  const sampleMessages: readonly SpaceChatMessageView[] = [
    {
      id: "catalog-alice",
      roomId: "catalog-room",
      author: alice,
      text: copy.aliceMessage,
      createdAt: "2026-08-26T18:06:00.000Z",
      status: "sent",
      isOwn: false,
      isAgent: false,
      edited: true,
      deleted: false,
      reply: null,
      reactions: [{ emoji: "Signal", count: 3, reactedBySelf: true }],
      actions: { reply: true, edit: false, delete: false, retry: false, react: true },
      hasAttachment: true,
      attachment: {
        name: locale === "zh-CN" ? "河岸路线图.png" : "river-route-map.png",
        kind: "image",
        mediaType: "image/png",
        size: 24832,
        downloadUrl: "/missing-chat-attachment.png",
        previewUrl: "/missing-chat-attachment.png",
      },
    },
    {
      id: "catalog-agent",
      roomId: "catalog-room",
      author: wayfinder,
      text: copy.agentMessage,
      createdAt: "2026-08-26T18:07:00.000Z",
      status: "sent",
      isOwn: false,
      isAgent: true,
      edited: false,
      deleted: false,
      reply: {
        messageId: "catalog-alice",
        state: "available",
        author: alice,
        text: copy.aliceMessage,
      },
      reactions: [],
      actions: { reply: true, edit: false, delete: false, retry: false, react: true },
      hasAttachment: false,
    },
    {
      id: "catalog-failed",
      roomId: "catalog-room",
      author: self,
      text: copy.failedMessage,
      createdAt: "2026-08-26T18:08:00.000Z",
      status: "failed",
      isOwn: true,
      isAgent: false,
      edited: false,
      deleted: false,
      reply: {
        messageId: "missing-event",
        state: "missing",
        author: null,
        text: "",
      },
      reactions: [],
      actions: { reply: false, edit: false, delete: false, retry: true, react: false },
      hasAttachment: false,
    },
    {
      id: "catalog-deleted",
      roomId: "catalog-room",
      author: alice,
      text: "",
      createdAt: "2026-08-26T18:09:00.000Z",
      status: "sent",
      isOwn: false,
      isAgent: false,
      edited: false,
      deleted: true,
      reply: null,
      reactions: [],
      actions: { reply: false, edit: false, delete: false, retry: false, react: false },
      hasAttachment: false,
    },
  ];
  const chatComponents = `
        <section class="chat-sample" aria-label="${escapeHtml(copy.timelineLabel)}">
          <h3>${escapeHtml(copy.timelineLabel)}</h3>
          <div class="chat-list">
            ${sampleMessages.map(renderSpaceChatMessage).join("\n            ")}
          </div>
          ${renderSpaceTypingIndicator([alice, wayfinder])}
          <span class="deleted-proof">${escapeHtml(copy.deletedMessage)}</span>
        </section>
        <section class="chat-workbench" aria-label="${escapeHtml(copy.workbenchLabel)}">
          <h3>${escapeHtml(copy.workbenchLabel)}</h3>
          <vc-space-chat-timeline data-catalog-timeline state="ready"></vc-space-chat-timeline>
          <vc-space-mention-menu data-catalog-mentions></vc-space-mention-menu>
          <vc-space-chat-error-state data-catalog-error></vc-space-chat-error-state>
          <vc-space-chat-composer data-catalog-composer></vc-space-chat-composer>
          <div class="interaction-row">
            <vc-space-reaction-bar data-catalog-reactions></vc-space-reaction-bar>
            <vc-space-message-actions data-catalog-actions></vc-space-message-actions>
          </div>
          <output class="interaction-log" data-catalog-log>${escapeHtml(copy.interactionIdle)}</output>
        </section>`;
  const safeMessages = JSON.stringify(sampleMessages).replaceAll("<", "\\u003c");
  const safeMentionTargets = JSON.stringify([
    { id: "alice", handle: "alice.maps", name: "Alice Chen", type: "member", available: true },
    { id: "wayfinder", handle: "wayfinder", name: "Wayfinder", type: "agent", available: true },
    { id: "offline-agent", handle: "offline", name: "Offline Agent", type: "agent", available: false },
  ]).replaceAll("<", "\\u003c");
  const safeCatalogError = JSON.stringify(copy.catalogError).replaceAll("<", "\\u003c");
  const safeInteractionIdle = JSON.stringify(copy.interactionIdle).replaceAll("<", "\\u003c");
  const safeAgentActivity = JSON.stringify({
    agent: {
      id: "wayfinder",
      name: "Wayfinder",
      avatarUrl: null,
      status: "working",
      summary: null,
      activeCount: 1,
      pendingCount: 2,
    },
    active: true,
    stage: copy.agentStage,
    queue: { activeCount: 1, pendingCount: 2 },
    activities: [
      {
        id: "catalog-activity-read",
        label: copy.agentActivityOne,
        detail: null,
        status: "completed",
      },
      {
        id: "catalog-activity-map",
        label: copy.agentActivityTwo,
        detail: null,
        status: "active",
      },
    ],
  }).replaceAll("<", "\\u003c");

  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="vibechat:space-component-artifact" content="${escapeHtml(manifest.artifactHash)}">
    <title>${escapeHtml(copy.title)} · VibeChat Space Components</title>
    <style>
      :root { color-scheme: light dark; }
      * { box-sizing: border-box; }
      ::selection { color: #fffaf0; background: #8d432e; }
      body { margin: 0; min-height: 100vh; color: #283029; background: #d8d0c1; font-family: "Optima", "Candara", sans-serif; }
      main { width: min(76rem, calc(100% - 2rem)); margin: 0 auto; padding: clamp(2.5rem, 7vw, 6rem) 0; }
      .intro { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(16rem, .65fr); gap: 2rem; align-items: end; margin-bottom: clamp(2.5rem, 6vw, 5rem); }
      h1 { max-width: 12ch; margin: 0; font: 500 clamp(2.9rem, 7vw, 5.8rem)/.9 "Iowan Old Style", "Palatino Linotype", serif; letter-spacing: -.03em; text-wrap: balance; }
      .lead { max-width: 34rem; margin: 0; color: #4d594f; font-size: clamp(1rem, 2vw, 1.24rem); line-height: 1.52; }
      .worlds { display: grid; gap: clamp(1.5rem, 4vw, 3.2rem); }
      .world { padding: clamp(1.15rem, 3.5vw, 2.8rem); border-radius: 1.35rem; color: var(--vc-space-color-text); background: var(--vc-space-color-surface); }
      .theme-signal { ${serializeSpaceIdentityTheme("signal")}; color-scheme: dark; }
      .theme-field { ${serializeSpaceIdentityTheme("field-note")}; color-scheme: light; }
      .world-copy { display: grid; grid-template-columns: minmax(0, 1fr) minmax(14rem, .7fr); gap: 1.5rem; align-items: end; margin-bottom: clamp(1.3rem, 3vw, 2.2rem); }
      h2 { margin: 0; font: 560 clamp(2rem, 4vw, 3.65rem)/.96 var(--vc-space-font-display); letter-spacing: -.025em; text-wrap: balance; }
      .world-copy p { max-width: 32rem; margin: 0; color: var(--vc-space-color-text-muted); font-size: .96rem; line-height: 1.48; }
      .identity-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
      .status-line { display: flex; flex-wrap: wrap; gap: .75rem 1.2rem; margin-top: 1.2rem; padding-top: 1rem; border-top: 1px solid var(--vc-space-color-border); }
      vc-space-agent-activity { display: block; max-width: 47rem; margin: 1rem auto 0; }
      h3 { margin: 0; color: var(--vc-space-color-text-muted); font: 760 .78rem/1.3 var(--vc-space-font-body); letter-spacing: .09em; text-transform: uppercase; }
      .component-label { margin: 0 0 .72rem; color: var(--vc-space-color-text-muted); font: 760 .72rem/1.3 var(--vc-space-font-body); letter-spacing: .09em; text-transform: uppercase; }
      .chat-sample { display: grid; gap: 1rem; max-width: 47rem; margin: clamp(2rem, 5vw, 3.5rem) auto 0; padding-top: clamp(1.4rem, 3vw, 2rem); border-top: 1px solid var(--vc-space-color-border); }
      .chat-list { display: grid; min-width: 0; gap: .9rem; }
      .deleted-proof { color: var(--vc-space-color-text-muted); font: 600 .72rem/1.35 var(--vc-space-font-body); }
      .chat-workbench { display: grid; gap: .72rem; max-width: 47rem; margin: clamp(2rem, 5vw, 3.5rem) auto 0; padding-top: clamp(1.4rem, 3vw, 2rem); border-top: 1px solid var(--vc-space-color-border); }
      .interaction-row { display: flex; flex-wrap: wrap; align-items: start; justify-content: space-between; gap: .75rem; }
      .interaction-log { min-height: 1.5rem; color: var(--vc-space-color-text-muted); font: 600 .75rem/1.4 var(--vc-space-font-body); overflow-wrap: anywhere; }
      footer { display: flex; justify-content: space-between; gap: 2rem; margin-top: 2rem; color: #4d594f; font-size: .76rem; line-height: 1.5; }
      footer p { max-width: 65ch; margin: 0; }
      footer span { font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
      @media (max-width: 48rem) {
        .intro, .world-copy, .identity-grid { grid-template-columns: 1fr; }
        h1 { max-width: 10ch; }
        footer { display: grid; }
      }
      @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; } }
      @media (forced-colors: active) { .world { border: 2px solid CanvasText; background: Canvas; color: CanvasText; } }
    </style>
  </head>
  <body>
    <main>
      <header class="intro">
        <h1>${escapeHtml(copy.title)}</h1>
        <p class="lead">${escapeHtml(copy.lead)}</p>
      </header>
      <div class="worlds">
        <section class="world theme-signal">
          <header class="world-copy"><h2>${escapeHtml(copy.signalTitle)}</h2><p>${escapeHtml(copy.signalNote)}</p></header>
          <p class="component-label">${escapeHtml(copy.identityLabel)}</p>
${identityComponents}
${chatComponents}
        </section>
        <section class="world theme-field">
          <header class="world-copy"><h2>${escapeHtml(copy.fieldTitle)}</h2><p>${escapeHtml(copy.fieldNote)}</p></header>
          <p class="component-label">${escapeHtml(copy.identityLabel)}</p>
${identityComponents}
${chatComponents}
        </section>
      </div>
      <footer>
        <p>${escapeHtml(copy.note)}</p>
        <span>${escapeHtml(manifest.packageVersion)} · ${escapeHtml(manifest.artifactHash.slice(0, 20))}…</span>
      </footer>
    </main>
    <script type="module">
      ${safeBrowserSource}
      const messages = ${safeMessages};
      const targets = ${safeMentionTargets};
      const initialLog = ${safeInteractionIdle};
      const agentActivity = ${safeAgentActivity};
      for (const world of document.querySelectorAll(".world")) {
        world.querySelector("[data-catalog-agent-activity]").activity = agentActivity;
        const timeline = world.querySelector("[data-catalog-timeline]");
        const composer = world.querySelector("[data-catalog-composer]");
        const mentions = world.querySelector("[data-catalog-mentions]");
        const reactions = world.querySelector("[data-catalog-reactions]");
        const actions = world.querySelector("[data-catalog-actions]");
        const error = world.querySelector("[data-catalog-error]");
        const log = world.querySelector("[data-catalog-log]");
        timeline.messages = messages;
        timeline.typingUsers = [messages[0].author];
        mentions.targets = targets;
        reactions.messageId = messages[0].id;
        reactions.reactions = messages[0].reactions;
        actions.actions = {
          messageId: messages[0].id,
          canReply: true,
          canEdit: false,
          canDelete: false,
          canRetry: true,
        };
        error.error = { command: "send", message: ${safeCatalogError} };
        let activeRange = null;
        composer.addEventListener("vc-space-mention-query", (event) => {
          activeRange = event.detail.range;
          if (event.detail.query === null) mentions.targets = [];
          else mentions.targets = targets.filter((target) =>
            target.name.toLowerCase().includes(event.detail.query.toLowerCase())
            || target.handle.toLowerCase().includes(event.detail.query.toLowerCase()));
        });
        mentions.addEventListener("vc-space-mention-select", (event) => {
          composer.insertMention(event.detail.target, activeRange);
          log.textContent = "mention-select: " + event.detail.target.type + "/" + event.detail.target.id;
        });
        error.addEventListener("vc-space-chat-dismiss-error", () => {
          error.error = null;
          log.textContent = initialLog;
        });
        for (const name of [
          "vc-space-chat-submit",
          "vc-space-chat-attach",
          "vc-space-chat-reply",
          "vc-space-chat-edit",
          "vc-space-chat-delete",
          "vc-space-chat-retry",
          "vc-space-chat-reaction",
        ]) {
          world.addEventListener(name, (event) => {
            log.textContent = name + ": " + JSON.stringify(event.detail);
          });
        }
      }
    </script>
  </body>
</html>`;
}
