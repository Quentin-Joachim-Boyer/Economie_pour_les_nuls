/* =====================================================================
   Emploi et chômage (économie bouclée)
   Les entreprises et l'État emploient le travail nécessaire pour produire ce qui est vendu (Keynes) : la demande de travail,
   en unités de salaire (un salaire élevé = une productivité élevée), suit le PIB. La population active plafonne la production.
   Chaque année : des emplois se perdent (risque selon l'âge et le revenu, Insee), puis on ajuste au besoin, par licenciements
   (mêmes risques) ou embauches (au hasard parmi les chômeurs, sauf ceux qui viennent de perdre leur emploi).
   Les heures par emploi sont fixes : tout l'ajustement passe par le nombre d'emplois. Pas d'allocation chômage.
   Générateur propre : les tirages existants ne changent pas.
   ===================================================================== */
function makeLabour(C,wage){
  const {N,P,seed,qi,age0}=C;const on=!!C.on;const g=rng(seed*104729+7);
  const emp=new Uint8Array(N).fill(1),dur=new Int32Array(N),fresh=new Uint8Array(N);
  const uT=new Float64Array(C.T),longT=new Float64Array(C.T),hoursT=new Float64Array(C.T);
  // risque relatif par âge × quintile, ajusté (calage sur marges) pour que la population de départ reproduise les taux Insee
  const fa=UNEMP_BY_AGE.slice(),fq=UNEMP_BY_QUINTILE.slice();
  const u=(i,t)=>Math.min(0.9,fa[ageGroup(age0[i]+t)]*fq[qi[i]]/UNEMP_RATE);
  if(on){const ga=new Int8Array(N);const na=new Float64Array(6),nq=new Float64Array(5);
    for(let i=0;i<N;i++){ga[i]=ageGroup(age0[i]);na[ga[i]]++;nq[qi[i]]++;}
    // cibles : taux par groupe remis à l'échelle du taux d'ensemble
    let sa=0,sq=0;for(let k=0;k<6;k++)sa+=na[k]*UNEMP_BY_AGE[k];for(let k=0;k<5;k++)sq+=nq[k]*UNEMP_BY_QUINTILE[k];
    const tA=UNEMP_BY_AGE.map(v=>v*UNEMP_RATE*N/sa),tQ=UNEMP_BY_QUINTILE.map(v=>v*UNEMP_RATE*N/sq);
    for(let it=0;it<60;it++){
      const pa=new Float64Array(6),pq=new Float64Array(5);for(let i=0;i<N;i++)pa[ga[i]]+=u(i,0);
      for(let k=0;k<6;k++)if(na[k]>0&&pa[k]>0)fa[k]*=tA[k]*na[k]/pa[k];
      for(let i=0;i<N;i++)pq[qi[i]]+=u(i,0);
      for(let k=0;k<5;k++)if(nq[k]>0&&pq[k]>0)fq[k]*=tQ[k]*nq[k]/pq[k];}
    for(let i=0;i<N;i++)if(g()<u(i,0))emp[i]=0;}
  // flux annuel de perte d'emploi qui donne, en régime stable, le taux de chômage de chacun
  const sep=(i,t)=>{const x=u(i,t);return UNEMP_EXIT*x/(1-x);};
  const effEmp=()=>{let s=0;for(let i=0;i<N;i++)if(emp[i])s+=wage[i];return s;};
  // tirage pondéré sans remise (Efraimidis et Spirakis) : ordre de passage
  const order=(cands,w)=>cands.map(i=>({i,k:Math.log(Math.max(g(),1e-300))/Math.max(w(i),1e-12)})).sort((a,b)=>b.k-a.k).map(o=>o.i);
  return {emp,on,
    effEmp,
    // ajuste l'emploi au besoin `need` (en unités de salaire) pour l'année t
    adjust(need,t){if(!on)return;fresh.fill(0);
      for(let i=0;i<N;i++)if(emp[i]&&g()<sep(i,t)){emp[i]=0;dur[i]=0;fresh[i]=1;}
      let e=effEmp();
      if(e>need){const c=[];for(let i=0;i<N;i++)if(emp[i])c.push(i);
        for(const i of order(c,i=>sep(i,t))){if(e<=need)break;emp[i]=0;dur[i]=0;fresh[i]=1;e-=wage[i];}}
      else if(e<need){const c=[];for(let i=0;i<N;i++)if(!emp[i]&&!fresh[i])c.push(i);
        for(const i of order(c,()=>1)){if(e>=need)break;emp[i]=1;e+=wage[i];}}},
    // bilan de fin d'année : taux de chômage, part au chômage depuis plus d'un an, heures travaillées par ménage
    close(t){let n=0,lg=0;for(let i=0;i<N;i++){if(!emp[i]){n++;if(dur[i]>=1)lg++;dur[i]++;}}
      uT[t]=n/N;longT[t]=n?lg/n:0;hoursT[t]=(N-n)*HOURS_PER_JOB/N;},
    out:{uT,longT,hoursT}};
}
