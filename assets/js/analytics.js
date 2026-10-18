/* Explicit browser-level exclusion for owner and QA visits. Runs before GA loads. */
(function () {
  'use strict';
  var key = 'hny_internal_traffic';
  var id = 'G-4E1HQTNWCD';
  var page = new URL(window.location.href);
  var choice = page.searchParams.get('hny_traffic');
  var saved = false;
  try { saved = window.localStorage.getItem(key) === '1'; } catch (_) {}
  var cookie = document.cookie.split(';').some(function (part) { return part.trim() === key + '=1'; });
  var internal = saved || cookie;
  if (choice === 'internal' || choice === 'external') {
    internal = choice === 'internal';
    try {
      if (internal) window.localStorage.setItem(key, '1');
      else window.localStorage.removeItem(key);
    } catch (_) {}
    document.cookie = key + '=' + (internal ? '1' : '') + '; Path=/; Max-Age=' + (internal ? '31536000' : '0') + '; SameSite=Lax; Secure';
    page.searchParams.delete('hny_traffic');
    window.history.replaceState(null, '', page.pathname + page.search + page.hash);
  }
  var production = page.hostname === 'honeyranking.com' || page.hostname === 'www.honeyranking.com';
  var settings = page.pathname === '/ops/traffic/' || page.pathname === '/ops/traffic/index.html';
  var enabled = production && !internal && !settings;
  window['ga-disable-' + id] = !enabled;
  window.hnyAnalytics = { enabled: enabled, internal: internal };
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { if (enabled) window.dataLayer.push(arguments); };
  if (enabled) {
    window.gtag('js', new Date());
    window.gtag('config', id);
    var tag = document.createElement('script');
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
    document.head.appendChild(tag);
  }
  document.addEventListener('DOMContentLoaded', function () {
    var status = document.getElementById('traffic-mode-status');
    if (status) status.textContent = internal ? '운영·점검 모드가 켜져 있습니다. 이 브라우저의 방문과 제휴 클릭은 GA4로 전송하지 않습니다.' : '일반 방문 모드입니다. 이 설정 페이지 자체는 집계하지 않습니다.';
    if (!internal) return;
    var note = document.createElement('aside');
    note.setAttribute('role', 'status');
    note.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:9999;max-width:calc(100% - 24px);padding:10px 14px;background:#17243b;color:#fff;border-radius:8px;font-size:13px;';
    note.textContent = '운영·점검 모드 · 방문 집계 제외 ';
    var link = document.createElement('a');
    link.href = '/ops/traffic/';
    link.textContent = '설정';
    link.style.color = '#fff';
    note.appendChild(link);
    document.body.appendChild(note);
  });
  document.addEventListener('click', function (e) {
    if (!enabled) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var url;
    try { url = new URL(a.href); } catch (_) { return; }
    if (!/(^|\.)coupang\.com$/.test(url.hostname)) return;
    window.gtag('event', 'affiliate_click', {
      link_url: a.href,
      product_id: url.searchParams.get('pageKey') || '',
      page_path: window.location.pathname,
      page_title: document.title
    });
  }, true);
}());
