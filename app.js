/* RMSS Desk app. Reads ONE bundle from the private data repo with a read-only token kept in localStorage.
   Never builds FOMO URLs: every link comes from the bundle (links.coin_url on the desk). */
(function(){
const DATA_URL='https://api.github.com/repos/rokys866-source/Rmss1/contents/desk.json';
const POLL_MS=15000, STALE_S=120;
const qs=new URLSearchParams(location.search);
const SRC=qs.get('src');                 // local file source (testing/screenshots only)
const $=s=>document.querySelector(s);
let B=null, etag=null, err=null, lastFetch=0, tab=qs.get('tab')||'desk', sel=qs.get('coin')||null, discAnim=null;

// one-time token handoff: #g=<token>  ->  localStorage, then strip from the address bar
(function(){const m=location.hash.match(/[#&]g=([^&]+)/);
  if(m){try{localStorage.setItem('gh',decodeURIComponent(m[1]));}catch(e){} history.replaceState(null,'',location.pathname+location.search);}})();
const token=()=>{try{return localStorage.getItem('gh')}catch(e){return null}};

async function load(){
  if(!SRC && !token()){err={kind:'token',msg:'No access key on this phone yet.'};render();return;}
  try{
    let r;
    if(SRC){r=await fetch(SRC,{cache:'no-store'});}
    else{const h={'Authorization':'Bearer '+token(),'Accept':'application/vnd.github.raw+json'};if(etag)h['If-None-Match']=etag;
      r=await fetch(DATA_URL,{headers:h,cache:'no-store'});}
    lastFetch=Date.now();
    if(r.status===304){err=null;render();return;}
    if(r.status===401||r.status===403){err={kind:'auth',msg:`GitHub refused the access key (${r.status}). It may have expired.`};render();return;}
    if(r.status===404){err={kind:'missing',msg:'No desk data published yet (404).'};render();return;}
    if(!r.ok){err={kind:'http',msg:`Couldn't load desk data (HTTP ${r.status}).`};render();return;}
    etag=r.headers.get('ETag');B=await r.json();err=null;render();
  }catch(e){err={kind:'net',msg:'Offline or GitHub unreachable. Retrying every 15 s.'};render();}
}

const money=v=>v==null?'—':(v<0?'-':'')+'$'+Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const sgn=v=>v==null?'—':(v>=0?'+':'-')+'$'+Math.abs(v).toFixed(2);
const hm=t=>t?new Date(t*1000).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Stockholm'}):'—';
const ago=t=>{if(!t)return'never';const s=Math.round(Date.now()/1000-t);return s<60?s+'s ago':s<3600?Math.round(s/60)+' min ago':Math.round(s/3600)+'h ago';};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// only the exact shapes links.py produces (the app never builds a FOMO URL itself)
const LINK_RE=[/^https:\/\/fomo\.family\/coin\?address=[A-Za-z0-9]+&chainId=(1399811149|4663|8453|56)&r=savipww&source=share_link$/,
  /^https:\/\/fomo\.family\/profile\/[A-Za-z0-9_.]+\?source=share_link&r=savipww$/, /^https:\/\/fomo\.family\/r\/savipww$/];
const safeLink=u=>(typeof u==='string'&&LINK_RE.some(r=>r.test(u)))?u:null;

function banner(){
  const el=$('#banner');el.className='banner hidden';
  if(B&&B.sample){el.className='banner info';el.textContent='SAMPLE DATA · for screenshots only, not real trades';}
  if(err&&B){el.className='banner';el.textContent=err.msg+' Showing the last data I had.';return;}
  if(B&&!err){const age=Date.now()/1000-(B.generated_ts||0);
    if(age>STALE_S&&!B.sample){el.className='banner warn';el.textContent=`Desk hasn't published for ${ago(B.generated_ts)}. It may be restarting.`;}}
}
function header(){
  const m=$('#mode');if(!B){m.className='pill';m.textContent='—';$('#age').textContent='';return;}
  m.className='pill '+(B.mode==='LIVE'?'live':'paper');m.textContent=B.mode+(B.paused?' · paused':'');
  $('#age').textContent=B.sample?'sample':('updated '+ago(B.generated_ts));
}
function errorScreen(){
  if(err.kind==='token') return `<div class="empty"><div class="ic">🔑</div><b>Open your setup link once</b><p>This phone has no access key yet. Open the one-time link the desk sent you on Telegram (it ends in <span class="mono">#g=…</span>). The key stays on this phone only.</p></div>`;
  if(err.kind==='auth') return `<div class="empty err"><div class="ic">⛔</div><b>Access key refused</b><p>${esc(err.msg)} Make a new read-only key for Rmss1 and open the setup link again.</p><button class="btn ghost" onclick="localStorage.removeItem('gh');location.reload()">Forget this key</button></div>`;
  return `<div class="empty err"><div class="ic">📡</div><b>Can't load the desk</b><p>${esc(err.msg)}</p><button class="btn ghost" onclick="location.reload()">Retry</button></div>`;
}

function deskTab(){
  const S=B.state,A=S.agents;
  const sc=A.scanner,au=A.auditor,an=A.analyst,ex=A.executor,rk=A.risk;
  const lastAud=au.last, anl=an.last;
  const exitTxt=rk.last_exit?(rk.last_exit.reason==='trail'?'Trailed out':rk.last_exit.reason==='stop'?'Stopped':rk.last_exit.reason==='timeout'?'Dead money':'Pulled'):'No exits yet';
  const lastFill=(B.activity||[]).find(a=>a.agent==='executor'&&a.kind==='bought');
  const fresh=lastFill&&(Date.now()/1000-lastFill.ts)<60;
  const audCoin=lastAud&&lastAud.mint&&B.coins[lastAud.mint];
  const dots=audCoin&&audCoin.auditor?audCoin.auditor.layers.map(l=>`<i class="${l.ok===true?'ok':(l.ok===false?'bad':'')}"></i>`).join(''):'<i></i>'.repeat(8);
  return `
  <div class="summary">
    <div class="kpi"><span>Stack</span><b>${money(S.stack)}</b></div>
    <div class="kpi"><span>Free</span><b>${money(S.free)}</b></div>
    <div class="kpi"><span>Tonight</span><b class="${S.pnl_night>=0?'ok':'bad'}">${sgn(S.pnl_night)}</b></div>
  </div>
  <div class="card"><h3><span>1 · Scanner</span><span>${hb(sc.hb)}</span></h3>
    <div class="big">${sc.watching?'Watching '+sc.watching:'Listening'}</div>
    <div class="sub">${sc.graduated_tonight} graduated coins tonight${sc.last?' · last: '+esc(sc.last.title):''}</div></div>
  <div class="card"><h3><span>2 · Auditor</span><span>${au.audited} audited · ${au.passed} passed</span></h3>
    <div class="big">${lastAud?esc(lastAud.title):'Waiting for a coin'}</div>
    <div class="sub">${lastAud?esc(lastAud.sub):'8 safety layers, yes or no'}</div><div class="dots">${dots}</div></div>
  <div class="card"><div class="row"><div><h3><span>3 · Analyst${an.mode==='rules'?' (rules)':''}</span></h3>
    <div class="big">Scoring</div><div class="sub">${anl?esc((B.coins[anl.mint]||{}).symbol||'')+' · '+(anl.passed?'passed':'rejected: '+esc((anl.failed||[])[0]||'')):'No coin scored yet'}</div></div>
    ${ringSVG(anl?anl.score:null,an.threshold)}</div></div>
  <div class="card"><h3><span>4 · Executor</span><span>${B.mode}</span></h3>
    <div class="big">${ex.trades} trade${ex.trades===1?'':'s'}</div>
    <div class="sub">${lastFill?esc(lastFill.right):'No fills tonight'}</div>
    ${lastFill?`<div class="bar ${fresh?'':'done'}" id="exbar"><i style="width:${fresh?0:100}%"></i></div><div class="sub" id="exbartx">${fresh?'Executing... 0%':'✓ Filled'}</div>`:''}</div>
  <div class="card"><h3><span>5 · Risk</span><span>${S.open.length} open</span></h3>
    <div class="big">${rk.guarding?'Guarding':'Idle'}</div><div class="sub">Last exit: ${exitTxt}</div>
    <div class="btns"><span class="pill red">stop -${rk.stop_pct}%</span><span class="pill green">trail ${rk.trail_pct}%</span></div></div>
  ${S.open.length?`<div class="grp">Open positions</div><div class="card list">${S.open.map(p=>`<div class="it tap" data-coin="${p.mint}"><div><div class="t">${esc(p.name)}</div><div class="s">${p.status} · in ${money(p.size_usd)} @ ${fmtPrice(p.entry_price)}</div></div><div class="r">${fmtPrice(p.last_price)}<small>${p.last_price?((p.last_price/p.entry_price-1)*100).toFixed(1)+'%':''}</small></div></div>`).join('')}</div>`:''}`;
}
function hb(t){return t?('alive '+ago(t)):'no heartbeat';}

function activityTab(){
  const a=B.activity||[];
  if(!a.length) return `<div class="empty"><div class="ic">🌙</div><b>Quiet so far</b><p>Nothing has happened tonight yet. Every spot, reject, buy and exit lands here.</p></div>`;
  return `<div class="card list">${a.map(x=>`<div class="it ${x.mint?'tap':''}" ${x.mint?`data-coin="${x.mint}"`:''}><div><div class="t">${esc(x.title)}</div><div class="s">${esc(x.sub)}</div></div><div class="r">${esc(x.right)}<small>${hm(x.ts)}</small></div></div>`).join('')}</div>`;
}

function coinTab(){
  const coins=B.coins||{},keys=Object.keys(coins);
  if(!keys.length) return `<div class="empty"><div class="ic">🪙</div><b>No coins tonight</b><p>Coins show up here once the Auditor checks them, the Executor pushes them, or Risk holds them.</p></div>`;
  const openM=new Set(B.state.open.map(p=>p.mint));
  keys.sort((a,b)=>(openM.has(b)-openM.has(a))||((coins[b].updated||0)-(coins[a].updated||0)));
  if(!sel||!coins[sel])sel=keys[0];
  const c=coins[sel],pos=B.state.open.concat(B.state.closed).filter(p=>p.mint===sel).pop();
  const link=safeLink((pos&&pos.link)||(c.scanner&&c.scanner.link));
  const an=c.analyst,ex=c.executor,au=c.auditor;
  const exitLabel=pos&&pos.trail_active?'Risk trailing stop':'Risk trailing stop';
  return `<div class="chips">${keys.map(k=>`<button class="chip ${k===sel?'on':''}" data-coin="${k}">${esc(coins[k].symbol||k.slice(0,6))}${openM.has(k)?' ●':''}</button>`).join('')}</div>
  <div class="card"><div class="row"><div><div class="big">${esc(c.name||'')} <span class="sub">${esc(c.symbol||'')}</span></div><div class="sub">${esc(c.verdict||'')}</div></div>
    ${pos?`<span class="pill ${pos.status==='closed'?(pos.pnl_usd>=0?'green':'red'):''}">${pos.status==='closed'?sgn(pos.pnl_usd):pos.status}</span>`:''}</div>
    <canvas class="chart" id="pc"></canvas>
    <div class="legend"><span><i style="border-color:#8a96a3;border-top-style:dotted"></i>entry</span><span><i style="border-color:#ff9f2e;border-top-style:dashed"></i>Risk trailing stop</span></div>
    ${link?`<div class="btns"><a class="btn ${pos&&pos.status!=='closed'?'red':''}" href="${link}" target="_blank" rel="noopener">${pos&&pos.status!=='closed'?'Sell on FOMO':'Open on FOMO'}</a></div>`:''}</div>
  <div class="card"><h3><span>Audit</span><span>${au?(au.passed?'passed':'rejected'):'not audited'}</span></h3>
    <canvas class="disc" id="disc"></canvas>
    <div class="layers">${au?au.layers.map(l=>`<div class="kv"><span>${l.n} · ${esc(l.name)}</span><span class="${l.ok===true?'ok':(l.ok===false?'bad':'sub')}">${esc(l.detail)}</span></div>`).join(''):'<div class="sub">The Auditor hasn\'t checked this coin.</div>'}</div></div>
  <div class="card"><div class="row"><div><h3><span>Analyst · ${an?esc(an.model):'—'}</span></h3>
    ${an&&an.answers?Object.entries(an.answers).map(([k,v])=>`<div class="kv"><span>${k}</span><span>${v.toFixed(2)}</span></div>`).join(''):`<div class="sub">${an?esc((an.failed||[])[0]||''):'Not scored'}</div>`}</div>
    ${ringSVG(an?an.score:null,(B.settings||{})['analyst.min_score']||70)}</div></div>
  ${ex?`<div class="card"><h3><span>Executor</span><span>${esc(ex.mode)}</span></h3><div class="kv"><span>Status</span><span>${esc(ex.status)}${ex.reason?' · '+esc(ex.reason):''}</span></div>
    <div class="kv"><span>Size</span><span>${ex.sizeUsd?money(ex.sizeUsd)+' · '+ex.stackPct+'% of stack':'—'}</span></div><div class="kv"><span>Signal price</span><span>${fmtPrice(ex.signalPrice)}</span></div></div>`:''}
  ${pos&&pos.status==='closed'?`<div class="card"><h3><span>Exit</span><span>${esc(pos.reason)}</span></h3><div class="kv"><span>Entry → exit</span><span>${fmtPrice(pos.entry_price)} → ${fmtPrice(pos.exit_price)}</span></div><div class="kv"><span>PnL after fees</span><span class="${pos.pnl_usd>=0?'ok':'bad'}">${sgn(pos.pnl_usd)} (${pos.pct.toFixed(1)}%)</span></div><div class="kv"><span>Fees</span><span>${money(pos.fees_usd)}</span></div></div>`:''}
  <div class="sub mono">${esc(sel)}</div>`;
}
function afterCoin(){
  const c=B.coins[sel];if(!c)return;
  const pos=B.state.open.concat(B.state.closed).filter(p=>p.mint===sel).pop();
  const pts=(B.chart||{})[sel]||[];
  const cv=$('#pc');if(cv)drawPrice(cv,pts,{entry:pos&&pos.entry_price,exitLine:pos&&pos.status==='open'?pos.exit_line:null,exitLabel:'trail stop'});
  const d=$('#disc');if(d){const L=c.auditor&&c.auditor.layers;if(discAnim)clearInterval(discAnim);let p=0;drawDisc(d,L,0);
    if(L){discAnim=setInterval(()=>{p+=0.25;drawDisc(d,L,p);if(p>=8){clearInterval(discAnim);discAnim=null;}},45);}}
}

function accountTab(){
  const s=B.settings||{};
  const groups=[['Desk',k=>!k.includes('.')],['Scanner',k=>k.startsWith('scanner.')],['Auditor',k=>k.startsWith('auditor.')],
    ['Analyst (rules)',k=>k.startsWith('analyst')],['Executor',k=>k.startsWith('executor.')||k==='executor.below_min'],['Risk',k=>k.startsWith('risk.')]];
  return `<div class="card"><h3><span>Account</span><span>${B.sample?'sample':''}</span></h3>
    ${(()=>{const L=B.links||{},pu=safeLink(L.profile),su=safeLink(L.signup);return `
    <div class="kv"><span>FOMO profile</span><span>${pu?`<a class="lnk" href="${pu}" target="_blank" rel="noopener">@${esc(s.fomo_handle)}</a>`:esc(s.fomo_handle)}</span></div>
    ${su?`<div class="btns"><button class="btn" id="invite" data-url="${su}">Invite a friend</button></div>`:''}`})()}
    <div class="kv"><span>Mode</span><span>${esc(B.mode)}</span></div>
    <div class="kv"><span>Analyst</span><span>${esc(s['analyst.mode'])}</span></div>
    <div class="kv"><span>Notifications</span><span>Telegram</span></div>
    <div class="sub" style="margin-top:8px">Settings are read-only here. Change them on Telegram, e.g. <span class="mono">set risk.stop_pct 5</span>, <span class="mono">stack 1240</span>, <span class="mono">pause</span>.</div></div>
  ${groups.map(([g,f])=>{const ks=Object.keys(s).filter(f).filter(k=>!['fomo_handle'].includes(k));return ks.length?`<div class="grp">${g}</div><div class="card">${ks.map(k=>`<div class="kv"><span>${esc(k.replace(/^(scanner|auditor|analyst|executor|risk)\./,''))}</span><span>${esc(JSON.stringify(s[k]))}</span></div>`).join('')}</div>`:''}).join('')}
  <div class="grp">This phone</div><div class="card"><div class="kv"><span>Access key</span><span>${token()?'stored':'none'}</span></div>
  <div class="btns"><button class="btn ghost" onclick="localStorage.removeItem('gh');location.reload()">Forget key</button></div></div>`;
}

function render(){
  banner();header();
  ['desk','activity','coin','account'].forEach(t=>{$('#tab-'+t).classList.toggle('hidden',t!==tab);document.querySelector(`[data-tab=${t}]`).classList.toggle('on',t===tab);});
  const el=$('#tab-'+tab);
  if(!B){el.innerHTML=err?errorScreen():'<div class="empty"><div class="ic">⏳</div><b>Loading the desk…</b></div>';return;}
  el.innerHTML=tab==='desk'?deskTab():tab==='activity'?activityTab():tab==='coin'?coinTab():accountTab();
  if(tab==='coin')afterCoin();
  if(tab==='desk'){const bar=$('#exbar');if(bar&&!bar.classList.contains('done')){let p=0;const i=setInterval(()=>{p=Math.min(100,p+100/12);bar.firstChild.style.width=p+'%';$('#exbartx').textContent=p<100?`Executing... ${Math.round(p)}%`:'✓ Filled';if(p>=100){bar.classList.add('done');clearInterval(i);}},100);}}
}
document.addEventListener('click',e=>{
  const iv=e.target.closest('#invite');if(iv){const u=iv.dataset.url;
    if(navigator.share){navigator.share({title:'FOMO',text:'Join me on FOMO',url:u}).catch(()=>{});}
    else if(navigator.clipboard){navigator.clipboard.writeText(u).then(()=>{iv.textContent='Link copied';});}else{window.open(u,'_blank');}
    return;}
  const t=e.target.closest('[data-tab]');if(t){tab=t.dataset.tab;render();return;}
  const c=e.target.closest('[data-coin]');if(c){sel=c.dataset.coin;tab='coin';render();window.scrollTo(0,0);}
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
setInterval(()=>{if(!document.hidden)load();},POLL_MS);
setInterval(()=>{if(B){header();}},5000);
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
load();
})();
