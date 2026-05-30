// Shared utilities — 通用看板 + 子页共用
// Load via <script src="dashboard-utils.js"></script> BEFORE the page render script.

const ESC_MAP = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};

// HTML-escape any value before injecting into innerHTML. ALWAYS use for user/DATA strings.
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC_MAP[c]);
}

function $(id) { return document.getElementById(id); }

function _toDate(v) { return v instanceof Date ? v : new Date(v); }

// 天数差 (今天 - dateStr). dateStr 为空或 '—' 返回 null。
function daysSince(dateStr, today) {
  if (!dateStr || dateStr === '—') return null;
  return Math.floor((_toDate(today) - _toDate(dateStr)) / 86400000);
}

// 天数差 (dateStr - 今天).
function daysUntil(dateStr, today) {
  if (!dateStr) return null;
  return Math.ceil((_toDate(dateStr) - _toDate(today)) / 86400000);
}

// 新鲜度分级 → CSS class (fresh / warm / stale)
function daysClass(d) {
  if (d == null) return '';
  if (d > 14) return 'stale';
  if (d > 7) return 'warm';
  return 'fresh';
}

// Countdown label (positive -> "in Xd", 0 -> "today", negative -> "Xd overdue")
function countdownLabel(days) {
  if (days == null) return '';
  if (days === 0) return 'today';
  if (days > 0) return `in ${days}d`;
  return `${-days}d overdue (start it)`;
}

// Auto-shown red banner if DATA.meta.today (or arg) != 真实今天 → 提醒数据 stale
function showDateWarning(dataToday) {
  if (!dataToday) return;
  const actual = new Date().toISOString().slice(0, 10);
  if (dataToday === actual) return;
  const banner = document.createElement('div');
  banner.className = 'date-warning';
  banner.innerHTML = `⚠️ Page data is dated <b>${esc(dataToday)}</b>, but today is <b>${esc(actual)}</b> — data is stale, update the DATA block`;
  document.body.insertBefore(banner, document.body.firstChild);
}
