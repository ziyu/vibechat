export const chatMarkup = `<div class="vcc-root" id="vcc-root">
  <button class="vcc-launch" id="vcc-launch" type="button" aria-label="Open Space Chat">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>
    <span id="vcc-launch-label">Chat</span><i id="vcc-unread">0</i>
  </button>
  <section class="vcc-shell" id="vcc-shell" aria-label="Space Chat">
    <header class="vcc-head">
      <span class="vcc-mark" id="vcc-mark">V</span>
      <span class="vcc-title"><strong id="vcc-room-name">Space</strong><small><i></i><span id="vcc-member-count">Connected</span></small></span>
      <span class="vcc-head-actions">
        <button class="vcc-icon vcc-close" id="vcc-close" type="button" aria-label="Close Chat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m18 6-12 12M6 6l12 12"/></svg></button>
      </span>
    </header>
    <main class="vcc-timeline-region">
      <section class="vcc-opening" id="vcc-opening">
        <b id="vcc-opening-mark">V</b>
        <h1 id="vcc-opening-title">Space</h1>
        <p id="vcc-opening-summary">Chat is ready.</p>
        <span id="vcc-opening-agent">Matrix Chat Core · @agent</span>
      </section>
      <vc-space-chat-timeline
        id="vcc-timeline"
        interactive
        state="loading"
        data-testid="message-timeline"
      ></vc-space-chat-timeline>
      <vc-space-agent-activity
        class="vcc-agent-activity"
        id="vcc-agent-activity"
        density="compact"
        data-testid="agent-activity"
      ></vc-space-agent-activity>
    </main>
    <div class="vcc-compose-wrap">
      <vc-space-mention-menu
        class="vcc-mentions"
        id="vcc-mentions"
        hidden
      ></vc-space-mention-menu>
      <vc-space-chat-error-state
        class="vcc-error"
        id="vcc-error"
      ></vc-space-chat-error-state>
      <vc-space-chat-composer
        id="vcc-composer"
        maxlength="4000"
      ></vc-space-chat-composer>
      <small class="vcc-hint" id="vcc-hint">Enter to send · type @ to mention a member or Agent</small>
    </div>
  </section>
</div>`;
