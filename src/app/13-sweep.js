/* =====================================================================
   Effet du taux d'intérêt (gains libres, de 0 à 15 %), comparé au scénario sans gains
   ===================================================================== */
let SWEEP=null;
const SWEEP_METRICS={
  bottom10:{f:a=>a.eq.bottom10,fmt:f1},
  gini:{f:a=>a.gi[a.gi.length-1],fmt:f2},
  funded:{f:a=>a.funded,fmt:int},
  mean:{f:a=>a.eq.mean,fmt:f1},
  indebted:{f:a=>a.eq.indebted*100,fmt:v=>Math.round(v)+' %'}};
function renderSweep(){
  if(!SWEEP)return;const key=$('sweepmetric').value;const M=SWEEP_METRICS[key];
  const ys=SWEEP.res.map(M.f);const base=ys[0];
  let lo=Math.min(...ys,base),hi=Math.max(...ys,base);const pad=(hi-lo)*0.15||Math.abs(hi)*0.1||1;lo-=pad;hi+=pad;
  if(lo>0&&key!=='mean'&&key!=='funded')lo=0;
  const r2=v=>fr(v,{maximumFractionDigits:2});
  lineChart($('ch_sweep'),{W:760,H:280,xs:SWEEP.rates.map(r=>r*100),xMin:0,xMax:15,yMin:lo,yMax:hi,yTicks:4,xTicks:6,xLabel:'taux d\'intérêt annuel (%)',
    yFmt:M.fmt,xFmt:v=>r2(v)+' %',tipX:v=>'Taux '+r2(v)+' % par an',markers:true,marks:[{x:SWEEP.current*100,label:'taux du panneau'}],
    series:[{ys:SWEEP.rates.map(()=>base),color:'var(--i)',dash:true,name:'Interdits'},{ys,color:'var(--l)',name:'Libres'}]});
}
function runSweep(){
  const btn=$('sweepbtn');btn.disabled=true;btn.textContent='Calcul…';
  const rates=Array.from({length:13},(_,k)=>k*0.0125);const Q={...P,bank:1};
  const jobs=[];for(const r of rates)for(let s=0;s<Q.runs;s++)jobs.push({world:'L',seed:1000+s,P:{...Q,rl:r}});
  runJobs(jobs,(d,n)=>setText('sweepnote',`Calcul ${d} / ${n} simulations…`)).then(xs=>{
    const res=rates.map((r,k)=>aggFrom('L',{...Q,rl:r},xs.slice(k*Q.runs,(k+1)*Q.runs)));
    SWEEP={rates,res,current:P.rl};renderSweep();btn.disabled=false;btn.textContent='Recalculer';
    setText('sweepnote','Survolez le graphique pour lire les valeurs. Relancez le calcul après avoir changé d\'autres réglages.');});
}
