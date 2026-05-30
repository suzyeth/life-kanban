# DATA Block Schema

The entire board is one JS object, `DATA`, at the top of `看板.html`. Editing the board = editing
this object. The render script below it is generic. Everything is HTML-escaped at render via `esc()`,
so plain text in any string field is safe.

```js
const DATA = {
  meta: { ... },
  nav: [ ... ],              // optional — multi-board sub-page links
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

Renders a chip row under the header linking sibling boards (e.g. a main board + 工作板 + 生活板).
Hidden when empty. Each board is its own HTML file sharing `dashboard.css` + `dashboard-utils.js`.

| Field | Type | Notes |
|---|---|---|
| `label` | string | Chip text, e.g. `"🟦 工作板"`. |
| `href` | string | Filename of the sibling board, e.g. `"工作板.html"`. The chip auto-marks `.current` when the filename matches the open page. |

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
| `time` | string | now[] only | Time slot, e.g. `"上午 ⭐"`, `"晚 21-22"`, `"✅ 已完成"`. |
| `day` | string | week[] only | Plan day, e.g. `"Mon"`, `"Wed ✅"`. |
| `when` | string | next[] only | Window, e.g. `"下周期"`, `"W23+"`, `"🦘 Filler"`. |
| `title` | string | ✅ | Short, scannable. The headline of the card. |
| `track` | string | ✅ | Must match a `tracks[].id`. Drives color. |
| `meta` | string | — | Expandable detail (click to expand on non-star cards). `\n` allowed. |
| `tag` | `"P0"`\|`"P1"`\|`"P2"` | — | Priority chip (red/yellow/blue). |
| `star` | boolean | — | ⭐ highlight; star cards show `meta` always + can't collapse. |
| `done` | boolean | — | Strike-through + auto-hidden under 👁️ toggle. Counts toward progress. |
| `action` | string | — | Verb for the badge when not a project, e.g. `做`/`练`/`投`/`复盘`. Badge = `label·action`. |
| `subject` | string | — | For project-type cards: emoji+name, e.g. `"🎯 Gacha"`. Badge = `label subject` (overrides action). |
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

Set `trackingTitle` to rename the section header (default `"📬 在管跟进"`).

## `notNow` (string[]) and `redlines` (string[])

- `notNow` — explicit "not doing this period" chips. Listing them prevents re-deciding.
- `redlines` — cross-period hard constraints, always applicable. Rendered with a ⛔ prefix.

---

## Browser overlay (localStorage) vs the file

The board supports **in-browser editing** (tick a card's ☑, drag cards between/within columns)
without touching the file. These edits are an **overlay** stored in `localStorage` under
`lk:<title>:overlay` — they never mutate the `DATA` block. On load the file is the base; the overlay
is layered on top (done state, column membership, ordering).

- The `DATA` block remains the **single source of truth for structure**. The overlay is ephemeral
  daily state.
- A **sync banner** appears whenever the overlay differs from the file. It offers:
  - **📤 复制最新 DATA** — reconstructs the full `DATA` (file + overlay applied) and copies it as a
    valid `const DATA = {…};` literal. Paste it over the file's `DATA` block to **commit** the changes.
  - **↺ 清空本地改动** — discards the overlay, reverting to the file.
- **Key stability:** the overlay maps to cards by `id` (or derived `track|title`). Renaming a title
  without an `id` orphans that card's overlay entry. When the skill does a Refresh/Edit, prefer baking
  in pending overlay changes first (ask the user to hit 复制最新 DATA, or read the banner state).
- Theme choice (`lk:theme`) is also persisted in `localStorage`, independent of the overlay.

## Edge cases & gotchas

- **Trailing commas / unescaped quotes** in `DATA` break the whole render (blank page). After editing,
  open in browser and check the console. Prefer `"…"` strings; escape inner quotes or use `'…'`.
- **`track` typos** render an uncolored card silently — verify against `tracks[].id`.
- **Bare dates** are parsed with `T12:00:00` to dodge UTC-midnight timezone off-by-one; always use
  `YYYY-MM-DD`.
- **Progress auto-mode** counts `week[]` done ratio only — not NOW/NEXT. Set `progress.pct` to override.
