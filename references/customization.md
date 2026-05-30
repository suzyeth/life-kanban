# Customization

The template renders out-of-the-box, but it's built to be reshaped per user. Everything visual is
driven by `DATA`; the render script and CSS rarely need touching.

## Tracks — the main lever

Tracks are **data-driven**. The render script reads `DATA.tracks` and injects, at runtime, the CSS for
each track's left-border color, badge color, and legend-chip tint. To change categories, edit only the
array:

```js
tracks: [
  { id: "work",    label: "Work",  color: "#58a6ff", emoji: "🟦" },
  { id: "learn",   label: "Learn", color: "#3fb950", emoji: "🟩" },
  // add / remove / rename freely
],
```

- **Add a track:** append one object. A new colored legend chip appears automatically, with its own
  filter and done/total count.
- **Remove a track:** delete it — but re-point any cards still using its `id`, or they render uncolored.
- **`id`** is the join key: cards say `track: "<id>"`, CSS class is `track-<id>`. Keep it ascii/kebab.
- **Color palette** (from the shared theme, good defaults): blue `#58a6ff`, green `#3fb950`,
  orange `#f0883e`, pink `#ec4899`, purple `#bc8cff`, grey `#8b949e`, yellow `#d29922`, red `#f85149`.
  Any `#rrggbb` works — `hexToRgba` derives the translucent badge background.

## Optional: the tracking table

`DATA.tracking[]` is a generic "launched, awaiting response" list (job applications, sent emails,
pending asks). The section is hidden until the array is non-empty. Rename its header with
`trackingTitle`. Day-count coloring: ≤7 fresh (green) / ≤14 warm (yellow) / >14 stale (red), via
`daysClass` in `dashboard-utils.js`.

## Optional: a custom metric module (e.g. health/finance tracking)

The original board had a bespoke **fitness-tracking** section (weight goal, pace vs expected, training streak).
That's an example of a custom module beyond the generic schema. To add one:

1. Add a data object to `DATA`, e.g. `health: { goal, baselineKg, currentKg, weekTrained, ... }`.
2. Add a `<section>` to the HTML body with placeholder ids.
3. Add a small render IIFE before the legend code that reads the data and fills those ids — compute
   progress as `(current - baseline) / goalDelta`, and a pace comparison `actualDelta - expectedDelta`
   (expected = elapsed-days-fraction × goal). Use `esc()` for any string injected via innerHTML.

Keep custom modules small and single-purpose; if one grows, give it its own sub-page.

## Multi-board (`DATA.nav`)

To run several linked boards (e.g. a main board + Work + Life boards), create one HTML file per board
(all sharing the same `dashboard.css` + `dashboard-utils.js` in the folder), and give each the same
`nav` array:

```js
nav: [
  { label: "📋 Main board", href: "board.html" },
  { label: "🟦 Work board", href: "work.html" },
  { label: "🌸 Life board", href: "life.html" },
],
```

The chip row renders under the header and auto-highlights the current page. Each board keeps its own
`DATA` (and its own `localStorage` overlay, keyed by `meta.title` — so use **distinct titles** per
board or their overlays will collide). When scaffolding multiple boards, copy the template once per
board and edit each one's `DATA`.

## Theme (light / dark)

Dark is default. The 🌗 toolbar button toggles `<html class="light">` and persists the choice in
`localStorage` (`lk:theme`). Light-theme variables live in `dashboard.css` under `html.light`; the
kanban template adds a couple of light overrides for the hero gradient and star-card background. To
change palettes, edit those CSS variable blocks.

## Optional: sub-pages

The original linked detail pages (job-search / mentor / fitness / timeline) via a `.subpage-nav` chip row,
each its own HTML file `<link>`-ing the same `dashboard.css` and `<script src>`-ing the same
`dashboard-utils.js`. To add one: create `<name>.html`, reuse the shared base, add a nav chip in the
header. The shared CSS already ships `.back`, `.stats`/`.stat`, and `section > h2` styles for these.

## Optional: markdown mirror

`assets/kanban-template.md` is a terminal-readable twin. If the user wants both, keep them in sync: every
Refresh updates both. The `.md` is hand-maintained (no render script), so it's a summary, not a
generated artifact — don't over-invest in keeping every card byte-identical, just the structure.

## Optional: period semantics

`meta.period` is just a label — use `W22` for weeks, `S3` for sprints, `2026-05` for months. The
progress bar auto-computes from `week[]` done ratio regardless; set `progress.pct` to override.

## Optional: stale-after-N-days nudge

The page already shows a red banner when `today` drifts. For an editor/statusline nudge, the user can
wire a hook that checks the file's `today` field against the system date — out of scope for the HTML
itself, but mentioned here because the original had it.
