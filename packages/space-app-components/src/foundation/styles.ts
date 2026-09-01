export const spaceComponentCssTokenVersion = "0.4.0" as const;

export const spaceAvatarStyles = `
:host {
  --vc-space-avatar-size: 2.75rem;
  --vc-space-avatar-ink: #171a1f;
  --vc-space-avatar-paper: #f3e8d2;
  --vc-space-avatar-signal: #ff6b44;
  --vc-space-avatar-online: #a8f36a;
  --vc-space-avatar-away: #ffc65b;
  --vc-space-avatar-offline: #8b929c;
  display: inline-grid;
  inline-size: var(--vc-space-avatar-size);
  block-size: var(--vc-space-avatar-size);
  vertical-align: middle;
}

:host([size="sm"]) { --vc-space-avatar-size: 2rem; }
:host([size="lg"]) { --vc-space-avatar-size: 4rem; }

.frame {
  position: relative;
  display: grid;
  inline-size: 100%;
  block-size: 100%;
  place-items: center;
  overflow: visible;
  border-radius: 42% 58% 48% 52% / 54% 45% 55% 46%;
  color: var(--vc-space-avatar-paper);
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--vc-space-avatar-signal) 82%, white), var(--vc-space-avatar-signal));
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, white 30%, transparent),
    0 .34rem 1rem color-mix(in srgb, var(--vc-space-avatar-ink) 22%, transparent);
  isolation: isolate;
}

.frame::before {
  content: "";
  position: absolute;
  inset: .14rem;
  z-index: -1;
  border-radius: inherit;
  background:
    repeating-linear-gradient(115deg, transparent 0 .22rem, color-mix(in srgb, white 12%, transparent) .22rem .26rem);
}

.initials {
  font: 700 calc(var(--vc-space-avatar-size) * .34) / 1 "Avenir Next Condensed", "DIN Alternate", sans-serif;
  letter-spacing: .035em;
  text-transform: uppercase;
}

img {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  border-radius: inherit;
  object-fit: cover;
}

.status {
  position: absolute;
  right: -.08rem;
  bottom: -.08rem;
  inline-size: max(.68rem, calc(var(--vc-space-avatar-size) * .24));
  block-size: max(.68rem, calc(var(--vc-space-avatar-size) * .24));
  border: max(2px, calc(var(--vc-space-avatar-size) * .055)) solid var(--vc-space-avatar-paper);
  border-radius: 50%;
  background: var(--vc-space-avatar-offline);
  box-shadow: 0 .12rem .3rem color-mix(in srgb, var(--vc-space-avatar-ink) 35%, transparent);
}

.status[data-status="online"] { background: var(--vc-space-avatar-online); }
.status[data-status="away"] { background: var(--vc-space-avatar-away); }
.status[data-status="offline"] { background: var(--vc-space-avatar-offline); }
.status[hidden] { display: none; }

@media (prefers-reduced-motion: no-preference) {
  :host(:hover) .frame {
    transform: rotate(-2deg) translateY(-1px);
    transition: transform 160ms cubic-bezier(.2, .8, .2, 1);
  }
}

@media (prefers-contrast: more) {
  .frame { box-shadow: inset 0 0 0 2px currentColor; }
  .status { border-color: Canvas; outline: 1px solid CanvasText; }
}
`;
