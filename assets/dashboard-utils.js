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

// 倒计时文案 (正 → "X 天后", 0 → "今天", 负 → "已过 X 天")
function countdownLabel(days) {
  if (days == null) return '';
  if (days === 0) return '今天';
  if (days > 0) return `${days} 天后`;
  return `已过 ${-days} 天 (该启动了)`;
}

// Auto-shown red banner if DATA.meta.today (or arg) != 真实今天 → 提醒数据 stale
function showDateWarning(dataToday) {
  if (!dataToday) return;
  const actual = new Date().toISOString().slice(0, 10);
  if (dataToday === actual) return;
  const banner = document.createElement('div');
  banner.className = 'date-warning';
  banner.innerHTML = `⚠️ 页面数据日期 <b>${esc(dataToday)}</b>,今天实际是 <b>${esc(actual)}</b> — 数据 stale,请更新 DATA 块`;
  document.body.insertBefore(banner, document.body.firstChild);
}
