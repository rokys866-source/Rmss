/* Canvas drawing, devicePixelRatio aware: Home line chart with marks, Coin candles + volume, score ring, Auditor disc stack. */
(function(){
const RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function fit(cv){const r=cv.getBoundingClientRect(),d=window.devicePixelRatio||1;
  cv.width=Math.max(1,Math.round(r.width*d));cv.height=Math.max(1,Math.round(r.height*d));
  const g=cv.getContext('2d');g.setTransform(d,0,0,d,0,0);return {g,w:r.width,h:r.height};}
const C={green:'#00d35a',red:'#ff453a',orange:'#ff9f0a',cyan:'#64d2ff',blue:'#0a84ff',yellow:'#ffd60a',pink:'#ff6b9a',
  sec:'rgba(235,235,245,0.6)',ter:'rgba(235,235,245,0.3)',sep:'rgba(84,84,88,0.55)',card:'#1c1c1e',card2:'#2c2c2e'};

/* line: pts [[ts,v],...], start value, marks [{ts,kind,text}], anim 0..1 for the newest point slide-in */
function line(cv,pts,start,marks,opt){opt=opt||{};const {g,w,h}=fit(cv);g.clearRect(0,0,w,h);
  const t0=pts.length?pts[0][0]:0,t1=pts.length?pts[pts.length-1][0]:1;
  // lay marks out first: a later mark that would overlap moves up a row
  g.font='600 11px -apple-system,system-ui,sans-serif';const X0=t=>t1>t0?(t-t0)/(t1-t0)*w:w/2;
  const rows=[],lay=(marks||[]).filter(m=>m.ts>=t0&&m.ts<=t1).sort((x,y)=>x.ts-y.ts).map(m=>{const tw=g.measureText(m.text).width+(m.ini!=null?28:12),x=Math.min(Math.max(X0(m.ts)-tw/2,0),w-tw);let r=0;
    while(rows[r]!=null&&rows[r]>x-4)r++;rows[r]=x+tw;return {m,tw,x,r};});
  const top=12+Math.min(rows.length,5)*20,bot=h-8;
  const vals=pts.map(p=>p[1]).concat([start]);let lo=Math.min(...vals),hi=Math.max(...vals);
  if(hi-lo<1e-9){hi+=Math.max(1,Math.abs(hi)*0.01);lo-=Math.max(1,Math.abs(lo)*0.01);}
  const pad=(hi-lo)*0.08;lo-=pad;hi+=pad;
  const X=t=>t1>t0?(t-t0)/(t1-t0)*(w-8):w/2,Y=v=>top+(hi-v)/(hi-lo)*(bot-top);
  g.setLineDash([4,4]);g.strokeStyle=C.ter;g.lineWidth=1;g.beginPath();g.moveTo(0,Y(start));g.lineTo(w,Y(start));g.stroke();g.setLineDash([]);
  if(pts.length<2)return;
  const a=opt.anim==null?1:opt.anim;const P=pts.map((p,i)=>{let x=X(p[0]),y=Y(p[1]);
    if(i===pts.length-1&&a<1){const q=pts[i-1];x=X(q[0])+(x-X(q[0]))*a;y=Y(q[1])+(y-Y(q[1]))*a;}return [x,y];});
  const grd=g.createLinearGradient(0,top,0,bot);grd.addColorStop(0,'rgba(0,211,90,0.28)');grd.addColorStop(1,'rgba(0,211,90,0)');
  g.beginPath();g.moveTo(P[0][0],bot);P.forEach(p=>g.lineTo(p[0],p[1]));g.lineTo(P[P.length-1][0],bot);g.closePath();g.fillStyle=grd;g.fill();
  g.beginPath();P.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.strokeStyle=C.green;g.lineWidth=2;g.lineJoin='round';g.stroke();
  // marks above the line; a later mark that would overlap moves up a row
  const ma=opt.markAnim==null?1:opt.markAnim;g.globalAlpha=ma;
  lay.forEach(({m,tw,x,r})=>{if(r>=5)return;const y=top-20-r*20+2;
    const col=m.kind==='buy'?C.blue:(m.kind==='win'?C.green:C.red);
    if(m.ini!=null){ // reference look: dark pill, green/red border, coin initial disc, PnL text
      g.strokeStyle=col;g.lineWidth=1;g.setLineDash([2,2]);g.beginPath();g.moveTo(X(m.ts),y+19);g.lineTo(X(m.ts),Y(valAt(pts,m.ts)));g.stroke();g.setLineDash([]);
      g.fillStyle='rgba(0,40,18,0.92)';g.beginPath();if(g.roundRect)g.roundRect(x,y,tw,19,9.5);else g.rect(x,y,tw,19);g.fill();g.stroke();
      g.fillStyle=col;g.beginPath();g.arc(x+10,y+9.5,6.5,0,Math.PI*2);g.fill();
      g.fillStyle='#000';g.font='700 9px -apple-system,system-ui,sans-serif';g.textAlign='center';g.fillText(m.ini,x+10,y+12.8);g.textAlign='left';
      g.font='600 11px -apple-system,system-ui,sans-serif';g.fillStyle=col;g.fillText(m.text,x+20,y+13.5);
      g.fillStyle=col;g.beginPath();g.arc(X(m.ts),Y(valAt(pts,m.ts)),3,0,Math.PI*2);g.fill();return;}
    g.fillStyle=col;g.beginPath();if(g.roundRect)g.roundRect(x,y,tw,17,8.5);else g.rect(x,y,tw,17);g.fill();
    g.fillStyle='#fff';g.fillText(m.text,x+6,y+12.5);
    g.strokeStyle=col;g.lineWidth=1;g.beginPath();g.moveTo(X(m.ts),y+17);g.lineTo(X(m.ts),Y(valAt(pts,m.ts)));g.stroke();});
  g.globalAlpha=1;
  // dot at the latest point (with a soft halo)
  const L=P[P.length-1];g.fillStyle='rgba(0,211,90,0.25)';g.beginPath();g.arc(L[0],L[1],7,0,Math.PI*2);g.fill();
  g.fillStyle=C.green;g.beginPath();g.arc(L[0],L[1],4,0,Math.PI*2);g.fill();}
function valAt(pts,t){let v=pts[0][1];for(const p of pts){if(p[0]>t)break;v=p[1];}return v;}

/* candles [[t,o,h,l,c,vol]], exitLine price or null */
function candles(cv,cs,exitLine,entry){const {g,w,h}=fit(cv);g.clearRect(0,0,w,h);
  const vh=h*0.2,ch=h-vh-6;if(!cs.length)return;
  let lo=Math.min(...cs.map(c=>c[3])),hi=Math.max(...cs.map(c=>c[2]));
  [exitLine,entry].forEach(v=>{if(v){lo=Math.min(lo,v);hi=Math.max(hi,v);}});
  if(hi-lo<=0){hi*=1.01;lo*=0.99;}const pad=(hi-lo)*0.06;lo-=pad;hi+=pad;
  const n=Math.max(cs.length,20),bw=w/n,Y=v=>(hi-v)/(hi-lo)*ch,vmax=Math.max(...cs.map(c=>c[5]||0))||1;
  cs.forEach((c,i)=>{const x=w-(cs.length-i)*bw+bw/2,up=c[4]>=c[1],col=up?C.green:C.red;g.strokeStyle=col;g.fillStyle=col;
    g.beginPath();g.moveTo(x,Y(c[2]));g.lineTo(x,Y(c[3]));g.lineWidth=1;g.stroke();
    const y1=Y(Math.max(c[1],c[4])),y2=Y(Math.min(c[1],c[4]));g.fillRect(x-bw*0.35,y1,bw*0.7,Math.max(1,y2-y1));
    const vb=(c[5]||0)/vmax*vh;g.globalAlpha=0.45;g.fillRect(x-bw*0.35,h-vb,bw*0.7,vb);g.globalAlpha=1;});
  if(exitLine){g.setLineDash([5,4]);g.strokeStyle=C.orange;g.lineWidth=1.5;g.beginPath();g.moveTo(0,Y(exitLine));g.lineTo(w,Y(exitLine));g.stroke();g.setLineDash([]);
    g.fillStyle=C.orange;g.font='600 11px -apple-system,system-ui,sans-serif';g.fillText('Risk trailing stop',6,Y(exitLine)-5);}}

/* score ring 0-100, green from `from` */
function ring(cv,score,from){const {g,w,h}=fit(cv);g.clearRect(0,0,w,h);const r=Math.min(w,h)/2-6,cx=w/2,cy=h/2;
  g.lineWidth=8;g.lineCap='round';g.strokeStyle=C.card2;g.beginPath();g.arc(cx,cy,r,0,Math.PI*2);g.stroke();
  if(score==null)return;g.strokeStyle=score>=from?C.green:C.yellow;g.beginPath();g.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,Math.min(100,score))/100);g.stroke();}

/* Auditor: the coin as a stack of 8 discs. state[i] = 'wait' | 'read' | true | false */
function discs(cv,state,beam){const {g,w,h}=fit(cv);g.clearRect(0,0,w,h);const rx=Math.min(w*0.42,140),ry=rx*0.28,step=(h-2*ry-10)/8,cx=w/2;
  for(let i=7;i>=0;i--){const cy=ry+5+i*step+step/2,s=state[i];
    const col=s===true?C.green:(s===false?C.red:(s==='read'?C.cyan:C.card2));
    g.fillStyle=s===true||s===false?col+'33':C.card;g.strokeStyle=col;g.lineWidth=1.5;
    g.beginPath();g.ellipse(cx,cy+step*0.18,rx,ry,0,0,Math.PI*2);g.fill();
    g.beginPath();g.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);g.fillStyle=s===true||s===false?col+'55':C.card2;g.fill();g.stroke();
    g.fillStyle=s===true||s===false?'#fff':C.sec;g.font='600 12px -apple-system,system-ui,sans-serif';g.textAlign='center';
    g.fillText(s===true?'✓':(s===false?'✕':String(i+1)),cx,cy+4);g.textAlign='left';}
  if(beam!=null){const y=ry+5+beam*step;g.fillStyle='rgba(100,210,255,0.85)';g.fillRect(cx-rx-8,y,2*rx+16,2);}}

window.Charts={line,candles,ring,discs,fit,C,RM};
})();
