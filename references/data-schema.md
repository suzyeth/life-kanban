# DATA Block Schema

The entire board is one JS object, `DATA`, at the top of `board.html`. Editing the board = editing
this object. The render script below it is generic. Everything is HTML-escaped at render via `esc()`,
so plain text in any string field is safe.

```js
const DATA = {
  meta: { ... },
  nav: [ ... ],              // optional — multi-board sub-page links
  goals: [ ... ],            // optional — goal hierarchy (cards link via goal:"id")
  tracks: [ ... ],
  progress: { ... },
  now:  [ card, ... ],
  week: [ card, ... ],
  next: [ card, ... ],
  timeline: [ event, ... ],
  tracking: [ item, ... ],   // optional
  trackingTitle: "...",      // optional
  notNow: [ "...", ... ],
  redlines: [ "...", ... ],
  archive: [ entry, ... ],   // optional — history ledger (written by Refresh)
  archiveCap: 12,
  nextFoldAfter: 8,          // optional — NEXT cards beyond this fold behind a "show N more" toggle (default 8)
};
```

---

## `meta` (object) — header + current period

| Field | Type | Default | Notes |
|---|---|---|---|
| `title` | string | board name | Shown in `<h1>` and `<title>`. |
| `today` | `YYYY-MM-DD` | real today | If ≠ actual today, a red stale banner appears. |
| `period` | string | `"W1"` | Period label — week, sprint, or month; your choice. |
| `periodRange` | string | — | e.g. `"2026-01-01 → 01-07"`. Display only. |
| `periodDay` | number | `1` | Day index within the period (1-based). |
| `periodDayName` | string | `"Mon"` | Short weekday. |
| `focus` | string | — | **The one-line headline focus.** Shows in the P0 pill. |

## `nav` (array, optional) — multi-board sub-page links

Renders a chip row under the header linking sibling boards (e.g. a main board + Work + Life boards).
Hidden when empty. Each board is its own HTML file sharing `dashboard.css` + `dashboard-utils.js`.

| Field | Type | Notes |
|---|---|---|
| `label` | string | Chip text, e.g. `"🟦 Work board"`. |
| `href` | string | Filename of the sibling board, e.g. `"work.html"`. The chip auto-marks `.current` when the filename matches the open page. |

## `goals` (array, optional) — goal hierarchy

The "why" behind tasks. Renders a 🎯 strip with a progress bar per goal; clicking a goal filters to its
cards (reuses the track-filter mechanism). Empty `[]` → hidden.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Join key — cards reference it via `goal: "<id>"`. |
| `title` | string | Shown in the chip + on linked cards' 🎯 pill. |
| `horizon` | string | e.g. `"This month"`, `"Q2"` — shown on hover. |
| `why` | string | The motivation — shown on hover. |
| `progress` | number \| null | `null` → auto-computed from linked cards' done ratio; `0-100` overrides. |

## `tracks` (array) — color categories (data-driven)

Each entry creates one color (card left-border + badge) and one legend filter chip. Add a track =
append one object. Card `track` fields must match an `id` here exactly.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Used as `track: "<id>"` on cards and the CSS class `track-<id>`. Keep it ascii/kebab. |
| `label` | string | Shown in the badge and legend. |
| `color` | hex `#rrggbb` | Border + badge color; legend count tint. Injected as CSS at runtime. |
| `emoji` | string | Optional legend prefix. |

Default set: `work 🟦 #58a6ff` · `learn 🟩 #3fb950` · `project 🟧 #f0883e` · `life 🌸 #ec4899` ·
`system ⬛ #8b949e`. See `customization.md` for swapping these.

## `progress` (object) — hero progress bar

| Field | Type | Default | Notes |
|---|---|---|---|
| `label` | string | — | Bar label. |
| `pct` | number \| null | `null` | `null` → auto-computed from `week[]` done ratio. A number overrides. |
| `detail` | string | — | One-line status under the bar. |

---

## Card schema — `now[]`, `week[]`, `next[]`

One task = one card. The only difference between the three columns is the **time field name**.

| Field | Type | Required | Notes |
|---|---|---|---|
| `time` | string | now[] only | Time slot, e.g. `"AM ⭐"`, `"21-22"`, `"✅ done"`. |
| `day` | string | week[] only | Plan day, e.g. `"Mon"`, `"Wed ✅"`. |
| `when` | string | next[] only | Window, e.g. `"Next period"`, `"W23+"`, `"🦘 Filler"`. |
| `title` | string | ✅ | Short, scannable. The headline of the card. |
| `track` | string | ✅ | Must match a `tracks[].id`. Drives color. |
| `meta` | string | — | Expandable detail (click to expand on non-star cards). `\n` allowed. |
| `tag` | `"P0"`\|`"P1"`\|`"P2"` | — | Priority chip (red/yellow/blue). |
| `star` | boolean | — | ⭐ highlight; star cards show `meta` always + can't collapse. |
| `done` | boolean | — | Strike-through + auto-hidden under 👁️ toggle. Counts toward progress. |
| `action` | string | — | Verb for the badge when not a project, e.g. `do`/`learn`/`write`/`review`. Badge = `label·action`. |
| `subject` | string | — | For project-type cards: emoji+name, e.g. `"🎯 Gacha"`. Badge = `label subject` (overrides action). |
| `due` | `YYYY-MM-DD` | — | Optional due date. While not done: past → red `overdue` outline + chip; today/≤7d → amber "soon" chip; counted in the NOW today-summary line. |
| `goal` | string | — | Optional link to a `goals[].id`. Shows a 🎯 pill and counts toward that goal's auto progress. Click a goal chip to filter to its cards. |
| `repeat` | string | — | Optional recurrence (`"weekly"` / `"Mon,Wed,Fri"` / `"monthly"`). Shows a ↻ badge; Refresh regenerates the card into the next period instead of dropping it. |
| `id` | string | — | Optional **stable key** for the browser overlay (check/drag persistence). If omitted, the key is derived as `track\|title` (with `#n` on duplicates). Add an explicit `id` if you plan to rename a card's title but keep its in-browser state. |

Badge rendering: `subject` wins → else `action` → else just the track `label`.

---

## `timeline` (array) — long-range gantt (log scale, near-term magnified)

| Field | Type | Notes |
|---|---|---|
| `date` | `YYYY-MM-DD` | Position on the axis. Sorted ascending automatically. |
| `label` | string | Short label on the dot. |
| `type` | `today`\|`milestone`\|`deadline`\|`visa` | Dot color + detail badge. `today`=accent, `milestone`=blue, `deadline`=red, `visa`=purple. |
| `detail` | string | Full description in the expandable detail list + auto countdown. |

## `tracking` (array, optional) — generic "launched, awaiting" list

Auto-shows only when non-empty. Generalizes any "in-flight" tracker (job applications, sent emails,
pending requests). Day-count colors via `daysClass` (≤7 fresh / ≤14 warm / >14 stale).

| Field | Type | Notes |
|---|---|---|
| `title` | string | Main label. |
| `sub` | string | Subtitle / role / context. |
| `date` | `YYYY-MM-DD` | Start/launch date → drives the `Nd` day counter. |
| `status` | string | Status badge text. |
| `track` | string | Optional; lets the legend filter cover it too. |
| `closed` | boolean | Terminal state → dimmed, struck through, hidden under 👁️ toggle. |

Set `trackingTitle` to rename the section header (default `"📬 In-flight"`).

## `notNow` (string[]) and `redlines` (string[])

- `notNow` — explicit "not doing this period" chips. Listing them prevents re-deciding.
- `redlines` — cross-period hard constraints, always applicable. Rendered with a ⛔ prefix.

---

## Browser overlay (localStorage) vs the file

The board supports **in-browser editing** (tick a card's ☑, drag cards between/within columns, or
**+ Add card** inline per column) without touching the file. These edits are an **overlay** stored in
`localStorage` under `lk:<title>:overlay` — they never mutate the `DATA` block. On load the file is the
base; the overlay is layered on top: `done` (per-card), `col` (column membership), `order` (per-column
ordering), and `added` (new cards created in-browser; deletable via the ✕). Added cards get baked into
the right column array on **📤 Copy latest DATA**.

- The `DATA` block remains the **single source of truth for structure**. The overlay is ephemeral
  daily state.
- A **sync banner** appears whenever the overlay differs from the file. It offers:
  - **📤 Copy latest DATA** — reconstructs the full `DATA` (file + overlay applied) and copies it as a
    valid `const DATA = {…};` literal. Paste it over the file's `DATA` block to **commit** the changes.
  - **↺ Reset local changes** — discards the overlay, reverting to the file.
- **Key stability:** the overlay maps to cards by `id` (or derived `track|title`). Renaming a title
  without an `id` orphans that card's overlay entry. When the skill does a Refresh/Edit, prefer baking
  in pending overlay changes first (ask the user to hit 📤 Copy latest DATA, or read the banner state).
- Theme choice (`lk:theme`) is also persisted in `localStorage`, independent of the overlay.

## `archive` (array, optional) — history ledger

The board's memory. **Refresh mode** prepends one entry per closed period *before* clearing NOW/WEEK
(see SKILL.md Step 4). Newest first. A brand-new board has `archive: []`. Rendered as a collapsed
**📒 Review log** with a completion-rate trend bar and a neglected-track warning. `archiveCap` (default
12) caps how many render; spill older entries to `review-log.md`.

| Field | Type | Notes |
|---|---|---|
| `period` | string | e.g. `"W22"` — also the trend-bar label. |
| `range` | string | e.g. `"2026-05-25 → 05-31"`. |
| `done` / `planned` | number | Completion = `done/planned` → the trend %. |
| `byTrack` | object | `{trackId: "done/total"}`, e.g. `{work:"5/7", life:"0/2"}`. Drives the per-period mix + the neglect warning (a track with `0/…` for ≥2 of the last 3 periods is flagged). |
| `focus` | string | The period's P0, for context. |
| `shipped` | string[] | Titles that got done (evidence). |
| `slipped` | string[] | WEEK items not done (honesty — don't drop silently). |
| `retro` | string | One reflection line captured at Refresh ("what went well / slipped & why / one change"). |

The ledger is **render-only** in the browser — entries are created by the skill's Refresh, never by
the localStorage overlay. It's plain `DATA`, so it stays single-file, zero-dep, and git-versioned.

## Edge cases & gotchas

- **Trailing commas / unescaped quotes** in `DATA` break the whole render (blank page). After editing,
  open in browser and check the console. Prefer `"…"` strings; escape inner quotes or use `'…'`.
- **`track` typos** render an uncolored card silently — verify against `tracks[].id`.
- **Bare dates** are parsed with `T12:00:00` to dodge UTC-midnight timezone off-by-one; always use
  `YYYY-MM-DD`.
- **Progress auto-mode** counts `week[]` done ratio only — not NOW/NEXT. Set `progress.pct` to override.
