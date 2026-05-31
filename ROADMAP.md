# Roadmap

Where life-kanban is headed, framed from the **life-management** (not code) angle.

## Thesis

The board today is excellent at **the present** — "what should I do right now?". Its gaps are almost
all about **the time dimension**: it has no memory of the past and no horizon on the future. The
optimization theme is therefore:

> **Give the board a memory (history / reflection) and a horizon (goals / recurrence / nudges).**

Constraints every solution must respect: **single HTML file · zero dependencies · the `DATA` block is
the source of truth · opens with a double-click (no server).**

## Gaps → solutions

| # | Gap (as a life-OS) | Concrete solution | Keeps constraints? |
|---|---|---|---|
| 1 | **No history / accountability** — Refresh clears the past, so you can't see if you actually did what you planned | `DATA.archive[]`: each Refresh snapshots planned/done/slipped + per-track done/total + focus + shipped/slipped lists *before* clearing. Render a collapsed **Review log** + a **completion-rate trend bar**. Spill entries beyond `archiveCap` into `review-log.md`. | ✅ data-only |
| 7 | **Review is mechanical, not reflective** | Refresh prompts for a one-line **retro**, stored on the archive entry; shown in the log. | ✅ |
| 6 | **No imbalance detection** | With history: flag any track that's been **0-done for N consecutive periods**; show a "this period's mix" line by NOW. | ✅ |
| 2 | **No recurring / habits** | (a) card `repeat: "weekly" / "Mon,Wed,Fri" / "monthly"` → Refresh regenerates it instead of dropping it. (b) optional `habits[]` (name + target + day-log) rendered as a streak grid. | ✅ data-only |
| 3 | **Tasks aren't linked to goals** | `goals: [{id, title, horizon, why, progress}]` + optional card `goal: "<id>"`. Render a **Goals strip** with auto progress (from linked cards' done ratio); clicking a goal filters its cards (reuses the track-filter mechanism). | ✅ data-only |
| 5 | **Passive — no reminders** | (a) in-board **attention strip** on open: "N days since refresh", "deadline in 3d", "X overdue". (b) the real proactive layer is **AI-side**: a scheduled skill run that reads the board each morning and produces a daily brief / deadline watch. | (a) ✅ (b) via scheduler |
| 4 | **Not mobile / not synced** | (a) responsive polish (sticky NOW, bigger tap targets, touch check/add). (b) true cross-device sync **conflicts with zero-dep / file-as-truth** → only as an **opt-in adapter** (point the localStorage overlay at a gist/GitHub file), default off. (c) fallback: the file lives in git → read-only on mobile via GitHub. | (a) ✅ (b) ⚠️ opt-in only |

## Keystone

`#1 history` unlocks `#6 imbalance`, `#7 reflection`, and a trend-aware Analyze mode — so they ship
together.

```
        ┌── #6 imbalance  (needs the trend)
#1 archive ┼── #7 retro      (lives on the archive entry)
        └── Analyze upgrade ("am I actually getting better?")
```

## Phases

| Phase | Scope | Why |
|---|---|---|
| **P1 — Memory** | #1 archive ledger + #7 retro + #6 imbalance + Analyze trends | one data structure unlocks three gaps; turns the board from a whiteboard into a ledger |
| **P2 — Horizon** | #3 goal hierarchy + #2 recurring (`repeat`) | tasks gain a "why"; covers the recurring nature of life |
| **P3 — Proactive & reachable** | #5 in-board attention strip + a scheduled daily-brief agent; #4 responsive polish | from passive to proactive; from desk to phone |
| **Won't do (as-is)** | #4 true cross-device sync | breaks zero-dependency; only viable as an explicit opt-in adapter |

## Non-goals

- Becoming a generic cloud kanban (that niche is saturated — Nullboard et al.).
- A backend / account / database. The file + git is the store.
