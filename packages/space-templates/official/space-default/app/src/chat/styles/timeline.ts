export const chatTimelineStyles = `
.vcc-timeline-region {
  display: grid;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
}

.vcc-opening {
  padding: clamp(28px, 5vw, 66px) 18px 18px;
  text-align: center;
}

.vcc-opening[hidden],
.vcc-build[hidden] {
  display: none;
}

.vcc-opening b {
  display: grid;
  width: 64px;
  height: 64px;
  place-items: center;
  margin: auto;
  border: 1px solid color-mix(in srgb, var(--vcc-accent) 40%, transparent);
  border-radius: 20px;
  background: color-mix(in srgb, var(--vcc-accent) 10%, transparent);
  color: var(--vcc-accent);
  box-shadow: 0 14px 48px color-mix(in srgb, var(--vcc-accent) 13%, transparent);
  font: italic 31px Georgia, serif;
}

.vcc-opening h1 {
  margin: 18px 0 8px;
  font: 500 clamp(27px, 4vw, 48px)/1.05 Georgia, "Noto Serif SC", serif;
  letter-spacing: -0.04em;
}

.vcc-opening p {
  max-width: 500px;
  margin: auto;
  color: var(--vcc-muted);
  font-size: 12px;
}

.vcc-opening span {
  display: inline-flex;
  margin-top: 16px;
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
  padding: 20px max(16px, calc((100% - 760px) / 2)) 26px;
  border: 0;
  border-radius: 0;
  background: transparent;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}

vc-space-chat-timeline::part(list) {
  width: min(100%, 760px);
  margin-inline: auto;
}

vc-space-chat-timeline::part(status) {
  min-height: 100%;
  color: var(--vcc-muted);
}

vc-space-chat-timeline::part(controls) {
  gap: 6px;
  margin-inline-start: 42px;
}

vc-space-chat-timeline::part(message-actions),
vc-space-chat-timeline::part(reaction-bar) {
  gap: 4px;
}

vc-space-chat-timeline::part(message-action-reply),
vc-space-chat-timeline::part(message-action-edit),
vc-space-chat-timeline::part(message-action-delete),
vc-space-chat-timeline::part(message-action-retry),
vc-space-chat-timeline::part(reaction) {
  min-block-size: 44px;
  min-inline-size: 44px;
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 10px;
}

.vcc-build {
  display: flex;
  gap: 10px;
  align-items: center;
  width: min(calc(100% - 32px), 720px);
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

@media (max-width: 390px) {
  vc-space-chat-timeline::part(controls) {
    margin-inline-start: 0;
  }
}
`;
