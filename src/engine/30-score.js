/* =====================================================================
   Tableau de bord de représentativité : le modèle (gains libres) comparé aux statistiques françaises (REF_FR)
   Pour chaque indicateur : valeur au départ (premières années) et à la fin, écart à la référence, verdict.
   Fonction pure : utilisée par la page et par tests/score.js.
   ===================================================================== */
function scoreCard(w,P){
  const T=P.T,L=T-1,closed=P.firm&&P.closed;
  const avg=(a,i0,i1)=>{if(!a)return null;let s=0,n=0;for(let i=Math.max(0,i0);i<=Math.min(a.length-1,i1);i++){s+=a[i];n++;}return n?s/n:null;};
  const growth=(a,i0,i1)=>a&&a[i0]>0&&a[i1]>0&&i1>i0?Math.pow(a[i1]/a[i0],1/(i1-i0))-1:null;
  const top10=lor=>lor?1-lor[36]:null;
  const net=w.eq&&w.eq.net,med=net&&net.length?net[Math.floor(net.length/2)]*UNIT_EUR:null;
  let topEnd=null;if(net&&net.length){let t=0,s=0;const k=Math.round(net.length*0.1);for(let i=0;i<net.length;i++){t+=net[i];if(i>=net.length-k)s+=net[i];}topEnd=t>0?s/t:null;}
  const M={
    gini:[w.gini0,w.gi[L]],top10:[top10(w.lor0),topEnd],wmed:[null,med],
    save:closed?[null,w.cSaveRate]:[null,null],margin:closed?[null,1-w.cWageShare]:[null,null],
    unemp:P.unemp&&closed?[w.lU[0],w.lU[L]]:[null,null],ulong:P.unemp&&closed?[avg(w.lLong,2,6),avg(w.lLong,L-4,L)]:[null,null],
    hours:P.unemp&&closed?[w.lHours[0],w.lHours[L]]:[null,null],
    infl:P.prices&&closed?[avg(w.pInfl,1,10),avg(w.pInfl,L-9,L)]:[null,null],
    growth:closed?[growth(w.rNdp,0,Math.min(10,L)),growth(w.rNdp,Math.max(0,L-10),L)]:[null,null],
    debt:P.state&&closed?[w.sDebt[0],w.sDebt[L]]:[null,null],deficit:P.state&&closed?[w.sDef[0],w.sDef[L]]:[null,null],
    stock:P.stock?[w.fPart0,w.fPart1]:[null,null],
    spend:P.state&&closed?[P.gW+P.gP+P.rB*P.debt0,null]:[null,null],prod:closed?[P.prodG||0,P.prodG||0]:[0,0],surv5:P.firm?[P.pok,null]:[null,null],hhdebt:[0,null]};
  return REF_FR.map(r=>{const [s,e]=M[r.k]||[null,null];
    const gap=v=>v==null||!isFinite(v)?null:(r.rel?(v-r.v)/r.v:v-r.v);
    const ok=v=>{const g=gap(v);return g==null?null:Math.abs(g)<=r.tol;};
    return {...r,start:s,end:e,gapEnd:gap(e),okStart:ok(s),okEnd:ok(e)};});
}
