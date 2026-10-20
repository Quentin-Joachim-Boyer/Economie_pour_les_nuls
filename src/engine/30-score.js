/* =====================================================================
   Tableau de bord de représentativité : le modèle (gains libres) comparé aux statistiques françaises (REF_FR)
   Pour chaque indicateur : valeur au départ (premières années) et à la fin, écart à la référence, verdict.
   Fonction pure : utilisée par la page et par tests/score.js.
   ===================================================================== */
function scoreCard(w,P){
  /* horizon de jugement (20 octobre 2026) : année 10 (P.hz), et non la fin de la simulation ; flux en moyenne des années H−4 à H,
     stocks l'année H. La stabilité sur toute la durée est mesurée à part (part des simulations où le capital s'effondre). */
  const T=P.T,L=T-1,H=Math.min(L,P.hz??10),closed=P.firm&&P.closed;
  const avg=(a,i0,i1)=>{if(!a)return null;let s=0,n=0;for(let i=Math.max(0,i0);i<=Math.min(a.length-1,i1);i++){s+=a[i];n++;}return n?s/n:null;};
  const growth=(a,i0,i1)=>a&&a[i0]>0&&a[i1]>0&&i1>i0?Math.pow(a[i1]/a[i0],1/(i1-i0))-1:null;
  const medY=(a,i0,i1)=>{const v=Array.from(a).slice(Math.max(0,i0),i1+1).sort((x,y)=>x-y);return v.length?v[Math.floor(v.length/2)]:null;};
  const top10=lor=>lor?1-lor[36]:null;
  const M={
    gini:[w.gini0,w.gi[H]],top10:[top10(w.lor0),w.wTop10S?w.wTop10S[H]:null],wmed:[null,w.wMedS?w.wMedS[H]*UNIT_EUR:null],
    save:closed?[null,avg(w.cSaveS,H-4,H)]:[null,null],margin:closed?[null,avg(w.cMarginS,H-4,H)]:[null,null],
    unemp:P.unemp&&closed?[w.lU[0],w.lU[H]]:[null,null],ulong:P.unemp&&closed?[avg(w.lLong,2,6),avg(w.lLong,H-4,H)]:[null,null],
    hours:P.unemp&&closed?[w.lHours[0],w.lHours[H]]:[null,null],
    infl:P.prices&&closed?[avg(w.pInfl,1,Math.min(10,L)),avg(w.pInfl,H-4,H)]:[null,null],
    growth:closed?[growth(w.rNdp,0,Math.min(10,L)),growth(w.rNdp,Math.max(0,H-5),H)]:[null,null],
    debt:P.state&&closed?[w.sDebt[0],w.sDebt[H]]:[null,null],deficit:P.state&&closed?[w.sDef[0],w.sDef[H]]:[null,null],
    stock:P.stock?[w.fPart0,w.fPartS?w.fPartS[H]:null]:[null,null],
    fail:closed&&P.bank&&P.credit&&w.kDef?[medY(w.kDef,1,10),medY(w.kDef,Math.max(1,H-9),H)]:[null,null],dep:closed&&P.demo&&w.depR?[w.depR[0],w.depR[H]]:[null,null],credit:closed&&P.bank&&P.credit&&w.kCred?[w.kCred[0],w.kCred[H]]:[null,null],
    spend:P.state&&closed?(P.social?[avg(w.sPub,0,2),avg(w.sPub,H-2,H)]:[P.gW+P.gP+P.rB*P.debt0,null]):[null,null],
    po:P.state&&closed&&P.social?[avg(w.sPO,0,2),avg(w.sPO,H-2,H)]:[null,null],prod:closed?[P.prodG||0,P.prodG||0]:[0,0],surv5:P.firm?[P.pok,null]:[null,null],
    hhdebt:closed&&P.housing&&w.hMort?[w.hMort[0],w.hMort[H]]:[null,null],own:closed&&P.housing&&w.hOwn?[w.hOwn[0],w.hOwn[H]]:[null,null]};
  // vEnd : référence à l'horizon (projection Insee pour la démographie, sinon la valeur actuelle)
  return REF_FR.map(r=>{const [s,e]=M[r.k]||[null,null];const vEnd=r.endProj?DEP_PROJ((P.y0||START_YEAR)+H):r.v;
    const gap=(v,ref)=>v==null||!isFinite(v)?null:(r.rel?(v-ref)/ref:v-ref);
    const ok=(v,ref)=>{const g=gap(v,ref);return g==null?null:Math.abs(g)<=r.tol;};
    return {...r,vEnd,start:s,end:e,gapEnd:gap(e,vEnd),okStart:ok(s,r.v),okEnd:ok(e,vEnd),hz:H};});
}
// stabilité sur toute la durée : part des simulations où le capital des entreprises tombe sous la moitié de son départ
const collapseShare=w=>w&&w.per&&w.per.collapse?Array.from(w.per.collapse).reduce((a,v)=>a+v,0)/w.per.collapse.length:null;

/* Test de validation : valeur du modèle à la fin (année BACKTEST.to) pour chaque indicateur de BACKTEST.refs */
function backtestCard(w,P){
  const L=P.T-1,net=w.eq&&w.eq.net,wr=w.pWr?w.pWr[L]:1;
  const med=net&&net.length?net[Math.floor(net.length/2)]:null,d9=net&&net.length?net[Math.floor(net.length*0.9)]:null;
  // moyennes des années 1 à 9 du modèle (2011-2019) ; croissance du produit net réel de l'ensemble des ménages
  const t9=Math.min(9,L),avgI=(()=>{let s=0;for(let t=1;t<=t9;t++)s+=w.pInfl[t];return t9>0?s/t9:null;})();
  const avg3=a=>{let x=0,n=0;for(let t=Math.max(0,L-2);t<=L;t++){x+=a[t];n++;}return n?x/n:null;};
  const tot=t=>w.rNdp[t]*(w.hhN?w.hhN[t]:1),grow=t9>0&&tot(1)>0?Math.pow(tot(t9)/tot(1),1/(t9-1||1))-1:null;
  const M={unemp:w.lU[L],ulong:w.lLong[L],debt:w.sDebt[L],deficit:w.sDef[L],spend:w.sPub[L],po:w.sPO[L],margin:w.cMargin,save:w.cSaveRate,infl:avgI,growth:grow,
    wmed:med!=null&&wr>0?med/wr:null,wd9:med>0?d9/med:null,
    // témoins ajoutés le 20 octobre 2026 : moyennes des trois dernières années pour les flux
    inv:w.cInvR?avg3(w.cInvR):null,div:w.cDivR?avg3(w.cDivR):null,top10g:w.wTop10G??null,hpi:w.hPI&&w.hPI[L]>0?w.hPI[L]:null};
  const S0={unemp:w.lU[0],ulong:w.lLong[Math.min(2,L)],debt:w.sDebt[0],deficit:w.sDef[0],spend:w.sPub[0],po:w.sPO[0],margin:null,save:null,infl:null,growth:null,
    wmed:WEALTH_Q[5][1]*(P.m0||1),wd9:WEALTH_Q[9][1]/WEALTH_Q[5][1],inv:null,div:null,top10g:null,hpi:1};
  /* critère (20 octobre 2026) : « bon sens » = le modèle bouge dans la même direction que la France, depuis son propre départ s'il en a un
     (sinon depuis la valeur française de 2010) ; « proche » = écart à 2024 au plus la moitié du chemin parcouru par la France (au moins 5 %
     de la valeur) : un modèle resté figé à sa valeur de départ n'est pas proche */
  return BACKTEST.refs.map(r=>{const m=M[r.k],m0=S0[r.k],from=m0!=null&&isFinite(m0)?m0:r.a;
    const dirOK=m==null?null:Math.sign(m-from)===Math.sign(r.b-r.a)||Math.abs(r.b-r.a)<1e-9;
    const err=m==null?null:Math.abs(m-r.b)/Math.max(Math.abs(r.b-r.a),Math.abs(r.b)*0.05);return {...r,m,m0,dirOK,close:err!=null&&err<=0.5};});
}
