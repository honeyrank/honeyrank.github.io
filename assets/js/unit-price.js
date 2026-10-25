(function () {
  'use strict';
  function calculate(input) {
    var price=Number(input.price),quantity=Number(input.quantity),packs=Number(input.packs),basis=Number(input.basis);
    if (![price,quantity,packs,basis].every(function(n){return Number.isFinite(n)&&n>0;}) || !Number.isInteger(packs) || ![1,10,100].includes(basis) || !['g','ml','개','매','m'].includes(input.unit)) {
      throw new Error('금액·총량은 0보다 큰 수, 묶음 수는 1 이상의 정수로 입력해 주세요.');
    }
    var total=quantity*packs, value=price/total*basis;
    if (!Number.isFinite(total) || !Number.isFinite(value) || total<=0)throw new Error('입력값이 너무 큽니다. 실제 구매 수량을 확인해 주세요.');
    return {total:total,pricePerBasis:value,basis:basis,unit:input.unit};
  }
  if (typeof module !== 'undefined' && module.exports) module.exports={calculate:calculate};
  if (typeof document === 'undefined')return;
  var form=document.getElementById('unit-price-form');
  if (!form)return;
  var error=document.getElementById('unit-error'),result=document.getElementById('unit-result');
  form.addEventListener('submit',function(event){
    event.preventDefault();error.textContent='';
    try {
      var value=calculate({price:form.elements.price.value,quantity:form.elements.quantity.value,packs:form.elements.packs.value,basis:form.elements.basis.value,unit:form.elements.unit.value});
      result.textContent='총 '+value.total.toLocaleString('ko-KR')+value.unit+' · '+value.basis+value.unit+'당 약 '+Math.round(value.pricePerBasis).toLocaleString('ko-KR')+'원';
    } catch(e){result.textContent='계산을 완료하지 못했습니다.';error.textContent=e.message;}
  });
})();
