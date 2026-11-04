/* Grok Bot · RMSS desk app (STEP 8). Plan B: reads ONE bundle (desk.json) from the private data repo with a read-only
   token kept in localStorage. Never builds a FOMO URL: every link comes from the bundle (links.py on the desk).
   Settings, pause and mode are shown read-only here: Plan B has no endpoint to write to, so changes go through Telegram. */
(function(){
const DATA_URL='https://api.github.com/repos/rokys866-source/Rmss1/contents/desk.json';
const POLL_S=15, STALE_S=120, TZ='Europe/Stockholm';
const qs=new URLSearchParams(location.search), SRC=qs.get('src');
const $=s=>document.querySelector(s), RM=Charts.RM;
let B=null, etag=null, err=null, lastOk=0, nextTry=0, tab=qs.get('tab')||'home', sheet=null, range='1D', actN=30, prevLast=null, prevMarks=-1, beamT=null;

(function(){const m=location.hash.match(/[#&]g=([^&]+)/);
  if(m){try{localStorage.setItem('gh',decodeURIComponent(m[1]));}catch(e){} history.replaceState(null,'',location.pathname+location.search);}})();
const token=()=>{try{return localStorage.getItem('gh')}catch(e){return null}};

async function load(){
  nextTry=Date.now()+POLL_S*1000;
  if(!SRC&&!token()){err={kind:'token'};render();return;}
  try{let r;
    if(SRC)r=await fetch(SRC,{cache:'no-store'});
    else{const h={'Authorization':'Bearer '+token(),'Accept':'application/vnd.github.raw+json'};if(etag)h['If-None-Match']=etag;
      r=await fetch(DATA_URL,{headers:h,cache:'no-store'});}
    if(r.status===304){err=null;lastOk=Date.now();render();return;}
    if(r.status===401||r.status===403){err={kind:'auth',code:r.status};render();return;}
    if(!r.ok){err={kind:'http',code:r.status};render();return;}
    etag=r.headers.get('ETag');B=await r.json();err=null;lastOk=Date.now();render();
  }catch(e){err={kind:'net'};render();}
}

// ---------- helpers ----------
const money=v=>v==null?'n/a':(v<0?'-':'')+'$'+Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const usd0=v=>v==null?'n/a':'$'+Math.round(v).toLocaleString('en-US');
const sgn=v=>(v>=0?'+':'-')+'$'+Math.abs(v).toFixed(2);
const pctS=v=>v==null?'':(v>=0?'+':'')+v.toFixed(2)+'%';
const hm=t=>t?new Date(t*1000).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:TZ}):'';
const tsOf=t=>typeof t==='number'?t:(t?Date.parse(t)/1000:null);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LINK_RE=[/^https:\/\/fomo\.family\/coin\?address=[A-Za-z0-9]+&chainId=(1399811149|4663|8453|56)&r=savipww&source=share_link$/,
  /^https:\/\/fomo\.family\/profile\/[A-Za-z0-9_.]+\?source=share_link&r=savipww$/,/^https:\/\/fomo\.family\/r\/savipww$/];
const safeLink=u=>(typeof u==='string'&&LINK_RE.some(r=>r.test(u)))?u:null;
const price=p=>p==null?'n/a':(p>=1?'$'+p.toFixed(4):'$'+p.toPrecision(4));
const age=t=>{if(!t)return'';const m=Math.max(0,Math.round((Date.now()/1000-t)/60));return m<60?m+'m old':(m<2880?Math.round(m/60)+'h old':Math.round(m/1440)+'d old');};
const L=l=>({n:l.n,name:l.name,pass:l.pass!=null?l.pass:l.ok,value:l.value!=null?l.value:l.detail});   // new and old layer formats
const coin=m=>B&&B.coins&&B.coins[m];
const nm=c=>c?(c.symbol||c.name||(c.mint||'').slice(0,6)):'';
const S=()=>B.settings||{};
const hbAge=k=>B.heartbeats&&B.heartbeats[k]?Date.now()/1000-B.heartbeats[k]:1e9;
const HB={scanner:'scanner.ws',auditor:'auditor',analyst:'main',executor:'executor',risk:'risk'};
const AG=['scanner','auditor','analyst','executor','risk'], AC={scanner:'#64d2ff',auditor:'#0a84ff',analyst:'#ffd60a',executor:'#00d35a',risk:'#ff6b9a'};
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
function toast(t){const d=document.createElement('div');d.className='toast';d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),1800);}

// ---------- odometer: each changed digit rolls 600ms ease-out, 30ms stagger right to left ----------
function odometer(el,str){
  const old=el.dataset.v||'';el.dataset.v=str;
  if(RM||old.length!==str.length){el.innerHTML=[...str].map(ch=>/\d/.test(ch)?`<span class="od"><span style="transform:translateY(-${ch}em)">${[...'0123456789'].map(d=>`<i>${d}</i>`).join('')}</span></span>`:`<span>${esc(ch)}</span>`).join('');return;}
  const cols=el.children;[...str].forEach((ch,i)=>{if(ch===old[i]||!/\d/.test(ch))return;const s=cols[i].firstElementChild;
    s.style.transitionDelay=((str.length-1-i)*30)+'ms';s.style.transform=`translateY(-${ch}em)`;});
}

// ---------- error row / states ----------
function errRow(){const e=$('#err');
  const stale=B&&!B.sample&&(Date.now()/1000-(B.generated_ts||0))>STALE_S;
  if(B&&(err||stale)){e.classList.remove('hidden');
    const n=Math.max(0,Math.ceil((nextTry-Date.now())/1000));
    e.textContent=`Desk offline · retrying in ${n}s · last update ${hm(B.generated_ts)}`;}
  else e.classList.add('hidden');}
setInterval(errRow,1000);
function setup(){
  if(err.kind==='token')return `<div class="empty"><b>Open your setup link once</b><p>This phone has no access key yet. Open the one-time link from Telegram (it ends in <span class="mono">#g=…</span>). The key stays on this phone only.</p></div>`;
  if(err.kind==='auth')return `<div class="empty"><b>Access key refused (${err.code})</b><p>Make a new read-only key for the data repo and open the setup link again.</p><button class="btn gh" id="forget">Forget this key</button></div>`;
  return null;}
const skel=()=>`<div class="sk" style="height:66px;width:70%;margin:12px 0"></div><div class="sk" style="height:22px;width:40%"></div><div class="sk" style="height:220px;margin:14px 0"></div><div class="sk" style="height:44px"></div><div class="sk" style="height:${Math.round((innerWidth-32)*470/504)}px;margin:18px 0;border-radius:${Math.round((innerWidth-32)*42/504)}px"></div><div class="sk" style="height:300px"></div>`;

// ---------- rows ----------
const KC={bought:'#0a84ff',sold:'#00d35a',stopped:'#ff453a',rejected:'#2c2c2e'};
function actRow(r,i){const c=coin(r.mint);const ini=esc((r.title||'').split(' ').slice(1).join(' ').slice(0,1)||'?');
  const rc=r.kind==='sold'?(String(r.right).startsWith('-')?'dn':'up'):(r.kind==='stopped'?'dn':(r.kind==='rejected'?'s':''));
  return `<button class="li" data-act="${i}" style="width:100%;text-align:left"><span class="ico" style="background:${KC[r.kind]||'#2c2c2e'}">${ini}</span>
  <span class="m"><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></span><span class="v ${rc}">${esc(r.right)}</span></button>`;}
function openAct(r){if(!r||!r.mint)return;if(r.kind==='rejected'&&!/^Analyst/.test(r.sub||'')&&!/^Executor/.test(r.sub||''))open('audit',r.mint);else open('coin',r.mint);}

// ---------- agent cards ----------
function agentCard(a){const st=B.state.agents[a]||{};const ds=(B.decisions||{})[a]||[];const col=AC[a];
  let body='';
  if(a==='scanner'){const f=ds.slice(0,4).map(d=>d.verdict==='kill'?`<div class="kill"><b>${esc(d.name)}</b> · ${esc(d.reason)}</div>`:`<div>${esc(d.name)} <span class="up">→ auditor</span></div>`).join('');
    body=`<div class="k num">${st.pools||0} pools</div><div class="s">${st.watching||0} waiting · ${st.passed||0} passed · ${st.killed||0} killed</div><div class="feed">${f||'<div class="s">Listening for graduations</div>'}</div>`;}
  if(a==='auditor'){const lc=coin(st.last_mint);const ls=lc&&lc.auditor?lc.auditor.layers.map(L):[];
    const strips=[0,1,2,3,4,5,6,7].map(i=>`<i class="${ls[i]?(ls[i].pass===true?'g':'r'):''}"></i>`).join('');
    const line=st.running?'taking apart...':(lc&&lc.auditor?(lc.auditor.passed?`<span class="up">8/8 → Executor</span>`:`<span class="dn">${esc(lc.auditor.reason||'rejected')}</span>`):'No coin taken apart yet');
    body=`<div class="k num">${st.taken_apart||0} taken apart</div><div class="s">${esc(st.running?nm(st.running):(lc?nm(lc):''))}</div><div class="strips">${strips}</div><div>${line}</div><div class="s">${st.rejected||0} rejected</div>`;}
  if(a==='analyst'){const l=st.last;body=`<div class="k">Scoring</div><div class="ringw"><canvas id="ring-${a}"></canvas><div><div class="k num" style="font-size:28px">${l&&l.score!=null?l.score:'n/a'}</div><div class="s">${l?esc(nm(coin(l.mint))||l.name||''):'No coin scored yet'}</div><div class="s">${l?esc(l.verdict||''):''} · ${esc(st.mode||'rules')} mode</div></div></div><div class="s">green from ${st.threshold}</div>`;}
  if(a==='executor'){const pend=(B.state.open||[]).find(p=>p.status==='pending');const lf=st.last_fill;
    let bar='';if(pend){const w=(S()['executor.confirm_window_min']||5)*60;const n=Math.min(99,Math.round(100*(Date.now()/1000-pend.opened_at)/w));bar=`<div class="bar"><i style="width:${n}%"></i></div><div>Executing... ${n}%</div>`;}
    else if(lf)bar=`<div class="bar"><i style="width:100%"></i></div><div class="up">✓ Filled · ${esc(lf.title.replace('Bought ',''))}</div>`;
    body=`<div class="k num">${st.trades||0} trades</div><div>${lf?esc(lf.right):money(B.state.stack*(st.stack_pct||8)/100)+' · '+st.stack_pct+'% of stack'}</div>${bar||'<div class="s">No trade yet</div>'}`;}
  if(a==='risk'){const le=st.last_exit;body=`<div class="k">${st.guarding?'Guarding':'Idle'}</div><div>${le?esc(le.reason==='stop'?'Stopped '+le.name:'Trailed out '+le.name):'<span class="s">No exit yet</span>'}</div><div style="display:flex;gap:8px"><span class="tp r">stop -${st.stop_pct}%</span><span class="tp g">trail ${st.trail_pct}%</span></div>`;}
  return `<div class="ac" data-agent="${a}"><div class="hd"><i style="background:${col}"></i>${cap(a)}${st.paused?' <span class="pill paper">paused</span>':''}</div>${body}</div>`;}
const running=()=>AG.filter(a=>!(B.state.agents[a]||{}).paused&&hbAge(HB[a])<STALE_S).length;

// ---------- screens ----------
function home(){const el=$('#tab-home');
  if(!el.dataset.built){el.innerHTML=`<div class="bal"><div class="big num" id="odo"></div><span class="pill paper hidden" id="pb">PAPER</span></div>
    <div class="row2"><span id="today" class="num"></span><span class="pill mult num" id="mult"></span></div>
    <div class="chart"><canvas id="line"></canvas><div class="emp hidden" id="lemp">Waiting for the first trade</div></div>
    <div class="rng" id="rng">${['LIVE','1H','4H','1D','1W','ALL'].map(r=>`<button data-r="${r}">${r}</button>`).join('')}</div>
    <h2 id="agh"></h2><div class="car" id="car"></div><h2>Activity <button data-goto="activity">See all</button></h2><div class="list" id="last5"></div>`;el.dataset.built=1;}
  const st=B.state;odometer($('#odo'),money(st.balance));$('#pb').classList.toggle('hidden',B.mode!=='PAPER');
  const t=$('#today');t.textContent=pctS(st.today_pct)+' today';t.className='num '+(st.today_pct>=0?'up':'dn');$('#mult').textContent=(st.multiplier||1).toFixed(2)+'×';
  [...$('#rng').children].forEach(b=>b.classList.toggle('on',b.dataset.r===range));
  drawLine();
  $('#agh').textContent=`Agents · ${running()} running`;const car=$('#car'),sl=car.scrollLeft;car.innerHTML=AG.map(agentCard).join('');car.scrollLeft=sl;drawRings();
  const a=(B.activity||[]).slice(0,5);$('#last5').innerHTML=a.length?a.map(actRow).join(''):'<div class="empty">Nothing yet tonight</div>';}
function drawLine(){const cv=$('#line');if(!cv)return;const pts=(B.chart||{})[range]||[],marks=B.marks||[];
  const noTrades=!(B.state.open||[]).length&&!(B.state.closed||[]).length&&!marks.length;$('#lemp').classList.toggle('hidden',!noTrades);
  const last=pts.length?pts[pts.length-1][0]:null,isNew=prevLast!=null&&last!==prevLast&&!RM,mNew=prevMarks>=0&&marks.length!==prevMarks&&!RM;prevLast=last;prevMarks=marks.length;
  const t0=performance.now();(function f(){const k=Math.min(1,(performance.now()-t0)/250),m=Math.min(1,(performance.now()-t0)/200);
    Charts.line(cv,pts,B.state.start,noTrades?[]:marks,{anim:isNew?k:1,markAnim:mNew?m:1});if((isNew&&k<1)||(mNew&&m<1))requestAnimationFrame(f);})();}
function drawRings(){const a=B.state.agents.analyst||{},cv=document.getElementById('ring-analyst');if(cv)Charts.ring(cv,a.last?a.last.score:null,a.threshold||70);
  document.querySelectorAll('canvas[data-ring]').forEach(c=>Charts.ring(c,a.last?a.last.score:null,a.threshold||70));}

const TG={scanner:'Scanner',auditor:'Auditor',analyst:'Analyst',executor:'Executor',risk:'Risk'};
function agents(){const op=(B.state.open||[]).some(p=>p.status!=='pending');
  $('#tab-agents').innerHTML=`<h2>Agents</h2><p class="note">Pause or resume on Telegram: send “pause scanner” or “resume scanner”. This hosting has no way to write back to the desk.</p>`+AG.map(a=>{const st=B.state.agents[a]||{};
    const down=hbAge(HB[a])>STALE_S,dot=st.paused?'p':(down?'d':''),stat=st.paused?'paused':(down?'not seen for '+Math.round(hbAge(HB[a])/60)+' min':'running');
    const count={scanner:(st.pools||0)+' pools',auditor:(st.taken_apart||0)+' taken apart',analyst:(st.scored||0)+' scored',executor:(st.trades||0)+' trades',risk:(st.exits||0)+' exits'}[a];
    const lock=a==='risk'&&op;const ds=(B.decisions||{})[a]||[];
    return `<div class="full" id="ag-${a}"><div class="hd"><span class="sdot ${dot}"></span><b>${cap(a)}</b><span class="s num">${count} today</span>
      <span class="sw ${st.paused?'':'on'} lock" title="${lock?'Risk is locked while a position is open':'Change on Telegram: '+(st.paused?'resume ':'pause ')+a}"></span></div>
      <div class="note">${stat}${lock?' · locked while a position is open':''} · Telegram: “${st.paused?'resume':'pause'} ${a}”</div>
      <div>${ds.length?ds.map(d=>{const l=safeLink(d.link);return `<div class="dec"><span class="s num">${hm(d.ts)}</span><span>${l?`<a href="${l}" target="_blank" rel="noopener">${esc(d.name||'')}</a>`:esc(d.name||'')} · <b>${esc(d.verdict)}</b></span><span class="r">${esc(d.reason||'')}</span></div>`}).join(''):'<div class="empty">Nothing yet tonight</div>'}</div>
      <button class="btn gh" data-set="${a}" style="min-height:44px;margin:10px 0 0">Settings</button></div>`;}).join('');}

function activity(){const a=B.activity||[];
  $('#tab-activity').innerHTML=`<h2>Activity</h2><div class="list">${a.length?a.slice(0,actN).map(actRow).join(''):'<div class="empty">Nothing yet tonight</div>'}</div>${a.length>actN?'<button class="btn gh" id="more">Show more</button>':''}`;}

const GROUPS=[['Scanner','scanner.'],['Auditor','auditor.'],['Analyst','analyst.'],['Executor','executor.'],['Risk','risk.'],['Desk','']];
function account(){const s=S(),R=B.ranges||{},prof=safeLink(B.links&&B.links.profile),sign=safeLink(B.links&&B.links.signup);
  const setRow=k=>{const v=s[k],r=R[k]||[];let ctl;
    if(typeof v==='boolean')ctl=`<span class="sw ${v?'on':''} lock"></span>`;
    else if(typeof v==='number'&&typeof r[0]==='number')ctl=`<input type="number" value="${v}" readonly>`;
    else ctl=`<input type="text" value="${esc(v)}" readonly>`;
    const sl=typeof v==='number'&&typeof r[0]==='number'?`<input type="range" min="${r[0]}" max="${r[1]}" step="any" value="${v}" disabled>`:'';
    return `<div class="set"><div class="top"><span class="mono">${esc(k)}</span>${ctl}</div>${sl}</div>`;};
  const keys=Object.keys(R);
  $('#tab-account').innerHTML=`<h2>Account</h2>
   <div class="card"><div class="kv"><span>Mode</span><span class="seg"><span class="${B.mode==='PAPER'?'on':''}">PAPER</span><span class="${B.mode==='LIVE'?'on':''}">LIVE</span></span></div>
   <div class="note">Switch on Telegram: “live”, then type LIVE to confirm (needs 1 full PAPER night and a LIVE stack). “paper” switches back.</div>
   <div class="kv"><span>Stack</span><span class="num">${money(B.state.stack)}${B.mode==='PAPER'?' <span class="pill paper">PAPER</span>':''}</span></div>
   <div class="kv"><span>LIVE stack</span><span class="num">${s.live_stack?money(s.live_stack):'not set · Telegram “stack 1240”'}</span></div></div>
   <div class="list">${prof?`<a class="li" href="${prof}" target="_blank" rel="noopener"><span class="m"><b>Your FOMO profile</b><small>@${esc(s.fomo_handle)}</small></span><span class="v s">›</span></a>`:''}
   ${sign?`<button class="li" id="invite" style="width:100%;text-align:left"><span class="m"><b>Invite a friend</b><small>Share your FOMO invite</small></span><span class="v s">›</span></button>`:''}</div>
   <div class="card"><div class="kv"><span>Telegram</span><span class="${B.telegram&&B.telegram.connected?'up':'dn'}">${B.telegram&&B.telegram.connected?'connected':'not connected'}</span></div>
   <div class="kv"><span>Send test push</span><span class="s">send “test” on Telegram</span></div>
   <div class="kv"><span>Notifications</span><span class="s">Telegram only (this hosting has no web push endpoint)</span></div></div>
   <h2>Settings</h2><p class="note">Read-only here. Change any of them on Telegram, e.g. “set stop to -8%”. Every change is checked and logged.</p>
   ${GROUPS.map(([g,p])=>{const ks=keys.filter(k=>p?k.startsWith(p):!GROUPS.slice(0,5).some(x=>k.startsWith(x[1])));return ks.length?`<div class="card" id="set-${g.toLowerCase()}"><b>${g}</b>${ks.map(setRow).join('')}</div>`:'';}).join('')}
   <button class="btn gh" id="forget">Forget the access key on this phone</button>`;}

// ---------- sheets: coin, audit, search, bell ----------
const back=t=>`<header class="nav"><button class="ib" data-close aria-label="Back"><svg viewBox="0 0 24 24"><path d="M15.4 4.6L14 3.2 5.2 12l8.8 8.8 1.4-1.4L8 12z"/></svg></button><div class="t">${t}</div></header>`;
function coinSheet(m){const c=coin(m);const pos=(B.state.open||[]).find(p=>p.mint===m&&p.status!=='pending')||null;
  if(!c&&!pos)return back('Coin')+`<main><div class="empty">This coin is not in tonight's data.</div></main>`;
  const cc=c||{mint:m,name:pos.name};const mk=cc.market||{};const au=cc.auditor;const ls=au&&au.layers?au.layers.map(L):[];const g=ls.filter(l=>l.pass===true).length;
  const pr=pos?(pos.last_price||mk.price):mk.price;const since=pos&&pos.entry_price&&pr?100*(pr/pos.entry_price-1):null;
  const link=safeLink(cc.link||(pos&&pos.link));const S_=S();
  const left=pos&&pos.timeout_at?Math.max(0,Math.round((pos.timeout_at-Date.now()/1000)/60)):null;
  return back(`${esc(cc.name||nm(cc))} ${B.mode==='PAPER'?'<span class="pill paper" style="margin-left:8px">PAPER</span>':''}`)+`<main>
   <div class="row2"><span class="s">${esc(cc.symbol||'')} · Solana · ${age(cc.born)}</span>${ls.length?`<button class="shield ${au.passed?'':'r'}" data-audit="${m}">${g}/8</button>`:''}</div>
   <div class="big num" style="font-size:44px">${price(pr)}</div>${since!=null?`<div class="${since>=0?'up':'dn'}">${since>=0?'▲':'▼'} ${Math.abs(since).toFixed(2)}% since entry</div>`:''}
   <div class="chart" style="height:240px">${(cc.candles||[]).length?'<canvas id="cdl"></canvas>':'<div class="emp">No prices recorded for this coin yet</div>'}</div>
   <div class="stats" style="margin-top:12px"><div><small>Market cap</small><b>${usd0(mk.marketCap)}</b></div><div><small>Liquidity</small><b>${usd0(mk.liquidityUsd)}</b></div>
   <div><small>24h volume</small><b>${usd0(mk.vol24)}</b></div><div><small>Holders</small><b>${mk.holders!=null?mk.holders:'n/a'}</b></div></div>
   ${pos?`<div class="card"><div class="kv"><span>Your position · ${money(pos.size_usd)} in · Executor</span><span class="${since>=0?'up':'dn'}">${since!=null?sgn(pos.size_usd*since/100)+' · '+pctS(since):''}</span></div>
     <div class="kv"><span>Entry</span><span>${price(pos.entry_price)}</span></div><div class="kv"><span>Peak</span><span>${price(pos.peak)}</span></div></div>
     <div class="card"><b>Exit</b><div class="kv"><span>Stop line (-${pos.stop_pct}%)</span><span class="dn">${price(pos.stop_line)}</span></div>
     <div class="kv"><span>Trail line (${S_['risk.trail_pct']}% under peak)</span><span>${pos.trail_line?price(pos.trail_line):'starts at +'+S_['risk.trail_start_pct']+'%'}</span></div>
     <div class="kv"><span>Time left to timeout</span><span>${left!=null?Math.floor(left/60)+'h '+(left%60)+'m':'n/a'}</span></div></div>`:''}
   ${link?`<a class="btn" href="${link}" target="_blank" rel="noopener">${pos?'Sell on FOMO':'Buy on FOMO'}</a>`:''}</main>`;}
function auditSheet(m){const c=coin(m);const au=c&&c.auditor;
  if(!au||!au.layers)return back('Auditor')+`<main><div class="empty">No coin taken apart yet</div></main>`;
  const ls=au.layers.map(L),link=safeLink(c.link),pos=[...(B.state.open||[]),...(B.state.closed||[])].find(p=>p.mint===m);
  const ex=c.executor&&typeof c.executor==='object'?c.executor:null,size=pos?pos.size_usd:(ex&&(ex.sizeUsd||ex.size_usd));
  const head=au.passed?`<div class="k up" style="font:600 22px var(--disp)">Cleared · 8/8 parts</div><div class="s">${size||(ex&&ex.status)?'Sent to Executor'+(size?' · '+money(size):''):'Sent to Analyst'+(c.analyst&&c.analyst.passed===false?' · rejected there':'')}</div>`
    :`<div class="k dn" style="font:600 22px var(--disp)">Rejected · ${esc(au.reason||'')}</div><div class="s">Grok Bot won't buy ${esc(nm(c))}</div>`;
  return back(esc(nm(c)))+`<main><div class="card">${head}</div><div class="lay"><canvas id="discs"></canvas><div class="rows">${ls.map((l,i)=>`<div class="kv" id="lr${i}" style="opacity:${RM?1:0.35}"><span class="s">${l.n} · ${esc(l.name)}</span><span class="${l.pass===true?'up':(l.pass===false?'dn':'s')}">${esc(l.value)}</span></div>`).join('')}</div></div>
   <div class="card"><div class="kv"><span>Take apart before buying</span><span class="sw ${S()['auditor.enabled']!==false?'on':''} lock"></span></div><div class="note">Change on Telegram: “set auditor.enabled off” (it asks twice).</div></div>
   ${link?`<a class="btn" href="${link}" target="_blank" rel="noopener">Open on FOMO</a>`:''}</main>`;}
function beam(m){const c=coin(m),ls=c&&c.auditor&&c.auditor.layers?c.auditor.layers.map(L):null,cv=$('#discs');if(!ls||!cv)return;
  if(beamT)clearTimeout(beamT);const st=Array(8).fill('wait');
  if(RM){ls.forEach((l,i)=>st[i]=l.pass);Charts.discs(cv,st,null);return;}
  let i=0;const step=()=>{if(i>=8){Charts.discs(cv,st,null);return;}
    if(!ls[i]){st[i]='read';Charts.discs(cv,st,i);return;}            // never show a result the server didn't send: the beam waits here
    st[i]='read';Charts.discs(cv,st,i);beamT=setTimeout(()=>{st[i]=ls[i].pass;Charts.discs(cv,st,i);const r=document.getElementById('lr'+i);if(r)r.style.opacity=1;i++;beamT=setTimeout(step,150);},350);};
  step();}
function searchSheet(){return back('Search')+`<main><input class="q" id="q" placeholder="Name, symbol or mint" autocomplete="off" autocapitalize="off"><div class="list" id="qr" style="margin-top:12px"></div></main>`;}
function searchRun(q){q=q.trim().toLowerCase();const out=[];if(q)Object.values(B.coins||{}).forEach(c=>{if([c.name,c.symbol,c.mint].some(x=>x&&String(x).toLowerCase().includes(q)))out.push(c);});
  $('#qr').innerHTML=out.slice(0,20).map(c=>`<button class="li" data-coin="${esc(c.mint)}" style="width:100%;text-align:left"><span class="m"><b>${esc(c.name||nm(c))}</b><small>${esc(c.symbol||'')} · ${esc(c.verdict||'')}</small></span></button>`).join('')||(q?'<div class="empty">No coin tonight matches</div>':'');}
function bellSheet(){const p=B.pushes||[];try{localStorage.setItem('seenPush',String(p.length?p[0].ts:0));}catch(e){}
  return back('Pushes')+`<main><div class="list">${p.length?p.map(x=>{const l=safeLink(x.link);return `<${l?`a href="${l}" target="_blank" rel="noopener"`:'div'} class="li"><span class="m"><b>${esc((x.note||x.kind).split('\n')[0])}</b><small>Grok Bot · ${hm(x.ts)}${x.ok?'':' · not delivered'}</small></span></${l?'a':'div'}>`}).join(''):'<div class="empty">Nothing yet tonight</div>'}</div><p class="note">Pushes go to Telegram.</p></main>`;}
function open(kind,arg){sheet={kind,arg};renderSheet();}
function renderSheet(){const el=$('#sheet');if(!sheet||!B){el.classList.add('hidden');return;}el.classList.remove('hidden');
  const k=sheet.kind;if(k==='search'&&el.dataset.k==='search')return;el.dataset.k=k;
  el.innerHTML=k==='coin'?coinSheet(sheet.arg):k==='audit'?auditSheet(sheet.arg):k==='search'?searchSheet():bellSheet();
  if(k==='coin'){const cv=$('#cdl'),c=coin(sheet.arg),pos=(B.state.open||[]).find(p=>p.mint===sheet.arg&&p.status!=='pending');if(cv)Charts.candles(cv,c.candles,pos?pos.exit_line:null,pos?pos.entry_price:null);}
  if(k==='audit'&&!sheet.played){sheet.played=1;beam(sheet.arg);}else if(k==='audit'){const c=coin(sheet.arg);if(c&&c.auditor){Charts.discs($('#discs'),c.auditor.layers.map(l=>L(l).pass),null);document.querySelectorAll('[id^=lr]').forEach(r=>r.style.opacity=1);}}
  if(k==='search'){const q=$('#q');q.focus();q.oninput=()=>searchRun(q.value);}}

// ---------- render ----------
function render(){errRow();
  const su=err&&!B?setup():null;
  ['home','agents','activity','account'].forEach(t=>$('#tab-'+t).classList.toggle('hidden',t!==tab));
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
  if(su){$('#tab-'+tab).innerHTML=su;$('#tab-home').dataset.built='';return;}
  if(!B){if(tab==='home'&&!$('#tab-home').dataset.built)$('#tab-home').innerHTML=skel();else if(tab!=='home')$('#tab-'+tab).innerHTML=skel();return;}
  const seen=+(localStorage.getItem('seenPush')||0);$('#belldot').classList.toggle('hidden',!(B.pushes||[]).some(p=>p.ts>seen));
  if(tab==='home')home();if(tab==='agents')agents();if(tab==='activity')activity();if(tab==='account')account();
  if(sheet&&sheet.kind!=='search')renderSheet();}

document.addEventListener('click',e=>{const t=e.target.closest('button,[data-close]');if(!t)return;
  if(t.dataset.tab){tab=t.dataset.tab;sheet=null;renderSheet();render();scrollTo(0,0);return;}
  if(t.dataset.goto){tab=t.dataset.goto;render();scrollTo(0,0);return;}
  if(t.dataset.r){range=t.dataset.r;prevLast=null;home();return;}
  if(t.hasAttribute('data-close')){sheet=null;$('#sheet').dataset.k='';renderSheet();return;}
  if(t.dataset.act!=null){openAct((B.activity||[])[+t.dataset.act]);return;}
  if(t.dataset.coin){open('coin',t.dataset.coin);return;}
  if(t.dataset.audit){open('audit',t.dataset.audit);return;}
  if(t.dataset.set){tab='account';render();const g=document.getElementById('set-'+t.dataset.set);if(g)g.scrollIntoView();return;}
  if(t.id==='more'){actN+=30;activity();return;}
  if(t.id==='avatar'){tab='account';sheet=null;renderSheet();render();return;}
  if(t.id==='search'&&B){open('search');return;}
  if(t.id==='bell'&&B){open('bell');$('#belldot').classList.add('hidden');return;}
  if(t.id==='forget'){try{localStorage.removeItem('gh');}catch(x){}location.reload();return;}
  if(t.id==='invite'){const u=safeLink(B.links.signup);if(!u)return;
    if(navigator.share)navigator.share({url:u}).catch(()=>{});else if(navigator.clipboard)navigator.clipboard.writeText(u).then(()=>toast('Link copied'));return;}
});
document.addEventListener('click',e=>{const c=e.target.closest('.ac');if(!c||!B)return;const a=c.dataset.agent;
  if(a==='auditor'){const m=(B.state.agents.auditor||{}).last_mint;open('audit',m);}else{tab='agents';render();const g=document.getElementById('ag-'+a);if(g)g.scrollIntoView();}});
addEventListener('resize',()=>{if(B&&tab==='home')drawLine();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
render();load();setInterval(load,POLL_S*1000);
if('serviceWorker' in navigator&&!SRC)navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
