/* =====================================================================
   Mesures d'équité et agrégation de plusieurs simulations
   ===================================================================== */
// répartition de la monnaie, au sens strict puis au sens large (séries, moyennées sur les simulations)
const MONEY_KEYS=['mPoor','mMid','mTop','mFirm','mSale','mOther','bCash','bDep','bBond','bEq','bSale','bBank','lU','lLong','lHours','lUnmet','pP','pInfl','pWr','pGap','sPub','sPO','dDeaths','dRet','kCred','kCET1','kM','kBail','kEq','depR','hhN','dWid','kDef','hOwn','hMort','hVal','hRent','hAcc'];
// indicateurs de répartition du patrimoine final (net trié dans .net)
function equity(net,grp,owes){
  const n=net.length;const x=Float64Array.from(net).sort();
  let tot=0;for(const v of x)tot+=v;const mean=tot/n;
  const sumRange=(a,b)=>{let s=0;for(let i=a;i<b;i++)s+=x[i];return s;};
  const k10=Math.max(1,Math.round(n*0.1)),k40=Math.round(n*0.4);
  const bottom10=sumRange(0,k10)/k10;
  const shTop10=sumRange(n-k10,n)/tot, shBot40=sumRange(0,k40)/tot;
  const palma=(tot>0&&shBot40>0)?shTop10/shBot40:null;
  const k1=Math.max(1,Math.round(n*0.01));const top1=tot>0?sumRange(n-k1,n)/tot:null;
  let indebted=0;for(let i=0;i<n;i++)indebted+=owes[i];
  // Dworkin : part des écarts expliquée par le parcours (chance subie ou résultat du pari)
  const g=[0,1,2,3].map(()=>({n:0,s:0}));for(let i=0;i<n;i++){g[grp[i]].n++;g[grp[i]].s+=net[i];}
  let vt=0,vb=0;for(let i=0;i<n;i++)vt+=(net[i]-mean)**2;
  for(const gg of g){if(gg.n)vb+=gg.n*(gg.s/gg.n-mean)**2;}
  return {mean,bottom10,palma,top1,indebted:indebted/n,groups:g.map(gg=>({share:gg.n/n,mean:gg.n?gg.s/gg.n:null})),between:vt>0?vb/vt:0,net:x};
}
// par quintile de revenu : patrimoine moyen, part ayant créé, part ayant essuyé un refus
function byQuint(net,grp,qi,ref){
  const q=[0,1,2,3,4].map(()=>({n:0,w:0,l:0,r:0}));
  for(let i=0;i<net.length;i++){const o=q[qi[i]];o.n++;o.w+=net[i];if(grp[i]>=2)o.l++;if(ref[i])o.r++;}
  return q.map(o=>({mean:o.n?o.w/o.n:null,launch:o.n?o.l/o.n:null,refused:o.n?o.r/o.n:null}));
}
// indice d'Atkinson d'aversion eps (patrimoines négatifs ramenés à 1 % de la moyenne)
function atkinson(x,eps){
  const n=x.length;let m=0;for(const v of x)m+=v;m/=n;if(m<=0)return {idx:null,ede:null};
  const fl=0.01*m;let mu=0;const y=new Float64Array(n);for(let i=0;i<n;i++){y[i]=Math.max(x[i],fl);mu+=y[i];}mu/=n;
  let ede;
  if(eps===0)ede=mu;
  else if(Math.abs(eps-1)<1e-9){let s=0;for(const v of y)s+=Math.log(v);ede=Math.exp(s/n);}
  else{let s=0;for(const v of y)s+=Math.pow(v,1-eps);ede=Math.pow(s/n,1/(1-eps));}
  return {idx:1-ede/mu,ede};
}

// résultats scalaires moyennés sur les simulations
const SUM_KEYS=['funded','refused','loans','debt','indebted','fund','refusedDebt','refusedFund','interest','issues','eqRaised','eqPaid','holders',
  'fCreated','fAlive','fBiz5','fBizEx','fOld0','fOldAlive','fDied','fBankrupt','fBankLoss','fDiv','fWear','fInvested','fExtE','fExtB','fUnowned','fValue',
  'fFundPaid','fFundV','fFundUn','fPart0','fPart1','fPart1T','cDrift','cWageShort','cSaveRate','cWageShare','cMargin','sTau','sTax','sWages','sPurch','sInt','sCut','sBond10'];
// indicateurs calculés simulation par simulation, pour mesurer la dispersion d'un tirage à l'autre
const PER_RUN={
  mean:(x,e)=>e.mean, bottom10:(x,e)=>e.bottom10, top1:(x,e)=>e.top1==null?NaN:e.top1, gini:(x,e,T)=>x.gi[T-1],
  funded:x=>x.funded, refused:x=>x.refused, indebted:(x,e)=>e.indebted, totE:(x,e,T)=>x.tot[T-1]+x.uT[T-1],
  fUnowned:x=>x.fUnowned, cons:(x,e,T)=>x.rCons[T-1], util:(x,e,T)=>x.rUtil[T-1], unemp:(x,e,T)=>x.lU[T-1], hours:(x,e,T)=>x.lHours[T-1], infl:x=>x.pInflAvg, fDied:x=>x.fDied, interest:x=>x.interest, qratio:(x,e,T,q)=>q[0].mean>0?q[4].mean/q[0].mean:NaN};
// moyenne élément par élément des diagnostics (tableaux), en ignorant les cases vides
function meanDiagnostics(xs){const dg={},R=xs.length;for(const k in xs[0].dg){const v=xs[0].dg[k];
  if(Array.isArray(v)){const sm=v.map(()=>0),cn=v.map(()=>0);for(const x of xs)x.dg[k].forEach((y,g)=>{if(isFinite(y)){sm[g]+=y;cn[g]++;}});dg[k]=sm.map((y,g)=>cn[g]?y/cn[g]:NaN);}
  else dg[k]=xs.reduce((a,x)=>a+x.dg[k],0)/R;}return dg;}
// fourchette du 10e au 90e centile
function spreadOf(a){const y=Array.from(a).filter(v=>isFinite(v)).sort((a,b)=>a-b);return y.length?{p10:y[Math.floor((y.length-1)*0.1)],p90:y[Math.ceil((y.length-1)*0.9)]}:null;}

/* Agrège des simulations déjà calculées (une par tirage, dans l'ordre des graines) */
function aggFrom(world,P,xs){
  const T=P.T,R=xs.length;const tot=new Float64Array(T),gi=new Float64Array(T),lor=new Float64Array(41),uT=new Float64Array(T),cov=new Float64Array(T),sDebt=new Float64Array(T),sDef=new Float64Array(T),rCons=new Float64Array(T),rConsMean=new Float64Array(T),rNdp=new Float64Array(T),rUtil=new Float64Array(T),rK=new Float64Array(T),mon={},lor0=new Float64Array(41);let g0=0;
  const o={};for(const k of SUM_KEYS)o[k]=0;
  const nets=[],grps=[],owes=[],qis=[],refs=[];
  const per={};for(const k in PER_RUN)per[k]=new Float64Array(R);
  for(let s=0;s<R;s++){const x=xs[s];
    for(let t=0;t<T;t++){tot[t]+=x.tot[t]/R;gi[t]+=x.gi[t]/R;uT[t]+=x.uT[t]/R;cov[t]+=x.cCov[t]/R;sDebt[t]+=x.sDebt[t]/R;sDef[t]+=x.sDef[t]/R;rCons[t]+=x.rCons[t]/R;rConsMean[t]+=x.rConsMean[t]/R;rNdp[t]+=x.rNdp[t]/R;rUtil[t]+=x.rUtil[t]/R;rK[t]+=x.rK[t]/R;}
    for(const k of MONEY_KEYS){if(!mon[k])mon[k]=new Float64Array(T);for(let t=0;t<T;t++)mon[k][t]+=x[k][t]/R;}
    for(let k=0;k<=40;k++)lor[k]+=x.lor[k]/R;
    if(x.lor0){for(let k=0;k<=40;k++)lor0[k]+=x.lor0[k]/R;g0+=x.gini0/R;}
    for(const k of SUM_KEYS)o[k]+=x[k]/R;
    for(let i=0;i<x.net.length;i++){nets.push(x.net[i]);qis.push(x.qi[i]);refs.push(x.refI[i]>0?1:0);grps.push(x.grp[i]);owes.push(x.owes[i]);}
    const e=equity(x.net,x.grp,x.owes),q=byQuint(x.net,x.grp,x.qi,x.refI);for(const k in PER_RUN)per[k][s]=PER_RUN[k](x,e,T,q);}
  const spread={};for(const k in per)spread[k]=spreadOf(per[k]);
  const hasStart=P.ini||(P.firm&&P.exist);
  return {tot,gi,uT,cov,sDebt,sDef,rCons,rConsMean,rNdp,rUtil,rK,...mon,lor,lor0:hasStart?lor0:null,gini0:hasStart?g0:null,...o,
    eqReturn:o.eqRaised>0?o.eqPaid/o.eqRaised-1:null,holdersPer:o.issues>0?o.holders/o.issues:null,
    eq:equity(nets,grps,owes),byq:byQuint(nets,grps,qis,refs),per,spread,R,dg:meanDiagnostics(xs)};
}
// calcul direct (sans workers), utile pour les tests
function agg(world,P){const xs=[];for(let s=0;s<P.runs;s++)xs.push(run(world,1000+s,P));return aggFrom(world,P,xs);}
