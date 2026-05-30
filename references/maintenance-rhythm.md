# Maintenance Rhythm

The board only stays useful if it's cheap to keep current. The whole point is a **30-second daily
glance** plus a **periodic full refresh**. These conventions come from the proven original.

## Cadence table

| Frequency | Action |
|---|---|
| **Each morning, 30s** | Look at the NOW column → start the first thing immediately. Don't re-plan, just act. |
| **Each evening, 30s** | Tick / restatus NOW cards (`done:true`). Don't backfill yesterday's misses — just move them to today. |
| **End of each period** (Sun, or sprint/month end) | Full-page refresh — see the checklist below. |
| **Deadline enters the 7-day window** | Promote it from `timeline[]` into a NOW/WEEK card. |
| **Launched something awaiting a reply** | Add a row to `tracking[]`. |
| **Something reaches a terminal state** | Mark `tracking[].closed = true` (or remove the card). |

## The full-refresh checklist — Refresh mode

Do this at the end of each period (the original does it every Sunday after writing the next week's plan):

1. **Ground in reality.** Read the user's actual plan/status/project files first. The board is a
   *view*, not the source of truth for what got done — verify done-vs-slipped against reality, not memory.
2. **Bump `meta`** — new `today`, `period`, `periodRange`, `periodDay`, `periodDayName`, and rewrite
   `focus` to the single most important thing for the new period.
3. **Roll the three columns:**
   - **NOW** → clear. Finished work gets deleted or kept as `done:true` to show momentum.
   - **WEEK** → archive finished; carry slipped items forward and **say they slipped** (honesty beats a clean-looking board).
   - **NEXT / LATER** → promote now-in-scope items up into WEEK; let the rest roll forward.
4. **Advance the timeline** — move the `today` marker's date; promote any deadline now within 7 days.
5. **Rewrite `notNow[]`** for the new period — explicitly cut what you're choosing not to do, so you
   stop re-litigating it. Re-check `redlines[]` still hold.
6. **Mirror to `.md`** if a markdown twin exists, so both stay in sync.

## Principles that keep it from rotting

- **Fits one screen** — if the board no longer fits one screen, that's a signal to cut, not to scroll. Archive
  done items, collapse finished tracks, move detail into `meta`.
- **Reality-calibrated** — refresh from actual files/state, never from what you *think* happened.
- **Deadlines first** — hard deadlines inside the window live at the top (NOW).
- **Dare to mark NOT NOW** — the list of things you're *not* doing is as load-bearing as the to-do list.
- **slip honestly** — a carried-over task keeps its history ("Wed slip → Thu"); don't silently reset it.

## Staleness signal

If `DATA.meta.today` drifts from the real date, the page shows a red banner automatically. Treat that
banner as the prompt to run a Refresh. (The original also wired a statusline/hook warning after 5 days
without an update — see `customization.md` if the user wants that.)
