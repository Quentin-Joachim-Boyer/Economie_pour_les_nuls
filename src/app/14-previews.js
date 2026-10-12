/* =====================================================================
   Aperçus instantanés (onglet Hypothèses), recalculés à chaque réglage, sans lancer la simulation :
   créations possibles, population au départ, entreprises au départ. Ils reprennent les tirages du moteur.
   ===================================================================== */
function drawPreviews(){drawProjects();drawPopulation();drawFirms0();}

function drawProjects(){
  const n=20000,g=rng(7),costs=new Float64Array(n),gains=new Float64Array(n);
  for(let k=0;k<n;k++){const pj=drawProject(g,P);costs[k]=pj.cost;gains[k]=pj.gain;}
  const C=distStats(costs),G=distStats(gains);
  hist($('ch_cost'),C,yrs);hist($('ch_gain'),G,yrs);
  if(!P.vary){
    setText('cost_note',`Créations identiques : chacune coûte ${yrs(P.cost)} de revenu.`);
    setText('gain_note',`Chaque succès rapporte ${yrs(P.payoff)} de revenu.`);
  }else{
    setText('cost_note',`Médiane ${yrs(C.med)} (≈ ${eur(C.med)}), moyenne ${yrs(C.mean)} (≈ ${eur(C.mean)}). Une création sur dix coûte plus de ${yrs(C.p90)} (≈ ${eur(C.p90)}), soit plus de ${Math.round(C.p90/(P.save*P.incM))} ans d'épargne.`);
    setText('gain_note',`Médiane ${yrs(G.med)} (≈ ${eur(G.med)}), moyenne ${yrs(G.mean)}. Les 10 % de succès les plus gros font ${Math.round(G.top10*100)} % de tous les gains ; un sur cent dépasse ${yrs(G.p99)} (≈ ${eur(G.p99)}).`);
  }
}

function drawPopulation(){
  // aperçu sur 20 000 ménages (le lien avec l'âge n'y est pas représenté)
  const n=20000,nrm=normalFrom(rng(11));const inc=new Float64Array(n),w0=new Float64Array(n);const c=P.inc?P.rhoIW:0;
  for(let k=0;k<n;k++){const z1=nrm();inc[k]=P.inc?P.incM*Math.exp(P.sigI*z1):P.incM;w0[k]=P.ini?P.m0*wealthQuantile(Phi(c*z1+Math.sqrt(1-c*c)*nrm()),P.alW):0;}
  if(P.inc){const I=distStats(inc);hist($('ch_inc'),I,v=>eur(v),'années de niveau de vie médian','des ménages');
    setText('inc_note',`Revenu disponible par ménage : médiane ${eur(I.med)}, moyenne ${eur(I.mean)}. Les 10 % les plus modestes gagnent moins de ${eur(I.d1)}, les 10 % les plus aisés plus de ${eur(I.d9)} : rapport ${fr(I.d9/I.d1,{maximumFractionDigits:1})}.`);}
  else{blankChart('ch_inc','Revenus égaux');setText('inc_note',`Chaque ménage gagne ${eur(P.incM)} par an.`);}
  if(P.ini&&P.m0>0){const S=distStats(w0);hist($('ch_w0'),S,yrs,'années de revenu','des ménages');
    setText('w0_note',`Médiane ${yrs(S.med)} (≈ ${eur(S.med)}), moyenne ${yrs(S.mean)} (≈ ${eur(S.mean)}). Les 10 % les mieux dotés détiennent ${Math.round(S.top10*100)} % du patrimoine de départ.`);}
  else{blankChart('ch_w0','Patrimoine de départ nul pour tous');setText('w0_note','Tout le monde commence sans patrimoine.');}
  let sv;
  if(P.inc&&P.sprof){const prof=SAVE_BY_QUINTILE;const y=Float64Array.from(inc).sort();let sw=0,swp=0;const qOf=i=>Math.min(4,Math.floor(i*5/n));for(let i=0;i<n;i++){sw+=y[i];swp+=y[i]*prof[qOf(i)];}const k=P.save*sw/swp;
    const rates=prof.map(v=>Math.min(0.9,v*k));const sav=[0,1,2,3,4].map(q=>{let a=0,c=0;for(let i=Math.floor(q*n/5);i<Math.floor((q+1)*n/5);i++){a+=y[i]*rates[q];c++;}return a/c;});
    sv=`Épargne annuelle par cinquième de revenu, du plus modeste au plus aisé : ${rates.map(r=>fr(Math.round(r*1000)/10)+' %').join(', ')} du revenu, soit en moyenne ${sav.map(eur).join(', ')} par an.`;}
  else sv=`Chacun épargne ${pct(P.save)} de son revenu.`;
  if(P.inc&&P.ini)sv+=` Corrélation des rangs entre revenu et patrimoine de départ : ${fr(rankCorrelation(inc,w0),{maximumFractionDigits:2})}.`;
  if(P.firm&&P.exist)sv+=P.ini?` Les parts des entreprises existantes (${fr(P.k0)} ans de revenu par ménage en moyenne), détenues par ${pct(P.hold)} des ménages surtout parmi les plus riches, sont comptées dans ce patrimoine et non en plus.`:` S'ajoutent au patrimoine de départ les parts des entreprises existantes (${fr(P.k0)} ans de revenu par ménage en moyenne), détenues par ${pct(P.hold)} des ménages.`;
  setText('sav_note',sv);
}
// corrélation de Spearman
function rankCorrelation(x,y){const n=x.length;const rk=v=>{const o=Array.from(v.keys()).sort((a,b)=>v[a]-v[b]);const r=new Float64Array(n);o.forEach((i,k)=>r[i]=k);return r;};
  const a=rk(x),b=rk(y);let ma=0,mb=0;for(let i=0;i<n;i++){ma+=a[i];mb+=b[i];}ma/=n;mb/=n;let sab=0,saa=0,sbb=0;for(let i=0;i<n;i++){const u=a[i]-ma,v=b[i]-mb;sab+=u*v;saa+=u*u;sbb+=v*v;}return sab/Math.sqrt(saa*sbb);}

function drawFirms0(){
  if(!(P.firm&&P.exist)){['ch_fk','ch_fr'].forEach(id=>blankChart(id,P.firm?'Pas d\'entreprises existantes':'Brique « entreprises » désactivée'));['fk_note','fr_note','f0_note'].forEach(id=>setText(id,''));return;}
  // mêmes tirages que le moteur, sur plusieurs paysages regroupés
  const er=rng(17),n0=Math.max(1,Math.round(P.N*P.nf/100)),reps=Math.max(1,Math.ceil(20000/n0));const Ks=[],rs=[];const cn=[0,0,0,0],ck=[0,0,0,0];
  for(let r=0;r<reps;r++)for(const x of landscape(n0,P.k0*P.N,er)){Ks.push(x.K);cn[x.cat]++;ck[x.cat]+=x.K;rs.push(drawRho(er,P));}
  const SK=distStats(Ks),SR=distStats(rs);
  hist($('ch_fk'),SK,yrs,'années de revenu médian','des entreprises');
  const kT=ck.reduce((a,b)=>a+b,0);const per=FIRM_CATS.map((c,j)=>{const m=Math.round(cn[j]/reps);return `${m} ${m>1?c.n:c.n1} (${Math.round(ck[j]/kT*100)} % du capital, ${eur(ck[j]/Math.max(1,cn[j]))} chacune en moyenne)`;}).join(', ');
  setText('fk_note',`${n0} entreprises pour ${P.N} ménages : ${per}. Capital médian ${eur(SK.med)}, moyen ${eur(SK.mean)}. À l'échelle de ${P.N} ménages, une grande entreprise ou une ETI ne peut exister qu'en « tranche » : leur nombre réel serait bien inférieur à 1.`);
  if(P.vary){hist($('ch_fr'),SR,pct1,'profit annuel / capital','des entreprises');
    setText('fr_note',`Médiane ${pct1(SR.med)}, moyenne ${pct1(SR.mean)}. Loi de Pareto d'indice ${fr(P.alpha)} : quelques entreprises très rentables, plafonnées à ${Math.round(RHO_CAP*100)} %.`);}
  else{blankChart('ch_fr',`Rentabilité égale : ${pct1(P.rho)} pour toutes`);setText('fr_note','Activez « créations inégales » pour des rentabilités dispersées.');}
  setText('f0_note',`Âge au départ : réparti uniformément entre ${EXIST_AGE_MIN} et ${EXIST_AGE_MIN+EXIST_AGE_SPAN-1} ans (les plus âgées résistent mieux). Propriété : dans les microentreprises et les PME, un propriétaire principal détient ${pct(P.own)}, le reste va à ${SHAREHOLDERS_SMALL} actionnaires ; les grandes entreprises et les ETI sont réparties entre ${SHAREHOLDERS_BIG} actionnaires. Tous sont tirés parmi les ${pct(P.hold)} de ménages détenteurs, d'autant plus souvent qu'ils sont riches.`);
}
