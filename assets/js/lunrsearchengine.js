---
layout: null
sitemap: false
---
/* Search data contains only representative articles and public buying tools. */
var documents = [
{% assign separator = '' %}
{% for page in site.pages %}
  {% assign searchable_page = false %}
  {% if page.discovery_page or page.url contains '/guides/' or page.url contains '/tools/' or page.url == '/methodology/' or page.url == '/about' %}{% assign searchable_page = true %}{% endif %}
  {% if page.noindex or page.search == false %}{% assign searchable_page = false %}{% endif %}
  {% if searchable_page %}
    {{ separator }}{"url":{{ page.url | absolute_url | jsonify }},"title":{{ page.title | jsonify }},"excerpt":{{ page.description | strip_html | jsonify }},"body":{{ page.description | append: ' ' | append: page.content | markdownify | strip_html | strip_newlines | truncate: 1800 | jsonify }}}
    {% assign separator = ',' %}
  {% endif %}
{% endfor %}
{% for post in site.posts %}
  {% unless post.canonical_url or post.noindex or post.search == false %}
    {% assign text_content = post.content | split: '<!-- hny-rich -->' | last %}
    {% capture product_names %}{% assign headings = text_content | split: '<h3' %}{% for heading in headings offset:1 %} {{ heading | split: '</h3>' | first | split: '>' | last | strip_html }}{% endfor %}{% endcapture %}
    {% capture search_body %}{{ post.description }} {{ post.categories | join: ' ' }} {{ product_names }} {{ text_content | markdownify | strip_html | strip_newlines | truncate: 1100 }}{% endcapture %}
    {{ separator }}{"url":{{ post.url | absolute_url | jsonify }},"title":{{ post.title | jsonify }},"excerpt":{{ post.description | strip_html | jsonify }},"body":{{ search_body | strip | jsonify }}}
    {% assign separator = ',' %}
  {% endunless %}
{% endfor %}
];

/* hny-search-runtime */
(function () {
  'use strict';
  function normalize(value) {
    return String(value || '').normalize('NFKC').toLocaleLowerCase('ko').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }
  function compact(value) { return normalize(value).replace(/\s/g, ''); }
  function plainExcerpt(value) {
    var text = String(value || '');
    var entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    // Decode only as text, including doubly escaped markup from Markdown snippets.
    for (var pass = 0; pass < 2; pass++) {
      text = text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, function (match, entity) {
        var key = entity.toLowerCase();
        if (key[0] !== '#') return entities[key];
        var code = key[1] === 'x' ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ' ';
      });
    }
    // Remove complete tags and trailing tags cut off by index truncation. Never parse HTML.
    return text.replace(/<!--[\s\S]*?(?:-->|$)/g, ' ').replace(/<\/?[a-z][^>]*(?:>|$)/gi, ' ').replace(/\s+/g, ' ').trim();
  }
  var seen = Object.create(null);
  var entries = documents.filter(function (doc) {
    if (!doc || !doc.title || !doc.url) return false;
    var path;
    try {
      var url = new URL(doc.url, window.location.href);
      if (url.hostname !== 'honeyranking.com' && url.origin !== window.location.origin) return false;
      path = decodeURIComponent(url.pathname).replace(/\/$/, '');
    } catch (_) { return false; }
    if (seen[path] || /^(\/ops(?:\/|$)|\/category(?:\/|$)|\/tag(?:\/|$)|\/page\d+$|\/404|\/llms\.txt|\/all$)/.test(path)) return false;
    seen[path] = true;
    return true;
  }).map(function (doc) {
    return { url: doc.url, title: doc.title, body: String(doc.body || '').replace(/\s+/g, ' ').trim(),
      excerpt: plainExcerpt(doc.excerpt) || plainExcerpt(doc.body), titleKey: compact(doc.title), bodyKey: compact(doc.body) };
  });

  function find(term) {
    var query = normalize(String(term || '').slice(0, 255));
    if (!query) return [];
    var terms = query.split(/\s+/);
    var phrase = terms.join('');
    return entries.map(function (entry) {
      var text = entry.titleKey + ' ' + entry.bodyKey;
      if (!terms.every(function (part) { return text.indexOf(part) !== -1; })) return null;
      var score = entry.titleKey === phrase ? 100 : entry.titleKey.indexOf(phrase) === 0 ? 80 : entry.titleKey.indexOf(phrase) !== -1 ? 60 : 0;
      terms.forEach(function (part) { if (entry.titleKey.indexOf(part) !== -1) score += 10; });
      return { url: entry.url, title: entry.title, body: entry.body, excerpt: entry.excerpt, score: score };
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score || a.title.localeCompare(b.title, 'ko'); }).slice(0, 30);
  }

  function closeResults() {
    var root = document.getElementById('lunrsearchresults');
    if (root) { root.replaceChildren(); root.hidden = true; }
    var input = document.getElementById('lunrsearch');
    if (input) input.focus();
  }
  function element(tag, text, className) {
    var node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  window.hnySearch = { find: find, documents: entries };
  window.lunr_search = function (term) {
    var root = document.getElementById('lunrsearchresults');
    if (!root) return false;
    root.replaceChildren();
    root.hidden = false;
    root.style.bottom = window.matchMedia('(max-width: 767px)').matches ? '140px' : '70px';
    var header = element('div', '', 'p-3');
    var heading = element('p', normalize(term) ? '“' + String(term).slice(0, 255) + '” 검색 결과' : '검색어를 입력해 주세요.');
    heading.setAttribute('role', 'status');
    header.appendChild(heading);
    var close = element('button', '검색 결과 닫기', 'btn btn-secondary btn-sm');
    close.type = 'button';
    close.addEventListener('click', closeResults);
    header.appendChild(close);
    root.appendChild(header);
    var results = find(term);
    var list = element('ul');
    results.forEach(function (result) {
      var item = element('li', '', 'lunrsearchresult');
      var link = element('a');
      link.href = result.url;
      link.appendChild(element('span', result.title, 'title'));
      var excerpt = element('small', result.excerpt.slice(0, 140) + (result.excerpt.length > 140 ? '…' : ''), 'd-block');
      link.appendChild(excerpt);
      item.appendChild(link);
      list.appendChild(item);
    });
    if (!results.length && normalize(term)) list.appendChild(element('li', '일치하는 대표 글이 없습니다. 상품명이나 용도를 짧게 입력해 보세요.'));
    root.appendChild(list);
    return false;
  };
  document.addEventListener('keydown', function (event) {
    var root = document.getElementById('lunrsearchresults');
    if (event.key === 'Escape' && root && !root.hidden) closeResults();
  });
}());
