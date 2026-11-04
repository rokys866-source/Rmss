/* Tiny canvas charts: price line with entry + orange dashed "Risk trailing stop", audit disc, score ring. */
(function(){
function setup(cv){const r=window.devicePixelRatio||1,w=cv.clientWidth,h=cv.clientHeight;cv.width=w*r;cv.height=h*r;const c=cv.getContext('2d');c.scale(r,r);return [c,w,h];}
function fmt(p){if(p==null)return'';if(p>=1)return p.toFixed(2);const e=Math.floor(Math.log10(p));return p.toFixed(Math.min(12,-e+2));}
window.drawPrice=function(cv,pts,o){o=o||{};const [c,w,h]=setup(cv);c.clearRect(0,0,w,h);
  if(!pts||pts.length<2){c.fillStyle='#8a96a3';c.font='13px sans-serif';c.textAlign='center';c.fillText('No price points yet',w/2,h/2);return;}
  const ys=pts.map(p=>p[1]).concat([o.entry,o.exitLine].filter(v=>v!=null));
  let lo=Math.min(...ys),hi=Math.max(...ys);const pad=(hi-lo)*0.08||hi*0.05;lo-=pad;hi+=pad;
  const t0=pts[0][0],t1=pts[pts.length-1][0]||t0+1,L=6,R=w-62,T=8,B=h-20;
  const X=t=>L+(R-L)*(t-t0)/Math.max(1,t1-t0),Y=v=>B-(B-T)*(v-lo)/(hi-lo);
  c.strokeStyle='#222b36';c.lineWidth=1;for(let i=0;i<4;i++){const y=T+(B-T)*i/3;c.beginPath();c.moveTo(L,y);c.lineTo(R,y);c.stroke();}
  const last=pts[pts.length-1][1],up=o.entry==null||last>=o.entry;
  const g=c.createLinearGradient(0,T,0,B);g.addColorStop(0,up?'rgba(33,195,122,.28)':'rgba(255,91,91,.28)');g.addColorStop(1,'rgba(0,0,0,0)');
  c.beginPath();pts.forEach((p,i)=>i?c.lineTo(X(p[0]),Y(p[1])):c.moveTo(X(p[0]),Y(p[1])));c.lineTo(X(t1),B);c.lineTo(X(t0),B);c.closePath();c.fillStyle=g;c.fill();
  c.beginPath();pts.forEach((p,i)=>i?c.lineTo(X(p[0]),Y(p[1])):c.moveTo(X(p[0]),Y(p[1])));c.strokeStyle=up?'#21c37a':'#ff5b5b';c.lineWidth=2;c.stroke();
  function hline(v,col,dash,label){if(v==null)return;c.save();c.setLineDash(dash);c.strokeStyle=col;c.lineWidth=1.6;c.beginPath();c.moveTo(L,Y(v));c.lineTo(R,Y(v));c.stroke();c.restore();
    c.fillStyle=col;c.font='10.5px sans-serif';c.textAlign='left';c.fillText(label,R+4,Y(v)-2);c.fillText(fmt(v),R+4,Y(v)+10);}
  hline(o.entry,'#8a96a3',[2,3],'entry');hline(o.exitLine,'#ff9f2e',[7,5],o.exitLabel||'stop');
  c.fillStyle='#8a96a3';c.font='10px sans-serif';c.textAlign='left';
  const tl=t=>new Date(t*1000).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Stockholm'});
  c.fillText(tl(t0),L,h-5);c.textAlign='right';c.fillText(tl(t1),R,h-5);
};
window.drawDisc=function(cv,layers,progress){const [c,w,h]=setup(cv);c.clearRect(0,0,w,h);const cx=w/2,cy=h/2,r=Math.min(w,h)/2-8,n=8;
  for(let i=0;i<n;i++){const a0=-Math.PI/2+i*2*Math.PI/n+0.04,a1=a0+2*Math.PI/n-0.08,l=layers&&layers[i];
    let col='#2a3440';if(l&&progress>i)col=l.ok?'#21c37a':'#ff5b5b';
    c.beginPath();c.arc(cx,cy,r,a0,a1);c.arc(cx,cy,r*0.62,a1,a0,true);c.closePath();c.fillStyle=col;c.fill();
    const am=(a0+a1)/2;c.fillStyle='#0b0f14';c.font='bold 12px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(String(i+1),cx+Math.cos(am)*r*0.81,cy+Math.sin(am)*r*0.81);}
  const done=Math.min(n,Math.floor(progress)),green=(layers||[]).slice(0,done).filter(l=>l.ok).length;
  c.fillStyle='#e8edf2';c.font='bold 22px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(layers?green+'/8':'—',cx,cy-4);
  c.fillStyle='#8a96a3';c.font='11px sans-serif';c.fillText(done<n&&layers?'auditing…':'layers green',cx,cy+16);
};
window.ringSVG=function(score,th){const s=score==null?0:score,R=26,C=2*Math.PI*R,col=score==null?'#2a3440':(s>=th?'#21c37a':'#ff9f2e');
  return `<svg class="ring" viewBox="0 0 64 64"><circle cx="32" cy="32" r="${R}" stroke="#222b36" stroke-width="7" fill="none"/>`+
  `<circle cx="32" cy="32" r="${R}" stroke="${col}" stroke-width="7" fill="none" stroke-linecap="round" stroke-dasharray="${C*s/100} ${C}" transform="rotate(-90 32 32)"/>`+
  `<text x="32" y="37" text-anchor="middle" font-size="16" font-weight="700" fill="#e8edf2">${score==null?'—':s}</text></svg>`;};
window.fmtPrice=fmt;
})();
