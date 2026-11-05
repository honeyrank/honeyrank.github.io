(function () {
  'use strict';
  var fields = ['width', 'length', 'margin'];
  var storageKey = 'hny_camping_fit_v1';

  function number(value, optional) {
    if (optional && (value == null || String(value).trim() === '')) return 0;
    if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') return NaN;
    return Number(value);
  }
  function inputValues(input) {
    var width = number(input.width, false);
    var length = number(input.length, false);
    var margin = number(input.margin, true);
    if (![width, length].every(function (n) { return Number.isFinite(n) && n > 0 && n <= 1000; })) {
      throw new Error('폭과 길이는 0보다 크고 1,000cm 이하인 수로 입력해 주세요.');
    }
    if (!Number.isFinite(margin) || margin < 0 || margin > 1000) {
      throw new Error('여유는 0~1,000cm 사이의 수로 입력하거나 비워 두세요.');
    }
    return {width: width, length: length, margin: margin};
  }
  function delta(available, required) {
    var n = available - required;
    return Math.abs(n) < 1e-8 ? 0 : n;
  }
  function calculate(input, products) {
    var values = inputValues(input);
    if (!Array.isArray(products) || !products.length || products.some(function (product) {
      return !product || !Number.isFinite(product.widthCm) || product.widthCm <= 0 || !Number.isFinite(product.lengthCm) || product.lengthCm <= 0;
    })) throw new Error('상품 치수 자료를 불러오지 못했습니다. 아래 제조사 표를 확인해 주세요.');
    return {
      input: values,
      products: products.map(function (product) {
        var requiredWidth = product.widthCm + values.margin;
        var requiredLength = product.lengthCm + values.margin;
        var widthDelta = delta(values.width, requiredWidth);
        var lengthDelta = delta(values.length, requiredLength);
        return {id: product.id, name: product.name, widthCm: product.widthCm, lengthCm: product.lengthCm,
          requiredWidth: requiredWidth, requiredLength: requiredLength, widthDelta: widthDelta, lengthDelta: lengthDelta,
          status: widthDelta < 0 || lengthDelta < 0 ? 'short' : widthDelta === 0 || lengthDelta === 0 ? 'boundary' : 'room'};
      })
    };
  }
  function makeShareHash(input) {
    var values = inputValues(input);
    return '#' + fields.map(function (field) { return field + '=' + encodeURIComponent(values[field]); }).join('&');
  }
  function readShareValues(hash) {
    var params = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    if (!params.has('width') && !params.has('length') && !params.has('margin')) return null;
    try { return inputValues({width: params.get('width'), length: params.get('length'), margin: params.get('margin')}); }
    catch (_) { return null; }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {inputValues: inputValues, calculate: calculate, makeShareHash: makeShareHash, readShareValues: readShareValues};
  }
  if (typeof document === 'undefined') return;
  var form = document.getElementById('camping-fit-form');
  if (!form) return;
  var error = document.getElementById('fit-error');
  var result = document.getElementById('fit-results');
  var storageStatus = document.getElementById('fit-storage-status');
  var actionStatus = document.getElementById('fit-action-status');
  var shareBox = document.getElementById('fit-share-box');
  var shareUrl = document.getElementById('fit-share-url');
  var save = document.getElementById('fit-save');
  var data;
  try { data = JSON.parse(document.getElementById('camping-fit-data').textContent); }
  catch (_) { data = {products: []}; }

  // Optional measurement must never hide a valid comparison or action result.
  function track(name) {
    try { if (typeof window.hnyTrack === 'function') window.hnyTrack(name, {tool_name: 'camping_fit'}); } catch (_) {}
  }

  function el(tag, text, className) {
    var node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function cm(value) { return Number(value.toFixed(2)).toLocaleString('ko-KR', {maximumFractionDigits: 2}) + 'cm'; }
  function readForm() {
    if (fields.some(function (field) { return form.elements.namedItem(field).validity && form.elements.namedItem(field).validity.badInput; })) {
      throw new Error('입력 중인 숫자를 확인해 주세요.');
    }
    return Object.fromEntries(fields.map(function (field) { return [field, form.elements.namedItem(field).value]; }));
  }
  function fill(values) { fields.forEach(function (field) { form.elements.namedItem(field).value = values[field]; }); }
  function resetResult(message) {
    result.replaceChildren(el('h2', '비교 결과'), el('p', message));
  }
  function differenceText(label, difference) {
    if (difference < 0) return label + ' ' + cm(-difference) + ' 부족';
    if (difference === 0) return label + ' 추가 여유 0cm';
    return label + ' ' + cm(difference) + ' 남음';
  }
  function render(comparison) {
    var values = comparison.input;
    result.replaceChildren(el('h2', '입력한 바닥과 침낭 비교'));
    result.appendChild(el('p', '바닥 ' + cm(values.width) + ' × ' + cm(values.length) + ' · 제품 폭과 길이에 각각 ' + cm(values.margin) + ' 전체 여유를 더한 기준', 'fit-summary'));
    var wrap = el('div', null, 'fit-table-wrap');
    wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', '침낭별 공간 계산 결과'); wrap.setAttribute('tabindex', '0');
    var table = el('table'); table.appendChild(el('caption', '여유를 포함한 필요 치수와 입력한 바닥을 대조한 계산입니다. 실제 호환 판정이 아닙니다.'));
    var head = el('thead'); var heading = el('tr');
    ['모델', '필요 폭 × 길이', '치수 계산 결과'].forEach(function (label) { var th = el('th', label); th.setAttribute('scope', 'col'); heading.appendChild(th); });
    head.appendChild(heading); table.appendChild(head);
    var body = el('tbody');
    comparison.products.forEach(function (product) {
      var row = el('tr'); row.setAttribute('data-model', product.id);
      var title = el('th', product.name); title.setAttribute('scope', 'row'); row.appendChild(title);
      row.appendChild(el('td', cm(product.requiredWidth) + ' × ' + cm(product.requiredLength)));
      var cell = el('td');
      var status = product.status === 'short' ? '치수 부족' : product.status === 'boundary' ? '계산상 딱 맞음 · 여유 확인' : '표기상 공간 확보';
      cell.appendChild(el('span', status, 'fit-status fit-' + (product.status === 'boundary' ? 'check' : product.status)));
      cell.appendChild(el('span', differenceText('폭', product.widthDelta) + ' · ' + differenceText('길이', product.lengthDelta), 'fit-result-detail'));
      row.appendChild(cell); body.appendChild(row);
    });
    table.appendChild(body); wrap.appendChild(table); result.appendChild(wrap);
    result.appendChild(el('p', '남는 치수는 직접 정한 여유를 이미 뺀 값입니다. 전체 길이는 내부 취침 길이와 다를 수 있으며, 실제 매트·베개·지퍼·문 닫힘 상태를 확인하세요.', 'fit-help'));
    var link = el('a', '3종의 구성 차이와 판매 옵션 확인 →', 'fit-link'); link.href = '/차박용-2인-침낭/'; result.appendChild(link);
  }

  var shared = readShareValues(window.location.hash);
  if (shared) {
    fill(shared); save.checked = false;
    storageStatus.textContent = '공유 주소의 치수를 불러왔습니다. 확인 후 비교 버튼을 눌러 주세요. 아직 저장하지 않았습니다.';
  } else {
    try {
      var stored = window.localStorage.getItem(storageKey);
      if (stored) { fill(inputValues(JSON.parse(stored))); save.checked = true; storageStatus.textContent = '이 브라우저에 저장한 치수를 불러왔습니다. 실제 배치가 바뀌었다면 다시 재세요.'; }
    } catch (_) {}
  }
  form.addEventListener('input', function (event) {
    if (event.target === save) return;
    error.textContent = ''; actionStatus.textContent = ''; shareBox.hidden = true;
    resetResult('입력한 값으로 다시 비교해 주세요.');
  });
  save.addEventListener('change', function () {
    if (save.checked) { storageStatus.textContent = '다음에 비교 버튼을 누르면 입력 치수만 이 브라우저에 저장합니다.'; return; }
    try { window.localStorage.removeItem(storageKey); storageStatus.textContent = '이 브라우저에 저장한 치수를 지웠습니다.'; }
    catch (_) { storageStatus.textContent = '브라우저 저장소에 접근할 수 없습니다. 저장 기능 없이 비교할 수 있습니다.'; }
  });
  form.addEventListener('submit', function (event) {
    event.preventDefault(); error.textContent = ''; actionStatus.textContent = ''; shareBox.hidden = true;
    try {
      var comparison = calculate(readForm(), data.products);
      render(comparison);
      if (save.checked) {
        try { window.localStorage.setItem(storageKey, JSON.stringify(comparison.input)); storageStatus.textContent = '입력 치수만 이 브라우저에 저장했습니다. 체크를 해제하거나 초기화하면 지웁니다.'; track('tool_save'); }
        catch (_) { storageStatus.textContent = '브라우저가 저장을 허용하지 않았습니다. 비교 결과는 정상 계산됐습니다.'; }
      }
      track('tool_result');
      result.focus({preventScroll: true});
    } catch (err) { resetResult('입력을 확인한 뒤 다시 비교해 주세요.'); error.textContent = err.message; }
  });
  document.getElementById('fit-share').addEventListener('click', function () {
    error.textContent = ''; actionStatus.textContent = '';
    try {
      var hash = makeShareHash(readForm());
      shareUrl.value = window.location.origin + window.location.pathname + hash;
      shareBox.hidden = false; shareUrl.focus(); shareUrl.select();
      actionStatus.textContent = '치수만 포함한 주소를 만들었습니다. 선택된 주소를 복사해 공유하세요.';
      track('tool_share');
    } catch (err) { shareBox.hidden = true; error.textContent = err.message; }
  });
  document.getElementById('fit-print').addEventListener('click', function () { window.print(); });
  form.addEventListener('reset', function (event) {
    event.preventDefault(); fields.forEach(function (field) { form.elements.namedItem(field).value = ''; }); save.checked = false;
    error.textContent = ''; actionStatus.textContent = ''; shareUrl.value = ''; shareBox.hidden = true;
    resetResult('치수를 입력하고 비교 버튼을 누르면 각 침낭에 필요한 폭과 길이를 보여줍니다.');
    try { window.localStorage.removeItem(storageKey); storageStatus.textContent = '입력과 이 브라우저의 저장값을 지웠습니다.'; }
    catch (_) { storageStatus.textContent = '입력값을 지웠습니다. 브라우저 저장소에는 접근할 수 없습니다.'; }
    if (readShareValues(window.location.hash)) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  });
}());
