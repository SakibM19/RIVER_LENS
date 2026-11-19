/* RiverLens (web edition): static site + one serverless function. Shared database. */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const CATS={visible_litter:'Visible litter',litter_accumulation:'Litter accumulation',surface_foam_or_film:'Surface foam or film',unusual_surface_appearance:'Unusual surface appearance',no_visible_indicator:'No visible indicator',image_insufficient:'Image insufficient'};
const LIMITS='This is a visual description of one photograph only. It is not a measurement of water quality, not a judgement about safety, and it does not identify the source of any pollution.';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`};
const lsGet=k=>{try{return localStorage.getItem(k)||''}catch(e){return''}}, lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};

/* ---------- API client ---------- */
async function api(u,o={}){const r=await fetch(u,{credentials:'same-origin',...o,headers:{'Content-Type':'application/json',...(o.headers||{})}});let d={};try{d=await r.json()}catch(e){}
  if(r.status===401&&d.code==='access'){showLogin();throw new Error(d.error)}
  if(!r.ok)throw new Error(d.error||('Error '+r.status));return d}
const post=(u,b)=>api(u,{method:'POST',body:JSON.stringify(b)});
const fmt=iso=>{const d=new Date(iso);if(isNaN(d))return iso||'';const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`};
const localDay=iso=>{const d=new Date(iso);const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};
const latest=o=>o.findings[0];
const row=r=>({...r,img:`/api/image?id=${r.id}&thumb=1`,needs_review:!!r.needs_review});

/* ---------- image processing: resize + strip all metadata via canvas ---------- */
function processImage(file){return new Promise((ok,no)=>{const img=new Image(),u=URL.createObjectURL(file);
  img.onload=()=>{const mk=(m,q)=>new Promise(r=>{const s=Math.min(1,m/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);r(c.toDataURL('image/jpeg',q).split(',')[1])});
   const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.drawImage(img,0,0,64,64);const d=x.getImageData(0,0,64,64).data;let sum=0,e=0,prev=0;
   for(let i=0;i<d.length;i+=4){const v=.3*d[i]+.59*d[i+1]+.11*d[i+2];sum+=v;if(i)e+=Math.abs(v-prev);prev=v}const n=d.length/4;
   Promise.all([mk(1280,.85),mk(320,.7)]).then(([image,thumb])=>{URL.revokeObjectURL(u);ok({image,thumb,stats:{mean:sum/n,edge:e/n}})})};
  img.onerror=()=>{URL.revokeObjectURL(u);no(new Error('The file is not a readable image.'))};img.src=u})}

/* ---------- UI ---------- */
Object.entries(CATS).forEach(([k,v])=>$('#fcat').insertAdjacentHTML('beforeend',`<option value="${k}">${v}</option>`));
function show(t){$$('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));$$('main>section').forEach(s=>s.hidden=s.id!=='tab-'+t);
 if(t==='records')loadRecords();if(t==='review')loadReview();if(t==='settings')loadSettings();if(t==='impact')loadImpact();}
$$('#tabs button').forEach(b=>b.onclick=()=>show(b.dataset.tab));
function tags(r){const f=r.final_category||r.primary_category;let h='';
 if(r.obs_status==='analysing')return '<span class="tag"><span class="spin"></span>Analysing…</span>';
 if(r.obs_status==='failed'||(!f&&r.error))return '<span class="tag bad">Analysis failed</span>';
 if(f)h+=`<span class="tag">${esc(CATS[f]||f)}</span>`;
 if(r.uncertainty)h+=`<span class="tag ${r.uncertainty==='low'?'ok':'warn'}">Uncertainty: ${esc(r.uncertainty)}</span>`;
 const st={ai_draft:['AI draft','warn'],confirmed:['Confirmed','ok'],corrected:['Corrected','ok'],rejected:['Rejected','bad']}[r.finding_status];if(st)h+=`<span class="tag ${st[1]}">${st[0]}</span>`;
 if(r.mode==='demo')h+='<span class="tag demo">demo mode</span>';return h}
function item(r){return `<div class="item" data-id="${r.id}"><img src="${r.img}" alt="photo ${r.id}"><div><b>${esc(r.site)}</b><span class="muted">${esc(fmt(r.created_at))}${r.note?' · '+esc(r.note.slice(0,80)):''}</span><div class="tags">${tags(r)}</div></div><span class="muted">#${r.id}</span></div>`}
function bindItems(el){el.querySelectorAll('.item').forEach(i=>i.onclick=()=>openDetail(+i.dataset.id))}
let ROWS=[];const allRows=async()=>{ROWS=(await api('/api/observations')).map(row);return ROWS};
// upload
let chosen=null;const drop=$('#drop'),file=$('#file');
drop.onclick=()=>file.click();drop.onkeydown=e=>{if(e.key==='Enter')file.click()};
['dragover','dragenter'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.add('over')}));
['dragleave','drop'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove('over')}));
drop.addEventListener('drop',e=>{if(e.dataTransfer.files[0])pick(e.dataTransfer.files[0])});file.onchange=()=>file.files[0]&&pick(file.files[0]);
function pick(f){const m=$('#upMsg');if(!/^image\/(jpeg|png|webp)$/.test(f.type)){m.className='msg err';m.textContent='Please choose a JPEG, PNG or WEBP photo.';return}
 if(f.size>20*1024*1024){m.className='msg err';m.textContent='That file is larger than 20 MB.';return}
 chosen=f;m.textContent='';const p=$('#preview');p.src=URL.createObjectURL(f);p.hidden=false;$('#sendBtn').disabled=false}
$('#upForm').onsubmit=async e=>{e.preventDefault();if(!chosen)return;const b=$('#sendBtn');b.disabled=true;const m=$('#upMsg');m.className='msg';m.textContent='Preparing photo…';
 try{const p=await processImage(chosen);m.textContent='Saving and analysing… this usually takes a few seconds.';
  const box=$('#result');box.innerHTML='<h2>Result</h2><p><span class="spin"></span>Analysing…</p>';
  const d=await post('/api/observations',{site:$('#site').value,note:$('#note').value,image:p.image,thumb:p.thumb,stats:p.stats});
  m.className='msg ok';m.textContent='Photo saved (location data removed).';const o=await api('/api/observation?id='+d.id);
  box.innerHTML='<h2>Result</h2>'+reportHTML(o,true);box.insertAdjacentHTML('beforeend','<div class="row"><button class="btn sm" id="again">Add another photo</button><button class="btn sm ghost" id="openIt">Open record</button></div>');
  $('#again').onclick=resetUpload;$('#openIt').onclick=()=>openDetail(d.id);refreshBadge()}catch(err){m.className='msg err';m.textContent=err.message;b.disabled=false;$('#result').innerHTML='<h2>Result</h2><p class="muted">Nothing was saved.</p>'}};
function resetUpload(){chosen=null;file.value='';$('#preview').hidden=true;$('#site').value='';$('#note').value='';$('#sendBtn').disabled=true;$('#upMsg').textContent='';$('#result').innerHTML='<h2>Result</h2><p class="muted">The AI draft appears here after upload.</p>'}
function reportHTML(o,brief){const f=latest(o);if(!f)return '<p class="muted">No analysis yet.</p>';
 if(!f.report)return `<p class="msg err">Analysis failed: ${esc(f.error||'unknown error')}</p><p class="muted">The photo was saved. This record needs manual review, or you can re-run the analysis.</p>`;
 const r=f.report;let h=`<div class="tags"><span class="tag">${esc(CATS[r.primary_category])}</span><span class="tag ${r.uncertainty.level==='low'?'ok':'warn'}">Uncertainty: ${esc(r.uncertainty.level)}</span>${f.needs_review?'<span class="tag warn">Needs human review</span>':''}${f.mode==='demo'?'<span class="tag demo">demo mode, no AI used</span>':''}</div><dl>
 <dt>What is visible</dt><dd>${esc(r.evidence_description)||'—'}</dd>${r.indicators.length?`<dt>Indicators</dt><dd>${r.indicators.map(esc).join(', ')}</dd>`:''}
 <dt>Why uncertain</dt><dd>${r.uncertainty.reasons.length?r.uncertainty.reasons.map(esc).join('<br>'):'—'}</dd><dt>Suggested follow-up</dt><dd>${esc(r.suggested_followup)||'—'}</dd></dl>
 <div class="lim">${esc(r.limitations_statement)}</div>`;
 if(!brief)h+=`<p class="muted">Model: ${esc(f.model)} · ${f.run_ms} ms</p>`;return h}
// records
['fq','fcat','frev','fdf','fdt'].forEach(i=>$('#'+i).addEventListener(i==='fq'?'input':'change',loadRecords));
function filt(rows){const q=$('#fq').value.toLowerCase(),c=$('#fcat').value,rv=$('#frev').value,a=$('#fdf').value,b=$('#fdt').value;
 return rows.filter(r=>(!q||(r.site+' '+r.note).toLowerCase().includes(q))&&(!c||(r.final_category||r.primary_category)===c)&&
  (!rv||(rv==='pending'?(r.needs_review&&r.finding_status==='ai_draft'):r.finding_status===rv))&&(!a||localDay(r.created_at)>=a)&&(!b||localDay(r.created_at)<=b))}
async function loadRecords(){const d=filt(await allRows());const l=$('#recList');l.innerHTML=d.length?d.map(item).join(''):'<div class="empty">No records match.</div>';bindItems(l)}
$('#expBtn').onclick=async e=>{e.preventDefault();const rows=filt(await allRows());
 const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const out=[['id','date','site','note','ai_category','final_category','uncertainty','review_status','reviewer','model','mode','limitations'].join(',')];
 rows.forEach(r=>out.push([r.id,fmt(r.created_at),r.site,r.note,r.primary_category,r.final_category,r.uncertainty,r.finding_status,r.reviewer,r.model,r.mode,LIMITS].map(q).join(',')));
 dl(new Blob([out.join('\n')],{type:'text/csv'}),'riverlens_records.csv')};
function dl(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
async function loadReview(){const d=(await allRows()).filter(r=>r.needs_review&&r.finding_status==='ai_draft'||r.obs_status==='failed');const l=$('#revList');l.innerHTML=d.length?d.map(item).join(''):'<div class="empty">Nothing waiting for review.</div>';bindItems(l);refreshBadge()}
async function refreshBadge(){let n=0;try{n=(await allRows()).filter(r=>r.needs_review&&r.finding_status==='ai_draft'||r.obs_status==='failed').length}catch(e){}const b=$('#qbadge');b.hidden=!n;b.textContent=n}
function banner(){const b=$('#modeBanner');const w=$('#warnBanner');const msg=!STATUS.db_configured?'The database is not connected yet. Add one in the Vercel project (see README), then redeploy.':(!STATUS.ai_configured?'Demo mode: no AI key is set on this site, so results are placeholders and not a real analysis.':'');b.hidden=!msg;b.textContent=msg;
 w.hidden=STATUS.access_code_required;w.textContent=STATUS.access_code_required?'':'No access code is set, so anyone with the link can see and add records. Set ACCESS_CODE in Vercel.'}
// detail modal
async function openDetail(id){const o=await api('/api/observation?id='+id);const f=latest(o);
 let rev='';if(f){rev=`<div class="revbox"><h2>Human review</h2>${f.status!=='ai_draft'?`<p class="tags"><span class="tag ok">${esc(f.status)}</span><span class="muted">by ${esc(f.reviewer)} on ${esc(fmt(f.reviewed_at))}${f.review_comment?' · '+esc(f.review_comment):''}${f.final_category?' · final: '+esc(CATS[f.final_category]):''}</span></p>`:''}
 <label>Reviewer name<input id="rvName" value="${esc(lsGet('rl_name'))}"></label>
 <label>Correct category (only if correcting)<select id="rvCat">${Object.entries(CATS).map(([k,v])=>`<option value="${k}" ${f.report&&f.report.primary_category===k?'selected':''}>${v}</option>`).join('')}</select></label>
 <label>Comment (required when rejecting)<textarea id="rvCom" rows="2"></textarea></label>
 <div class="row"><button class="btn sm" data-d="confirm">Confirm AI finding</button><button class="btn sm ghost" data-d="correct">Save correction</button><button class="btn sm red" data-d="reject">Reject</button></div><div id="rvMsg" class="msg"></div></div>`}
 $('#mbody').innerHTML=`<h2>${esc(o.site)} <span class="muted">#${o.id} · ${esc(fmt(o.created_at))}</span></h2><div class="det"><div><img src="/api/image?id=${o.id}" alt="photo"></div><div>${o.note?`<dl><dt>Volunteer note</dt><dd>${esc(o.note)}</dd></dl>`:''}${reportHTML(o)}<div class="row"><button class="btn sm ghost" id="rerun">Re-run analysis</button><button class="btn sm ghost" id="delRec" style="color:var(--bad);border-color:var(--bad)">Delete record</button></div></div></div>${rev}`;
 $('#modal').hidden=false;
 $('#rerun').onclick=async()=>{$('#mbody').innerHTML='<p><span class="spin"></span>Re-running…</p>';try{await post('/api/reanalyze',{id})}catch(e){}openDetail(id);refreshAll()};
 $('#delRec').onclick=async()=>{if(confirm('Delete this record and its photo for everyone? This cannot be undone.')){await post('/api/delete',{id});closeModal();refreshAll()}};
 $$('[data-d]').forEach(b=>b.onclick=async()=>{const name=$('#rvName').value.trim(),m=$('#rvMsg');m.className='msg err';lsSet('rl_name',name);
  try{await post('/api/review',{finding_id:f.id,decision:b.dataset.d,reviewer:name,category:$('#rvCat').value,comment:$('#rvCom').value.trim()});closeModal();refreshAll()}catch(e){m.textContent=e.message}})}
function closeModal(){$('#modal').hidden=true}$('#mclose').onclick=closeModal;$('#modal').onclick=e=>{if(e.target.id==='modal')closeModal()};document.addEventListener('keydown',e=>e.key==='Escape'&&closeModal());
function refreshAll(){const t=$$('#tabs button.on')[0].dataset.tab;if(t==='records')loadRecords();if(t==='review')loadReview();if(t==='impact')loadImpact();refreshBadge()}
// impact
async function loadImpact(){const rows=(await allRows());const cats={},sites={};let reviewed=0,flagged=0;
 rows.forEach(r=>{if(['confirmed','corrected'].includes(r.finding_status))reviewed++;if(r.finding_status==='rejected')return;const c=r.final_category||r.primary_category;if(c)cats[c]=(cats[c]||0)+1;
  const s=sites[r.site]=sites[r.site]||{site:r.site,observations:0,indicators:0};s.observations++;if(['visible_litter','litter_accumulation','surface_foam_or_film','unusual_surface_appearance'].includes(c)){s.indicators++;flagged++}});
 const T=[[rows.length,'observations recorded'],[Object.keys(sites).length,'sites documented'],[reviewed,'confirmed by a person'],[flagged,'sightings of visible concern']];
 $('#tiles').innerHTML=T.map(([n,l])=>`<div class="tile"><b>${n}</b><span>${l}</span></div>`).join('');
 const max=Math.max(1,...Object.values(cats));
 $('#catBars').innerHTML=rows.length?Object.entries(CATS).map(([k,v])=>{const n=cats[k]||0;return `<div class="cbar"><span>${v}</span><div><i style="width:${Math.round(n/max*100)}%"></i></div><b>${n}</b></div>`}).join(''):'<p class="muted">No observations yet. Add a photo to start your community record.</p>';
 const sl=Object.values(sites).filter(s=>s.indicators>0).sort((a,b)=>b.indicators-a.indicators).slice(0,6);
 $('#siteList').innerHTML=sl.length?sl.map(s=>`<div class="site"><b>${esc(s.site)}</b><span class="muted">${s.indicators} of ${s.observations} ${s.observations==1?'photo shows':'photos show'} something visible</span></div>`).join('')+'<p class="muted">Repeated sightings at one place are worth sharing with the people who manage that waterway.</p>':'<p class="muted">No repeated sightings yet.</p>';
 $('#greenNote').innerHTML=`<h2>🌱 Where your data lives</h2><p>Records are kept in this project's shared database and the cleaned photo is sent to the AI provider to be described. Location data is removed from every photo before it is saved. Only people with the access code can see the records.</p><p class="muted">RiverLens also has a fully offline version that runs the model on a local computer and sends nothing anywhere. Energy use of the different set-ups is being measured as part of the research behind RiverLens. No energy saving is claimed here.</p>`}
// status
async function loadStatus(){try{STATUS=await (await fetch('/api/status',{credentials:'same-origin'})).json()}catch(e){STATUS={ai_configured:false,db_configured:false,access_code_required:false,unreachable:true}}banner();return STATUS}
async function loadSettings(){await loadStatus();let n='—';try{n=(await allRows()).length}catch(e){}
 $('#statusCard').innerHTML=`<h2>System status</h2><dl><dt>AI analysis</dt><dd>${STATUS.ai_configured?'<span class="tag ok">on</span> '+esc(STATUS.provider)+' · '+esc(STATUS.model):'<span class="tag warn">off (demo mode)</span>'}</dd>
 <dt>Database</dt><dd>${STATUS.db_configured?'<span class="tag ok">connected</span>':'<span class="tag bad">not connected</span>'}</dd><dt>Access code</dt><dd>${STATUS.access_code_required?'required':'<span class="tag warn">not set: records are open to anyone with the link</span>'}</dd><dt>Records stored</dt><dd>${n}</dd></dl>`}
$('#logoutBtn').onclick=()=>{document.cookie='rl_auth=; Max-Age=0; Path=/';location.reload()};
function showLogin(){$('#login').hidden=false;$('#lcode').focus()}
$('#loginForm').onsubmit=async e=>{e.preventDefault();try{await post('/api/login',{code:$('#lcode').value});$('#login').hidden=true;$('#lcode').value='';$('#lmsg').textContent='';await loadStatus();refreshAll();refreshBadge()}catch(err){$('#lmsg').textContent=err.message}};
(async()=>{await loadStatus();if(STATUS.access_code_required&&!STATUS.authed)showLogin();else refreshBadge()})();
