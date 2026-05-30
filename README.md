# life-kanban

A Claude Code skill for creating and maintaining a **single-file HTML personal kanban board** — a
"what should I look at / do right now" life + project dashboard.

## What it does

| Mode | Trigger | Result |
|---|---|---|
| **Create** | "做个看板" / no board exists | Scaffolds `看板.html` + `dashboard.css` + `dashboard-utils.js` from bundled templates, seeded with your real focus. |
| **Edit** | "加一项" / "打勾" / "挪到今天" / "删掉" | Small precise edits to the top `DATA` block (add/move/complete/remove cards). |
| **Refresh** | "复盘" / "刷新看板" / "进新的一周" | Full-page reset for a new period — rolls columns, advances timeline, rewrites focus & NOT-NOW. |
| **Analyze** | "汇总" / "现在啥情况" / "哪些落后了" | Reads the board and reports per-track counts, NOW load, slips, nearest deadline. |

## The board

One HTML file. The `DATA = {...}` block at the top is the **single source of truth**; the render
script below it is generic. Features:

- 3 columns — 🔥 NOW·今天 / 📅 本周 / ⏭ NEXT&LATER
- **Data-driven color tracks** (define categories in `DATA.tracks`, CSS injected at runtime)
- Auto progress bar (from `week[]` done ratio)
- Non-linear (log-scale) long-range timeline — near-term magnified
- Clickable legend filter + show/hide-done toggle
- NOT-NOW + redlines rails
- Optional: generic "in-flight tracking" table, markdown mirror, custom modules, sub-pages
- Dark GitHub theme, zero dependencies, opens by double-click

## Layout

```
life-kanban/
├── SKILL.md                       # workflow: detect mode → Create/Edit/Refresh/Analyze → verify
├── README.md
├── assets/
│   ├── kanban-template.html       # generic render-complete skeleton (copy, edit DATA)
│   ├── dashboard.css              # shared dark-theme base
│   ├── dashboard-utils.js         # esc / daysSince / daysClass / showDateWarning
│   └── kanban-template.md         # optional terminal-readable mirror
└── references/
    ├── data-schema.md             # full DATA field reference
    ├── maintenance-rhythm.md      # daily/weekly/deadline conventions + refresh checklist
    └── customization.md           # tracks, colors, optional modules, sub-pages
```

## Design principles

单页可读 · 现实校准 (refresh from real files, not memory) · deadline 优先 · 敢标 NOT NOW ·
slip honestly. See `references/maintenance-rhythm.md`.
