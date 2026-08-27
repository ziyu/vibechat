export const chatResponsiveStyles = `
@media (max-width: 620px) {
  .vcc-shell {
    inset: 0;
    width: auto;
    border: 0;
    border-radius: 0;
  }

  .vcc-launch {
    right: 14px;
    bottom: 14px;
  }

  .vcc-opening {
    padding: 22px 12px 12px;
  }

  vc-space-chat-timeline::part(viewport) {
    padding: 12px 8px 18px;
  }

  .vcc-root[data-mode="full"] .vcc-compose-wrap {
    padding-inline: 8px;
  }

  .vcc-root[data-mode="full"] .vcc-mentions {
    right: 8px;
    left: 8px;
  }

  .vcc-hint {
    display: none;
  }
}

@media (max-width: 390px) {
  .vcc-opening b {
    width: 54px;
    height: 54px;
    border-radius: 16px;
    font-size: 26px;
  }

  .vcc-opening h1 {
    margin-top: 14px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .vcc-shell,
  .vcc-launch {
    transition: none;
  }

  .vcc-build i {
    animation: none;
  }
}
`;
