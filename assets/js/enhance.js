/*!
 * 꿀랭킹 UI 보강 스크립트 (점진적 향상)
 * 본문 마크업은 .md에 인라인 스타일로 박제되어 있어, 렌더 후 DOM을 보강한다.
 * - 상품 블록(형제 나열)을 카드로 감싸고 순위 배지 부여
 * - 목차(점프 내비) 생성
 * - 모바일 스티키 CTA / 읽기 진행바 / 맨 위로
 * 실패해도 페이지는 그대로 동작한다.
 */
(function () {
  'use strict';

  var article = document.querySelector('.article-post');
  var isPost = !!article && !!document.querySelector('.entry-header');

  /* ---------- 1. 상품 블록 → 카드 ---------- */
  function buildCards() {
    if (!article) return [];

    // 생성기가 마크업에 .hny-card를 직접 넣은 새 글은 그대로 사용(중복 래핑 방지)
    var existing = article.querySelectorAll('.hny-card');
    if (existing.length) return Array.prototype.slice.call(existing);

    var cards = [];
    var headings = Array.prototype.slice.call(article.querySelectorAll('h2'));

    headings.forEach(function (h2) {
      var m = (h2.textContent || '').trim().match(/^(\d+)위$/);
      if (!m) return;

      var rank = m[1];
      // 시작: 바로 앞 형제(상품 이미지 center), 없으면 h2부터
      var start = h2.previousElementSibling;
      if (!start || start.tagName !== 'CENTER' || !start.querySelector('img')) start = h2;

      // 끝: CTA 버튼을 포함한 center 까지. 못 찾으면 감싸지 않는다
      // (잘못 감싸서 다음 상품까지 삼키는 것보다 그대로 두는 편이 안전)
      var end = null;
      var cursor = h2.nextElementSibling;
      var guard = 0;
      while (cursor && guard++ < 8) {
        if (cursor.querySelector && cursor.querySelector('.hny-more-btn')) {
          end = cursor;
          break;
        }
        cursor = cursor.nextElementSibling;
      }
      if (!end) return;

      var card = document.createElement('div');
      card.className = 'hny-card';
      card.setAttribute('data-rank', rank);
      card.id = 'rank-' + rank;

      start.parentNode.insertBefore(card, start);

      var node = start;
      while (node) {
        var next = node.nextElementSibling;
        card.appendChild(node);
        if (node === end) break;
        node = next;
      }

      h2.classList.add('hny-rank');
      cards.push(card);
    });

    return cards;
  }

  /* ---------- 1-b. 이미지 로딩 최적화 (LCP/CLS) ---------- */
  function tuneImages(cards) {
    cards.forEach(function (card, i) {
      var img = card.querySelector('img');
      if (!img) return;
      img.setAttribute('decoding', 'async');
      if (i === 0) {
        // 첫 상품 이미지는 LCP 후보 → 지연 로딩하지 않음
        img.setAttribute('fetchpriority', 'high');
        img.removeAttribute('loading');
      } else {
        img.setAttribute('loading', 'lazy');
      }
    });
  }

  /* ---------- 1-c. 읽기 시간 (신뢰·기대치 신호) ---------- */
  function addReadingTime() {
    var header = document.querySelector('.entry-header .d-flex');
    if (!header || !article) return;
    var chars = (article.innerText || '').replace(/\s/g, '').length;
    if (!chars) return;
    var min = Math.max(1, Math.round(chars / 500)); // 한국어 분당 약 500자
    var span = document.createElement('span');
    span.className = 'hny-readtime';
    span.textContent = '· 읽는 시간 약 ' + min + '분';
    var box = header.querySelector('div:last-child');
    if (box) box.appendChild(span);
  }

  /* ---------- 2. 목차 ---------- */
  function buildToc(cardCount) {
    if (!article) return;
    var items = [];

    Array.prototype.slice.call(article.querySelectorAll('h2')).forEach(function (h2) {
      if (h2.classList.contains('hny-rank')) return;
      var text = (h2.textContent || '').trim();
      if (!text) return;
      if (!h2.id) {
        h2.id = 'sec-' + items.length + '-' + text.replace(/\s+/g, '-').slice(0, 20);
      }
      items.push({ id: h2.id, text: text });
    });

    if (cardCount > 0) {
      // 상품 목록으로 가는 점프 링크를 두 번째 위치에 삽입
      items.splice(Math.min(1, items.length), 0, {
        id: 'rank-1',
        text: '상품 순위 TOP ' + cardCount + ' 바로 보기',
      });
    }

    if (items.length < 2) return;

    var toc = document.createElement('details');
    toc.className = 'hny-toc';
    toc.open = true;

    var summary = document.createElement('summary');
    summary.textContent = '이 글의 목차';
    toc.appendChild(summary);

    var ol = document.createElement('ol');
    items.forEach(function (it) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + it.id;
      a.textContent = it.text;
      li.appendChild(a);
      ol.appendChild(li);
    });
    toc.appendChild(ol);

    // 제휴 고지 뒤(있으면) 또는 본문 맨 앞에 삽입
    var anchor = article.querySelector('p[style*="background:#fff8e1"]');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(toc, anchor.nextSibling);
    else article.insertBefore(toc, article.firstChild);
  }

  /* ---------- 3. 스티키 CTA (모바일) ---------- */
  function buildStickyCta(cards) {
    if (!cards.length || window.matchMedia('(min-width: 768px)').matches) return null;
    var firstLink = cards[0].querySelector('a[href*="coupang.com"]');
    if (!firstLink) return null;

    var bar = document.createElement('div');
    bar.className = 'hny-sticky-cta';
    var a = document.createElement('a');
    a.href = firstLink.href;
    a.rel = 'sponsored nofollow';
    a.target = '_blank';
    // 이모지는 일부 환경에서 두부(□)로 깨질 수 있어 텍스트로만 구성
    a.textContent = '1위 상품 쿠팡 최저가 확인하기';
    bar.appendChild(a);
    document.body.appendChild(bar);
    return bar;
  }

  /* ---------- 4. 진행바 · 맨 위로 ---------- */
  function buildScrollUi() {
    var bar = document.createElement('div');
    bar.className = 'hny-progress';
    document.body.appendChild(bar);

    var top = document.createElement('button');
    top.className = 'hny-top';
    top.type = 'button';
    top.setAttribute('aria-label', '맨 위로 이동');
    top.innerHTML = '↑';
    top.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.body.appendChild(top);

    return { bar: bar, top: top };
  }

  /* ---------- 실행 ---------- */
  function init() {
    var cards = isPost ? buildCards() : [];
    if (isPost) {
      tuneImages(cards);
      addReadingTime();
      buildToc(cards.length);
    }

    var sticky = isPost ? buildStickyCta(cards) : null;
    var ui = buildScrollUi();

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        var doc = document.documentElement;
        var max = (doc.scrollHeight - window.innerHeight) || 1;
        var y = window.pageYOffset || doc.scrollTop;
        var pct = Math.min(100, Math.max(0, (y / max) * 100));

        ui.bar.style.width = pct + '%';
        ui.top.classList.toggle('is-visible', y > 700);

        if (sticky) {
          // 본문 하단 CTA와 겹치지 않도록: 400px 이상 스크롤 & 문서 끝 12% 전까지만 노출
          sticky.classList.toggle('is-visible', y > 400 && pct < 88);
        }
        ticking = false;
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
