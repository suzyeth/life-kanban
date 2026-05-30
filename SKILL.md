---
name: life-kanban
description: >-
  Create and maintain a single-file HTML life/project-management kanban board — a personal
  "what should I look at / do right now" dashboard. Use when the user wants to make, open,
  update, or review a kanban / 看板 / 进度看板 / dashboard / 仪表盘 / focus board / task board;
  add / move / complete / remove a task or card; do a weekly (or sprint / monthly) review and
  refresh the whole board; or summarize and analyze board state (what's overdue, stale,
  done, slipping). Also triggers on "生成看板", "更新看板", "做个看板", "周日复盘",
  "把今天的任务排一下", "看板里加一项", "看板汇总", "track my tasks", "build a focus board",
  "我现在该做什么", "我的待办板", "理一下这周要做的事", "where am I / what should I do now".
  Generates a self-contained HTML file (dark theme, 3 columns: NOW / WEEK / NEXT+LATER,
  data-driven tracks, progress bar, log-scale timeline, NOT-NOW + redlines rails) whose top
  DATA block is the single source of truth, plus an optional markdown mirror.
---

# Life Kanban

A reusable tool for a **single-file personal kanban board**: one HTML file whose top `DATA`
block is the single source of truth. 3 columns (🔥 NOW·今天 / 📅 本周 / ⏭ NEXT&LATER),
data-driven color tracks, auto progress bar, a non-linear (log-scale) long-range timeline,
and NOT-NOW + redlines rails. Optional markdown mirror for terminal viewing.

Built-in viewing aids (no data-model impact): instant **search** box, **keyboard shortcuts**
(`/` search · `1-9` track filter · `a` all · `d` show/hide done · `p` print · `Esc` clear),
a **复制今天** button (NOW column → clipboard as plain text), and a **print stylesheet**
(`Ctrl/⌘+P` → clean light-theme PDF that expands all cards and ignores active filters).

**Core idea — edit data, never markup.** All board changes are edits to the `DATA = {...}`
object at the top of the HTML. The render script below it is generic and never needs touching.
This keeps every operation a small, safe, diff-able JS-object edit.

**Design principles** (carried from the proven original):
- **单页可读** — the whole board scrolls in one screen; if it overflows, cut/archive, don't pile.
- **现实校准** — when refreshing, ground the board in the user's *actual* files/状态, not memory.
- **deadline 优先** — anything with a hard deadline inside 7 days gets pushed to the NOW column.
- **敢标 NOT NOW** — explicitly listing what you're *not* doing prevents distraction.

---

## Step 1: Detect Mode and Target Board

Figure out **what the user wants** and **which board** to act on. Build the decision tree first.

### 1a. Detect the target board

**Probe with the `Glob` tool** (portable — never shell out; this runs on Windows/PowerShell, macOS,
and Linux identically). Run these patterns and read the results into the decision tree below:

| Probe | Glob pattern | Tells you |
|---|---|---|
| Existing board (named) | `**/看板.html` | The canonical board file. |
| Existing board (any) | `**/*{kanban,看板,board,dashboard}*.html` | Other candidate boards. |
| Assets already present | `<targetdir>/dashboard-utils.js` | Whether a board's shared assets are already there (don't re-copy/clobber). |
| Markdown mirror | `<targetdir>/看板.md` (or `*.md` twin) | Whether to keep a `.md` in sync. |

**Decision tree:**
1. User named an explicit path/file → that is the target board.
2. Exactly one board matches a Glob → use it.
3. Multiple boards match → **ask which one.** Never guess between two real boards.
4. No board matches → **Create mode** (Step 2).
5. Before any Create copy, check "assets already present": if `dashboard.css` / `dashboard-utils.js`
   already exist in the target dir, **reuse them** (only write the `.html`) — never overwrite a
   working asset.

### 1b. Classify the intent → mode

| User says… | Mode | Go to |
|---|---|---|
| "做个看板" / "新建" / no board exists | **Create** | Step 2 |
| "加一项" / "改成" / "打勾" / "完成了" / "挪到今天" / "删掉" | **Edit** | Step 3 |
| "复盘" / "刷新看板" / "周日整理" / "进新的一周" | **Refresh** | Step 4 |
| "汇总" / "分析" / "现在啥情况" / "哪些落后了" | **Analyze** | Step 5 |

If ambiguous, default to **Edit** for an existing board, **Create** if none exists. State the
chosen mode in one line before proceeding.

### 1c. Always do the date check first

Read `DATA.meta.today` and compare to the real today. If stale, note it — Refresh mode will fix
`today` / `period` / `periodDay`; other modes should at least flag it. The page itself shows a red
banner when `today` ≠ actual today (via `showDateWarning`).

---

## Defaults — never stall waiting for input

If the user omits something, use these and **state the assumption in your response** rather than
asking. The skill should always produce a working board.

| Parameter | Default if not provided | Rationale |
|---|---|---|
| Target directory | current working dir; if it looks like a repo root, a `Dashboard/` subfolder | Keeps the board near where the user works; mirrors the proven layout. |
| HTML filename | `看板.html` | Matches the original; what the user's muscle memory expects. |
| Board title (`__TITLE__`) | `"我的看板"` | Renders something sensible; trivial to rename later. |
| `tracks` | work🟦 / learn🟩 / project🟧 / life🌸 / system⬛ (template's 5) | Covers most life+work splits; easy to add/remove per `customization.md`. |
| `period` semantics | weekly (`W<n>`) | The original cadence; switch to sprint/month only if the user says so. |
| `meta.today` | the real current date | Avoids the stale red banner on first render. |
| Markdown mirror (`.md`) | skip unless the user wants a terminal view or one already exists | Avoids maintaining two sources for users who only use the HTML. |
| Column seeding | if the user described tasks, seed them; else keep example cards and **say they're placeholders** | Never ships an empty board, never pretends placeholders are real. |
| `notNow` / `redlines` | one placeholder line each if nothing given | Sections render; user fills later. |

---

## Step 2: Create a New Board

Scaffold a fresh board from the bundled template assets. **Never write the HTML/CSS/JS by hand** —
copy the assets, then edit only the `DATA` block.

1. **Copy the asset files** into the target directory (see the Defaults table for dir/filename). Per
   the Step 1 asset-presence probe, **skip any asset that already exists** — never clobber a working one:
   - `assets/dashboard.css` → `dashboard.css`
   - `assets/dashboard-utils.js` → `dashboard-utils.js`
   - `assets/kanban-template.html` → `看板.html` (or the user's preferred filename)
   - Optional: `assets/kanban-template.md` → `看板.md` (terminal mirror; default skip)
2. **Replace `__TITLE__`** in the HTML (and `.md`) with the user's board name (default `"我的看板"`).
3. **Set `DATA.meta`** — `today` (real today), `period` / `periodRange` / `periodDay` /
   `periodDayName`, and a one-line `focus` (the single most important thing this period).
4. **Define `DATA.tracks`** — ask or infer the user's life/work categories. Default to the 5 in the
   template (work / learn / project / life / system). Each track = one color + one legend chip.
   See `references/customization.md` for adding/removing tracks and picking colors.
5. **Seed the columns** — turn whatever the user described into `now[]`, `week[]`, `next[]` cards.
   Use the schema in `references/data-schema.md`. If they gave nothing, keep the example cards as
   placeholders and tell them so.
6. **Fill `notNow[]` and `redlines[]`** if the user mentioned things to explicitly avoid; otherwise
   leave one placeholder each.

**Exit gate:** the file opens in a browser with no console errors and renders the user's real focus
(not just placeholders). Verify per Step 6 before declaring done.

---

## Step 3: Edit Tasks (add / move / complete / remove)

All edits target the `DATA` block. Read the current board first, then make the smallest precise edit.

| Operation | What to change |
|---|---|
| **Add a card** | Append an object to `now[]` / `week[]` / `next[]`. Required: a time field (`time` for now, `day` for week, `when` for next) + `title` + `track`. Optional: `meta`, `tag` (`P0`/`P1`/`P2`), `star`, `action`, `subject`. |
| **Complete a card** | Set `done: true` on it (it strikes through + auto-hides under the 👁️ toggle). For dated columns, optionally prefix the time field with ✅. |
| **Move a card** | Cut the object from one column array, paste into the target. NOW↔WEEK↔NEXT are just three arrays. |
| **Edit a card** | Change its fields in place. Keep immutability discipline at the *file* level — rewrite the whole object cleanly rather than half-editing. |
| **Remove a card** | Delete the object from its array. |
| **Promote a deadline** | When a `timeline[]` deadline enters the 7-day window, also add a NOW/WEEK card for it. |
| **Tracking item** | For "already launched, waiting on a reply" things (applications, sent messages), add to `tracking[]` (`title`, `sub`, `date`, `status`, `track`, `closed?`). The section auto-shows when non-empty. |

Rules:
- One task = one card. Don't cram multiple actions into one title; split them.
- Keep `meta` as the expandable detail; keep `title` short and scannable.
- Match the existing track ids exactly — a typo'd `track` just renders uncolored.
- After editing, re-verify per Step 6 (the page must still render).

See `references/data-schema.md` for the full field reference and `references/maintenance-rhythm.md`
for when each kind of edit happens in the daily/weekly loop.

---

## Step 4: Refresh / Weekly Review (整页刷新)

The periodic "复盘" that resets the board for a new cycle. Follow `references/maintenance-rhythm.md`.

1. **Ground in reality first** — read the user's actual plan/status files (or ask) before rewriting.
   Don't refresh from memory. Confirm what *actually* got done vs slipped.
2. **Update `meta`** — new `today`, `period`, `periodRange`, `periodDay`, `periodDayName`, and a
   rewritten one-line `focus`.
3. **Roll the columns**:
   - NOW → clear out; completed items either archived (deleted) or moved down as `done:true`.
   - WEEK → archive finished, carry over slipped (mark honestly, don't silently drop).
   - NEXT/LATER → promote what's now in-scope into WEEK; let the rest roll forward.
4. **Timeline** — advance the `today` marker; promote any deadline now inside 7 days into a card.
5. **Refresh `notNow[]`** for the new cycle and re-check `redlines[]` still apply.
6. **Mirror to `.md`** if one exists, so the markdown stays同源.

**Exit gate:** board reflects the new period, `today` matches reality, slipped items are surfaced
(not hidden), and it still renders one-screen. Verify per Step 6.

---

## Step 5: Summarize / Analyze

Read the `DATA` block and report state. No file edits in this mode (unless the user then asks).

Compute and report:
1. **Per-track counts** — done/total for each track (the legend numbers).
2. **NOW load** — how many cards in today's column, how many starred (⭐), any P0s.
3. **Slip/stale signals** — `done:false` cards whose dated time field is in the past;
   `tracking[]` items with large day-counts (>14 = stale per `daysClass`).
4. **Timeline pressure** — nearest deadline and its countdown; anything overdue.
5. **NOT-NOW / redline sanity** — flag if something in NOW contradicts a redline.

Present as the scorecard in Step 6. Offer to act on the findings (e.g. "promote the overdue
deadline?") but don't edit unprompted.

---

## Step 6: Verify and Respond

### Verify (always, after any edit/create/refresh)
- The `DATA` block is valid JS (no trailing-comma/quote breakage). If unsure, open the file in the
  browser preview and check the console — a broken `DATA` block renders a blank page.
- `DATA.meta.today` matches the real today (or the red banner is expected/explained).
- Every card's `track` matches a defined `DATA.tracks` id.
- After editing the **template/CSS/JS assets** (not just a user's `DATA`), run the smoke test in
  `references/self-test.md` to confirm the board still renders and interactions work.

### Respond — use this structure
1. **Mode + target** — one line: what you did, to which file.
2. **What changed** — bullet list of the concrete card/section edits (or, for Analyze, the
   scorecard: per-track counts, NOW load, slips, nearest deadline).
3. **State of the board now** — NOW column at a glance + current `focus`.
4. **Open it** — clickable path to the `.html`, and the maintenance reminder relevant to the mode
   (e.g. "周日复盘时再 Refresh 一次").

---

## Reference Files

- `references/data-schema.md` — complete `DATA` block field reference: `meta`, `tracks`, `progress`,
  `now/week/next` card schema, `timeline`, `tracking`, `notNow`, `redlines`, with every field's type
  and default.
- `references/maintenance-rhythm.md` — the daily / weekly / deadline update conventions and the
  "整页刷新" review checklist.
- `references/customization.md` — adding/removing tracks, choosing colors, optional modules
  (tracking table, sub-pages, custom sections like health tracking), and how the dynamic track CSS
  injection works.
- `references/self-test.md` — a ~1-minute smoke test (serve assets → DOM-probe eval → clean console)
  to re-verify rendering after editing any asset. Run this whenever you change the template/CSS/JS.

## Assets

- `assets/kanban-template.html` — the generic, render-complete board skeleton (copy, then edit `DATA`).
- `assets/dashboard.css` — shared dark-theme base styles.
- `assets/dashboard-utils.js` — shared helpers (`esc`, `daysSince`, `daysClass`, `showDateWarning`).
- `assets/kanban-template.md` — optional terminal-readable markdown mirror.
