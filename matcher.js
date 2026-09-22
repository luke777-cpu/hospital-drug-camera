(function(root){
  const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
  function ingredientKey(s){
    s=norm(s);
    if(!s||/없음|미상|확인필요/.test(s))return '';
    // Remove quantities and dosage-unit labels, but preserve salts and all components.
    s=s.replace(/\d+(?:\.\d+)?(?:mcg|μg|ug|mg|ml|iu|g|l|%|단위)/g,'')
      .replace(/\/(?:\d+)?(?:정|캡슐|포|앰플|병|개|t|c)(?=$|[\/(),])/g,'')
      .replace(/[()_]/g,'');
    return s.split(/[\/,;+]/).map(x=>x.trim()).filter(Boolean).sort().join('+');
  }
  function family(d){
    const text=norm(d.name+' '+d.ingredient),e=norm(d.efficacy);
    if(e.includes('ppi'))return 'PPI';
    if(/트라마돌|트라세타/.test(text))return '트라마돌계 진통제';
    if(/아세트아미노펜|프로파세타몰/.test(text))return '해열진통제(아세트아미노펜계)';
    if(e.includes('마약성진통제'))return '마약성 진통제';
    if(e==='진통제'||e.includes('nsaids')||/디클로페낙/.test(text))return '소염진통제(NSAIDs)';
    if(e.includes('h2')||/시메티딘/.test(text))return 'H2 수용체 차단제';
    if(e.includes('hmg-coa'))return '스타틴';
    if(e.includes('항히스타민'))return '항히스타민제';
    if(e==='근이완제'||e==='근육이완제')return '근육이완제';
    return d.efficacy?d.efficacy.trim():'';
  }
  function enrich(list){return list.map((d,i)=>({...d,id:d.id||i+1,family:family(d),ingredientKey:ingredientKey(d.ingredient)}))}
  function match(row,list){
    const key=ingredientKey(row.ingredient);
    const same=key?list.filter(d=>d.ingredientKey&&d.ingredientKey===key):[];
    const group=row.family||same[0]?.family||'';
    return {same,family:group,related:same.length?[]:list.filter(d=>group&&d.family===group)};
  }
  function search(q,list){
    const n=norm(q);if(!n)return [];
    return list.filter(d=>norm([d.name,d.ingredient,d.family,d.efficacy].join(' ')).includes(n));
  }
  const api={norm,ingredientKey,family,enrich,match,search};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DrugMatcher=api;
})(typeof window!=='undefined'?window:this);
