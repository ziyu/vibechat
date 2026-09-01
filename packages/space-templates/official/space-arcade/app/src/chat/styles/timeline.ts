export const chatTimelineStyles = `
.vcc-timeline-region {
  display: grid;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
}

.vcc-opening {
  padding: 28px 18px 18px;
  text-align: center;
}

.vcc-opening[hidden],
.vcc-build[hidden] {
  display: none;
}

.vcc-opening b {
  display: grid;
  width: 58px;
  height: 58px;
  place-items: center;
  margin: auto;
  border: 1px solid color-mix(in srgb, var(--vcc-accent) 40%, transparent);
  border-radius: 18px;
  background: color-mix(in srgb, var(--vcc-accent) 10%, transparent);
  color: var(--vcc-accent);
  box-shadow: 0 14px 48px color-mix(in srgb, var(--vcc-accent) 13%, transparent);
  font: italic 28px Georgia, serif;
}

.vcc-opening h1 {
  margin: 16px 0 8px;
  font: 500 clamp(25px, 4vw, 38px)/1.05 Georgia, "Noto Serif SC", serif;
  letter-spacing: -0.04em;
}

.vcc-opening p {
  max-width: 360px;
  margin: auto;
  color: var(--vcc-muted);
  font-size: 12px;
}

.vcc-opening span {
  display: inline-flex;
  margin-top: 14px;
  padding: 5px 9px;
  border: 1px solid var(--vcc-line);
  border-radius: 999px;
  color: #c7c4bc;
  font-size: 9px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

vc-space-chat-timeline {
  display: block;
  min-height: 0;
  height: 100%;
  --vc-space-chat-timeline-max-height: none;
}

vc-space-chat-timeline::part(viewport) {
  height: 100%;
  max-height: none;
  padding: 18px 14px 22px;
  border: 0;
  border-radius: 0;
  background: transparent;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}

vc-space-chat-timeline::part(list) {
  width: 100%;
  margin-inline: auto;
}

vc-space-chat-timeline::part(status) {
  min-height: 100%;
  color: var(--vcc-muted);
}

vc-space-chat-timeline::part(controls) {
  gap: 6px;
}

vc-space-chat-timeline::part(message-actions),
vc-space-chat-timeline::part(reaction-bar) {
  gap: 4px;
}

vc-space-chat-timeline::part(message-action-more),
vc-space-chat-timeline::part(reaction) {
  min-block-size: 44px;
  min-inline-size: 44px;
  padding: 7px 9px;
  border-radius: 8px;
  border-color: color-mix(in srgb, var(--vcc-line) 82%, transparent);
  background: rgba(255, 255, 255, 0.035);
  color: #bbb9b2;
  font-size: 10px;
}

vc-space-chat-timeline::part(message-action-more):hover,
vc-space-chat-timeline::part(reaction):hover {
  border-color: color-mix(in srgb, var(--vcc-accent) 38%, var(--vcc-line));
  background: color-mix(in srgb, var(--vcc-accent) 8%, #171916);
  color: #f7f4ed;
}

vc-space-chat-timeline::part(message-action-menu) {
  min-width: 224px;
  border-color: rgba(255, 255, 255, 0.17);
  background: #1b1d19;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.44);
}

vc-space-chat-timeline::part(message-action-menu-title) {
  color: #aaa9a2;
}

vc-space-chat-timeline::part(message-action-menu-close) {
  color: #c9c6be;
}

vc-space-chat-timeline::part(message-action-reply),
vc-space-chat-timeline::part(message-action-edit),
vc-space-chat-timeline::part(message-action-delete),
vc-space-chat-timeline::part(message-action-retry) {
  min-block-size: 42px;
  padding: 9px 10px;
  border-color: transparent;
  border-radius: 8px;
  background: transparent;
  font-size: 11px;
}

vc-space-chat-timeline::part(message-action-delete) {
  color: #f0a292;
}

vc-space-chat-timeline::part(message-reaction-choice) {
  min-block-size: 44px;
  min-inline-size: 44px;
  border-radius: 9px;
  background: #171916;
}

.vcc-build {
  display: flex;
  gap: 10px;
  align-items: center;
  width: calc(100% - 28px);
  margin: 0 auto 12px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--vcc-accent) 28%, transparent);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.24);
}

.vcc-build i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--vcc-accent);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--vcc-accent) 14%, transparent);
  animation: vccPulse 900ms ease-in-out infinite alternate;
}

.vcc-build span {
  display: grid;
}

.vcc-build small {
  color: var(--vcc-muted);
  font-size: 9px;
}

@keyframes vccPulse {
  to {
    opacity: 0.35;
    transform: scale(0.7);
  }
}

@media (max-width: 480px) {
  vc-space-chat-timeline::part(message-action-menu) {
    min-width: 0;
    border-radius: 16px;
  }
}
`;
