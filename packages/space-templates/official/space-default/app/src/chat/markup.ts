export const chatMarkup = `<div class="vcc-root" id="vcc-root">
  <button class="vcc-launch" id="vcc-launch" type="button" aria-label="Open Space Chat">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>
    <span>Chat</span><i id="vcc-unread">0</i>
  </button>
  <section class="vcc-shell" aria-label="Space Chat">
    <header class="vcc-head">
      <span class="vcc-mark" id="vcc-mark">V</span>
      <span class="vcc-title"><strong id="vcc-room-name">Space</strong><small><i></i><span id="vcc-member-count">Connected</span></small></span>
      <span class="vcc-head-actions">
        <button class="vcc-icon vcc-close" id="vcc-close" type="button" aria-label="Close Chat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m18 6-12 12M6 6l12 12"/></svg></button>
      </span>
    </header>
    <div class="vcc-timeline" id="vcc-timeline" data-testid="message-timeline"></div>
    <div class="vcc-compose-wrap">
      <div class="vcc-mentions" id="vcc-mentions"></div>
      <div class="vcc-context" id="vcc-context" data-testid="chat-context" hidden></div>
      <div class="vcc-typing" id="vcc-typing" data-testid="typing-indicator" hidden></div>
      <div class="vcc-error" id="vcc-error" hidden></div>
      <form class="vcc-compose" id="vcc-form">
        <button class="vcc-icon vcc-attach" id="vcc-attach" type="button" aria-label="Attach file"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7L9.7 17.7a2 2 0 1 1-2.8-2.8l8.9-8.9"/></svg></button>
        <input class="vcc-file" id="vcc-file" type="file" data-testid="attachment-input" hidden>
        <textarea id="vcc-input" rows="1" maxlength="4000" placeholder="Message this Space…" data-testid="message-input"></textarea>
        <button class="vcc-send" id="vcc-send" type="submit" disabled aria-label="Send message" data-testid="send-message"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></button>
      </form>
      <small class="vcc-hint" id="vcc-hint">Enter to send · type @ to mention a member or Agent</small>
    </div>
  </section>
</div>`;
