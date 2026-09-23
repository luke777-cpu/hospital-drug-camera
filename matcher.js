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
  const ARB='안지오텐신Ⅱ수용체길항제';
  // Ingredient class references: WHO ATC C09CA and A02BC (2026-09-23).
  // Exact whole-ingredient rules: do not classify combinations by one component.
  const arb=/^(?:발사르탄|텔미사르탄|로사르탄|칸데사르탄|올메사르탄|이르베사르탄|에프로사르탄|아질사르탄|피마사르탄|valsartan|telmisartan|losartan|candesartan|olmesartan|irbesartan|eprosartan|azilsartan|fimasartan)(?:칼륨|실렉세틸|메독소밀|메실산염|potassium|cilexetil|medoxomil|mesylate)?(?:수화물|삼수화물|hydrate|trihydrate)?$/;
  const ppi=/^(?:오메프라졸|에스오메프라졸|에소메프라졸|란소프라졸|덱스란소프라졸|판토프라졸|라베프라졸|omeprazole|esomeprazole|lansoprazole|dexlansoprazole|pantoprazole|rabeprazole)(?:나트륨|마그네슘|sodium|magnesium)?(?:이수화물|삼수화물|세스키히드레이트|수화물|dihydrate|trihydrate|sesquihydrate|hydrate)?$/;
  function ingredientFamily(value){
    const k=ingredientKey(value);
    return arb.test(k)?ARB:ppi.test(k)?'PPI':'';
  }
  function canonicalFamily(value){
    const n=norm(value).replace(/[()·_-]/g,'');
    if(['arb','arbs','안지오텐신ii수용체길항제','안지오텐신2수용체길항제','안지오텐신수용체차단제','안지오텐신ii수용체차단제','안지오텐신수용체길항제'].includes(n))return ARB;
    if(['ppi','protonpumpinhibitor','protonpumpinhibitors','위산분비억제제ppi','양성자펌프억제제','프로톤펌프억제제'].includes(n))return 'PPI';
    return String(value||'').trim();
  }
  function inferFamily(row,list=[]){
    const ingredient=String(row.ingredient||'').trim();
    const known=ingredientFamily(ingredient);
    if(known)return known;
    // Generic names only when the ingredient field is empty. No fuzzy brand guesses.
    if(!ingredient){
      const generic=ingredientFamily(row.name);
      if(generic)return generic;
      const exact=list.find(d=>norm(d.name)===norm(row.name));
      if(exact)return exact.family;
    }
    return canonicalFamily(row.family);
  }
  function family(d){
    const known=ingredientFamily(d.ingredient);
    if(known)return known;
    if(d.family)return canonicalFamily(d.family);
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
    return canonicalFamily(d.efficacy);
  }
  function enrich(list){return list.map((d,i)=>({...d,id:d.id||i+1,family:family(d),ingredientKey:ingredientKey(d.ingredient)}))}
  function match(row,list){
    const key=ingredientKey(row.ingredient);
    const same=key?list.filter(d=>d.ingredientKey&&d.ingredientKey===key):[];
    const group=same[0]?.family||inferFamily(row,list);
    return {same,family:group,related:same.length?[]:list.filter(d=>group&&d.family===group)};
  }
  function search(q,list){
    const n=norm(q);if(!n)return [];
    return list.filter(d=>norm([d.name,d.ingredient,d.family,d.efficacy].join(' ')).includes(n));
  }
  const api={norm,ingredientKey,ingredientFamily,canonicalFamily,inferFamily,family,enrich,match,search};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DrugMatcher=api;
})(typeof window!=='undefined'?window:this);
