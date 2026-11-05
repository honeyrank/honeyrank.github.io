(function () {
  'use strict';
  const fields = ['price', 'shipping', 'coupon', 'quantity', 'unit', 'packs', 'basis', 'daily'];
  const storageKey = 'hny_unit_price_v1';
  function calculate(input) {
    const price = Number(input.price);
    const quantity = Number(input.quantity);
    const packs = Number(input.packs);
    const basis = Number(input.basis);
    const shipping = Number(input.shipping || 0);
    const coupon = Number(input.coupon || 0);
    const daily = input.daily == null || String(input.daily).trim() === '' ? null : Number(input.daily);
    if (![price, quantity].every(n => Number.isFinite(n) && n > 0) ||
        !Number.isSafeInteger(packs) || packs < 1 || ![1, 10, 100].includes(basis) ||
        !['g', 'ml', '개', '매', 'm'].includes(input.unit)) {
      throw new Error('상품 합계와 총량은 양수, 묶음 수는 1 이상의 정수로 입력해 주세요.');
    }
    if (![shipping, coupon].every(n => Number.isFinite(n) && n >= 0) || coupon > price + shipping) {
      throw new Error('배송비와 할인액은 0원 이상이며, 할인액은 배송비를 포함한 금액까지 입력할 수 있습니다.');
    }
    if (daily !== null && (!Number.isFinite(daily) || daily <= 0)) {
      throw new Error('하루 사용량은 0보다 큰 수로 입력하거나 비워 두세요.');
    }
    const total = quantity * packs;
    const paid = price + shipping - coupon;
    const unitPrice = paid / total;
    const pricePerBasis = unitPrice * basis;
    const dailyCost = daily === null ? null : unitPrice * daily;
    const days = daily === null ? null : total / daily;
    if (![total, paid, pricePerBasis, dailyCost, days].every(n => n === null || Number.isFinite(n))) {
      throw new Error('입력 범위를 벗어났습니다. 금액과 수량을 확인해 주세요.');
    }
    return {total, paid, pricePerBasis, basis, unit: input.unit, dailyCost, days};
  }
  function compareOptions(inputA, inputB) {
    const a = calculate(inputA), b = calculate(inputB);
    if (a.unit !== b.unit) throw new Error('A와 B의 단위가 다릅니다. g·ml·개 등 서로 다른 단위는 직접 비교하지 않습니다.');
    const basis = b.basis;
    const aPrice = a.paid / a.total * basis;
    const bPrice = b.pricePerBasis;
    const difference = bPrice - aPrice;
    const same = Math.abs(difference) <= Number.EPSILON * 8 * Math.max(1, aPrice, bPrice);
    return {a, b, basis, unit: b.unit, aPrice, bPrice, difference: same ? 0 : difference,
      cheaper: same ? 'same' : difference < 0 ? 'b' : 'a', percentChange: aPrice === 0 ? null : (difference / aPrice * 100)};
  }
  function safeInput(input) {
    calculate(input);
    return Object.fromEntries(fields.map(field => [field, input[field] == null ? '' : String(input[field])]));
  }
  function readSaved(text) {
    if (!text) return null;
    try {
      const value = JSON.parse(text);
      if (!value || value.version !== 1) return null;
      return {version: 1, input: safeInput(value.input), optionA: value.optionA ? safeInput(value.optionA) : null};
    } catch (_) { return null; }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {calculate, compareOptions, safeInput, readSaved};
  if (typeof document === 'undefined') return;
  const form = document.getElementById('unit-price-form');
  if (!form) return;
  const error = document.getElementById('unit-error');
  const result = document.getElementById('unit-result');
  const dailyLabel = document.getElementById('daily-label');
  const pin = document.getElementById('unit-pin-a');
  const aSummary = document.getElementById('unit-option-a');
  const comparison = document.getElementById('unit-comparison');
  const saveStatus = document.getElementById('unit-save-status');
  const extra = document.getElementById('unit-extra');
  const won = n => Math.round(n).toLocaleString('ko-KR') + '원';
  let optionA = null, currentInput = null;
  function track(name) { try { if (typeof window.hnyTrack === 'function') window.hnyTrack(name, {tool_name:'unit_price'}); } catch (_) {} }
  function labelDaily() { dailyLabel.textContent = '하루 섭취량 또는 사용량 (' + form.elements.unit.value + ', 선택)'; }
  function formInput() {
    if (fields.some(field => form.elements[field].validity && form.elements[field].validity.badInput)) throw new Error('입력 중인 숫자를 확인해 주세요.');
    return safeInput(Object.fromEntries(fields.map(field => [field, form.elements[field].value])));
  }
  function summary(value) {
    const values = ['결제액 ' + won(value.paid), '총 ' + value.total.toLocaleString('ko-KR') + value.unit, value.basis + value.unit + '당 약 ' + won(value.pricePerBasis)];
    if (value.days !== null) {
      const days = value.days < 0.1 ? '0.1일 미만' : '약 ' + value.days.toLocaleString('ko-KR', {maximumFractionDigits: 1}) + '일분';
      values.push('하루 약 ' + won(value.dailyCost), days);
    }
    return values.join(' · ');
  }
  function updateA() { aSummary.textContent = optionA ? '고정한 A · ' + summary(calculate(optionA)) : '아직 고정한 A가 없습니다.'; }
  function el(tag, text) { const n=document.createElement(tag); if(text != null)n.textContent=text; return n; }
  function renderComparison(inputB) {
    comparison.replaceChildren();
    if (!optionA) return;
    let values;
    try { values = compareOptions(optionA, inputB); }
    catch (err) { comparison.appendChild(el('p',err.message));return; }
    const wrap=el('div');wrap.className='unit-table';wrap.setAttribute('role','region');wrap.setAttribute('aria-label','구성 A와 B 단가 비교');wrap.setAttribute('tabindex','0');
    const table=el('table'),head=el('thead'),row=el('tr'),body=el('tbody');
    ['구성','결제액 / 총량',values.basis+values.unit+'당'].forEach(label=>{const th=el('th',label);th.setAttribute('scope','col');row.appendChild(th);});head.appendChild(row);table.appendChild(head);
    [['A',values.a,values.aPrice],['B',values.b,values.bPrice]].forEach(([label,v,unitPrice])=>{const tr=el('tr'),th=el('th',label);th.setAttribute('scope','row');tr.appendChild(th);tr.appendChild(el('td',won(v.paid)+' / '+v.total.toLocaleString('ko-KR')+v.unit));tr.appendChild(el('td','약 '+won(unitPrice)));body.appendChild(tr);});
    table.appendChild(body);wrap.appendChild(table);comparison.appendChild(wrap);
    let message;
    if(values.cheaper==='same')message='A와 B의 단가가 같습니다. 필요한 양과 보관 조건을 함께 확인하세요.';
    else {
      const amount=Math.abs(values.difference)<1?'1원 미만':won(Math.abs(values.difference));
      message=(values.cheaper==='b'?'B가 A보다 ':'A가 B보다 ')+values.basis+values.unit+'당 '+amount+' 저렴합니다.';
      if(values.percentChange!==null)message+=' A의 단가를 기준으로 한 B의 차이는 '+(values.percentChange<0?'−':'+')+Math.abs(values.percentChange).toLocaleString('ko-KR',{maximumFractionDigits:1})+'%입니다.';
      else message+=' A의 결제액이 0원이므로 증감률은 계산하지 않습니다.';
    }
    comparison.appendChild(el('p',message));
    comparison.appendChild(el('p','현재 B에서 선택한 기준량으로 두 구성을 맞췄습니다. 같은 단위라도 품질·규격·필요 수량이 같다는 뜻은 아닙니다.'));
  }
  function restore() {
    try {
      const saved=readSaved(window.localStorage.getItem(storageKey));
      if(!saved)return;
      fields.forEach(field=>{form.elements[field].value=saved.input[field];});optionA=saved.optionA;updateA();
      if(extra && ['shipping','coupon','daily'].some(field => saved.input[field] !== '' && Number(saved.input[field]) !== 0)) extra.open=true;
      saveStatus.textContent='이 브라우저에 저장한 입력과 A를 불러왔습니다. 현재 가격·조건을 확인하고 다시 계산하세요.';
    } catch(_){}
  }
  form.addEventListener('input', function () {
    labelDaily();error.textContent='';currentInput=null;pin.disabled=true;
    result.textContent='입력한 값으로 다시 계산해 주세요.';comparison.replaceChildren();
  });
  form.addEventListener('submit', function (event) {
    event.preventDefault();error.textContent='';
    try {
      const input=formInput(),value=calculate(input);currentInput=input;
      result.textContent=summary(value);pin.disabled=false;renderComparison(input);track('tool_result');
    } catch(err){currentInput=null;pin.disabled=true;result.textContent='';comparison.replaceChildren();error.textContent=err.message;if(extra)extra.open=true;}
  });
  pin.addEventListener('click',function(){
    if(!currentInput)return;
    optionA=Object.assign({},currentInput);updateA();comparison.replaceChildren();
    comparison.appendChild(el('p','A를 고정했습니다. 위 입력을 B 구성으로 바꾸고 다시 계산하세요. 아직 브라우저 저장값은 바꾸지 않았습니다.'));
  });
  document.getElementById('unit-clear-a').addEventListener('click',function(){
    optionA=null;updateA();comparison.replaceChildren();
    try {
      const saved=readSaved(window.localStorage.getItem(storageKey));
      if(saved&&saved.optionA){saved.optionA=null;window.localStorage.setItem(storageKey,JSON.stringify(saved));saveStatus.textContent='A 고정을 해제하고 저장된 A도 지웠습니다. 저장한 현재 입력은 유지합니다.';}
    } catch(_){}
  });
  document.getElementById('unit-save').addEventListener('click',function(){
    error.textContent='';
    try {
      const input=formInput();window.localStorage.setItem(storageKey,JSON.stringify({version:1,input,optionA}));
      saveStatus.textContent='현재 입력과 A를 이 브라우저에만 저장했습니다. 저장값 삭제 버튼으로 지울 수 있습니다.';track('tool_save');
    } catch(err){saveStatus.textContent='저장하지 못했습니다. 입력값을 확인하거나 브라우저 저장 허용 상태를 확인해 주세요.';}
  });
  document.getElementById('unit-clear-saved').addEventListener('click',function(){
    try {window.localStorage.removeItem(storageKey);saveStatus.textContent='이 브라우저의 저장값을 삭제했습니다. 화면의 입력과 A는 새로고침 전까지 남습니다.';}
    catch(_){saveStatus.textContent='브라우저 저장소에 접근하지 못했습니다. 사이트 데이터 설정에서 삭제할 수 있습니다.';}
  });
  document.getElementById('unit-print').addEventListener('click',function(){window.print();});
  restore();labelDaily();
})();
