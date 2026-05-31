import { test, expect } from '@playwright/test';

// Drives the raw bundled template (kanban-template.html) — its example DATA has
// 2 NOW / 2 WEEK / 2 NEXT cards, 5 tracks, 3 timeline events, 1 redline.

test.beforeEach(async ({ page }) => {
  // Clean overlay/theme before each test so state never leaks between tests.
  await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
  await page.goto('/kanban-template.html');
  await page.waitForFunction(() => document.querySelectorAll('#now-list .card').length > 0);
});

test('renders all sections', async ({ page }) => {
  await expect(page.locator('#now-list .card')).toHaveCount(2);
  await expect(page.locator('#week-list .card')).toHaveCount(2);
  await expect(page.locator('#next-list .card')).toHaveCount(2);
  await expect(page.locator('#legend .legend-chip')).toHaveCount(7); // All + 5 tracks + done toggle
  await expect(page.locator('#timeline .tl-event')).toHaveCount(3);
  await expect(page.locator('#redlines li')).toHaveCount(1);
  await expect(page.locator('#track-styles')).toHaveCount(1);
});

test('dynamic track color is applied to cards', async ({ page }) => {
  // first NOW card is track "work" → border #58a6ff → rgb(88, 166, 255)
  const border = await page.locator('#now-list .card').first()
    .evaluate(el => getComputedStyle(el).borderLeftColor);
  expect(border).toBe('rgb(88, 166, 255)');
});

test('no console / page errors on load', async ({ page }) => {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#now-list .card').length > 0);
  expect(errors).toEqual([]);
});

test('search filters cards and Esc clears', async ({ page }) => {
  await page.fill('#search', 'secondary');
  // "Secondary task example" stays; "most important" card is hidden
  await expect(page.locator('#now-list .card.search-hidden')).toHaveCount(1);
  await page.locator('#search').press('Escape');
  await expect(page.locator('.card.search-hidden')).toHaveCount(0);
});

test('keyboard 1-9 filters a track, a resets to all', async ({ page }) => {
  await page.keyboard.press('2'); // 2nd track = learn
  await expect(page.locator('.legend-chip.active')).toHaveAttribute('data-filter', 'learn');
  await page.keyboard.press('a');
  await expect(page.locator('.legend-chip.active')).toHaveAttribute('data-filter', 'all');
});

test('check off a card → done + sync banner + localStorage overlay', async ({ page }) => {
  await expect(page.locator('#sync-banner')).toBeHidden();
  const card = page.locator('#now-list .card').first();
  await card.locator('.chk').click();
  await expect(card).toHaveClass(/done/);
  await expect(page.locator('#sync-banner')).toBeVisible();
  const doneKeys = await page.evaluate(() => {
    const k = Object.keys(localStorage).find(x => x.includes(':overlay'));
    return k ? Object.keys(JSON.parse(localStorage.getItem(k)).done || {}).length : 0;
  });
  expect(doneKeys).toBeGreaterThan(0);
});

test('drag a NOW card to WEEK persists in the overlay', async ({ page }) => {
  const key = await page.locator('#now-list .card').first().getAttribute('data-key');
  // Dispatch native dragstart/drop (handlers are DataTransfer-agnostic).
  await page.evaluate((k) => {
    const card = document.querySelector(`.card[data-key="${CSS.escape(k)}"]`);
    card.dispatchEvent(new Event('dragstart', { bubbles: true }));
    document.getElementById('week-list').closest('.col').dispatchEvent(new Event('drop', { bubbles: true }));
  }, key);
  await expect(page.locator(`#week-list .card[data-key="${key}"]`)).toHaveCount(1);
  await expect(page.locator(`#now-list .card[data-key="${key}"]`)).toHaveCount(0);
  const col = await page.evaluate((k) => {
    const s = Object.keys(localStorage).find(x => x.includes(':overlay'));
    return JSON.parse(localStorage.getItem(s)).col[k];
  }, key);
  expect(col).toBe('week');
});

test('theme toggle adds .light and persists', async ({ page }) => {
  await page.click('#theme-toggle');
  await expect(page.locator('html')).toHaveClass(/light/);
  expect(await page.evaluate(() => localStorage.getItem('lk:theme'))).toBe('light');
});

test('reset discards the overlay', async ({ page }) => {
  await page.locator('#now-list .card').first().locator('.chk').click();
  await expect(page.locator('#sync-banner')).toBeVisible();
  page.on('dialog', d => d.accept()); // confirm()
  await page.click('#sync-reset');
  await expect(page.locator('#sync-banner')).toBeHidden();
  const overlay = await page.evaluate(() => {
    const k = Object.keys(localStorage).find(x => x.includes(':overlay'));
    const o = k ? JSON.parse(localStorage.getItem(k)) : { done: {} };
    return Object.keys(o.done || {}).length;
  });
  expect(overlay).toBe(0);
});

test('NOW today-summary counts overdue + due chips render', async ({ page }) => {
  await expect(page.locator('#now-summary')).toContainText('overdue');
  await expect(page.locator('#now-list .card.overdue')).toHaveCount(1); // due 2025-12-31
  await expect(page.locator('#now-list .card .due')).toHaveCount(2);
});

test('+ Add card writes to the overlay and shows the banner', async ({ page }) => {
  await page.locator('.add-row[data-col="now"] .add-toggle').click();
  const inp = page.locator('.add-row[data-col="now"] .add-form input');
  await inp.fill('Buy groceries');
  await inp.press('Enter');
  await expect(page.locator('#now-list .card')).toHaveCount(3);
  await expect(page.locator('#now-list .card .title', { hasText: 'Buy groceries' })).toHaveCount(1);
  await expect(page.locator('#sync-banner')).toBeVisible();
  const added = await page.evaluate(() => {
    const k = Object.keys(localStorage).find(x => x.includes(':overlay'));
    return JSON.parse(localStorage.getItem(k)).added.length;
  });
  expect(added).toBe(1);
  // delete it again
  await page.locator('#now-list .card.added .del').click();
  await expect(page.locator('#now-list .card')).toHaveCount(2);
});

test('typing in the add form does not trigger keyboard shortcuts', async ({ page }) => {
  await page.locator('.add-row[data-col="now"] .add-toggle').click();
  const inp = page.locator('.add-row[data-col="now"] .add-form input');
  await inp.fill('abc');
  await inp.press('a'); // would be the "all" shortcut if hijacked
  await expect(page.locator('.legend-chip.active')).toHaveAttribute('data-filter', 'all');
  await expect(inp).toHaveValue('abca');
});

test('lower sections are collapsed by default', async ({ page }) => {
  const open = await page.locator('#more-fold').evaluate(el => el.open);
  expect(open).toBe(false);
});

test('attention strip surfaces nudges (stale refresh / overdue)', async ({ page }) => {
  // template DATA.today is a fixed past date → "Nd since refresh" fires; an example card is overdue
  await expect(page.locator('#attn-strip')).toBeVisible();
  await expect(page.locator('#attn-strip .a-chip')).not.toHaveCount(0);
  await expect(page.locator('#attn-strip')).toContainText('since last refresh');
});

test('goals strip renders, filters to its cards, and auto-progresses on check', async ({ page }) => {
  await expect(page.locator('#goals-strip')).toBeVisible();
  await expect(page.locator('#goals-strip .goal-chip')).toHaveCount(1);
  await expect(page.locator('.card .goal-pill')).toHaveCount(2);   // 2 example cards link to ship-v1
  await expect(page.locator('.card .rep')).toHaveCount(1);          // 1 example card repeats
  await expect(page.locator('#goals-strip .gpct')).toHaveText('0%');
  // click the goal → only its linked cards remain unfiltered
  await page.locator('#goals-strip .goal-chip').click();
  await expect(page.locator('.card:not(.filtered-out)')).toHaveCount(2);
  // check a linked card → progress rises
  await page.locator('.card[data-goal="ship-v1"]').first().locator('.chk').click();
  await expect(page.locator('#goals-strip .gpct')).toHaveText('50%');
});

test('review log renders trend bars, rows, and a neglected-track warning', async ({ page }) => {
  await page.locator('#more-fold').evaluate(el => { el.open = true; });   // ledger lives in the collapsed fold
  await expect(page.locator('#ledger-section')).toBeVisible();
  await expect(page.locator('#ledger-trend .bar')).toHaveCount(3);
  await expect(page.locator('#ledger-rows .ledger-row')).toHaveCount(3);
  // example archive has Life 0-done across all 3 periods → warning fires
  await expect(page.locator('#ledger-warn')).toContainText('Neglected');
  // trend ascends (oldest → newest): 42% → 55% → 67%
  const heights = await page.locator('#ledger-trend .bar').evaluateAll(els => els.map(e => parseInt(e.style.height)));
  expect(heights[0]).toBeLessThan(heights[2]);
});

test('checkbox is keyboard-operable (focusable button + Enter)', async ({ page }) => {
  const card = page.locator('#now-list .card').first();
  const key = await card.getAttribute('data-key');
  await card.locator('.chk').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator(`#now-list .card[data-key="${key}"]`)).toHaveClass(/done/);
});

test('keyboard move: grab handle + arrows move a card across columns', async ({ page }) => {
  const nowBefore = await page.locator('#now-list .card').count();
  const weekBefore = await page.locator('#week-list .card').count();
  const key = await page.locator('#now-list .card').first().getAttribute('data-key');
  await page.locator('#now-list .card').first().locator('.grab').focus();
  await page.keyboard.press('ArrowRight'); // NOW → WEEK
  await expect(page.locator('#now-list .card')).toHaveCount(nowBefore - 1);
  await expect(page.locator('#week-list .card')).toHaveCount(weekBefore + 1);
  await expect(page.locator(`#week-list .card[data-key="${key}"]`)).toHaveCount(1);
  await expect(page.locator('#sync-banner')).toBeVisible();
});

test('keyboard move: ↑ ↓ reorder within a column', async ({ page }) => {
  const firstKey = await page.locator('#week-list .card').first().getAttribute('data-key');
  await page.locator('#week-list .card').first().locator('.grab').focus();
  await page.keyboard.press('ArrowDown'); // first WEEK card moves down one slot
  await expect(page.locator('#week-list .card').nth(1)).toHaveAttribute('data-key', firstKey);
});

test('cards expose state via aria-label (non-color signal)', async ({ page }) => {
  const overdueAria = await page.locator('#now-list .card.overdue').first().getAttribute('aria-label');
  expect((overdueAria || '').toLowerCase()).toContain('overdue');
  const starAria = await page.locator('#now-list .card.star').first().getAttribute('aria-label');
  expect((starAria || '').toLowerCase()).toContain('starred');
});

test('window.LK_I18N localizes engine strings', async ({ page }) => {
  await page.addInitScript(() => { window.LK_I18N = { all: '__ALLX__', showDone: '__SHOWX__' }; });
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#now-list .card').length > 0);
  await expect(page.locator('.legend-chip[data-filter="all"]')).toContainText('__ALLX__');
  await expect(page.locator('#toggle-done-label')).toContainText('__SHOWX__');
});

test('window.LK_PLUGINS run once after first paint with a context', async ({ page }) => {
  await page.addInitScript(() => {
    window.LK_PLUGINS = [(ctx) => {
      const d = document.createElement('div');
      d.id = 'plugin-probe';
      d.textContent = (ctx && Array.isArray(ctx.DATA?.now) && typeof ctx.repaint === 'function') ? 'ctx-ok' : 'ctx-bad';
      document.body.appendChild(d);
    }];
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#now-list .card').length > 0);
  await expect(page.locator('#plugin-probe')).toHaveText('ctx-ok');
  await expect(page.locator('#plugin-probe')).toHaveCount(1); // ran exactly once
});

test('NEXT column folds overflow beyond the threshold + toggle expands', async ({ page }) => {
  // template NEXT has 2 cards; default fold is 8. Add 7 → 9 total → folded to 8 + a "more" button.
  await page.locator('.add-row[data-col="next"] .add-toggle').click();
  const inp = page.locator('.add-row[data-col="next"] .add-form input');
  for (let i = 0; i < 7; i++) { await inp.fill('extra ' + i); await inp.press('Enter'); }
  await expect(page.locator('#next-list .next-more')).toBeVisible();
  await expect(page.locator('#next-list .card')).toHaveCount(8);
  await page.locator('#next-list .next-more').click();
  await expect(page.locator('#next-list .card')).toHaveCount(9);
  await expect(page.locator('#next-list .next-more')).toContainText('less');
});

test('in-browser edit: ✎ rewrites title, persists to overlay, shows banner', async ({ page }) => {
  const card = page.locator('#now-list .card').first();
  const key = await card.getAttribute('data-key');
  await card.locator('.edit').click();
  await expect(card.locator('.card-editor')).toBeVisible();
  await card.locator('.card-editor .ce-title').fill('EDITED HEADLINE');
  await card.locator('.card-editor .ce-save').click();
  await expect(page.locator(`#now-list .card[data-key="${key}"] .title`)).toHaveText('EDITED HEADLINE');
  await expect(page.locator('#sync-banner')).toBeVisible();
  const edited = await page.evaluate((k) => {
    const s = Object.keys(localStorage).find(x => x.includes(':overlay'));
    return JSON.parse(localStorage.getItem(s)).edit[k]?.title;
  }, key);
  expect(edited).toBe('EDITED HEADLINE');
});

test('timeline type filter narrows events and resets', async ({ page }) => {
  await page.locator('#more-fold').evaluate(el => { el.open = true; });
  await expect(page.locator('.tl-filter .tl-chip')).not.toHaveCount(0);
  await page.locator('.tl-filter .tl-chip[data-tl="deadline"]').click();
  await expect(page.locator('#timeline .tl-event')).toHaveCount(1); // 1 deadline in template DATA
  await page.locator('.tl-filter .tl-chip[data-tl="all"]').click();
  await expect(page.locator('#timeline .tl-event')).toHaveCount(3);
});

test('tap-to-move: tap ⠿ then tap a column moves the card (touch path)', async ({ page }) => {
  const key = await page.locator('#now-list .card').first().getAttribute('data-key');
  await page.locator('#now-list .card').first().locator('.grab').click();
  await expect(page.locator('body')).toHaveClass(/lk-moving/);
  await page.locator('#week-list').click();
  await expect(page.locator(`#week-list .card[data-key="${key}"]`)).toHaveCount(1);
  await expect(page.locator(`#now-list .card[data-key="${key}"]`)).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/lk-moving/);
});

test('LK.snapshotPeriod + regenRepeats compute the refresh transforms', async ({ page }) => {
  const snap = await page.evaluate(() => window.LK.snapshotPeriod(DATA));
  // template: 6 track'd cards, 1 done (the "Wed ✅" project card)
  expect(snap.done).toBe(1);
  expect(snap.planned).toBe(6);
  expect(snap.byTrack.project).toBe('1/2');
  expect(snap.shipped).toContain('Completed task example');
  expect(snap.slipped).toContain("This week's task A"); // a WEEK card not done
  const snap2 = await page.evaluate(() => window.LK.snapshotPeriod(DATA, 'felt productive'));
  expect(snap2.retro).toBe('felt productive');
  const reps = await page.evaluate(() => window.LK.regenRepeats(DATA));
  expect(reps.length).toBe(1); // the "21-22" learn card has repeat:"weekly"
  expect(reps[0].title).toBe('Secondary task example');
  expect('done' in reps[0]).toBe(false); // reset to not-done
});

test('rich edit: ✎ can change track / tag / star, persisted to overlay', async ({ page }) => {
  const card = page.locator('#now-list .card').first(); // AM card: work / P0 / star
  const key = await card.getAttribute('data-key');
  await card.locator('.edit').click();
  await card.locator('.card-editor .ce-track').selectOption('project');
  await card.locator('.card-editor .ce-tag').selectOption('P1');
  await card.locator('.card-editor .ce-star input').uncheck();
  await card.locator('.card-editor .ce-save').click();
  const moved = page.locator(`#now-list .card[data-key="${key}"]`);
  await expect(moved).toHaveClass(/track-project/);
  await expect(moved).not.toHaveClass(/star/);
  await expect(moved.locator('.tag')).toHaveText('P1');
  const edit = await page.evaluate((k) => {
    const s = Object.keys(localStorage).find(x => x.includes(':overlay'));
    return JSON.parse(localStorage.getItem(s)).edit[k];
  }, key);
  expect(edit.track).toBe('project');
  expect(edit.tag).toBe('P1');
  expect(edit.star).toBe(false);
});

test('checkbox renders as a visible bordered box (engine-injected control styles)', async ({ page }) => {
  // regression guard: .chk styling must come from the engine, not a board's inline <style>
  const chk = page.locator('#now-list .card .chk').first();
  const box = await chk.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(14);
  expect(box.height).toBeGreaterThanOrEqual(14);
  const border = await chk.evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth));
  expect(border).toBeGreaterThan(0);
});

test('undo: Ctrl+Z reverts the last overlay change', async ({ page }) => {
  const card = page.locator('#now-list .card').first();
  await card.locator('.chk').click();
  await expect(card).toHaveClass(/done/);
  await expect(page.locator('#sync-banner')).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(page.locator('#now-list .card').first()).not.toHaveClass(/done/);
  await expect(page.locator('#sync-banner')).toBeHidden();
});

// ===== code-review fixes =====

test('expanded card stays expanded across a repaint (review #1)', async ({ page }) => {
  // the 2nd NOW card ("Secondary task example") is has-meta + not star → expandable
  const target = page.locator('#now-list .card', { hasText: 'Secondary task example' });
  await target.locator('.title').click();           // expand it
  await expect(target).toHaveClass(/expanded/);
  // now interact with a DIFFERENT card → triggers a full repaint
  await page.locator('#now-list .card').first().locator('.chk').click();
  await expect(page.locator('#now-list .card', { hasText: 'Secondary task example' })).toHaveClass(/expanded/);
});

test('editing only the title keeps the existing tag (review #2)', async ({ page }) => {
  const card = page.locator('#now-list .card').first(); // AM card has tag P0
  const key = await card.getAttribute('data-key');
  await card.locator('.edit').click();
  await expect(card.locator('.card-editor .ce-tag')).toHaveValue('P0'); // existing tag preselected, not wiped
  await card.locator('.card-editor .ce-title').fill('Reworded headline');
  await card.locator('.card-editor .ce-save').click();
  await expect(page.locator(`#now-list .card[data-key="${key}"] .tag`)).toHaveText('P0');
});

test('copy-today reflects in-browser edits (review #3)', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const card = page.locator('#now-list .card').first();
  await card.locator('.edit').click();
  await card.locator('.card-editor .ce-title').fill('EDITED-FOR-COPY');
  await card.locator('.card-editor .ce-save').click();
  await page.click('#copy-today');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('EDITED-FOR-COPY');
});

test('reordering a folded NEXT keeps hidden cards in ov.order (review #4)', async ({ page }) => {
  // grow NEXT to 9 (>8) so it folds, then drag the first visible NEXT card and confirm the
  // overlay order retains ALL keys (not just the 8 visible ones).
  await page.locator('.add-row[data-col="next"] .add-toggle').click();
  const inp = page.locator('.add-row[data-col="next"] .add-form input');
  for (let i = 0; i < 7; i++) { await inp.fill('n' + i); await inp.press('Enter'); }
  await expect(page.locator('#next-list .next-more')).toBeVisible();      // folded (9 > 8)
  const firstKey = await page.locator('#next-list .card').first().getAttribute('data-key');
  await page.evaluate((k) => {
    const card = document.querySelector(`.card[data-key="${CSS.escape(k)}"]`);
    card.dispatchEvent(new Event('dragstart', { bubbles: true }));
    document.getElementById('next-list').closest('.col').dispatchEvent(new Event('drop', { bubbles: true }));
  }, firstKey);
  const orderLen = await page.evaluate(() => {
    const s = Object.keys(localStorage).find((x) => x.includes(':overlay'));
    return JSON.parse(localStorage.getItem(s)).order.next.length;
  });
  expect(orderLen).toBe(9); // all 9, not the 8 visible — hidden card preserved
});

test('done-count includes plugin-rendered .app.rejected (review #5)', async ({ page }) => {
  await page.addInitScript(() => {
    window.LK_PLUGINS = [() => {
      const d = document.createElement('div');
      d.className = 'app rejected'; d.textContent = 'x';
      document.body.appendChild(d);
    }];
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#now-list .card').length > 0);
  // template has 1 done card (week "Wed ✅") + the plugin's 1 rejected app = 2
  await expect(page.locator('#done-count')).toHaveText('2');
});

test('keyboard-move at a column edge does not push a no-op undo state (review #6)', async ({ page }) => {
  const card = page.locator('#now-list .card').first();
  // first toggle a real change
  await card.locator('.chk').click();
  await expect(card).toHaveClass(/done/);
  // press ArrowLeft on a NOW card's grab (already leftmost column) → should be a no-op, no snapshot
  await card.locator('.grab').focus();
  await page.keyboard.press('ArrowLeft');
  // a single undo should revert the real change (not get absorbed by a no-op edge entry)
  await page.keyboard.press('Control+z');
  await expect(page.locator('#now-list .card').first()).not.toHaveClass(/done/);
});

test('quick-add parses #track / P-tag / star / day token from the input', async ({ page }) => {
  await page.locator('.add-row[data-col="week"] .add-toggle').click();
  const inp = page.locator('.add-row[data-col="week"] .add-form input');
  await inp.fill('Wed ship the thing #learn P0 !');
  await inp.press('Enter');
  const card = page.locator('#week-list .card', { hasText: 'ship the thing' });
  await expect(card).toHaveCount(1);
  await expect(card).toHaveClass(/track-learn/);
  await expect(card).toHaveClass(/star/);
  await expect(card.locator('.tag')).toHaveText('P0');
  await expect(card.locator('.time')).toHaveText('Wed');
  await expect(card.locator('.title')).toHaveText('ship the thing'); // tokens stripped, title clean
});

test('habits grid renders; ticking today sets a streak + syncs + undoes', async ({ page }) => {
  await expect(page.locator('#habits-section')).toBeVisible();
  const rows = page.locator('#habits-grid .habit-row');
  await expect(rows).toHaveCount(2);                                   // template has 2 example habits
  await expect(rows.first().locator('.habit-cell')).toHaveCount(7);    // 7-day window
  await rows.first().locator('.habit-cell.today').click();
  await expect(rows.first().locator('.habit-cell.today')).toHaveClass(/done/);
  await expect(rows.first().locator('.habit-streak')).toContainText('1');
  await expect(page.locator('#sync-banner')).toBeVisible();
  const stored = await page.evaluate(() => {
    const s = Object.keys(localStorage).find((x) => x.includes(':overlay'));
    const o = JSON.parse(localStorage.getItem(s)).habits || {};
    return Object.values(o).some((v) => Object.values(v).some(Boolean));
  });
  expect(stored).toBe(true);
  // undo reverts the check-in
  await page.keyboard.press('Control+z');
  await expect(page.locator('#habits-grid .habit-row').first().locator('.habit-cell.today')).not.toHaveClass(/done/);
});
