// The listed end date is inclusive in Korea. A cached page may outlive the offer.
(function () {
  const section = document.querySelector('[data-partner-events]');
  if (!section) return;
  let timer;
  function refresh() {
    clearTimeout(timer);
    const now = Date.now();
    let next = Infinity;
    for (const row of section.querySelectorAll('[data-through]')) {
      const end = Date.parse(row.dataset.through + 'T00:00:00+09:00') + 86400000;
      row.hidden = !(now < end);
      if (!row.hidden) next = Math.min(next, end);
    }
    section.hidden = !Number.isFinite(next);
    if (!section.hidden) timer = setTimeout(refresh, Math.min(next - now, 2147483647));
  }
  refresh();
  window.addEventListener('pageshow', refresh);
  document.addEventListener('visibilitychange', refresh);
}());
