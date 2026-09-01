export const chatResponsiveStyles = `
@media (max-width: 620px) {
  .vcc-shell {
    inset: 0;
    width: auto;
    border: 0;
    border-radius: 0;
  }

  .vcc-head {
    padding-top: max(13px, env(safe-area-inset-top));
  }

  .vcc-launch {
    right: max(14px, env(safe-area-inset-right));
    bottom: max(14px, env(safe-area-inset-bottom));
  }

  .vcc-opening {
    padding: 22px 12px 12px;
  }

  vc-space-chat-timeline::part(viewport) {
    padding: 12px 8px 18px;
  }

  vc-space-agent-activity {
    width: calc(100% - 16px);
    margin-bottom: 10px;
  }

  .vcc-mentions {
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
}
`;
