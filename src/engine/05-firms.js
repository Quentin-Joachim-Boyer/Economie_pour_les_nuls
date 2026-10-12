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
   Les parts font partie du patrimoine Insee : elles sont retirées du reste du patrimoine de leur détenteur.
   Modifie C.firms, C.W, C.W0, C.init0 ; renvoie quelques indicateurs. */
function seedExistingFirms(C){
  const {N,P,W,W0,init0,firms}=C;const er=rng(C.seed*104729+3);const n0=Math.max(1,Math.round(N*P.nf/100));
  const wt=i=>P.ini?Math.pow(Math.max(W0[i],1e-9),HOLD_GAMMA):1;const nH=Math.max(1,Math.round(N*P.hold));
  // tirage pondéré sans remise des détenteurs (clés d'Efraimidis-Spirakis)
  const keys=Array.from({length:N},(_,i)=>[Math.log(Math.max(er(),1e-12))/wt(i),i]).sort((a,b)=>b[0]-a[0]);const H=keys.slice(0,nH).map(x=>x[1]);
  const cdf=new Float64Array(nH);{let c=0;for(let k=0;k<nH;k++){c+=wt(H[k]);cdf[k]=c;}}
  const pick=()=>{const x=er()*cdf[nH-1];let lo=0,hi=nH-1;while(lo<hi){const m=(lo+hi)>>1;if(cdf[m]<x)lo=m+1;else hi=m;}return H[lo];};
  for(const ls of landscape(n0,P.k0*N,er)){const K=ls.K,isBig=FIRM_CATS[ls.cat].big;const rho=drawRho(er,P);
    const owner=isBig?-1:pick();const own=isBig?0:P.own;
    const fm=newHoldings({K,R:0,debt:0,rho,age:EXIST_AGE_MIN+Math.floor(er()*EXIST_AGE_SPAN),f:-1,cat:ls.cat,selfC:0,dead:false,old:true},isBig?64:16);
    if(owner>=0){addHolder(fm,owner,K*own,K*own);init0[owner]+=K*own;}
    const ns=isBig?SHAREHOLDERS_BIG:SHAREHOLDERS_SMALL,part=K*(1-own)/ns;if(part>0)for(let a=0;a<ns;a++){const j=pick();addHolder(fm,j,part,part);init0[j]+=part;}
    firms.push(fm);}
  // parts retirées du reste du patrimoine (sans descendre sous zéro) ; ce qui dépasse s'ajoute au patrimoine
  let ex=0,tb=0;for(let i=0;i<N;i++){const b=init0[i]-W0[i];if(b<=0)continue;tb+=b;if(P.ini){const keep=Math.max(0,W0[i]-b);ex+=Math.max(0,b-W0[i]);W0[i]=keep;W[i]=keep;init0[i]=keep+b;}else ex+=b;}
  // part des parts détenue par les 5 % qui en ont le plus
  const b=Array.from(init0,(v,i)=>v-W0[i]).sort((a,b)=>b-a);const tot=b.reduce((a,c)=>a+c,0);const k5=Math.max(1,Math.round(N*0.05));let t5=0;for(let k=0;k<k5;k++)t5+=b[k];
  return {exist0:n0,bizEx:tb>0?ex/tb:0,biz5:tot>0?t5/tot:0};
}
