const assert=require('node:assert/strict');
const m=require('./matcher.js');
const list=m.enrich(require('./drugs.json'));
const ppi=m.match({ingredient:'라베프라졸',family:'PPI'},list);
assert.equal(ppi.same.length,0);
assert.equal(ppi.related.length,3);
assert.ok(ppi.related.some(d=>d.name.includes('에소메칸')));
assert.ok(ppi.related.every(d=>d.family==='PPI'));
const same=m.match({ingredient:'란소프라졸 15mg/정',family:'PPI'},list);
assert.ok(same.same.some(d=>d.name.includes('란스톤')));
assert.equal(same.related.length,0);
assert.equal(m.search('PPI',list).length,3);
assert.ok(m.search('진통제',list).length>3);
assert.notEqual(m.ingredientKey('성분나트륨 10mg'),m.ingredientKey('성분 10mg'));
assert.notEqual(m.ingredientKey('성분A 10mg / 성분B 20mg'),m.ingredientKey('성분A 10mg'));
assert.equal(m.match({ingredient:'',family:''},list).same.length,0);
assert.equal(m.match({ingredient:'',family:''},list).related.length,0);
console.log('PASS: PPI 3종, 에소메칸 포함, 동일 성분 우선, 함량 차이, 계열 검색, 염·복합제 구분');
// Actual failure: AI returns an ingredient but leaves family empty.
for(const ingredient of ['발사르탄 80mg','valsartan 80mg']){
  const result=m.match({name:'외부 약',ingredient,family:''},list);
  assert.equal(result.same.length,0);
  assert.equal(result.related.length,5);
  assert.ok(result.related.some(d=>d.name.includes('텔미사탄')));
  assert.ok(result.related.some(d=>d.name.includes('칸살탄')));
  assert.ok(result.related.every(d=>!d.name.includes('엔트레스토')&&!d.name.includes('오로텐션')));
}
for(const ingredient of ['라베프라졸나트륨 10mg','omeprazole 20mg']){
  const result=m.match({ingredient,family:''},list);
  assert.equal(result.related.length,3);
  assert.ok(result.related.some(d=>d.name.includes('란스톤')));
  assert.ok(result.related.some(d=>d.name.includes('에소메칸')));
}
assert.equal(m.match({name:'발사르탄',ingredient:'',family:''},list).related.length,5);
assert.equal(m.match({ingredient:'',family:'ARB'},list).related.length,5);
assert.equal(m.match({name:'프라진',ingredient:'',family:''},list).related.length,0);
for(const ingredient of ['사쿠비트릴발사르탄나트륨염수화물','발사르탄 80mg + 히드로클로로티아지드 12.5mg','테고프라잔','나프록센 500mg + 에스오메프라졸 20mg']){
  assert.equal(m.ingredientFamily(ingredient),'');
}
assert.equal(m.enrich([{name:'x',ingredient:'x',family:'서버 확인 계열',efficacy:'다른 분류'}])[0].family,'서버 확인 계열');
console.log('PASS: 계열 빈칸 ARB 5종/PPI 3종 자동 후보, 영문 성분, 알려진 일반명, 복합제·불명확 상품명 제외');
