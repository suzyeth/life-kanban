// lk-engine.js — shared, language-neutral kanban engine (看板核心引擎)
// ─────────────────────────────────────────────────────────────────────────────
// ONE engine for both the skill template and a real board. Load AFTER a script
// that defines `const DATA = {...}` and AFTER dashboard-utils.js:
//     <script>const DATA = { ... };</script>
//     <script src="dashboard-utils.js"></script>
//     <script src="lk-engine.js"></script>
//
// Everything user-facing flows through STR (English by default). To localise,
// set `DATA.i18n = { ...overrides }` in the page's DATA block — see DEFAULT_STR
// below for every key (plain strings or (args)=>string functions).
//
// Goals support BOTH modes: a goal with `track:"x"` derives its progress from
// that track's done-ratio (and clicking filters that track); a goal with no
// track derives from cards that link via `goal:"<id>"` (clicking filters those).
//
// Page-specific extras (health tracker, in-flight apps, anything bespoke) run as
// plugins: define `window.LK_PLUGINS = [fn, ...]` BEFORE this script; each fn is
// called once after first paint with a context object (see the call site).
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  "use strict";

  // ===== Default (English) strings. DATA.i18n overrides any subset. =====
  const DEFAULT_STR = {
    // due-date chips
    dueOverdue: (n) => `${n}d overdue`,
    dueToday: "due today",
    dueIn: (n) => `in ${n}d`,
    dueOn: (mmdd) => `due ${mmdd}`,
    // card buttons
    chkTitle: "Toggle done",
    delTitle: "Delete card",
    repTitle: (r) => `repeats ${r}`,
    // NOW summary line
    summary: (o) => `Today: <b>${o.n}</b> tasks · ${o.star} ⭐ · ${o.p0} P0 · ${o.done} done`,
    overdue: (n) => `${n} overdue`,
    // sync banner
    syncMsg: (n, hasOrder) =>
      `📝 <b>${n}</b> local change(s)${hasOrder ? " (incl. reorder)" : ""} not yet written to the file — click 📤 and paste it over the DATA block to commit.`,
    confirmReset: "Discard all local changes and revert to the file DATA?",
    copyLatest: "📤 Copy latest DATA",
    copiedSync: "✅ Copied · paste over DATA block",
    pasteOverPrompt: "Copy the text below and replace the DATA block at the top of the file:",
    // + Add card
    addCard: "+ Add card",
    newTask: (col) => `New ${col} task… (Enter)`,
    addLabel: (col) => (col === "now" ? "Today" : col === "week" ? "this wk" : "later"),
    addAction: "do",
    // tracking section default header (overridable via DATA.trackingTitle too)
    trackingTitle: "📬 In-flight",
    // timeline
    tlScaleHint: "Non-linear · near-term zoomed",
    tlCountdown: (days) => {
      if (days === 0) return "today";
      if (days < 0) return `${-days}d ago`;
      if (days < 30) return `in ${days}d`;
      if (days < 365) return `~${Math.round(days / 30)}mo`;
      return `~${(days / 365).toFixed(1)}y`;
    },
    tlBadge: { today: "NOW", milestone: "MILE", deadline: "DUE", visa: "VISA" },
    tlNoDetail: "(no details)",
    // ledger
    neglected: (list) => `⚠ Neglected (0 done lately): ${list.join(" / ")} — give it some time`,
    // legend
    all: "📂 All",
    showDone: "Show done",
    hideDone: "Hide done",
    doneToggleTitle: "Done hidden by default · click to toggle",
    // attention strip
    attnStale: (d) => `📅 ${d}d since last refresh — time for a review`,
    attnDeadline: (label, d) => `⏰ ${label} in ${d}d`,
    attnOverdue: (n) => `🔴 ${n} overdue in NOW`,
    // copy-today
    copyHead: (M) => `🔥 Today ${M.periodDayName} ${M.today} · ${M.period} Day ${M.periodDay}\nFocus: ${M.focus}\n`,
    copyTodayBtn: "📋 Copy today",
    copied: "✅ Copied",
    copyFail: "⚠ Copy failed (select manually)",
    copyPrompt: "Copy the text below:",
    docTitleSuffix: " — Life Kanban",
    // accessibility
    grabLabel: "Move card — focus then ← → to change column, ↑ ↓ to reorder",
    aDone: "done",
    aOverdue: "overdue",
    aStar: "starred",
  };

  function initKanban() {
    if (typeof DATA === "undefined" || !DATA) {
      console.error("lk-engine: no DATA global found — define `const DATA = {...}` before loading the engine.");
      return;
    }
    // Localise via window.LK_I18N (preferred — keeps DATA pure-data so the sync
    // "Copy latest DATA" JSON.stringify never drops function-valued strings) or DATA.i18n.
    const STR = Object.assign({}, DEFAULT_STR, window.LK_I18N || {}, DATA.i18n || {});

    // ── meta schema normalization (accept legacy week*/globalP0 as period*/focus) ──
    const M = DATA.meta;
    if (M.period == null && M.week != null) M.period = M.week;
    if (M.periodRange == null && M.weekRange != null) M.periodRange = M.weekRange;
    if (M.periodDay == null && M.weekDay != null) M.periodDay = M.weekDay;
    if (M.periodDayName == null && M.weekDayName != null) M.periodDayName = M.weekDayName;
    if (M.focus == null && M.globalP0 != null) M.focus = M.globalP0;

    const dayMs = 86400000;
    const toLocalDate = (s) => new Date(s + "T12:00:00"); // avoid bare-date UTC-midnight TZ skew
    const todayDate = toLocalDate(M.today);

    // 0. stale-date warning banner
    showDateWarning(M.today);

    // 1. inject per-track colors (card border + badge + legend chip)
    const hexToRgba = (hex, a) => {
      const h = hex.replace("#", "");
      const r = parseInt(h.slice(0, 2), 16),
        g = parseInt(h.slice(2, 4), 16),
        b = parseInt(h.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${a})`;
    };
    const goalMap = {};
    (DATA.goals || []).forEach((g) => (goalMap[g.id] = g));
    const trackMap = {};
    let css = "";
    (DATA.tracks || []).forEach((t) => {
      trackMap[t.id] = t;
      css += `.card.track-${t.id}{border-left:3px solid ${t.color};}`;
      css += `.card.track-${t.id} .cat-badge{background:${hexToRgba(t.color, 0.18)};color:${t.color};}`;
      css += `.legend-chip.lc-${t.id}.active{border-color:${t.color};}`;
      css += `.legend-chip.lc-${t.id} .lc-count{color:${t.color};}`;
    });
    // keyboard grab-handle (accessible drag) — revealed on hover/focus, never layout-shifts
    css += `.card{position:relative;}`;
    css += `.card .grab{position:absolute;bottom:5px;right:5px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;`
        + `background:none;border:0;color:var(--muted);font-size:13px;line-height:1;cursor:grab;border-radius:4px;opacity:0;transition:opacity .12s;}`;
    css += `.card:hover .grab,.card:focus-within .grab{opacity:.55;}`;
    css += `.card .grab:hover,.card .grab:focus-visible{opacity:1;outline:2px solid var(--accent);outline-offset:1px;}`;
    const styleEl = document.createElement("style");
    styleEl.id = "track-styles";
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    // 2. header + hero (only set elements that exist — boards vary)
    const setText = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
    setText("hdr-title", M.title || "");
    setText("hdr-date", `· ${M.periodDayName} ${M.today} · ${M.period} Day ${M.periodDay}`);
    setText("hdr-focus", `${M.period} · ${M.periodRange}`);
    setText("hdr-p0", M.focus);
    setText("hero-date", `${M.periodDayName} ${M.today} · ${M.period} Day ${M.periodDay}`);
    setText("week-col-label", M.period);
    if (M.title) document.title = `${M.title}${STR.docTitleSuffix}`;
    setText("hero-progress-detail", DATA.progress ? DATA.progress.detail : "");

    // 3. badge (project uses subject, else action)
    const trackBadge = (c) => {
      if (!c.track) return "";
      const t = trackMap[c.track];
      const label = t ? t.label : c.track;
      let inner;
      if (c.subject) inner = `${label} ${c.subject}`;
      else if (c.action) inner = `${label}·${c.action}`;
      else inner = label;
      return `<span class="cat-badge">${esc(inner)}</span>`;
    };
    const trackClass = (track) => (track ? `track-${esc(track)}` : "");

    // 4. ===== cards + localStorage overlay (browser check / drag — never touches the file) =====
    const COLS = ["now", "week", "next"];
    const FIELD = { now: "time", week: "day", next: "when" };
    const LIST = { now: "now-list", week: "week-list", next: "next-list" };
    const CNT = { now: "now-count", week: "week-count", next: "next-count" };
    const STORE = "lk:" + (M.title || M.period || "board") + ":overlay";
    let ov = {};
    try { ov = JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { ov = {}; }
    ov.done = ov.done || {}; ov.col = ov.col || {}; ov.order = ov.order || {}; ov.added = ov.added || [];
    const saveOv = () => { try { localStorage.setItem(STORE, JSON.stringify(ov)); } catch (e) {} };

    let cards = [];
    const buildCards = () => {
      cards = []; const kc = {};
      COLS.forEach((col) => (DATA[col] || []).forEach((c) => {
        const baseK = c.id || `${c.track || "_"}|${c.title}`;
        kc[baseK] = (kc[baseK] || 0) + 1;
        cards.push({ d: c, key: kc[baseK] > 1 ? `${baseK}#${kc[baseK]}` : baseK, baseCol: col, label: c.time || c.day || c.when || "", added: false });
      }));
      ov.added.forEach((a) => cards.push({ d: a, key: a.id, baseCol: a.col, label: a.label || "+ added", added: true }));
    };
    buildCards();

    const effCol = (c) => ov.col[c.key] || c.baseCol;
    const effDone = (c) => (c.key in ov.done ? ov.done[c.key] : !!c.d.done);

    const bucket = () => {
      const b = { now: [], week: [], next: [] };
      cards.forEach((c) => b[effCol(c)].push(c));
      COLS.forEach((col) => {
        const ord = ov.order[col];
        if (ord && ord.length) b[col].sort((x, y) => {
          let ix = ord.indexOf(x.key), iy = ord.indexOf(y.key);
          if (ix < 0) ix = 1e9; if (iy < 0) iy = 1e9;
          return ix - iy;
        });
      });
      return b;
    };

    const dueInfo = (due) => {
      if (!due) return null;
      const days = Math.floor((toLocalDate(due) - todayDate) / dayMs);
      if (days < 0) return { cls: "overdue", label: STR.dueOverdue(-days) };
      if (days === 0) return { cls: "soon", label: STR.dueToday };
      if (days <= 7) return { cls: "soon", label: STR.dueIn(days) };
      return { cls: "", label: STR.dueOn(due.slice(5)) };
    };

    const renderCard = (c) => {
      const d = c.d, done = effDone(c);
      const du = done ? null : dueInfo(d.due);
      const dueCls = du ? (du.cls === "overdue" ? "overdue" : du.cls === "soon" ? "soon" : "") : "";
      const tl = (trackMap[d.track] || {}).label || d.track || "";
      const flags = [done ? STR.aDone : null, du && du.cls === "overdue" ? STR.aOverdue : null, d.star ? STR.aStar : null].filter(Boolean).join(", ");
      const aria = `${tl ? tl + ": " : ""}${c.label} ${d.title}${flags ? " — " + flags : ""}`;
      return `<div class="card ${d.star ? "star" : ""} ${done ? "done" : ""} ${d.meta ? "has-meta" : ""} ${c.added ? "added" : ""} ${dueCls} ${trackClass(d.track)}" data-key="${esc(c.key)}" data-goal="${esc(d.goal || "")}" draggable="true" role="group" aria-label="${esc(aria)}">
      <button class="chk" type="button" title="${esc(STR.chkTitle)}" aria-label="${esc(STR.chkTitle)}">${done ? "✓" : ""}</button>
      <button class="grab" type="button" aria-label="${esc(STR.grabLabel)}" title="${esc(STR.grabLabel)}">⠿</button>
      ${c.added ? `<button class="del" type="button" title="${esc(STR.delTitle)}" aria-label="${esc(STR.delTitle)}">✕</button>` : ""}
      ${d.goal && goalMap[d.goal] ? `<span class="goal-pill" title="${esc(goalMap[d.goal].horizon || "")}">🎯 ${esc(goalMap[d.goal].title)}</span>` : ""}
      ${trackBadge(d)}
      ${d.tag ? `<span class="tag ${esc(String(d.tag).toLowerCase())}">${esc(d.tag)}</span>` : ""}
      <span class="time">${esc(c.label)}</span>${d.repeat ? `<span class="rep" title="${esc(STR.repTitle(d.repeat))}">↻</span>` : ""}${du ? `<span class="due">${esc(du.label)}</span>` : ""}
      <div class="title">${esc(d.title)}</div>
      ${d.meta ? `<div class="meta">${esc(d.meta)}</div>` : ""}
      ${d.link ? `<a class="card-link" href="${esc(d.link)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">🔗 ${esc(d.linkLabel || "link")}</a>` : ""}
    </div>`;
    };
    const renderColumns = () => {
      const b = bucket();
      COLS.forEach((col) => { $(LIST[col]).innerHTML = b[col].map(renderCard).join(""); $(CNT[col]).textContent = b[col].length; });
      return b;
    };

    // effective stats (overlay-aware)
    const computeStats = (b) => {
      const ts = {};
      cards.forEach((c) => {
        if (!c.d.track) return;
        ts[c.d.track] = ts[c.d.track] || { total: 0, done: 0 };
        ts[c.d.track].total++; if (effDone(c)) ts[c.d.track].done++;
      });
      return { ts, weekTotal: b.week.length, weekDone: b.week.filter(effDone).length };
    };
    const refreshProgress = (s) => {
      if (!DATA.progress) return;
      const autoPct = s.weekTotal ? Math.round((s.weekDone / s.weekTotal) * 100) : 0;
      const pct = DATA.progress.pct != null ? DATA.progress.pct : autoPct;
      setText("hero-progress-label", `${DATA.progress.label} (${s.weekDone}/${s.weekTotal})`);
      setText("hero-progress-pct", pct + "%");
      const bar = $("hero-progress-bar"); if (bar) bar.style.width = pct + "%";
    };
    const progressLabel = (s) => (s ? (s.done > 0 ? `${s.done}/${s.total}` : `${s.total}`) : "0");
    const refreshLegendCounts = (s) => {
      const totalAll = Object.values(s.ts).reduce((a, x) => a + x.total, 0);
      const doneAll = Object.values(s.ts).reduce((a, x) => a + x.done, 0);
      const allEl = document.querySelector('.legend-chip[data-filter="all"] .lc-count');
      if (allEl) allEl.textContent = doneAll > 0 ? `${doneAll}/${totalAll}` : `${totalAll}`;
      (DATA.tracks || []).forEach((t) => {
        const el = document.querySelector(`.legend-chip[data-filter="${t.id}"] .lc-count`);
        if (el) el.textContent = progressLabel(s.ts[t.id]);
      });
      const dcEl = $("done-count");
      if (dcEl) dcEl.textContent = document.querySelectorAll(".card.done").length + document.querySelectorAll(".track-item.closed, .app.rejected").length;
    };

    // view layer: track / goal filter + search (re-applied after every render)
    let activeFilter = "all";
    const reapplyView = () => {
      const searchEl = $("search");
      const needle = ((searchEl && searchEl.value) || "").trim().toLowerCase();
      const goalId = activeFilter.startsWith("goal:") ? activeFilter.slice(5) : null;
      document.querySelectorAll(".card, .track-item, .app").forEach((el) => {
        let pass;
        if (activeFilter === "all") pass = true;
        else if (goalId) pass = el.dataset.goal === goalId; // non-card items have no goal → filtered out
        else pass = el.classList.contains(`track-${activeFilter}`);
        el.classList.toggle("filtered-out", !pass);
        el.classList.toggle("search-hidden", !!needle && !el.textContent.toLowerCase().includes(needle));
      });
    };

    // 🎯 goals strip — dual mode (track-derived OR card-linked) + click-to-filter
    const renderGoals = () => {
      const goals = DATA.goals || [];
      const strip = $("goals-strip");
      if (!strip) return;
      if (!goals.length) { strip.style.display = "none"; return; }
      strip.style.display = "";
      const ts = {}; // per-track done ratios for track-derived goals
      cards.forEach((c) => { if (!c.d.track) return; ts[c.d.track] = ts[c.d.track] || { d: 0, t: 0 }; ts[c.d.track].t++; if (effDone(c)) ts[c.d.track].d++; });
      strip.innerHTML = goals.map((g) => {
        let pct = g.progress;
        if (pct == null) {
          if (g.track) pct = ts[g.track] && ts[g.track].t ? Math.round((ts[g.track].d / ts[g.track].t) * 100) : 0;
          else { const lk = cards.filter((c) => c.d.goal === g.id); pct = lk.length ? Math.round((lk.filter(effDone).length / lk.length) * 100) : 0; }
        }
        const fk = g.track ? g.track : "goal:" + g.id;
        const act = activeFilter === fk ? " active" : "";
        return `<span class="goal-chip${act}" data-goalfilter="${esc(fk)}" title="${esc(g.horizon || "")}${g.why ? " · " + esc(g.why) : ""}">🎯 ${esc(g.title)} <span class="gp"><i style="width:${pct}%"></i></span><span class="gpct">${pct}%</span></span>`;
      }).join("");
      strip.querySelectorAll(".goal-chip").forEach((ch) => ch.addEventListener("click", () => {
        const fk = ch.dataset.goalfilter;
        activeFilter = activeFilter === fk ? "all" : fk;
        document.querySelectorAll(".legend-chip[data-filter]").forEach((c) => c.classList.toggle("active", c.dataset.filter === activeFilter || (c.dataset.filter === "all" && activeFilter === "all")));
        renderGoals();
        reapplyView();
      }));
    };

    // NOW today-summary line
    const refreshSummary = (b) => {
      const el = $("now-summary"); if (!el) return;
      const now = b.now;
      const star = now.filter((c) => c.d.star).length;
      const p0 = now.filter((c) => String(c.d.tag || "").toUpperCase() === "P0").length;
      const done = now.filter(effDone).length;
      const overdue = now.filter((c) => { if (effDone(c)) return false; const di = dueInfo(c.d.due); return di && di.cls === "overdue"; }).length;
      el.innerHTML = STR.summary({ n: now.length, star, p0, done }) + (overdue ? ` · <span class="ov">${STR.overdue(overdue)}</span>` : "");
    };

    // sync banner
    const changedCount = () => {
      let n = ov.added.length;
      cards.forEach((c) => {
        if (c.added) return;
        const dc = c.key in ov.done && ov.done[c.key] !== !!c.d.done;
        const cc = ov.col[c.key] && ov.col[c.key] !== c.baseCol;
        if (dc || cc) n++;
      });
      return n;
    };
    const refreshBanner = () => {
      const banner = $("sync-banner"); if (!banner) return;
      const n = changedCount();
      const hasOrder = COLS.some((col) => (ov.order[col] || []).length);
      if (n === 0 && !hasOrder) { banner.style.display = "none"; return; }
      banner.style.display = "";
      const msg = $("sync-msg"); if (msg) msg.innerHTML = STR.syncMsg(n, hasOrder);
    };

    const repaint = () => {
      const b = renderColumns();
      const s = computeStats(b);
      refreshProgress(s); refreshLegendCounts(s); refreshSummary(b); renderGoals(); refreshBanner(); reapplyView();
    };

    // —— interactions: check / delete-added / add-form toggle / expand (delegated) ——
    document.addEventListener("click", (e) => {
      const chk = e.target.closest(".chk");
      if (chk) {
        e.stopPropagation();
        const card = chk.closest(".card"); const c = cards.find((x) => x.key === card.dataset.key);
        if (c) { ov.done[c.key] = !effDone(c); saveOv(); repaint(); }
        return;
      }
      const del = e.target.closest(".card.added .del");
      if (del) {
        e.stopPropagation();
        const key = del.closest(".card").dataset.key;
        ov.added = ov.added.filter((a) => a.id !== key);
        delete ov.done[key]; delete ov.col[key];
        COLS.forEach((col) => { if (ov.order[col]) ov.order[col] = ov.order[col].filter((k) => k !== key); });
        saveOv(); buildCards(); repaint();
        return;
      }
      const tg = e.target.closest(".add-toggle");
      if (tg) {
        const form = tg.nextElementSibling;
        const open = form.classList.toggle("open");
        if (open) form.querySelector("input").focus();
        return;
      }
      const card = e.target.closest(".card.has-meta");
      if (card && !card.classList.contains("star")) card.classList.toggle("expanded");
    });

    // —— interactions: drag to move between / reorder within columns ——
    let dragKey = null, dragFrom = null;
    const afterEl = (listEl, y) => [...listEl.querySelectorAll(".card:not(.dragging)")].reduce((best, ch) => {
      const box = ch.getBoundingClientRect(); const off = y - box.top - box.height / 2;
      return off < 0 && off > best.off ? { off, el: ch } : best;
    }, { off: -Infinity, el: null }).el;
    document.addEventListener("dragstart", (e) => {
      const card = e.target.closest(".card"); if (!card) return;
      dragKey = card.dataset.key; const c = cards.find((x) => x.key === dragKey); dragFrom = c ? effCol(c) : null;
      card.classList.add("dragging"); if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    });
    document.addEventListener("dragend", (e) => { const card = e.target.closest(".card"); if (card) card.classList.remove("dragging"); });
    COLS.forEach((col) => {
      const listEl0 = $(LIST[col]); if (!listEl0) return;
      const colEl = listEl0.closest(".col");
      colEl.addEventListener("dragover", (e) => { e.preventDefault(); colEl.classList.add("drop-target"); });
      colEl.addEventListener("dragleave", () => colEl.classList.remove("drop-target"));
      colEl.addEventListener("drop", (e) => {
        e.preventDefault(); colEl.classList.remove("drop-target");
        if (!dragKey) return;
        const listEl = $(LIST[col]);
        const seq = [...listEl.querySelectorAll(".card")].map((el) => el.dataset.key).filter((k) => k !== dragKey);
        const ref = afterEl(listEl, e.clientY);
        const at = ref ? Math.max(0, seq.indexOf(ref.dataset.key)) : seq.length;
        seq.splice(at, 0, dragKey);
        ov.order[col] = seq; ov.col[dragKey] = col;
        if (dragFrom && dragFrom !== col) ov.order[dragFrom] = [...$(LIST[dragFrom]).querySelectorAll(".card")].map((el) => el.dataset.key).filter((k) => k !== dragKey);
        saveOv(); dragKey = null; repaint();
      });
    });

    // —— keyboard move (accessible alternative to drag): focus a card's ⠿ grab handle,
    //    then ← → move between columns, ↑ ↓ reorder within the column ——
    const refocusGrab = (key) => {
      const sel = `.card[data-key="${(window.CSS && CSS.escape) ? CSS.escape(key) : key.replace(/["\\]/g, "\\$&")}"] .grab`;
      const el = document.querySelector(sel);
      if (el) el.focus();
    };
    document.addEventListener("keydown", (e) => {
      const grab = e.target.closest && e.target.closest(".grab");
      if (!grab) return;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      e.preventDefault();
      const card = grab.closest(".card");
      const c = cards.find((x) => x.key === card.dataset.key);
      if (!c) return;
      const col = effCol(c);
      const seqOf = (cl) => [...$(LIST[cl]).querySelectorAll(".card")].map((el) => el.dataset.key);
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const ni = COLS.indexOf(col) + (e.key === "ArrowRight" ? 1 : -1);
        if (ni < 0 || ni >= COLS.length) return;
        const ncol = COLS[ni];
        ov.order[col] = seqOf(col).filter((k) => k !== c.key);
        ov.order[ncol] = [...seqOf(ncol), c.key];
        ov.col[c.key] = ncol;
      } else {
        const seq = seqOf(col);
        const idx = seq.indexOf(c.key);
        const ni = idx + (e.key === "ArrowDown" ? 1 : -1);
        if (ni < 0 || ni >= seq.length) return;
        seq.splice(idx, 1); seq.splice(ni, 0, c.key);
        ov.order[col] = seq;
      }
      saveOv(); repaint(); refocusGrab(c.key);
    });

    // —— sync banner buttons ——
    const syncReset = $("sync-reset");
    if (syncReset) syncReset.addEventListener("click", () => {
      if (!confirm(STR.confirmReset)) return;
      ov = { done: {}, col: {}, order: {}, added: [] }; saveOv(); buildCards(); repaint();
    });
    const syncCopy = $("sync-copy");
    if (syncCopy) syncCopy.addEventListener("click", async () => {
      const b = bucket();
      const clean = (c) => {
        const d = c.d, o = {};
        o[FIELD[effCol(c)]] = c.label; o.title = d.title;
        if (d.meta) o.meta = d.meta;
        if (d.tag) o.tag = d.tag;
        if (d.star) o.star = true;
        if (effDone(c)) o.done = true;
        if (d.track) o.track = d.track;
        if (d.action) o.action = d.action;
        if (d.subject) o.subject = d.subject;
        if (d.goal) o.goal = d.goal;
        if (d.repeat) o.repeat = d.repeat;
        if (d.due) o.due = d.due;
        if (d.link) o.link = d.link;
        if (d.linkLabel) o.linkLabel = d.linkLabel;
        if (d.id && !c.added) o.id = d.id;
        return o;
      };
      const out = Object.assign({}, DATA);
      out.now = b.now.map(clean); out.week = b.week.map(clean); out.next = b.next.map(clean);
      const text = "const DATA = " + JSON.stringify(out, null, 2) + ";";
      try { await navigator.clipboard.writeText(text); syncCopy.textContent = STR.copiedSync; syncCopy.classList.add("ok"); }
      catch (e) { window.prompt(STR.pasteOverPrompt, text); }
      setTimeout(() => { syncCopy.textContent = STR.copyLatest; syncCopy.classList.remove("ok"); }, 2400);
    });

    // —— theme toggle (persisted) ——
    const THEME = "lk:theme";
    let theme = localStorage.getItem(THEME) || "dark";
    const applyTheme = () => document.documentElement.classList.toggle("light", theme === "light");
    applyTheme();
    const themeBtn = $("theme-toggle");
    if (themeBtn) themeBtn.addEventListener("click", () => { theme = theme === "light" ? "dark" : "light"; try { localStorage.setItem(THEME, theme); } catch (e) {} applyTheme(); });

    // —— multi-board sub-page nav (from DATA.nav) ——
    if (DATA.nav && DATA.nav.length) {
      const nav = $("subpage-nav");
      if (nav) {
        nav.style.display = "";
        nav.innerHTML = DATA.nav.map((n) => {
          const cur = n.href && location.pathname.split("/").pop() === n.href ? " current" : "";
          return `<a class="${cur}" href="${esc(n.href)}">${esc(n.label)}</a>`;
        }).join("");
      }
    }

    // —— + Add card (per column; writes to overlay.added, syncs back like any change) ——
    (function buildAddControls() {
      const rows = document.querySelectorAll(".add-row");
      if (!rows.length) return;
      const opts = (DATA.tracks || []).map((t) => `<option value="${esc(t.id)}">${esc(t.emoji || "")} ${esc(t.label)}</option>`).join("");
      rows.forEach((row) => {
        row.innerHTML = `<button class="add-toggle" type="button">${esc(STR.addCard)}</button>
        <div class="add-form"><input type="text" maxlength="120" placeholder="${esc(STR.newTask(row.dataset.col))}"><select title="track">${opts}</select></div>`;
      });
      document.addEventListener("keydown", (e) => {
        const inp = e.target.closest && e.target.closest(".add-form input");
        if (!inp) return;
        if (e.key === "Escape") { inp.value = ""; inp.closest(".add-form").classList.remove("open"); return; }
        if (e.key !== "Enter") return;
        const title = inp.value.trim(); if (!title) return;
        const form = inp.closest(".add-form"), col = form.closest(".add-row").dataset.col;
        const track = form.querySelector("select").value;
        const id = "add-" + (cards.length + ov.added.length + 1) + "-" + col + "-" + title.slice(0, 8);
        ov.added.push({ id, col, title, track, action: STR.addAction, label: STR.addLabel(col) });
        saveOv(); buildCards(); repaint();
        inp.value = ""; inp.focus();
      });
    })();

    // 5. optional tracking table (DATA.tracking)
    if (DATA.tracking && DATA.tracking.length && $("tracking-section")) {
      $("tracking-section").style.display = "";
      setText("tracking-title", DATA.trackingTitle || STR.trackingTitle);
      $("tracking-list").innerHTML = DATA.tracking.map((a) => {
        const days = daysSince(a.date, todayDate);
        const cls = a.closed ? "closed" : daysClass(days);
        const tc = a.track ? `track-${esc(a.track)}` : "";
        return `<div class="track-item ${cls} ${tc}">
        <div class="ti-title">${esc(a.title)}</div>
        <div class="ti-sub">${esc(a.sub || "")}</div>
        <div class="status-row"><span class="status-badge">${esc(a.status || "")}</span><span class="days">${a.closed ? "—" : days == null ? "" : days + "d"}</span></div>
      </div>`;
      }).join("");
    }

    // 6. timeline (log axis · near-term zoomed)
    if (DATA.timeline && DATA.timeline.length && $("timeline")) {
      const tlEvents = DATA.timeline.map((e) => ({ ...e, d: toLocalDate(e.date) })).sort((a, b) => a.d - b.d);
      const todayMs = todayDate.getTime();
      const logPos = (d) => Math.log10(Math.max(0, (d.getTime() - todayMs) / dayMs) + 1);
      const xMax = Math.max(...tlEvents.map((e) => logPos(e.d))) || 1;
      const TICKS = [{ days: 7, label: "1w" }, { days: 30, label: "1m" }, { days: 90, label: "3m" }, { days: 365, label: "1y" }, { days: 1825, label: "5y" }];
      const tickHtml = TICKS.filter((t) => Math.log10(t.days + 1) <= xMax).map((t) => `<div class="tl-tick" style="left:${(Math.log10(t.days + 1) / xMax) * 100}%;">${t.label}</div>`).join("");
      $("timeline").innerHTML = `<div class="tl-scale-hint">${esc(STR.tlScaleHint)}</div><div class="tl-bar"></div>${tickHtml}` + tlEvents.map((e, i) => {
        const x = (logPos(e.d) / xMax) * 100;
        const below = i % 2 === 1;
        return `<div class="tl-event ${esc(e.type)} ${below ? "below" : ""}" style="left:${x}%;"><div class="lbl">${esc(e.label)}</div><div class="dot"></div><div class="date-lbl">${esc(e.date.slice(2))}</div></div>`;
      }).join("");
      if ($("timeline-detail")) $("timeline-detail").innerHTML = tlEvents.map((e) => {
        const days = Math.floor((e.d - todayDate) / dayMs);
        const badge = STR.tlBadge[e.type] || "·";
        return `<div class="tl-row ${esc(e.type)}"><div class="tl-row-date">${esc(e.date)}<br><span class="badge">${esc(badge)}</span></div><div class="tl-row-body"><div class="tl-row-label">${esc(e.label)} <span style="color:var(--muted);font-weight:500;">· ${esc(STR.tlCountdown(days))}</span></div><div class="tl-row-text">${esc(e.detail || STR.tlNoDetail)}</div></div></div>`;
      }).join("");
    }

    // 7. NOT NOW + redlines
    if ($("not-now")) $("not-now").innerHTML = (DATA.notNow || []).map((n) => `<span class="chip">${esc(n)}</span>`).join("");
    if ($("redlines")) $("redlines").innerHTML = (DATA.redlines || []).map((r) => `<li>${esc(r)}</li>`).join("");

    // 8. 📒 review log — render-only from DATA.archive (the skill writes entries on Refresh)
    (function renderLedger() {
      const arr = (DATA.archive || []).slice(0, DATA.archiveCap || 12);
      if (!arr.length || !$("ledger-section")) return;
      $("ledger-section").style.display = "";
      const pct = (e) => (e.planned ? Math.round((e.done / e.planned) * 100) : 0);
      $("ledger-trend").innerHTML = [...arr].reverse().map((e) => {
        const p = pct(e);
        return `<div class="bar" style="height:${Math.max(6, p)}%;" title="${esc(e.period)}: ${e.done}/${e.planned}"><span>${p}%</span><b>${esc(e.period)}</b></div>`;
      }).join("");
      $("ledger-rows").innerHTML = arr.map((e) => {
        const tracks = e.byTrack ? Object.entries(e.byTrack).map(([k, v]) => `${esc(k)} ${esc(v)}`).join(" · ") : "";
        return `<div class="ledger-row"><span class="lr-period">${esc(e.period)}</span><span class="lr-rate">${e.done}/${e.planned} · ${pct(e)}%</span><span><span class="lr-focus">${esc(e.focus || "")}</span><span class="lr-tracks">${tracks}</span>${e.retro ? `<span class="lr-retro">“${esc(e.retro)}”</span>` : ""}</span></div>`;
      }).join("");
      const last3 = arr.slice(0, 3);
      const ids = [...new Set(last3.flatMap((e) => Object.keys(e.byTrack || {})))];
      const warnIds = ids.filter((id) => { const seen = last3.filter((e) => e.byTrack && id in e.byTrack); return seen.length >= 2 && seen.every((e) => String(e.byTrack[id]).split("/")[0] === "0"); });
      const warns = warnIds.map((id) => (trackMap[id] ? trackMap[id].label : id));
      $("ledger-warn").textContent = warns.length ? STR.neglected(warns) : "";
    })();

    // 9. legend skeleton (counts filled by repaint) + filter + done toggle
    const legendEl = $("legend");
    if (legendEl) {
      let legendHtml = `<span class="legend-chip active" data-filter="all">${esc(STR.all)} <span class="lc-count"></span></span>`;
      (DATA.tracks || []).forEach((t) => {
        legendHtml += `<span class="legend-chip lc-${esc(t.id)}" data-filter="${esc(t.id)}">${esc(t.emoji || "")} ${esc(t.label)} <span class="lc-count"></span></span>`;
      });
      legendHtml += `<span class="legend-chip" id="toggle-done" style="margin-left:auto;cursor:pointer;" title="${esc(STR.doneToggleTitle)}">👁️ <span id="toggle-done-label">${esc(STR.showDone)}</span> <span class="lc-count" id="done-count"></span></span>`;
      legendEl.innerHTML = legendHtml;
    }
    document.querySelectorAll(".legend-chip[data-filter]").forEach((chip) => {
      chip.addEventListener("click", () => {
        activeFilter = chip.dataset.filter;
        document.querySelectorAll(".legend-chip[data-filter]").forEach((c) => c.classList.toggle("active", c === chip));
        renderGoals();
        reapplyView();
      });
    });

    document.body.classList.add("hide-done");
    const toggleChip = $("toggle-done");
    const toggleLabel = $("toggle-done-label");
    if (toggleChip) toggleChip.addEventListener("click", () => {
      const hidden = document.body.classList.toggle("hide-done");
      if (toggleLabel) toggleLabel.textContent = hidden ? STR.showDone : STR.hideDone;
      toggleChip.classList.toggle("active", !hidden);
    });

    // first paint (columns + counts + progress + banner + view, overlay-aware)
    repaint();

    // ⚡ attention strip — proactive nudges computed on open
    (function attn() {
      const el = $("attn-strip"); if (!el) return;
      const items = [];
      const realToday = new Date().toISOString().slice(0, 10);
      const ds = Math.floor((toLocalDate(realToday) - todayDate) / dayMs);
      if (ds >= 5) items.push({ cls: "warn", txt: STR.attnStale(ds) });
      (DATA.timeline || []).forEach((e) => {
        const d = Math.floor((toLocalDate(e.date) - todayDate) / dayMs);
        if (e.type === "deadline" && d >= 0 && d <= 7) items.push({ cls: "due", txt: STR.attnDeadline(e.label, d) });
      });
      const od = bucket().now.filter((c) => !effDone(c) && c.d.due && Math.floor((toLocalDate(c.d.due) - todayDate) / dayMs) < 0).length;
      if (od) items.push({ cls: "due", txt: STR.attnOverdue(od) });
      if (!items.length) { el.style.display = "none"; return; }
      el.style.display = "";
      el.innerHTML = items.map((i) => `<span class="a-chip ${i.cls}">${esc(i.txt)}</span>`).join("");
    })();

    // 10. instant search (combines with track/goal filter via reapplyView)
    const searchEl = $("search");
    if (searchEl) searchEl.addEventListener("input", reapplyView);

    // 11. copy today (NOW column effective content → plain text)
    const copyBtn = $("copy-today");
    if (copyBtn) copyBtn.addEventListener("click", async () => {
      const head = STR.copyHead(M);
      const lines = bucket().now.map((c) => {
        const d = c.d;
        const mark = `${effDone(c) ? "✅" : "⬜"}${d.star ? " ⭐" : ""}${d.tag ? " " + d.tag : ""}`;
        return `${mark} [${c.label}] ${d.title}`;
      });
      const text = head + "\n" + lines.join("\n");
      try { await navigator.clipboard.writeText(text); copyBtn.textContent = STR.copied; copyBtn.classList.add("ok"); }
      catch (e) { copyBtn.textContent = STR.copyFail; window.prompt(STR.copyPrompt, text); }
      setTimeout(() => { copyBtn.textContent = STR.copyTodayBtn; copyBtn.classList.remove("ok"); }, 1800);
    });

    // 12. keyboard shortcuts: / search · 1-9 track · a all · d done · p print · Esc clear
    const filterChips = () => [...document.querySelectorAll(".legend-chip[data-filter]")];
    document.addEventListener("keydown", (e) => {
      const ae = document.activeElement;
      const inField = ae && (ae.tagName === "INPUT" || ae.tagName === "SELECT" || ae.tagName === "TEXTAREA" || ae.isContentEditable);
      if (e.key === "Escape") { if (searchEl && ae === searchEl) { searchEl.value = ""; reapplyView(); searchEl.blur(); } return; }
      if (inField) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") { if (searchEl) { e.preventDefault(); searchEl.focus(); } return; }
      if (e.key === "a" || e.key === "0") { const c = filterChips()[0]; if (c) c.click(); return; }
      if (e.key === "d") { if (toggleChip) toggleChip.click(); return; }
      if (e.key === "p") { e.preventDefault(); window.print(); return; }
      if (/^[1-9]$/.test(e.key)) { const c = filterChips()[+e.key]; if (c) c.click(); }
    });

    // 13. page-specific plugins (health tracker, in-flight apps, anything bespoke)
    const ctx = { DATA, M, STR, todayDate, toLocalDate, dayMs, repaint, effDone, bucket, esc };
    (window.LK_PLUGINS || []).forEach((fn) => { try { fn(ctx); } catch (e) { console.error("lk-engine: plugin error", e); } });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initKanban);
  else initKanban();
  window.initKanban = initKanban;
})();
