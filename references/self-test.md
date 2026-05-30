# Self-Test (smoke test)

Run this after editing any asset (`kanban-template.html`, `dashboard.css`, `dashboard-utils.js`) to
confirm a generated board still renders. It's the exact check used when the skill was built. ~1 minute.

> **Prefer the automated tests.** `npm install && npm test` runs the Playwright suite in
> `tests/board.spec.mjs` (also on every push via `.github/workflows/ci.yml`) and covers everything
> below plus drag-to-column and the sync overlay. This manual recipe is the fallback when Node /
> Playwright isn't available.

## 1. Serve the assets

The template uses relative `href`/`src`, so serve the `assets/` dir over HTTP (double-clicking the raw
`kanban-template.html` from `file://` also works, since there are no fetch/CORS calls — but a server is
cleaner for the eval probes below). Any static server works:

```
python -m http.server 8753 --directory <skill>/assets
```

Then load `http://localhost:8753/kanban-template.html`.

(In Claude Code: add a `kanban-template` entry to `.claude/launch.json` pointing
`--directory` at the assets folder, `preview_start` it, then navigate via `preview_eval`.)

## 2. Assert the render (DOM probe)

Run this in the page console / `preview_eval`. **All checks must pass:**

```js
(function(){
  const r = {
    legendChips:   document.querySelectorAll('#legend .legend-chip').length,   // expect tracks.length + 2 (All + 👁️)
    trackStyle:    !!document.getElementById('track-styles'),                  // dynamic track CSS injected
    cardBorder:    getComputedStyle(document.querySelector('#now-list .card')).borderLeftColor, // non-default = track color applied
    nowCards:      document.querySelectorAll('#now-list .card').length   > 0,
    weekCards:     document.querySelectorAll('#week-list .card').length  > 0,
    nextCards:     document.querySelectorAll('#next-list .card').length  > 0,
    timeline:      document.querySelectorAll('#timeline .tl-event').length > 0,
    timelineRows:  document.querySelectorAll('#timeline-detail .tl-row').length > 0,
    notNow:        document.querySelectorAll('#not-now .chip').length    > 0,
    redlines:      document.querySelectorAll('#redlines li').length      > 0,
  };
  // interactions
  document.querySelector('#legend .legend-chip[data-filter]:not([data-filter="all"])').click();
  r.filterHidesSome = [...document.querySelectorAll('.card')].some(c => c.classList.contains('filtered-out'));
  document.querySelector('#legend .legend-chip[data-filter="all"]').click();
  r.doneHiddenByDefault = getComputedStyle(document.querySelector('.card.done')).display === 'none';
  document.getElementById('toggle-done').click();
  r.doneToggleShows   = getComputedStyle(document.querySelector('.card.done')).display !== 'none';
  // toolbar / search / shortcuts
  r.toolbar = !!document.getElementById('search') && !!document.getElementById('copy-today');
  const s = document.getElementById('search');
  s.value = 'secondary'; s.dispatchEvent(new Event('input'));
  r.searchHidesSome = document.querySelectorAll('.card.search-hidden').length > 0;
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}));
  r.escClears = s.value === '' && document.querySelectorAll('.card.search-hidden').length === 0;
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'2'}));
  r.keyFilters = document.querySelector('.legend-chip.active').dataset.filter !== 'all';
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'a'}));
  // overlay: checkbox tick → done + sync banner + localStorage
  const card0 = document.querySelector('#now-list .card');
  r.cardsHaveKey = !!card0.dataset.key && card0.getAttribute('draggable') === 'true';
  card0.querySelector('.chk').click();
  r.tickMakesDone = [...document.querySelectorAll('.card')].some(c => c.dataset.key === card0.dataset.key && c.classList.contains('done'));
  r.bannerShows = document.getElementById('sync-banner').style.display !== 'none';
  r.overlayPersisted = !!Object.keys(localStorage).find(k => k.includes(':overlay'));
  // theme toggle
  document.getElementById('theme-toggle').click();
  r.themeLight = document.documentElement.classList.contains('light');
  document.getElementById('theme-toggle').click();
  // reset overlay (stub confirm)
  const _c = window.confirm; window.confirm = () => true;
  document.getElementById('sync-reset').click(); window.confirm = _c;
  r.resetClears = document.getElementById('sync-banner').style.display === 'none';
  return r;
})()
```

(For the search probe to hide something, use a needle present in the data, e.g. `secondary`. With the
raw template's placeholder cards, swap in a word that appears there.)

**Expected:** `trackStyle` true · `cardBorder` is a real color (not `rgb(0,0,0)`/transparent) · all
`*Cards`/`timeline*`/`notNow`/`redlines` true · `filterHidesSome` true · `doneHiddenByDefault` true ·
`doneToggleShows` true · `toolbar` true · `searchHidesSome` true · `escClears` true · `keyFilters` true ·
`cardsHaveKey` true · `tickMakesDone` true · `bannerShows` true · `overlayPersisted` true · `themeLight` true · `resetClears` true.

(Drag-and-drop isn't covered by this DOM probe — verify it manually, or simulate via
`card.dispatchEvent(new DragEvent('dragstart',{bubbles:true}))` then a `drop` DragEvent on a column's
`.col`, and check `ov.col[key]` in `localStorage` + the card moved lists.)

## 3. Console must be clean

Check console for errors. A broken `DATA` block (trailing comma, unescaped quote) yields a blank page
and a parse error here — that's the #1 failure mode to catch.

## 4. Date banner is expected for the raw template

The shipped template's `meta.today` is a fixed placeholder date, so the red stale banner *will* show on
the raw template — that's correct behavior, not a failure. A real generated board sets `today` to the
actual date and shows no banner.

## Known tooling note

`preview_screenshot` may time out on some setups even when the page is fine; the DOM probe above is the
authoritative check, not the screenshot.
