export const chatResponsiveStyles = `
@media (max-width: 620px) {
  .vcc-shell { inset: 0; width: auto; border: 0; border-radius: 0; }
  .vcc-launch { right: 14px; bottom: 14px; }
  .vcc-root[data-mode="full"] .vcc-timeline { padding-inline: 12px; }
  .vcc-root[data-mode="full"] .vcc-compose-wrap { padding-inline: 8px; }
  .vcc-root[data-mode="full"] .vcc-mentions { right: 8px; left: 8px; }
  .vcc-main { max-width: 90%; }
  .vcc-opening { margin-top: 2vh; }
  .vcc-hint { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .vcc-shell,
  .vcc-launch { transition: none; }
  .vcc-build i { animation: none; }
}
`;
