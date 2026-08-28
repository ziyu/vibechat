---
name: VibeChat Host — Lamplit
description: A bright, tactile host that feels like rooms gathered around warm light, then recedes when a Space opens.
colors:
  ember-accent: "#a95436"
  lamplight-accent: "#e39a62"
  warm-on-accent: "#fff8f1"
  mineral-canvas: "#e9ece6"
  chalk-surface: "#fbfcf8"
  daylight-raised: "#ffffff"
  mineral-sunken: "#e4e8df"
  charcoal-text: "#292c27"
  olive-muted: "#62685f"
  midnight-canvas: "#10110f"
  charcoal-surface: "#191a17"
  charcoal-raised: "#23231f"
  linen-text: "#eeeae1"
  ash-muted: "#aaa69a"
  success: "#3f7d55"
  warning: "#9a672d"
  danger: "#a74336"
typography:
  display:
    fontFamily: "IBM Plex Sans, Avenir Next, PingFang SC, Noto Sans SC, Hiragino Sans GB, sans-serif"
    fontSize: "clamp(2.25rem, 4.5vw, 3.5rem)"
    fontWeight: 400
    lineHeight: 1.06
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "IBM Plex Sans, Avenir Next, PingFang SC, Noto Sans SC, Hiragino Sans GB, sans-serif"
    fontSize: "2.125rem"
    fontWeight: 500
    lineHeight: 1.12
    letterSpacing: "-0.018em"
  title:
    fontFamily: "IBM Plex Sans, Avenir Next, Noto Sans SC, Hiragino Sans GB, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  compact-title:
    fontFamily: "IBM Plex Sans, Avenir Next, Noto Sans SC, Hiragino Sans GB, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 560
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body:
    fontFamily: "IBM Plex Sans, Avenir Next, Noto Sans SC, Hiragino Sans GB, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "normal"
  label:
    fontFamily: "IBM Plex Sans, Avenir Next, Noto Sans SC, Hiragino Sans GB, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "normal"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
  3xl: "44px"
components:
  button-primary:
    backgroundColor: "{colors.ember-accent}"
    textColor: "{colors.warm-on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "46px"
  search-field:
    backgroundColor: "{colors.mineral-sunken}"
    textColor: "{colors.charcoal-text}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "42px"
  room-card:
    backgroundColor: "{colors.chalk-surface}"
    textColor: "{colors.charcoal-text}"
    rounded: "{rounded.lg}"
    padding: "24px"
  mobile-dock-item:
    textColor: "{colors.olive-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "56px"
---

# Design System: VibeChat Host — Lamplit

## Overview

**Creative North Star: “灯下房间 / The Lamplit Room”**

The VibeChat host should feel like a bright corridor connecting inhabited rooms: quiet mineral surfaces, clear thresholds, and a small amount of warm light that tells people where life is happening. It is simple and creative rather than decorative, with enough material depth to remain comfortable during long sessions. It must never read as a SaaS dashboard, an editing tool, a magazine spread, or a colorful skin laid over the product.

The host exists to orient people, help them find friends and Spaces, and then step back. Once a running Space opens, its user-controlled App owns the visual world beneath the trusted Kernel. Lamplit styling may identify that trusted Kernel boundary, but it must stop at the App Surface and never recolor, filter, dim, or otherwise compete with Space content.

**Key Characteristics:**

- Bright warm-mineral Light mode with visible but restrained surface separation.
- Quiet charcoal Dark mode with low-frequency amber light, designed independently rather than inverted.
- Room, doorway, pool-of-light, and threshold cues used as a reusable spatial language.
- A slim left rail on desktop and a thumb-reachable bottom Dock on mobile.
- Real activity and relationships lead; management controls wait behind deliberate entry points.

## Colors

The palette is predominantly neutral and low-chroma. Warm orange is scarce enough to remain meaningful, while adjacent mineral or charcoal surfaces supply most of the depth.

### Primary

- **Ember Accent:** the Light-mode action, focus, active-navigation, and inhabited-state signal.
- **Lamplight Accent:** the brighter Dark-mode counterpart, tuned for charcoal surroundings rather than copied from Light.

### Secondary

- **Success:** healthy connection, completion, and positive system state.
- **Warning:** attention states that require care but are not destructive.
- **Danger:** destructive actions and blocking failures only.

### Neutral

- **Mineral Canvas, Chalk Surface, Daylight Raised, Mineral Sunken:** Light-mode depth is built from close warm-gray values, not pure-white emptiness.
- **Charcoal Text and Olive Muted:** primary and supporting copy remain calm and readable against the Light environment.
- **Midnight Canvas, Charcoal Surface, Charcoal Raised:** Dark mode uses distinct charcoal layers instead of numerical inversion.
- **Linen Text and Ash Muted:** Dark-mode text keeps a soft, non-glare contrast.

**The Warm Light Rarity Rule.** Accent color identifies action, focus, active location, or signs of life; it does not fill large decorative regions.

**The Bright Without Blank Rule.** Light mode may be bright, but every large region must retain legible depth through tonal separation, a fine boundary, atmosphere, or a soft shadow.

## Typography

**Display Font:** the same IBM Plex Sans / Avenir Next / PingFang SC / Noto Sans SC family used by the host body, tuned at a lighter weight and more open spacing for large Chinese headings.

**Body Font:** IBM Plex Sans (with Avenir Next, Noto Sans SC, Hiragino Sans GB, sans-serif fallback)

**Character:** Large headings use a calm, open sans-serif voice rather than a blocky display face. Personality comes from scale, spacing, material depth, and composition, while the single-family system keeps long-term operation neutral and highly legible.

### Hierarchy

- **Display:** reserved for one primary invitation or page identity, fluid between 36px and 56px with a tight line height.
- **Headline:** used for room and section thresholds, not for every card.
- **Title:** used for Space names, account records, plan names, and other scannable objects.
- **Compact title:** used for trusted Kernel identity and similarly dense persistent context where the full title step would compete with primary content.
- **Body:** used for guidance and explanatory copy; keep paragraphs narrow enough to scan and normally no wider than 60ch.
- **Label:** used for navigation, metadata, status, and compact actions; never reduce visible product copy below 11px.

**The One Sign Rule.** A viewport gets one dominant display-typography moment. Repeating the display face across every module turns the product into a magazine.

## Layout

Desktop host pages use a slim fixed left rail, a quiet contextual header, and a flexible content region. Primary actions do not live in a top toolbar: navigation sits around the rail’s middle, while search and account controls rest near the bottom. The Spaces route behaves as a corridor with a compact, cover-first Space shelf; a single Space keeps a bounded card width instead of expanding into a room-sized scene. Finder contains exhaustive search, filters, unread state, and management.

At 719px and below, the desktop rail disappears and the host recomposes around a bottom Dock with safe-area padding. Drawers become bottom sheets, two-column records become stacked sequences, and the five account index items remain visible without horizontal scrolling. Tap targets are at least 44px and essential content must not overflow at a 390px viewport.

The spacing rhythm is based on a compact 4/8/12/16px cadence, opening to 24/32/44px for page structure and room-scale breathing space. Density may increase for records, but related content stays closer than unrelated content.

**The Room, Not Dashboard Rule.** Do not introduce metric-card grids, marketing heroes, equal-weight plan walls, or persistent management panels when a spatial threshold, sequence, or Finder can express the task.

**The Recompose Rule.** Mobile layouts change task order and interaction surface; they are never a shrunken desktop composition.

## Elevation & Depth

Lamplit uses a hybrid of tonal layering and soft ambient shadow. Most resting surfaces are separated by nearby tones and hairline boundaries; shadows appear for floating navigation, interactive room cards, dialogs, and true overlays. Light-mode shadows are broad and low-opacity, while Dark mode increases opacity to remain perceptible on charcoal.

### Shadow Vocabulary

- **Ambient Low** (`0 8px 24px rgb(44 49 40 / 7%)`): resting interactive cards, avatars, and small floating details in Light mode.
- **Ambient Medium** (`0 18px 48px rgb(44 49 40 / 11%)`): hovered room entries and raised panels in Light mode.
- **Ambient High** (`0 32px 90px rgb(44 49 40 / 18%)`): dialogs and explicit overlays in Light mode.
- **Charcoal Low / Medium / High:** the same spatial roles at 24%, 34%, and 48% black opacity in Dark mode.

**The Threshold Rule.** Elevation communicates a change in interaction plane. Static page sections do not receive shadows merely to look decorated.

## Shapes

Everyday controls use gently curved 8–12px corners. Cards and grouped surfaces use 16px corners, while dialogs and major overlays use 20px. Pills are reserved for filters, compact status, and switches. The signature exception is an occasional door, lamp, or asymmetric brand-mark silhouette; it may shape a spatial scene but must not become a generic container style.

Borders are thin, low-contrast separators. Stronger borders are reserved for focus, selected thresholds, or boundaries between independently scrolling regions.

## Components

### Buttons

- **Shape:** primary controls use a comfortable 12px curve and at least 44px height.
- **Primary:** Ember or Lamplight background with the matching on-accent text; use for the single clearest next action in a region.
- **Hover / Focus:** hover darkens through perceptual color mixing; keyboard focus uses a 2–3px accent outline offset by 3px.
- **Secondary / Ghost:** quiet controls rest on transparent or sunken surfaces and gain a border or tonal fill on hover.

### Chips

- **Style:** compact pill geometry with neutral text and no decorative shadow.
- **State:** selection uses a low-opacity accent wash and accent text; unselected chips remain visually subordinate.

### Cards / Containers

- **Corner Style:** 16px for ordinary cards and 20px for overlays.
- **Background:** use the current surface role; nested content normally moves one tonal step sunken or raised.
- **Shadow Strategy:** resting cards use Ambient Low only when they are clickable or meaningfully raised.
- **Border:** a low-contrast hairline remains the default structural separator.
- **Internal Padding:** 16–24px for ordinary cards; larger room scenes may use 32–44px.

### Inputs / Fields

- **Style:** 42px minimum height, 12px corners, a sunken surface, and a fine neutral border.
- **Focus:** move to the raised surface, strengthen the border, and add a restrained accent halo.
- **Error / Disabled:** error uses Danger without changing layout; disabled state uses the shared 42% opacity token and remains legible.

### Navigation

Desktop navigation uses a narrow left rail with centered, 56px-tall destinations. Active state is a quiet accent wash, not a filled app bar. Mobile navigation becomes a five-item bottom Dock with safe-area padding and the same active-state language. Search and identity stay low on desktop instead of becoming top-level header actions.

### Trusted Space Kernel

The Kernel is the one persistent host surface above a running Space. It is a calm threshold, not an editor toolbar: Space identity and connection lead, member/Agent/Revision context stays compact, and reload/publish/menu remain clearly trusted host actions. Desktop uses one approximately 68px surface; mobile recomposes into an identity row and a context/action row instead of squeezing everything into a single strip. Interactive targets are at least 44px and visible labels remain at least 11px.

Kernel Light uses the bright mineral host surface with a fine boundary and low ambient shadow. Kernel Dark uses the charcoal surface and independently tuned contrast. Space accent may mark the glyph or live/build state but never becomes the Header canvas. Host styles end at the Kernel border: the single iframe beneath it receives no host filter, opacity, blend mode, color overlay, or theme-derived background override.

### Space Cover Card

The Space cover card is the signature host component: a compact 16:10 cover generated from the Space template identity, followed by the Space name, member count, update time, unread state, and one clear entry affordance. It does not simulate a room with lamps, furniture, speech bubbles, or decorative people, and it does not expose management data. One card never stretches to fill the corridor; multiple cards form a quiet social shelf rather than a SaaS resource grid.

### Finder

Finder owns exhaustive search, unread filtering, and Space management. It opens as a desktop side drawer or mobile bottom sheet, traps focus while open, closes on Escape, and returns focus to its trigger. The corridor remains for orientation and entry rather than becoming a permanent control panel.

## Do's and Don'ts

### Do:

- **Do** use semantic host tokens so Light, Dark, and future themes can change without rewriting page selectors.
- **Do** make activity, relationships, and the next human action visible before management controls.
- **Do** preserve subtle material depth in bright Light mode through nearby tones, boundaries, and low ambient shadows.
- **Do** verify both desktop and 390px mobile layouts, keyboard focus, reduced motion, and 11px minimum visible text.
- **Do** let the trusted Kernel use host semantic tokens, then stop the host theme exactly at the running Space App boundary.

### Don't:

- **Don't** turn host pages into SaaS dashboards, analytics grids, pricing walls, editor chrome, or magazine spreads.
- **Don't** use large colorful decoration or frequent orange fills that compete with Space content.
- **Don't** place desktop primary navigation, search, and account management in a crowded top bar.
- **Don't** treat Dark mode as a mechanical inversion of Light mode.
- **Don't** shrink desktop layouts onto mobile or hide essential navigation in horizontally scrolling strips.
- **Don't** recolor, filter, blur, dim, or otherwise theme user-controlled Space content from the host.
