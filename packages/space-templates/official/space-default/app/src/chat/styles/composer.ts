export const chatComposerStyles = `
.vcc-compose-wrap {
  position: relative;
  z-index: 2;
  padding: 10px 12px max(12px, env(safe-area-inset-bottom));
  border-top: 1px solid color-mix(in srgb, var(--vcc-line) 70%, transparent);
  background: linear-gradient(180deg, rgba(16, 18, 15, 0.88), #10120f 28%);
}

.vcc-root[data-mode="full"] .vcc-compose-wrap {
  padding-right: max(18px, calc((100% - 760px) / 2));
  padding-left: max(18px, calc((100% - 760px) / 2));
}

.vcc-mentions {
  position: absolute;
  right: 12px;
  bottom: calc(100% - 4px);
  left: 12px;
  z-index: 3;
}

.vcc-mentions[hidden] {
  display: none;
}

.vcc-root[data-mode="full"] .vcc-mentions {
  right: max(18px, calc((100% - 760px) / 2));
  left: max(18px, calc((100% - 760px) / 2));
}

.vcc-mentions::part(menu) {
  border-color: var(--vcc-line);
  border-radius: 12px;
  background: #1b1d19;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.4);
}

.vcc-mentions::part(option) {
  border-radius: 9px;
}

.vcc-error {
  display: block;
  margin: 0 8px 6px;
}

.vcc-error::part(error) {
  border-color: rgba(238, 105, 83, 0.46);
  border-radius: 9px;
  background: #181a17;
  color: #f4b0a2;
  font-size: 10px;
}

vc-space-chat-composer::part(context) {
  margin: 0 8px 6px;
  border: 1px solid var(--vcc-line);
  border-radius: 9px;
  background: #181a17;
  color: #d1cec5;
  font-size: 10px;
}

vc-space-chat-composer::part(form) {
  gap: 7px;
  padding: 8px;
  border-color: var(--vcc-line);
  border-radius: 16px;
  background: #171916;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.34);
}

vc-space-chat-composer::part(input) {
  min-height: 38px;
  padding: 9px 6px 5px;
  color: #fff;
  caret-color: var(--vcc-accent);
}

vc-space-chat-composer::part(attach),
vc-space-chat-composer::part(send),
vc-space-chat-composer::part(cancel-context) {
  min-width: 44px;
  min-height: 44px;
  border-radius: 11px;
}

vc-space-chat-composer::part(attach),
vc-space-chat-composer::part(cancel-context) {
  border-color: transparent;
  background: transparent;
  color: #d0cdc5;
}

vc-space-chat-composer::part(send) {
  border-color: var(--vcc-accent);
  background: var(--vcc-accent);
  color: #11120f;
}

.vcc-hint {
  display: block;
  margin-top: 5px;
  color: #8d8c85;
  font-size: 9px;
  text-align: center;
}
`;
