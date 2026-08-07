---
name: new-qconhub-brand-design
description: "QC OneHub brand design system — color tokens, typography, spacing, and component patterns for internal tools/dashboards. Use when styling any internal tool/dashboard/admin page: applying the brand blue palette, Inter/JetBrains Mono typography, badges, tables, panels, buttons, modals, toasts, stat cards. Triggers: 'onehub brand', 'onehub design', 'match onehub style', 'corporate theme', 'internal tool theme'."
---
# QC OneHub Brand Design System

Design tokens for internal tools/dashboards — palette, type scale, and
component look for consistent enterprise internal tooling styling.

## When to Apply

- Building or restyling an internal tool/dashboard/admin page
- Asked to "match onehub style", "onehub brand", "corporate theme", or
  reference the standard internal tool look
- Choosing colors/typography for enterprise internal tooling in this org

## Typography

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&subset=vietnamese&display=swap');
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');

--font-sans: 'Inter', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
```

- Body text: 14px, line-height 1.55, weight 400, `font-feature-settings: 'cv11', 'ss01', 'ss03'`.
- Use `--font-mono` for: labels/eyebrows (uppercase, letter-spacing 0.12–0.14em,
  10–11px), badges, table headers, HTTP method tokens, copy buttons.
- Use `--font-sans` for everything else (body, buttons, inputs, panel titles).
- Headings use tight letter-spacing (`-0.02em` to `-0.03em`) at heavier weights (700–800).

## Color Tokens

```css
:root {
  /* Surfaces */
  --bg: #F2F2F2;
  --bg-2: #E8E8E8;
  --surface: #FFFFFF;
  --surface-2: #FAFAFA;

  /* Text */
  --ink: #231F20;
  --ink-2: #3A3638;
  --muted: #5E5C62;
  --dim: #8A8890;
  --faint: #B0AEB4;

  /* Borders */
  --border: #E4E4E4;
  --border-strong: #CFCFCF;
  --rule: #EDEDED;

  /* Brand — primary blue */
  --brand: #0066B3;
  --brand-dark: #004F8C;
  --brand-darker: #003366;
  --brand-soft: #E6F0F8;
  --brand-tint: rgba(0, 102, 179, 0.10);

  /* Accents */
  --accent-orange: #F47920;
  --accent-yellow: #FDB913;
  --accent-red: #ED1C24;   /* alerts/promo only, not decorative */

  /* Semantic */
  --ok: #2E8B3D;      --ok-soft: #E8F5EA;
  --warn: #F47920;    --warn-soft: #FDEFE2;
  --err: #ED1C24;     --err-soft: #FCE8E9;
  --info: #0066B3;    --info-soft: #E6F0F8;
  --purple: #5E2B97;  --purple-soft: #EFE7F7;
}
```

Rules:
- `--brand` (`#0066B3`, primary blue) is the only color for primary actions,
  links, focus rings, and active nav state.
- `--accent-red` is reserved for genuine alerts/errors — never used decoratively.
- Dark surfaces (footers, selection bars, toasts) use `--ink` (`#231F20`), not black.

## Shape & Elevation

```css
--radius: 6px;
--radius-sm: 4px;
--shadow-sm: 0 1px 2px rgba(10, 10, 11, 0.04);
--shadow: 0 1px 3px rgba(10, 10, 11, 0.06), 0 1px 2px rgba(10, 10, 11, 0.04);
--shadow-lg: 0 12px 32px -8px rgba(10, 10, 11, 0.16);
```

- Corporate top accent bar: 3px gradient strip at the very top of the page —
  `linear-gradient(90deg, var(--brand) 0%, var(--brand-darker) 60%, var(--brand) 100%)`.
- Cards/panels: 1px `--border`, `--radius` (6px), `--shadow-sm` at rest,
  `--shadow` + 1px `translateY` lift on hover, transition 0.12–0.15s.
- Focus ring pattern (inputs, selects, comboboxes): `border-color: var(--brand)`
  + `box-shadow: 0 0 0 3px var(--brand-tint)`.

## Component Patterns

**Buttons**
- `.btn.primary`: `--brand` bg, white text, subtle inset highlight shadow;
  hover → `--brand-dark` + stronger shadow; active → `translateY(1px)`.
- `.btn.ghost`: white bg, `--border-strong` border; hover → `--brand` border/text
  + `--brand-soft` bg.
- Font-weight 600, 13px, `letter-spacing: -0.005em`, `border-radius: var(--radius)`.

**App Header** (`.app-header`) — corporate header pattern, ref: CP4I API
Registry (n8n-mb.vib internal tool)
- Layout: `grid-template-columns: 1fr auto` — brand block left, control
  (env/app selector) right, `gap: 32px`, `padding: 22px max(32px,3vw) 20px`.
- `.app-header-logo`: 54×54px square tile, `--brand` bg, white bold initials
  (19px), `border-radius: var(--radius)`, soft glow shadow
  (`0 6px 18px -4px var(--brand-tint)`) + diagonal white-gradient sheen
  overlay for depth.
- `.app-header-title`: 24px/800/`-0.028em` tracking; wrap the accent word in
  `<em>` (styled non-italic, `--brand` color) — e.g. `OneHub <em>CI/CD
  Console</em>`.
- `.app-header-sub`: mono 12px uppercase breadcrumb-style subtitle, segments
  in `--muted` bold, separated by `<span class="sep">·</span>` dots colored
  `--brand`.
- Pair with `.context-banner` directly below (warn-soft bg, circular `!`
  icon, switches to `.ok` variant with `✓` once context is selected) and
  `.tabs-underline` (2px bottom-border active state) for the nav row.
- Use `.app-header` instead of `.navbar` when the page needs a heavier,
  more formal identity block (single-app internal tools, admin consoles)
  rather than a persistent multi-page pill nav.

**Navbar** (`.navbar`) — lighter alternative
- Pill-style active nav-link (`--brand-soft` bg) instead of underline.
- Prefer for apps with many top-level sections/pages navigated frequently.

**Sidebar layout** (`.sidebar` + `.app-shell`) — persistent left nav, ref:
`demo/sidebar-layout.html`
- Shell markup: `.app-shell` (flex row) > `.sidebar` (220px, sticky,
  `overflow-y: auto`) + `.content-area` (flex column) > `.content-header`
  (the "topbar", height locked to 97px to match `.app-header`) +
  `.content-body`.
- `.content-header` needs `flex-shrink: 0` — without it, a flex column with
  a growing sibling (`.content-body { flex: 1 }`) shrinks the header below
  its set height once content overflows the viewport.
- `.sidebar-brand` (logo tile + wordmark) is also locked to `height: 97px`
  so its bottom border lines up with `.content-header`'s. It needs
  `margin-top: -12px` to cancel out `.sidebar`'s own `padding: 12px 8px` —
  without that offset the brand row sits 12px lower than the topbar even
  though both report the same computed height.
- `.sidebar-footer` (margin-top: auto pins it to the bottom) holds
  `.sidebar-footer-row` (avatar + name/role + `.sidebar-collapse-btn`) and
  `.sidebar-quota-bar` (label/pct header + track/fill). The avatar wraps a
  `.quota-ring` (SVG circle, `stroke-dashoffset` animates with usage) via
  `.sidebar-user-avatar-wrap`.
- Quota color tiers (both ring and bar) — apply `.tier-warn`/`.tier-err` at
  >60%/>85% usage, no class = ok/green. Drive both from one JS call (see
  `setQuota()` in `demo/sidebar-layout.html`) so the ring, bar, %, and
  tooltip stay in sync.
- `.sidebar-link .count` — right-aligned pill badge for item counts (e.g.
  active pipeline count next to "Pipelines").
- Collapsed state: toggle `.sidebar.collapsed` (JS: `classList.toggle`).
  Width drops to 60px, labels/text hide, only icons + collapse button
  remain; the quota bar hides in favor of a hover tooltip on the avatar.
- Mobile (`@media max-width: 860px`): sidebar becomes an off-canvas drawer
  (`position: fixed`, `translateX(-100%)`), toggled via `.sidebar.mobile-open`
  from a `.mobile-menu-btn` (hidden above the breakpoint).
- Use `.app-shell`/`.sidebar` instead of `.app-header`/`.navbar` when the
  page needs a persistent multi-section left nav (dashboards with 5+
  sections) rather than a single-page identity header.

**Badges** (`--font-mono`, 10px, uppercase, letter-spacing 0.05em, weight 700)
- green/yellow/red/blue/gray variants pair a `*-soft` background with the
  matching solid text color and a low-alpha border of the same hue.

**Tables**
- Header row: `--surface-2` bg, mono uppercase 10px labels in `--dim`.
- Row states: `row-active` → `--ok-soft` bg + `inset 2px 0 0 var(--ok)` left
  bar; `row-pending` → same pattern with `--warn`.
- HTTP method tokens (GET/POST/PUT/DELETE/PATCH) are colored + mono, mapped to
  info/ok/warn/err/purple respectively.

**Stat cards**
- White surface, top border reveals `--brand` as a 2px underline on hover
  (`scaleX` transform transition).
- Mono uppercase label (10px) above a large tabular-nums value (32px, weight 700).

**Modals / Toasts**
- Modal overlay: `rgba(10,10,11,0.45)` + `backdrop-filter: blur(4px)`.
- `.modal-close` is 44×44px (touch-target minimum) and needs `aria-label`.
- Toast: fixed `--inverse-bg`/`--inverse-ink` (NOT `--ink`, which flips to
  near-white in dark mode and breaks contrast), 3px left accent border
  (`--brand`/`--ok`/`--err` by type), slide-up entrance. Set
  `role="alert" aria-live="assertive"` for error toasts, `role="status"
  aria-live="polite"` for others — screen readers must announce them.

**Combo (searchable dropdown)**
- `.combo` > `.combo-trigger` (button) + `.combo-panel` (search input +
  `.combo-option` list), toggled via `.combo.open`. Ref: CP4I API Registry
  app-selector.
- Use over a plain `<select>` when the option list is long/searchable
  (pipeline picker, app picker) — plain `<select>` still wins for short
  static lists (environment, HTTP method).

**Selection bar** (`.selection-bar`) — fixed-bottom bulk-action bar, shown
when rows are checked in a table. Dark `--inverse-bg` surface, `--brand` top
border, slides in/out via `.hidden`.

**Log console** (`.log-console`) — terminal-style output for a Logs tab.
Fixed-dark surface (`--inverse-bg`) regardless of theme, mono font,
`.log-line.info/.ok/.warn/.err` color the level tag.

**Pipeline steps** (`.pipeline-steps`) — vertical stage tracker for a
Pipeline/Deploy tab. `.pipeline-step.done/.active/.error` color the step dot;
connector line between dots via `::before`.

**Motion**
- Page sections fade in on load (`opacity` only, staggered ~0.04s per item) —
  avoid transform-based reveal so descendants can still use `position: fixed`
  (selection bars, modals).
- Interactive transitions: 0.08–0.18s ease, nothing slower than ~0.35s.
- `@media (prefers-reduced-motion: reduce)` in `tokens.css` collapses all
  animation/transition durations to near-zero — don't rely on motion alone
  to convey state.

## Dark Mode

Tokens include both `prefers-color-scheme: dark` (auto) and `.dark`/`.light`
classes on `<html>` (manual toggle — `.light` force-overrides an OS-dark
media query, same specificity as `:root`, later in source wins). Brand blue
shifts to `#3B8FD4`, surfaces go near-black, shadows are heavier — everything
else maps 1:1. See `assets/tokens.css`.

Surfaces that must stay dark-on-white in *both* themes (toast, log console,
selection bar) use fixed `--inverse-bg`/`--inverse-ink` tokens instead of
`--ink`/`#fff` — `--ink` itself flips to near-white in dark mode.

## Accessibility

- `--dim` was `#8A8890`/`#6E6C74` (light/dark) — failed WCAG AA text contrast
  (3.49:1 / 3.28:1). Now `#6E6C73`/`#8C8A92` (~5.1:1 / ~5.6:1). Re-check any
  new token tweaks against a 4.5:1 minimum for text use.
- Icon-only buttons (`.modal-close`, etc.) need `aria-label`.
- Toasts need `role`/`aria-live` (see above) — set at DOM-insertion time.

## Charts

No chart lib is bundled — canvas/SVG chart libs don't read CSS custom
properties directly, so pull token values via `getComputedStyle` into the
lib's JS config instead of hardcoding hex.

| Use case (CI/CD dashboard) | Chart type | Library |
|---|---|---|
| Build/deploy trend over time | Line / Area | Chart.js, ApexCharts |
| Compare pipelines/environments | Bar (horizontal or vertical) | Chart.js, ApexCharts |
| Success rate vs target | Gauge or Bullet | ApexCharts, D3.js |
| Status breakdown (ok/warn/err share) | Donut (avoid Pie if >5 slices) | Chart.js, ApexCharts |
| Deploy history cumulative | Waterfall | ApexCharts, Highcharts |
| Multi-metric comparison (CPU/mem/latency) | Radar | Chart.js, ApexCharts |

Default pick: **ApexCharts** — covers all rows above, theming via JS config
(no build step, works in a plain `<script>` tag same as this demo).
`Chart.js` is the lighter alternative if only line/bar/donut are needed.
`D3.js` only if a chart type above isn't natively supported by either.

```js
// Pull brand tokens for chart colors instead of hardcoding hex
const css = getComputedStyle(document.documentElement);
const brand = css.getPropertyValue('--brand').trim();
const ok = css.getPropertyValue('--ok').trim();
const err = css.getPropertyValue('--err').trim();
// re-read on theme toggle — chart libs don't auto-update on CSS var change
```

- Grid lines: `--rule`. Axis labels: `--dim`, `font-family: var(--font-mono)`, 10–11px uppercase.
- Series colors: `--brand` primary, `--ok`/`--warn`/`--err`/`--purple` for status series — same semantic mapping as badges.
- Re-render (or re-read colors and `chart.updateOptions()`) on the dark-mode toggle click — tokens change but the chart canvas won't repaint itself.

## Assets

| File | Purpose |
|---|---|
| `assets/tokens.css` | Design tokens + base reset + dark mode + reduced-motion |
| `assets/components.css` | All component classes (buttons, badges, tables, cards, modals, toasts, navbar, app header, sidebar + app shell, forms, combo, selection bar, log console, pipeline steps) |
| `demo/index.html` | Live preview of every component — open in browser, toggle dark mode |
| `demo/loading.html` | Loading-state patterns: spinners, skeletons, progress bars, overlays |
| `demo/pipeline-logs.html` | Expandable pipeline steps with inline/shared log panels (vertical + horizontal) |
| `demo/sidebar-layout.html` | Full sidebar + content-area page shell, collapsed/mobile states, user quota widget |

## Applying to a Next.js / Tailwind App

1. Add the two `@import` font URLs (Inter + JetBrains Mono) to the top of the
   global stylesheet.
2. Map the CSS custom properties above into the app's existing token file
   (e.g. `globals.css`), replacing `--font-sans`/`--font-mono` and any
   brand/status color variables 1:1 — keep existing variable *names* if the
   app already has a token system, just swap the *values*.
3. Do not introduce new one-off hex colors in components — always reference
   the semantic tokens (`--ok`, `--warn`, `--err`, `--brand`, etc.) so theme
   changes stay centralized.
