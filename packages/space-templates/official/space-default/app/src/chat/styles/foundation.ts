export const chatFoundationStyles = `
.vcc-root {
  --vcc-accent: var(--space-accent, #ff5a3d);
  --vcc-line: var(--space-border, rgba(255, 255, 255, 0.16));
  --vcc-muted: var(--space-muted, #aaa9a2);
  --vc-space-color-text: var(--space-text, #f7f4ed);
  --vc-space-color-text-muted: var(--vcc-muted);
  --vc-space-color-surface: #171916;
  --vc-space-color-surface-raised: #1d1f1c;
  --vc-space-color-border: var(--vcc-line);
  --vc-space-color-accent: var(--vcc-accent);
  --vc-space-color-accent-contrast: #11120f;
  --vc-space-color-negative: #f0a292;
  --vc-space-color-focus: #ff8a75;
  --vc-space-font-body: "Avenir Next", "Noto Sans SC", sans-serif;
  --vc-space-radius-card: 14px;
  --vc-space-radius-control: 10px;
  --vc-space-chat-bubble-radius: 4px 14px 14px;
  --vc-space-chat-bubble-padding: 10px 12px;
  position: fixed;
  inset: 0;
  z-index: 70;
  color: var(--vc-space-color-text);
  font: 13px/1.45 var(--vc-space-font-body);
  pointer-events: none;
}

.vcc-launch {
  position: fixed;
  right: 22px;
  bottom: 22px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 14px;
  border: 1px solid color-mix(in srgb, var(--vcc-accent) 45%, transparent);
  border-radius: 999px;
  background: #171916;
  color: #fff;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.38);
  cursor: pointer;
  pointer-events: auto;
}

.vcc-launch svg {
  width: 18px;
  height: 18px;
}

.vcc-launch i {
  display: grid;
  min-width: 18px;
  height: 18px;
  place-items: center;
  border-radius: 9px;
  background: var(--vcc-accent);
  color: #111;
  font: 700 9px/1 system-ui, sans-serif;
}

.vcc-shell {
  position: fixed;
  inset: 14px 14px 14px auto;
  display: grid;
  width: min(430px, calc(100vw - 28px));
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  border: 1px solid var(--vcc-line);
  border-radius: 20px;
  background: rgba(16, 18, 15, 0.96);
  box-shadow: 0 28px 90px rgba(0, 0, 0, 0.54);
  transform: translateX(calc(100% + 36px));
  transition: transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
  pointer-events: auto;
  backdrop-filter: blur(26px);
}

.vcc-root[data-open="true"] .vcc-shell {
  transform: translateX(0);
}

.vcc-root[data-mode="full"] .vcc-shell {
  inset: 0;
  width: auto;
  grid-template-rows: minmax(0, 1fr) auto;
  border: 0;
  border-radius: 0;
  background:
    radial-gradient(circle at 18% 0, rgba(255, 90, 61, 0.11), transparent 34%),
    radial-gradient(circle at 92% 88%, rgba(213, 190, 110, 0.08), transparent 28%),
    #10120f;
  box-shadow: none;
  transform: none;
}

.vcc-root[data-mode="full"] .vcc-launch,
.vcc-root[data-mode="full"] .vcc-head {
  display: none;
}

.vcc-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 13px 14px;
  border-bottom: 1px solid var(--vcc-line);
  background: rgba(11, 12, 10, 0.82);
}

.vcc-mark {
  display: grid;
  width: 37px;
  height: 37px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--vcc-accent) 45%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--vcc-accent) 13%, transparent);
  color: var(--vcc-accent);
  font: italic 20px Georgia, serif;
}

.vcc-title {
  min-width: 0;
}

.vcc-title strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.vcc-title small {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  color: var(--vcc-muted);
  font-size: 10px;
}

.vcc-title small i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #69c681;
  box-shadow: 0 0 0 3px rgba(105, 198, 129, 0.12);
}

.vcc-head-actions {
  display: flex;
}

.vcc-icon {
  display: grid;
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  place-items: center;
  border: 0;
  border-radius: 11px;
  background: transparent;
  color: #c7c5be;
  cursor: pointer;
}

.vcc-icon:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.vcc-icon:focus-visible,
.vcc-launch:focus-visible {
  outline: 2px solid var(--vc-space-color-focus);
  outline-offset: 2px;
}

.vcc-icon svg {
  width: 18px;
  height: 18px;
}
`;
