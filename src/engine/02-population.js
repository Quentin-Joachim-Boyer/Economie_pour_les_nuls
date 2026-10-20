/* =====================================================================
   Population : revenus, taux d'épargne, âges et patrimoine de départ
   ===================================================================== */
// quantile du patrimoine net (distribution Insee, queue de Pareto d'indice a)
function wealthQuantile(u,a){const Q=WEALTH_Q;if(u>=.99)return Q[11][1]*Math.pow((1-Math.min(u,1-1e-7))/.01,-1/a);let k=1;while(Q[k][0]<u)k++;const [p0,v0]=Q[k-1],[p1,v1]=Q[k];const t=(u-p0)/(p1-p0);return v0<=0?v1*t:v0*Math.pow(v1/v0,t);}
// pyramide des âges des ménages : celle de 2023 par défaut, une autre si P.pyr est donné (test 2010 → 2024)
function drawAge(u,pyr=AGE_PYRAMID){let x=u*pyr.reduce((a,c)=>a+c[2],0);for(const [a,b,n] of pyr){if(x<n)return a+(b-a)*x/n;x-=n;}return 94;}
// tranches d'âge des enquêtes Patrimoine : moins de 30, 30-39, 40-49, 50-59, 60-69, 70 ou plus
const ageGroup=a=>a<30?0:a<40?1:a<50?2:a<60?3:a<70?4:5;
// décalage du score de patrimoine selon l'âge (quantile normal du centile visé, × 1,05 pour la dispersion ajoutée)
const AGE_WEALTH_SHIFT=AGE_WEALTH_PCT.map(p=>1.05*PhiInv(p/100));

/* Tire la population avec le générateur `prng` (identique dans les deux scénarios). L'ordre des tirages compte :
   revenus, âges, puis patrimoine. Renvoie wage (revenu disponible du ménage, en années de niveau de vie médian), sr (taux d'épargne), qi (quintile de revenu), age0, W0 (patrimoine). */
function makePopulation(P,N,prng){
  const nrm=normalFrom(prng);
  const wage=new Float64Array(N).fill(P.incM),sr=new Float64Array(N).fill(P.save),W0=new Float64Array(N),qi=new Int8Array(N);
  // revenus log-normaux
  const zI=new Float64Array(N);for(let i=0;i<N;i++)zI[i]=nrm();
  if(P.inc)for(let i=0;i<N;i++)wage[i]=P.incM*Math.exp(P.sigI*zI[i]);
  {const idx=Array.from({length:N},(_,i)=>i).sort((a,b)=>wage[a]-wage[b]);idx.forEach((i,r)=>{qi[i]=Math.min(4,Math.floor(r*5/N));});}
  // les plus aisés épargnent davantage : profil Insee, remis à l'échelle pour garder le taux moyen
  if(P.inc&&P.sprof){const prof=SAVE_BY_QUINTILE;let sw=0,swp=0;for(let i=0;i<N;i++){sw+=wage[i];swp+=wage[i]*prof[qi[i]];}const k=P.save*sw/swp;for(let i=0;i<N;i++)sr[i]=Math.min(0.9,prof[qi[i]]*k);}
  // âge au départ (recensement) ; il augmente d'un an par an, sans décès
  const age0=new Float64Array(N);for(let i=0;i<N;i++)age0[i]=drawAge(prng(),P.pyr||AGE_PYRAMID);
  // patrimoine : un score mêle revenu (corrélation rhoIW) et âge ; on tire N valeurs dans la distribution Insee
  // et on les attribue dans l'ordre des scores, ce qui garde exactement la distribution d'ensemble
  if(P.ini){const c=P.inc?P.rhoIW:0;const sc=new Float64Array(N);for(let i=0;i<N;i++)sc[i]=AGE_WEALTH_SHIFT[ageGroup(age0[i])]+c*zI[i]+Math.sqrt(1-c*c)*nrm();
    const us=new Float64Array(N);for(let i=0;i<N;i++)us[i]=prng();us.sort();const ord=Array.from({length:N},(_,i)=>i).sort((a,b)=>sc[a]-sc[b]);
    for(let r=0;r<N;r++)W0[ord[r]]=P.m0*wealthQuantile(us[r],P.alW);}
  return {wage,sr,qi,age0,W0};
}
