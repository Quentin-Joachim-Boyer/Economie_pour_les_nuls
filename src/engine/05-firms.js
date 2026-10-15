/* =====================================================================
   Entreprises : paysage de départ et risque de disparition
   ===================================================================== */
/* Paysage initial : nombre d'entreprises par catégorie Insee (au moins une de chaque), capital de la
   catégorie réparti entre elles avec une dispersion log-normale. Renvoie [{K, cat}]. */
function landscape(n0,Ktot,er){const cnt=FIRM_CATS.map((c,j)=>j<3?Math.max(1,Math.round(n0*c.c/FIRM_CATS_TOTAL)):0);cnt[3]=Math.max(1,n0-cnt[0]-cnt[1]-cnt[2]);const out=[];
  FIRM_CATS.forEach((c,j)=>{const w=[];let t=0;for(let k=0;k<cnt[j];k++){const u1=Math.max(er(),1e-12),u2=er();const v=Math.exp(FIRM_SIZE_SIGMA*Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2));w.push(v);t+=v;}w.forEach(v=>out.push({K:v/t*c.k*Ktot,cat:j}));});return out;}

/* Risque annuel de disparition = c / marge (marge = profit après échéance de la dette, rapporté au capital), plafonné.
   c est calé pour que, sans dette, la part d'entreprises survivantes 5 ans après leur création vaille en moyenne P.pok.
   Au-delà de 5 ans, le risque baisse avec l'âge : facteur (5 / âge) puissance P.ageb. */
const HAZ_CACHE=new Map();
function hazardModel(P){
  const key=[P.pok,P.rho,!!P.vary,P.alpha].join('|');let c=HAZ_CACHE.get(key);
  if(c===undefined){const cr=rng(5);const rs=[];for(let k=0;k<4000;k++)rs.push(drawRho(cr,P));
    const surv=c=>{let s=0;for(const r of rs){const h=r<=1e-9?HAZARD_MAX:Math.min(HAZARD_MAX,c/r);s+=Math.pow(1-h,5);}return s/rs.length;};
    let lo=1e-7,hi=1;for(let it=0;it<50;it++){const mid=Math.sqrt(lo*hi);if(surv(mid)>P.pok)lo=mid;else hi=mid;}c=Math.sqrt(lo*hi);HAZ_CACHE.set(key,c);}
  const ageF=a=>a<=5?1:Math.pow(5/a,P.ageb);
  return (margin,age)=>margin<=1e-9?HAZARD_MAX:Math.min(HAZARD_MAX,c/margin*ageF(age));
}

/* Entreprises existantes au départ, appartenant à des ménages du modèle.
   Seule une part P.hold des ménages en détient (Insee : 16 %), tirée d'autant plus souvent que le patrimoine est élevé.
   PME et microentreprises : un propriétaire principal (part P.own) et 10 actionnaires ; grandes entreprises et ETI : 40 actionnaires.
   Les parts font partie du patrimoine Insee : elles sont retirées du reste du patrimoine de leur détenteur. Ce qui dépasse le
   patrimoine d'un détenteur passe à des fonds (investisseurs institutionnels : assurance-vie, OPC), dont les parts sont réparties
   entre tous les ménages en proportion de leur patrimoine restant : la distribution d'ensemble reste celle de l'Insee.
   Modifie C.firms, C.W, C.W0, C.init0 ; renvoie quelques indicateurs. */
function seedExistingFirms(C){
  // N0 : ménages présents au départ (les places de réserve de la démographie, à la fin, sont vides)
  const {N,P,W,W0,init0,firms}=C;const N0=C.N0||N;const er=rng(C.seed*104729+3);const n0=Math.max(1,Math.round(N0*P.nf/100));
  const wt=i=>P.ini?Math.pow(Math.max(W0[i],1e-9),HOLD_GAMMA):1;const nH=Math.max(1,Math.round(N0*P.hold));
  // tirage pondéré sans remise des détenteurs (clés d'Efraimidis-Spirakis)
  const keys=Array.from({length:N0},(_,i)=>[Math.log(Math.max(er(),1e-12))/wt(i),i]).sort((a,b)=>b[0]-a[0]);const H=keys.slice(0,nH).map(x=>x[1]);
  const cdf=new Float64Array(nH);{let c=0;for(let k=0;k<nH;k++){c+=wt(H[k]);cdf[k]=c;}}
  const pick=()=>{const x=er()*cdf[nH-1];let lo=0,hi=nH-1;while(lo<hi){const m=(lo+hi)>>1;if(cdf[m]<x)lo=m+1;else hi=m;}return H[lo];};
  // économie bouclée : chaque entreprise détient au départ la trésorerie d'une année d'investissement (sa règle d'autofinancement),
  // payée par ses détenteurs comme le capital : la valeur d'une entreprise est K + R
  const r0=P.closed?P.invest:0,lam=C.creditOn?SNF_CREDIT_K:0;   // dette bancaire de départ (crédit)
  for(const ls of landscape(n0,P.k0*N0,er)){const K=ls.K,isBig=FIRM_CATS[ls.cat].big;const rho=drawRho(er,P);
    const owner=isBig?-1:pick();const own=isBig?0:P.own;const V=K*(1+r0-lam);
    const fm=newHoldings({K,R:K*r0,debt:K*lam,rho,age:EXIST_AGE_MIN+Math.floor(er()*EXIST_AGE_SPAN),f:-1,cat:ls.cat,selfC:0,dead:false,old:true},isBig?64:16);
    if(owner>=0){addHolder(fm,owner,V*own,V*own);init0[owner]+=V*own;}
    const ns=isBig?SHAREHOLDERS_BIG:SHAREHOLDERS_SMALL,part=V*(1-own)/ns;if(part>0)for(let a=0;a<ns;a++){const j=pick();addHolder(fm,j,part,part);init0[j]+=part;}
    firms.push(fm);}
  // parts retirées du reste du patrimoine ; ce qui dépasse le patrimoine du détenteur passe aux fonds
  let ex=0,tb=0;const sc=new Float64Array(N).fill(1);
  for(let i=0;i<N;i++){const b=init0[i]-W0[i];if(b<=0)continue;tb+=b;
    if(P.ini){const w0=W0[i];if(b>w0){ex+=b-w0;sc[i]=w0/b;}W0[i]=Math.max(0,w0-b);W[i]=W0[i];init0[i]=w0;}else ex+=b;}
  if(P.ini&&ex>0&&C.funds){const fu=C.funds,NF=fu.NF,toF=new Float64Array(NF);
    for(const fm of firms){const n=fm.n;for(let k=0;k<n;k++){const j=fm.hi[k];if(j<0||sc[j]>=1)continue;const x=fm.hc[k]*(1-sc[j]);fm.hc[k]-=x;fm.hr[k]-=x;const f=fu.fundOf[j];toF[f]+=x;addHolder(fm,fundId(f),x,x);}}
    // parts de fonds : réparties dans chaque fonds en proportion du patrimoine restant de ses membres (le patrimoine total ne change pas)
    const sw=new Float64Array(NF);for(let i=0;i<N;i++)sw[fu.fundOf[i]]+=Math.max(0,W[i]);
    for(let i=0;i<N;i++){const f=fu.fundOf[i];if(sw[f]<=0||W[i]<=0)continue;const x=Math.min(W[i],toF[f]*W[i]/sw[f]);W[i]-=x;W0[i]-=x;fu.seed(i,x);}}
  // part des parts détenue par les 5 % qui en ont le plus
  const b=Array.from(init0,(v,i)=>v-W0[i]).sort((a,b)=>b-a);const tot=b.reduce((a,c)=>a+c,0);const k5=Math.max(1,Math.round(N0*0.05));let t5=0;for(let k=0;k<k5;k++)t5+=b[k];
  return {exist0:n0,bizEx:tb>0?ex/tb:0,biz5:tot>0?t5/tot:0};
}
