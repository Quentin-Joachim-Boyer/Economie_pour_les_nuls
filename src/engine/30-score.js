/* =====================================================================
   Tableau de bord de représentativité : le modèle (gains libres) comparé aux statistiques françaises (REF_FR)
   Pour chaque indicateur : valeur au départ (premières années) et à la fin, écart à la référence, verdict.
   Fonction pure : utilisée par la page et par tests/score.js.
   ===================================================================== */
function scoreCard(w,P){
  const T=P.T,L=T-1,closed=P.firm&&P.closed;
  const avg=(a,i0,i1)=>{if(!a)return null;let s=0,n=0;for(let i=Math.max(0,i0);i<=Math.min(a.length-1,i1);i++){s+=a[i];n++;}return n?s/n:null;};
  const growth=(a,i0,i1)=>a&&a[i0]>0&&a[i1]>0&&i1>i0?Math.pow(a[i1]/a[i0],1/(i1-i0))-1:null;
  const medY=(a,i0,i1)=>{const v=Array.from(a).slice(Math.max(0,i0),i1+1).sort((x,y)=>x-y);return v.length?v[Math.floor(v.length/2)]:null;};
  const top10=lor=>lor?1-lor[36]:null;
  const net=w.eq&&w.eq.net,med=net&&net.length?net[Math.floor(net.length/2)]*UNIT_EUR:null;
  let topEnd=null;if(net&&net.length){let t=0,s=0;const k=Math.round(net.length*0.1);for(let i=0;i<net.length;i++){t+=net[i];if(i>=net.length-k)s+=net[i];}topEnd=t>0?s/t:null;}
  const M={
    gini:[w.gini0,w.gi[L]],top10:[top10(w.lor0),topEnd],wmed:[null,med],
    save:closed?[null,w.cSaveRate]:[null,null],margin:closed?[null,w.cMargin]:[null,null],
    unemp:P.unemp&&closed?[w.lU[0],w.lU[L]]:[null,null],ulong:P.unemp&&closed?[avg(w.lLong,2,6),avg(w.lLong,L-4,L)]:[null,null],
    hours:P.unemp&&closed?[w.lHours[0],w.lHours[L]]:[null,null],
    infl:P.prices&&closed?[avg(w.pInfl,1,10),avg(w.pInfl,L-9,L)]:[null,null],
    growth:closed?[growth(w.rNdp,0,Math.min(10,L)),growth(w.rNdp,Math.max(0,L-10),L)]:[null,null],
    debt:P.state&&closed?[w.sDebt[0],w.sDebt[L]]:[null,null],deficit:P.state&&closed?[w.sDef[0],w.sDef[L]]:[null,null],
    stock:P.stock?[w.fPart0,w.fPart1]:[null,null],
    fail:closed&&P.bank&&P.credit&&w.kDef?[medY(w.kDef,1,10),medY(w.kDef,L-9,L)]:[null,null],dep:closed&&P.demo&&w.depR?[w.depR[0],w.depR[L]]:[null,null],credit:closed&&P.bank&&P.credit&&w.kCred?[w.kCred[0],w.kCred[L]]:[null,null],
    spend:P.state&&closed?(P.social?[avg(w.sPub,0,2),avg(w.sPub,L-2,L)]:[P.gW+P.gP+P.rB*P.debt0,null]):[null,null],
    po:P.state&&closed&&P.social?[avg(w.sPO,0,2),avg(w.sPO,L-2,L)]:[null,null],prod:closed?[P.prodG||0,P.prodG||0]:[0,0],surv5:P.firm?[P.pok,null]:[null,null],hhdebt:[0,null]};
  // vEnd : référence pour la fin (projection Insee pour la démographie, sinon la valeur actuelle)
  return REF_FR.map(r=>{const [s,e]=M[r.k]||[null,null];const vEnd=r.endProj?DEP_PROJ((P.y0||START_YEAR)+L):r.v;
    const gap=(v,ref)=>v==null||!isFinite(v)?null:(r.rel?(v-ref)/ref:v-ref);
    const ok=(v,ref)=>{const g=gap(v,ref);return g==null?null:Math.abs(g)<=r.tol;};
    return {...r,vEnd,start:s,end:e,gapEnd:gap(e,vEnd),okStart:ok(s,r.v),okEnd:ok(e,vEnd)};});
}

/* Test de validation : valeur du modèle à la fin (année BACKTEST.to) pour chaque indicateur de BACKTEST.refs */
function backtestCard(w,P){
  const L=P.T-1,net=w.eq&&w.eq.net,wr=w.pWr?w.pWr[L]:1;
  const med=net&&net.length?net[Math.floor(net.length/2)]:null,d9=net&&net.length?net[Math.floor(net.length*0.9)]:null;
  const M={unemp:w.lU[L],ulong:w.lLong[L],debt:w.sDebt[L],deficit:w.sDef[L],spend:w.sPub[L],po:w.sPO[L],margin:w.cMargin,save:w.cSaveRate,
    wmed:med!=null&&wr>0?med/wr:null,wd9:med>0?d9/med:null};
  const S0={unemp:w.lU[0],ulong:w.lLong[Math.min(2,L)],debt:w.sDebt[0],deficit:w.sDef[0],spend:w.sPub[0],po:w.sPO[0],margin:null,save:null,
    wmed:WEALTH_Q[5][1]*(P.m0||1),wd9:WEALTH_Q[9][1]/WEALTH_Q[5][1]};
  return BACKTEST.refs.map(r=>{const m=M[r.k],m0=S0[r.k];const dirOK=m==null?null:Math.sign(m-r.a)===Math.sign(r.b-r.a)||Math.abs(r.b-r.a)<1e-9;
    const err=m==null?null:Math.abs(m-r.b)/Math.max(Math.abs(r.b-r.a),Math.abs(r.b)*0.05);return {...r,m,m0,dirOK,close:err!=null&&err<=1};});
}
