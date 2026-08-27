export const chatTimelineStyles = `
.vcc-history-bar {
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 8px 16px 0;
}

.vcc-history-bar button {
  padding: 6px 11px;
  border: 1px solid var(--vcc-line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--vcc-muted);
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}

.vcc-history-bar button:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--vcc-accent) 55%, transparent);
  color: #fff;
}

.vcc-history-bar button:disabled {
  cursor: default;
  opacity: 0.65;
}

.vcc-history-bar span {
  color: #f09a8c;
  font-size: 9px;
}

.vcc-timeline {
  min-height: 0;
  overflow-y: auto;
  padding: 20px 16px 24px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.16) transparent;
}

.vcc-root[data-mode="full"] .vcc-timeline {
  padding: clamp(28px, 5vw, 66px) max(18px, calc((100% - 760px) / 2)) 32px;
}

.vcc-opening {
  margin: 4vh auto 48px;
  text-align: center;
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
  box-shadow: 0 0 70px color-mix(in srgb, var(--vcc-accent) 13%, transparent);
  font: italic 31px Georgia, serif;
}

.vcc-opening h1 {
  margin: 18px 0 8px;
  font: 500 clamp(27px, 4vw, 48px) / 1.05 Georgia, "Noto Serif SC", serif;
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
  color: #bcb9b1;
  font-size: 9px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.vcc-message {
  display: grid;
  grid-template-columns: 31px minmax(0, 1fr);
  gap: 9px;
  align-items: start;
  margin-top: 15px;
}

.vcc-message[data-own="true"] {
  grid-template-columns: minmax(0, 1fr);
}

.vcc-avatar {
  display: grid;
  width: 31px;
  height: 31px;
  place-items: center;
  border: 1px solid var(--vcc-line);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.07);
  color: #ddd8ce;
  font: 700 10px Georgia, serif;
}

.vcc-message[data-agent="true"] .vcc-avatar {
  border-color: color-mix(in srgb, var(--vcc-accent) 42%, transparent);
  color: var(--vcc-accent);
}

.vcc-main {
  min-width: 0;
  max-width: 82%;
}

.vcc-message[data-own="true"] .vcc-main {
  justify-self: end;
}

.vcc-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0 5px 5px;
}

.vcc-meta strong {
  font-size: 10px;
}

.vcc-meta time,
.vcc-edited,
.vcc-status {
  color: #77776f;
  font-size: 8px;
}

.vcc-bubble {
  position: relative;
  padding: 10px 12px;
  border: 1px solid var(--vcc-line);
  border-radius: 4px 14px 14px;
  background: rgba(255, 255, 255, 0.07);
}

.vcc-message[data-own="true"] .vcc-bubble {
  border-color: color-mix(in srgb, var(--vcc-accent) 32%, transparent);
  border-radius: 14px 4px 14px 14px;
  background: color-mix(in srgb, var(--vcc-accent) 15%, rgba(255, 255, 255, 0.05));
}

.vcc-message[data-agent="true"] .vcc-bubble {
  border-color: color-mix(in srgb, var(--vcc-accent) 28%, transparent);
  background: color-mix(in srgb, var(--vcc-accent) 9%, rgba(255, 255, 255, 0.04));
}

.vcc-message[data-mentioned="true"] .vcc-bubble {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--vcc-accent) 46%, transparent);
}

.vcc-bubble p {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.vcc-bubble blockquote {
  margin: 0 0 8px;
  padding: 7px 9px;
  border-left: 2px solid var(--vcc-accent);
  border-radius: 4px 8px 8px 4px;
  background: rgba(0, 0, 0, 0.2);
  color: #b9b6ad;
  font-size: 10px;
}

.vcc-bubble blockquote b {
  display: block;
  color: #e1ddd4;
}

.vcc-attachment {
  display: flex;
  gap: 9px;
  align-items: center;
  margin: 0 0 8px;
  padding: 8px;
  border: 1px solid var(--vcc-line);
  border-radius: 9px;
  color: #fff;
  text-decoration: none;
}

.vcc-attachment img {
  width: 96px;
  max-height: 84px;
  border-radius: 7px;
  object-fit: cover;
}

.vcc-attachment span {
  display: grid;
}

.vcc-attachment small {
  color: var(--vcc-muted);
  font-size: 9px;
}

.vcc-edited,
.vcc-status {
  display: block;
  margin-top: 5px;
}

.vcc-status {
  text-align: right;
}

.vcc-status[data-failed="true"] {
  color: #f09a8c;
  cursor: pointer;
}

.vcc-actions,
.vcc-reactions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 7px;
}

.vcc-actions button,
.vcc-reactions button {
  min-width: 25px;
  height: 24px;
  padding: 0 7px;
  border: 1px solid var(--vcc-line);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.04);
  color: #ccc8bf;
  font-size: 10px;
  cursor: pointer;
}

.vcc-actions button:hover,
.vcc-reactions button:hover {
  border-color: color-mix(in srgb, var(--vcc-accent) 55%, transparent);
  color: #fff;
}

.vcc-reactions button[data-reacted="true"] {
  border-color: var(--vcc-accent);
  background: color-mix(in srgb, var(--vcc-accent) 16%, transparent);
}

.vcc-build {
  display: flex;
  gap: 10px;
  align-items: center;
  margin: 18px 0 0 40px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--vcc-accent) 28%, transparent);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.2);
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
`;
