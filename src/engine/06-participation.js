/* =====================================================================
   Qui épargne en actions
   Probabilité = facteur patrimoine × facteur âge × facteur revenu (plafonnée à 1).
   - patrimoine : groupes définis par des seuils fixes en euros (si les ménages s'enrichissent,
     ils sont plus nombreux à épargner en actions : coût d'entrée fixe, Vissing-Jørgensen 2002) ;
   - âge : il augmente chaque année ; revenu : quintile fixe.
   Au départ, les facteurs patrimoine et âge sont ajustés (calage sur marges) pour reproduire les taux
   de détention de l'Insee par patrimoine et par âge, remis à l'échelle de la part visée P.part.
   Un goût propre et fixe pour le risque (uP) départage les ménages : à situation égale, ce sont toujours les mêmes.
   ===================================================================== */
const wealthGroup=w=>{let g=0;while(g<PART_WEALTH_CUTS.length&&w>=PART_WEALTH_CUTS[g])g++;return g;};
function makeParticipation(C){
  const {N,P,prng,age0,qi,init0}=C;const target=C.stock?Math.max(0,Math.min(1,P.part)):0;
  const uP=new Float64Array(N);for(let i=0;i<N;i++)uP[i]=prng();
  const part=new Uint8Array(N);
  const mW=PART_BY_WEALTH.map(x=>x[1]),mA=PART_BY_AGE.slice(),mQ=P.inc?PART_INCOME_FACTOR:[1,1,1,1,1];
  const prob=(i,w,t)=>Math.min(1,mW[wealthGroup(w)]*mA[ageGroup(age0[i]+t)]*mQ[qi[i]]);
  if(target>0){const gw0=new Int8Array(N),ga0=new Int8Array(N);const nw=new Float64Array(6),na=new Float64Array(6);
    for(let i=0;i<N;i++){gw0[i]=wealthGroup(init0[i]);ga0[i]=ageGroup(age0[i]);nw[gw0[i]]++;na[ga0[i]]++;}
    let sw=0,sa=0;for(let g=0;g<6;g++){sw+=nw[g]*PART_BY_WEALTH[g][1];sa+=na[g]*PART_BY_AGE[g];}
    const tW=PART_BY_WEALTH.map(x=>x[1]*target*N/sw),tA=PART_BY_AGE.map(v=>v*target*N/sa);
    // même calcul que prob(i, init0[i], 0), avec les groupes mis en cache
    const p0=i=>Math.min(1,mW[gw0[i]]*mA[ga0[i]]*mQ[qi[i]]);
    for(let it=0;it<60;it++){
      const pw=new Float64Array(6),pa=new Float64Array(6);for(let i=0;i<N;i++)pw[gw0[i]]+=p0(i);
      for(let g=0;g<6;g++)if(nw[g]>0&&pw[g]>0)mW[g]*=Math.min(50,tW[g]*nw[g]/pw[g]);
      for(let i=0;i<N;i++)pa[ga0[i]]+=p0(i);
      for(let g=0;g<6;g++)if(na[g]>0&&pa[g]>0)mA[g]*=Math.min(50,tA[g]*na[g]/pa[g]);}}
  return {part,
    // met à jour qui épargne en actions, selon le patrimoine de chacun l'année t
    update(wealth,t){if(target<=0){part.fill(0);return;}for(let i=0;i<N;i++)part[i]=uP[i]<prob(i,wealth[i],t)?1:0;},
    // part d'ensemble, et chez les 10 % les plus riches
    stat(wealth){let a=0,top=0,nt=0;const c9=Float64Array.from(wealth).sort()[Math.floor(0.9*N)];for(let i=0;i<N;i++){a+=part[i];if(wealth[i]>=c9){nt++;top+=part[i];}}return {all:a/N,top:nt?top/nt:0};}};
}
