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

.vcc-context,
.vcc-typing,
.vcc-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 8px 6px;
  padding: 7px 9px;
  border: 1px solid var(--vcc-line);
  border-radius: 9px;
  background: #181a17;
  color: #c8c5bc;
  font-size: 9px;
}

.vcc-context[hidden],
.vcc-typing[hidden],
.vcc-error[hidden] {
  display: none !important;
}

.vcc-context button {
  border: 0;
  background: none;
  color: #fff;
  cursor: pointer;
}

.vcc-typing {
  width: max-content;
  color: var(--vcc-muted);
}

.vcc-error {
  border-color: rgba(238, 105, 83, 0.35);
  color: #f0a292;
}

.vcc-compose {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 7px;
  align-items: end;
  padding: 8px;
  border: 1px solid var(--vcc-line);
  border-radius: 16px;
  background: #171916;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.34);
}

.vcc-compose .vcc-attach {
  align-self: end;
}

.vcc-compose textarea {
  width: 100%;
  min-width: 0;
  min-height: 38px;
  max-height: 120px;
  resize: none;
  overflow-y: auto;
  padding: 9px 6px 5px;
  border: 0;
  outline: 0;
  background: transparent;
  color: #fff;
  font: inherit;
  line-height: 1.5;
}

.vcc-compose textarea::placeholder {
  color: #706f68;
}

.vcc-send {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 0;
  border-radius: 11px;
  background: var(--vcc-accent);
  color: #11120f;
  cursor: pointer;
}

.vcc-send:disabled {
  opacity: 0.3;
  cursor: default;
}

.vcc-send svg {
  width: 17px;
}

.vcc-hint {
  display: block;
  margin-top: 5px;
  color: #66665f;
  font-size: 8px;
  text-align: center;
}

.vcc-file {
  display: none;
}

.vcc-mentions {
  position: absolute;
  right: 12px;
  bottom: calc(100% - 4px);
  left: 12px;
  display: none;
  max-height: 180px;
  overflow: auto;
  padding: 5px;
  border: 1px solid var(--vcc-line);
  border-radius: 12px;
  background: #1b1d19;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.4);
}

.vcc-root[data-mentions="true"] .vcc-mentions {
  display: grid;
}

.vcc-root[data-mode="full"] .vcc-mentions {
  right: max(18px, calc((100% - 760px) / 2));
  left: max(18px, calc((100% - 760px) / 2));
}

.vcc-mention {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  gap: 9px;
  align-items: center;
  padding: 7px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #fff;
  text-align: left;
  cursor: pointer;
}

.vcc-mention:hover {
  background: rgba(255, 255, 255, 0.07);
}

.vcc-mention b {
  display: grid;
  width: 29px;
  height: 29px;
  place-items: center;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--vcc-accent);
  font: 700 9px Georgia, serif;
}

.vcc-mention span {
  display: grid;
}

.vcc-mention small,
.vcc-mention em {
  color: var(--vcc-muted);
  font-size: 8px;
}

.vcc-mention em {
  font-style: normal;
  text-transform: uppercase;
}
`;
