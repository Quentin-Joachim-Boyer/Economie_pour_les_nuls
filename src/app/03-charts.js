/* =====================================================================
   Composants graphiques : barres comparées, lignes, histogrammes
   ===================================================================== */
/* Barres comparant les deux scénarios. vals : [libres, interdits] ; better : 'high' | 'low' (coche le meilleur) ;
   subs : texte sous chaque valeur ; domain : bornes communes à plusieurs lignes ; compact : noms courts. */
function bars(vals,fmt,{better=null,subs=null,compact=false,domain=null}={}){
  const ok=vals.map(v=>v!=null&&isFinite(v));
  const good=vals.filter((v,i)=>ok[i]);
  let lo=Math.min(0,...good),hi=Math.max(0,...good);if(domain){lo=Math.min(lo,domain[0]);hi=Math.max(hi,domain[1]);}if(hi-lo<1e-12)hi=lo+1;
  const pos=v=>(v-lo)/(hi-lo)*100, z=pos(0);
  let best=-1;
  if(better){vals.forEach((v,i)=>{if(!ok[i])return;if(best<0||(better==='high'?v>vals[best]+1e-9:v<vals[best]-1e-9))best=i;});
    if(best>=0&&vals.filter((v,i)=>ok[i]&&Math.abs(v-vals[best])<1e-9).length>1)best=-1;}
  const names=compact?SHORT:LABELS;
  return `<div class="bars${compact?' compact':''}">`+vals.map((v,i)=>{
    const p=ok[i]?pos(v):z;const left=Math.min(p,z),w=Math.abs(p-z);
    return `<div class="bline" title="${LABELS[i]} : ${fmt(v)}"><span class="bname"><i style="background:var(--${KEYS[i]})"></i>${names[i]}</span>`+
      `<div class="track">${ok[i]?`<div class="fill" style="left:${left}%;width:${w}%;background:var(--${KEYS[i]})"></div>`:''}${lo<0?`<div class="zero" style="left:${z}%"></div>`:''}</div>`+
      `<span class="bval"><span${i===best?' class="best"':''}>${fmt(v)}</span>${subs?`<small>${subs[i]}</small>`:''}</span></div>`;
  }).join('')+`</div>`;
}
// une ligne de comparaison : libellé, aide, barres
function crow(label,hint,vals,fmt,opts){return `<div class="crow"><div class="clabel">${label}${hint?`<small>${hint}</small>`:''}</div>${bars(vals,fmt,opts)}</div>`}
// une carte d'indicateur clé
function kpi(title,vals,f,better,subs){return `<div class="kpi"><h3>${title}</h3>${bars(vals,f,{compact:true,better,subs})}</div>`}
// fourchette où tombent 80 % des simulations, pour un indicateur calculé simulation par simulation (voir PER_RUN)
const range80=(W,k,f)=>W.map(w=>{const s=w.spread&&w.spread[k];if(!s||w.R<3)return '';return `${f(s.p10)} à ${f(s.p90)}`;});
// série par scénario pour lineChart (interdits d'abord, pour que libres soit dessiné par-dessus)
const seriesLI=(a,b,soft)=>[{ys:Array.from(b),color:'var(--i)',soft:soft?'var(--i-soft)':null,name:'Interdits'},{ys:Array.from(a),color:'var(--l)',soft:soft?'var(--l-soft)':null,name:'Libres'}];

function niceMax(v){if(v<=0)return 1;const p=Math.pow(10,Math.floor(Math.log10(v)));const m=v/p;const n=m<=1?1:m<=2?2:m<=2.5?2.5:m<=5?5:10;return n*p}
/* Graphique en lignes avec étiquettes en bout de courbe et info-bulle au survol.
   series : [{ys, color, name, dash?, soft?}] ; marks : lignes verticales repères ; diag : diagonale (Lorenz). */
function lineChart(svg,{W,H,xs,series,yMin=0,yMax,yTicks,xTicks=5,xLabel,yFmt,xFmt=fmtN,tipX=null,tipY=null,xMax,xMin=0,area,diag,markers,marks}){
  svg.innerHTML='';const m={l:56,r:96,t:14,b:34};const iw=W-m.l-m.r,ih=H-m.t-m.b;
  const X=x=>m.l+(x-xMin)/(xMax-xMin)*iw,Y=y=>m.t+ih-(y-yMin)/(yMax-yMin)*ih;
  const line=(a,parent=svg)=>el('line',{stroke:'var(--muted)','stroke-width':1,...a},parent);
  for(let i=0;i<=yTicks;i++){const v=yMin+(yMax-yMin)*i/yTicks;line({x1:m.l,x2:m.l+iw,y1:Y(v),y2:Y(v),stroke:'var(--grid)'});el('text',{x:m.l-8,y:Y(v)+4,'text-anchor':'end'},svg,yFmt(v));}
  for(let i=0;i<=xTicks;i++){const v=xMin+(xMax-xMin)*i/xTicks;el('text',{x:X(v),y:m.t+ih+18,'text-anchor':i===0?'start':i===xTicks?'end':'middle'},svg,xFmt(v));}
  el('text',{x:m.l+iw,y:H-2,'text-anchor':'end'},svg,xLabel);
  if(diag)line({x1:X(0),y1:Y(0),x2:X(xMax),y2:Y(100),'stroke-dasharray':'3 4'});
  const base=yMin<0&&yMax>0?0:yMin;line({x1:m.l,x2:m.l+iw,y1:Y(base),y2:Y(base)});
  if(marks)for(const mk of marks){line({x1:X(mk.x),x2:X(mk.x),y1:m.t,y2:m.t+ih,'stroke-dasharray':'2 3'});el('text',{x:X(mk.x)+5,y:m.t+10},svg,mk.label);}
  const ends=[];
  for(const s of series){
    let d='';s.ys.forEach((y,i)=>{d+=(i?'L':'M')+X(xs[i]).toFixed(1)+' '+Y(y).toFixed(1)});
    if(area&&!s.dash){const b=Y(Math.max(yMin,Math.min(0,yMax)));el('path',{d:d+`L${X(xs[xs.length-1]).toFixed(1)} ${b}L${X(xs[0]).toFixed(1)} ${b}Z`,fill:s.soft,stroke:'none'},svg);}
    el('path',{d,fill:'none',stroke:s.color,'stroke-width':2,'stroke-linejoin':'round','stroke-dasharray':s.dash?'6 5':'none'},svg);
    const dot=(i)=>el('circle',{cx:X(xs[i]),cy:Y(s.ys[i]),r:4,fill:s.color,stroke:'var(--panel)','stroke-width':2},svg);
    if(markers&&!s.dash)s.ys.forEach((y,i)=>dot(i));
    const li=s.ys.length-1;if(!markers||s.dash)dot(li);
    ends.push({y:Y(s.ys[li]),name:s.name});
  }
  // étiquettes directes en bout de courbe, écartées si elles se chevauchent
  ends.sort((a,b)=>a.y-b.y);for(let k=1;k<ends.length;k++)if(ends[k].y-ends[k-1].y<15)ends[k].y=ends[k-1].y+15;
  for(const e of ends)el('text',{x:m.l+iw+8,y:e.y+4,class:'lab'},svg,e.name);
  // couche de survol
  const wrap=svg.parentNode;let tip=wrap.querySelector('.tip');if(!tip){tip=document.createElement('div');tip.className='tip';tip.hidden=true;wrap.appendChild(tip);}
  const guide=line({x1:0,x2:0,y1:m.t,y2:m.t+ih,visibility:'hidden'});
  const dots=series.map(s=>el('circle',{r:5,fill:s.color,stroke:'var(--panel)','stroke-width':2,visibility:'hidden'},svg));
  const hit=el('rect',{x:m.l,y:m.t,width:iw,height:ih,fill:'transparent'},svg);
  const pick=ev=>{const r=svg.getBoundingClientRect();const sx=(ev.clientX-r.left)/r.width*W;let bi=0,bd=1e9;xs.forEach((x,i)=>{const d=Math.abs(X(x)-sx);if(d<bd){bd=d;bi=i;}});return {i:bi,r};};
  hit.addEventListener('pointermove',ev=>{const {i,r}=pick(ev);const gx=X(xs[i]);guide.setAttribute('x1',gx);guide.setAttribute('x2',gx);guide.setAttribute('visibility','visible');
    series.forEach((s,k)=>{dots[k].setAttribute('cx',gx);dots[k].setAttribute('cy',Y(s.ys[i]));dots[k].setAttribute('visibility','visible');});
    tip.innerHTML=`<div>${(tipX||xFmt)(xs[i])}</div>`+series.map(s=>`<div class="tr"><i style="background:${s.color}"></i>${s.name}<b>${(tipY||yFmt)(s.ys[i])}</b></div>`).join('');
    tip.hidden=false;const px=gx/W*r.width;const wr=wrap.getBoundingClientRect();tip.style.left=Math.min(px+12,wr.width-tip.offsetWidth-4)+'px';tip.style.top='8px';});
  hit.addEventListener('pointerleave',()=>{tip.hidden=true;guide.setAttribute('visibility','hidden');dots.forEach(d=>d.setAttribute('visibility','hidden'));});
}
/* Histogramme en échelle logarithmique (36 classes), avec médiane et moyenne. S : distStats(...) ; what : ce que l'on compte. */
function hist(svg,S,fmt,xlab='années de revenu',what='des créations'){
  svg.innerHTML='';const W=380,H=220,m={l:44,r:12,t:16,b:34};const iw=W-m.l-m.r,ih=H-m.t-m.b;const y=S.y;
  let lo=y[Math.floor(y.length*0.001)],hi=y[Math.floor(y.length*0.999)];
  if(hi/lo<1.5){const c=Math.sqrt(lo*hi);lo=c/3;hi=c*3;}
  const L0=Math.floor(Math.log10(lo)*2)/2,L1=Math.ceil(Math.log10(hi)*2)/2;const nb=36;const bw=(L1-L0)/nb;
  const counts=new Array(nb).fill(0);let over=0,under=0;
  for(const v of y){const b=Math.floor((Math.log10(v)-L0)/bw);if(b<0)under++;else if(b>=nb)over++;else counts[b]++;}
  counts[0]+=under;counts[nb-1]+=over;
  const mx=Math.max(...counts)/y.length;const yMax=mx>0?Math.ceil(mx*100/4)*4/100||mx:1;
  const X=l=>m.l+(l-L0)/(L1-L0)*iw,Y=f=>m.t+ih-f/yMax*ih;
  for(let i=0;i<=4;i++){const f=yMax*i/4;el('line',{x1:m.l,x2:m.l+iw,y1:Y(f),y2:Y(f),stroke:'var(--grid)','stroke-width':1},svg);el('text',{x:m.l-6,y:Y(f)+4,'text-anchor':'end'},svg,fr(f*100,{maximumFractionDigits:1})+' %');}
  for(let e=Math.ceil(L0);e<=Math.floor(L1);e++){const v=Math.pow(10,e);el('line',{x1:X(e),x2:X(e),y1:m.t+ih,y2:m.t+ih+4,stroke:'var(--muted)','stroke-width':1},svg);el('text',{x:X(e),y:m.t+ih+17,'text-anchor':'middle'},svg,fr(v,{maximumSignificantDigits:1,useGrouping:true}));}
  el('text',{x:m.l+iw,y:H-2,'text-anchor':'end'},svg,xlab);
  counts.forEach((c,i)=>{const f=c/y.length;if(f<=0)return;const x0=X(L0+i*bw)+0.5,x1=X(L0+(i+1)*bw)-0.5;const r=el('rect',{x:x0,y:Y(f),width:Math.max(1,x1-x0),height:m.t+ih-Y(f),fill:'var(--muted)',opacity:.55,rx:1},svg);
    el('title',{},r,`${fmt(Math.pow(10,L0+i*bw))} à ${fmt(Math.pow(10,L0+(i+1)*bw))} : ${fr(f*100,{maximumFractionDigits:1})} % ${what}`);});
  el('line',{x1:m.l,x2:m.l+iw,y1:m.t+ih,y2:m.t+ih,stroke:'var(--muted)','stroke-width':1},svg);
  const mark=(v,label,dash,dy)=>{const l=Math.log10(v);if(l<L0||l>L1)return;el('line',{x1:X(l),x2:X(l),y1:m.t,y2:m.t+ih,stroke:'var(--fg)','stroke-width':1.2,'stroke-dasharray':dash},svg);el('text',{x:X(l)+4,y:m.t+8+dy,class:'lab'},svg,label);};
  mark(S.med,'médiane','3 3',0);mark(S.mean,'moyenne','none',14);
}
