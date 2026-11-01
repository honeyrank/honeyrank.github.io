(function () {
  'use strict';

  function calculate(input) {
    const price = Number(input.price);
    const quantity = Number(input.quantity);
    const packs = Number(input.packs);
    const basis = Number(input.basis);
    const shipping = Number(input.shipping || 0);
    const coupon = Number(input.coupon || 0);
    const daily = input.daily == null || input.daily === '' ? null : Number(input.daily);
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

  if (typeof module !== 'undefined' && module.exports) module.exports = {calculate};
  if (typeof document === 'undefined') return;
  const form = document.getElementById('unit-price-form');
  if (!form) return;
  const error = document.getElementById('unit-error');
  const result = document.getElementById('unit-result');
  const won = n => Math.round(n).toLocaleString('ko-KR') + '원';
  const dailyLabel = document.getElementById('daily-label');
  function labelDaily() {
    dailyLabel.textContent = '하루 섭취량 또는 사용량 (' + form.elements.unit.value + ', 선택)';
  }
  form.addEventListener('input', function () {
    labelDaily();
    error.textContent = '';
    result.textContent = '입력한 값으로 다시 계산해 주세요.';
  });
  labelDaily();
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    error.textContent = '';
    try {
      if (Array.from(form.elements).some(field => field.validity && field.validity.badInput)) {
        throw new Error('입력 중인 숫자를 확인해 주세요.');
      }
      const value = calculate(Object.fromEntries(new FormData(form)));
      const summary = [
        '결제액 ' + won(value.paid),
        '총 ' + value.total.toLocaleString('ko-KR') + value.unit,
        value.basis + value.unit + '당 약 ' + won(value.pricePerBasis)
      ];
      if (value.days !== null) {
        const days = value.days < 0.1 ? '0.1일 미만' : '약 ' + value.days.toLocaleString('ko-KR', {maximumFractionDigits: 1}) + '일분';
        summary.push('하루 약 ' + won(value.dailyCost), days);
      }
      result.textContent = summary.join(' · ');
    } catch (e) {
      result.textContent = '';
      error.textContent = e.message;
    }
  });
})();
