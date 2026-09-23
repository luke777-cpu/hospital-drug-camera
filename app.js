'use strict';
const $=s=>document.querySelector(s);let catalog=[],photo='',rows=[],busy=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
const localServer=$('meta[name=session-token]').content.length>30;
if(!localServer&&'serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
fetch(localServer?'/catalog':'drugs.json').then(r=>{if(!r.ok)throw Error();return r.json()}).then(j=>{catalog=DrugMatcher.enrich(Array.isArray(j)?j:j.drugs);$('#status').textContent=localServer?`본원 약품 ${catalog.length}종 준비됨`:'본원 목록 검색 가능 · 사진 AI 판독은 내려받은 약 전용 PC 서버에서 사용하세요.'}).catch(()=>{$('#status').textContent='목록 로딩 실패. 페이지를 새로고침하세요.';$('#read').disabled=true;$('#manual').disabled=true});
async function setPhoto(file){if(!file)return;photo='';$('#read').disabled=true;$('#preview').hidden=true;$('#clearPhoto').hidden=true;try{if(file.size>20*1024*1024)throw Error('사진은 20MB 이하로 선택하세요.');const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();const scale=Math.min(1,2200/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);photo=c.toDataURL('image/jpeg',.9);if(photo.length>8000000)throw Error('사진 용량이 큽니다. 약 부분만 잘라 다시 선택하세요.');$('#preview').src=photo;$('#preview').hidden=false;$('#clearPhoto').hidden=false;$('#status').textContent='사진 준비됨 · 아직 전송하지 않았습니다.';}finally{URL.revokeObjectURL(url)}}catch(e){photo='';$('#status').textContent=e.message||'사진을 읽지 못했습니다. JPG로 다시 선택하세요.'}finally{$('#read').disabled=!catalog.length;$('#consent').checked=false;invalidate()}}
function invalidate(){$('#results').hidden=true;}
$('#camera').onchange=e=>setPhoto(e.target.files[0]);$('#album').onchange=e=>setPhoto(e.target.files[0]);
$('#clearPhoto').onclick=()=>{photo='';$('#preview').removeAttribute('src');$('#preview').hidden=true;$('#clearPhoto').hidden=true;$('#camera').value='';$('#album').value='';$('#consent').checked=false;invalidate()};
$('#input').oninput=()=>{$('#consent').checked=false;invalidate()};
function renderRows(){const box=$('#rows');box.replaceChildren();rows.forEach((row,i)=>{const div=document.createElement('div');div.className='edit';div.innerHTML=`<label>약 이름<input data-key="name" value="${esc(row.name)}"></label><label>함량<input data-key="strength" value="${esc(row.strength)}"></label><label>성분·함량 원문<input data-key="ingredient" value="${esc(row.ingredient)}" placeholder="불확실하면 비워두세요"></label><label>약 계열<select data-key="family"><option value="">계열 선택</option>${[...new Set(catalog.map(d=>d.family))].filter(Boolean).sort().map(f=>`<option value="${esc(f)}" ${f===row.family?'selected':''}>${esc(f)}</option>`).join('')}</select></label><p class="note">${esc(row.notes)}</p><button class="secondary">이 약 삭제</button>`;div.querySelectorAll('input,select').forEach(input=>input.oninput=()=>{row[input.dataset.key]=input.value;if(input.dataset.key==='name'){row.ingredient='';row.family='';div.querySelector('[data-key=ingredient]').value='';div.querySelector('[data-key=family]').value='';}else if(input.dataset.key==='ingredient'){row.family=DrugMatcher.match({...row,family:''},catalog).family||'';div.querySelector('[data-key=family]').value=row.family;}for(const key of ['sources','external_candidates','lookup_status','lookup_message','broad_class','detail_class','purpose','candidate_error'])delete row[key];row.alternatives=[];row.notes='입력 수정됨';div.querySelector('.note').textContent=row.notes;invalidate()});div.querySelector('button').onclick=()=>{rows.splice(i,1);renderRows();invalidate()};box.append(div)});$('#verify').hidden=false;invalidate()}
$('#add').onclick=()=>{rows.push({name:'',strength:'',ingredient:'',notes:'직접 입력',family:'',alternatives:[]});renderRows()};
$('#read').onclick=async()=>{if(!localServer){$('#status').textContent='사진 AI 판독은 약 전용 PC 서버 주소에서 사용하세요. GitHub Pages에서는 본원 목록 검색만 가능합니다.';return}if(busy)return;if(!photo&&!$('#input').value.trim()){$('#status').textContent='사진 또는 약 이름을 입력하세요.';return}if(!$('#consent').checked){$('#status').textContent='자료 전송 확인란을 체크하세요.';return}busy=true;lockInputs(true);$('#read').disabled=true;$('#verify').hidden=true;invalidate();$('#status').textContent='판독 중입니다. 최대 약 3분 걸릴 수 있습니다.';const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),180000);try{const r=await fetch('/generate',{method:'POST',headers:{'Content-Type':'application/json','X-Session-Token':$('meta[name=session-token]').content},body:JSON.stringify({history:$('#input').value,photos:photo?[photo]:[],treatments:[]}),signal:ctl.signal});const j=await r.json();if(!r.ok)throw Error(j.error||'판독 오류');clearTimeout(timer);rows=j.drugs.map(row=>({...row,family:DrugMatcher.inferFamily(row,catalog)}));renderRows();lockInputs(true);$('#status').textContent=rows.length?`${rows.length}개 약 판독 · 원문과 대조해주세요.`:'읽을 수 있는 약이 없습니다. 다시 촬영하거나 직접 입력하세요.';showResults();await lookupMissing()}catch(e){$('#status').textContent=e.name==='AbortError'?'응답 시간이 초과되었습니다. 사진을 줄여 다시 시도하세요.':e.message}finally{clearTimeout(timer);busy=false;lockInputs(false);$('#read').disabled=false}};
function card(d,reason=''){return `<div class="candidate"><b>${esc(d.name)}</b><div>${esc(d.ingredient||'성분 자료 없음')}</div><div class="meta">함량: ${esc(d.strength||'확인 필요')} · ${esc(d.sheet)} · 코드 ${esc(d.code)}<br>계열: ${esc(d.family)}</div>${reason?`<p class="note">AI 제안 사유: ${esc(reason)}</p>`:''}</div>`}
function showResults(scroll=true){
  $('#resultList').innerHTML=rows.filter(r=>r.name.trim()).map(row=>{
    const m=DrugMatcher.match(row,catalog);
    const candidateReasons=new Map((row.external_candidates||[]).map(c=>[c.id,c.reason]));
    if(row.lookup_status==='found'&&!m.same.length)m.related=(row.external_candidates||[]).map(c=>catalog.find(d=>d.id===c.id)).filter(Boolean);
    return `<article><h3>${esc(row.name)} ${esc(row.strength)}</h3><p class="meta">성분: ${esc(row.ingredient||'미확인')} · 계열: ${esc(m.family||'미확인')}</p>${externalInfo(row)}<h4>① 동일 성분약</h4>${m.same.length?m.same.map(d=>card(d)).join(''):'<p>본원 동일 성분약 없음 또는 성분 미확인</p>'}${!m.same.length?`<h4>② 동일 성분 없음 → 동일 계열 본원 후보 · ${esc(row.detail_class||m.family||'계열 미확인')}</h4>${m.related.length?m.related.map(d=>card(d,candidateReasons.get(d.id)||'')).join(''):'<p>표시할 본원 세부 계열 후보가 없습니다. 외부 조회 상태를 확인하세요.</p>'}`:''}${!m.same.length?`<button class="secondary" data-lookup="${rows.indexOf(row)}" ${busy?'disabled':''}>외부 정보 다시 조회</button>`:''}<p class="meta">함량·제형·투여경로는 각 약에 표시합니다. 최종 선택은 의료진이 결정합니다.</p></article>`;
  }).join('');
  $('#results').hidden=false;if(scroll)$('#results').scrollIntoView({behavior:'smooth'});
  document.querySelectorAll('[data-lookup]').forEach(b=>b.onclick=()=>retryLookup(Number(b.dataset.lookup)));
}
$('#match').onclick=showResults;
$('#manual').onclick=()=>{$('#search').hidden=false;$('#query').value=$('#input').value.split('\n')[0];search();$('#search').scrollIntoView({behavior:'smooth'})};
function search(){const q=norm($('#query').value);const found=DrugMatcher.search(q,catalog);$('#searchResults').innerHTML=found.length?found.map(d=>card(d)).join(''):'<p>검색어를 입력하거나 성분명으로 다시 찾아보세요.</p>'}
$('#query').oninput=search;$('#reset').onclick=()=>location.reload();

function lockInputs(locked){document.querySelectorAll('main input,main textarea,main select,main button').forEach(e=>e.disabled=locked)}
function sourceUrl(url){try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&['health.kr','nedrug.mfds.go.kr'].some(d=>u.hostname===d||u.hostname.endsWith('.'+d))?u.href:''}catch{return ''}}
function externalInfo(row){
  const links=(row.sources||[]).map(sourceUrl).filter(Boolean).map(url=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${url.includes('nedrug.mfds.go.kr')?'식약처 제품 출처':'약학정보원 제품 출처'}</a>`).join(' · ');
  if(row.lookup_status==='found')return `<div class="candidate"><b>어떤 약인가요? ${esc(row.broad_class)}</b><p>세부 계열: ${esc(row.detail_class)}</p><p>${esc(row.purpose)}</p><p class="meta">외부 출처 기반 AI 요약 · 본원 후보는 AI 계열 비교 결과</p>${links}${row.candidate_error?`<p>${esc(row.candidate_error)}</p>`:''}</div>`;
  if(row.lookup_status)return `<p class="note">${esc(row.lookup_message||'외부 자료에서 정확한 제품을 확인하지 못했습니다.')}</p>`;
  return '';
}
async function lookupBatch(indices){
  for(const i of indices){rows[i].lookup_status='pending';rows[i].lookup_message='외부 의약품 정보 조회 중…'}showResults(false);
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),165000);
  try{
    const r=await fetch('/generate',{method:'POST',headers:{'Content-Type':'application/json','X-Session-Token':$('meta[name=session-token]').content},body:JSON.stringify({operation:'external_lookup',queries:indices.map(i=>({name:rows[i].name,strength:rows[i].strength}))}),signal:ctl.signal});
    const result=await r.json();if(!r.ok)throw Error(result.error||'외부 조회 실패');
    if(!Array.isArray(result.drugs)||result.drugs.length!==indices.length)throw Error('외부 조회 결과 연결 오류');
    for(const item of result.drugs){
      if(!Number.isInteger(item.index)||item.index<0||item.index>=indices.length)throw Error('외부 조회 약 번호 오류');
      const row=rows[indices[item.index]];
      if(item.lookup_status==='found'){
        Object.assign(row,item);row.family=DrugMatcher.inferFamily({...row,family:''},catalog);row.notes='외부 출처 기반 성분 조회 · 사진 원문과 대조';
      }else{row.lookup_status=item.lookup_status;row.lookup_message=item.lookup_message;row.sources=[];row.external_candidates=[];}
    }
  }catch(e){for(const i of indices){rows[i].lookup_status='error';rows[i].lookup_message='외부 조회 실패 · '+(e.name==='AbortError'?'조회 시간이 초과되었습니다.':e.message)}}
  finally{clearTimeout(timer);showResults(false)}
}
async function lookupMissing(){
  const missing=rows.map((row,i)=>!DrugMatcher.match(row,catalog).same.length&&row.name.trim()&&row.name!=='판독 불가'?i:-1).filter(i=>i>=0);
  for(let start=0;start<missing.length;start+=5){$('#status').textContent=`외부 의약품 조회 ${start+1}~${Math.min(start+5,missing.length)} / ${missing.length}개`;await lookupBatch(missing.slice(start,start+5));}
  renderRows();showResults(false);$('#status').textContent=`${rows.length}개 약 판독 · 외부 출처 확인 ${rows.filter(r=>r.lookup_status==='found').length}개. 조회 실패 시 기존 판독 결과를 유지합니다.`;
}
async function retryLookup(i){
  if(busy||!rows[i]||!localServer)return;
  busy=true;lockInputs(true);
  try{await lookupBatch([i]);renderRows();showResults(false)}finally{busy=false;lockInputs(false)}
}
