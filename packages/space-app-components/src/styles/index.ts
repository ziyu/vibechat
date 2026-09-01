export type SpaceIdentityThemeName = "signal" | "field-note";

export type SpaceIdentityThemeTokens = Readonly<Record<`--vc-space-${string}`, string>>;

export const spaceSignalTheme: SpaceIdentityThemeTokens = Object.freeze({
  "--vc-space-color-surface": "#0f1519",
  "--vc-space-color-surface-raised": "#192229",
  "--vc-space-color-text": "#f4ead8",
  "--vc-space-color-text-muted": "#c7baa5",
  "--vc-space-color-border": "#53616a",
  "--vc-space-color-accent": "#ff7048",
  "--vc-space-color-accent-contrast": "#17110e",
  "--vc-space-color-focus": "#b8ef72",
  "--vc-space-color-positive": "#86ce77",
  "--vc-space-color-warning": "#f2b85b",
  "--vc-space-color-negative": "#ff7881",
  "--vc-space-color-neutral": "#9aa5ad",
  "--vc-space-font-body": "\"Avenir Next Condensed\", \"DIN Alternate\", sans-serif",
  "--vc-space-font-display": "\"Iowan Old Style\", \"Palatino Linotype\", serif",
  "--vc-space-radius-card": ".9rem",
  "--vc-space-radius-control": ".72rem",
});

export const spaceFieldNoteTheme: SpaceIdentityThemeTokens = Object.freeze({
  "--vc-space-color-surface": "#eee8d9",
  "--vc-space-color-surface-raised": "#fffaf0",
  "--vc-space-color-text": "#26362c",
  "--vc-space-color-text-muted": "#58675e",
  "--vc-space-color-border": "#9aa89b",
  "--vc-space-color-accent": "#2e715a",
  "--vc-space-color-accent-contrast": "#f8fff8",
  "--vc-space-color-focus": "#9f482e",
  "--vc-space-color-positive": "#347a4d",
  "--vc-space-color-warning": "#936018",
  "--vc-space-color-negative": "#a33b43",
  "--vc-space-color-neutral": "#69766d",
  "--vc-space-font-body": "\"Optima\", \"Candara\", sans-serif",
  "--vc-space-font-display": "\"Baskerville\", \"Times New Roman\", serif",
  "--vc-space-radius-card": "1rem",
  "--vc-space-radius-control": "1rem",
});

export function getSpaceIdentityTheme(name: SpaceIdentityThemeName) {
  return name === "field-note" ? spaceFieldNoteTheme : spaceSignalTheme;
}

export function serializeSpaceIdentityTheme(name: SpaceIdentityThemeName) {
  return Object.entries(getSpaceIdentityTheme(name))
    .map(([token, value]) => `${token}: ${value}`)
    .join("; ");
}
