/* =====================================================================
   Une simulation : world 'L' (gains libres) ou 'I' (gains interdits), une graine, des paramètres.
   Deux générateurs : prng pour la population (identique dans les deux scénarios), rnd pour les événements.
   Chaque année : qui épargne en actions → intérêts → épargne → fonds → entreprises → idées → versements des fonds → bilan.
   ===================================================================== */
function run(world,seed,P){
  const N=P.N,T=P.T,eps=1e-9;
  const bank=!!P.bank,stock=!!P.stock,firmOn=!!P.firm,capped=world==='I';
  const rate=world==='L'?P.rl:0;                       // taux d'intérêt (nul avec gains interdits)
  const depE=bank?P.dep:0,invE=stock?Math.min(P.inv,1-depE):0; // parts de l'épargne déposée et placée en actions
  const phi=stock?(bank?P.phi:1):0;                    // part d'un besoin de financement demandée à la bourse
  const C={world,seed,P,N,T,stock,prng:rng(seed*7919+13),rnd:rng(seed),firms:[],
    fs:{created:0,died:0,bankrupt:0,bankLoss:0,divPaid:0,lostR:0,invested:0,extE:0,extB:0,fundPaid:0,fundV:0,fundUn:0,unowned:0,firmV:0}};
  const {rnd,firms,fs}=C;
  // W liquidités, D dépôts, eqSave épargne-actions de l'année (versée aux fonds), L dette personnelle, net patrimoine net
  const W=C.W=new Float64Array(N),D=new Float64Array(N),eqSave=C.eqSave=new Float64Array(N),L=new Float64Array(N),net=new Float64Array(N);
  const lent=new Float64Array(N);                      // prêt direct : apport de chacun au projet en cours
  const ideas=new Int32Array(N),succ=new Int32Array(N),fail=new Int32Array(N),refI=new Int32Array(N);

  /* ---------- départ ---------- */
  const pop=makePopulation(P,N,C.prng);const {wage,sr,qi,age0}=pop;
  Object.assign(C,{W0:pop.W0,qi,age0});
  const funds=makeFunds(C);
  for(let i=0;i<N;i++)W[i]=pop.W0[i];
  const init0=C.init0=Float64Array.from(pop.W0);
  const hazard=hazardModel(P);
  let exist={exist0:0,biz5:0,bizEx:0};if(firmOn&&P.exist)exist=seedExistingFirms(C);
  const partic=makeParticipation(C);const part=partic.part;
  partic.update(init0,0);const part0=partic.stat(init0);
  const dg=startDiagnostics(C,part);

  let F=0;                                              // caisse de la banque
  const st={funded:0,refused:0,loans:0,refusedDebt:0,refusedFund:0,interest:0,issues:0,eqRaised:0,eqPaid:0,holders:0};
  const tot=new Float64Array(T),gi=new Float64Array(T),uT=new Float64Array(T);

  for(let t=0;t<T;t++){
    if(t>0)partic.update(net,t);

    /* ---------- intérêts des dettes personnelles, reversés aux déposants ---------- */
    if(bank&&rate>0){let acc=0,sumD=0;for(let i=0;i<N;i++){if(L[i]>eps){const x=L[i]*rate;L[i]+=x;acc+=x;}sumD+=D[i];}
      if(acc>0&&sumD>0){for(let j=0;j<N;j++)D[j]+=acc*D[j]/sumD;st.interest+=acc;}}

    /* ---------- épargne : remboursement des dettes, dépôt, actions, liquidités ---------- */
    for(let i=0;i<N;i++){let s=wage[i]*sr[i];
      if(L[i]>eps){const p=Math.min(s,L[i]);L[i]-=p;F+=p;s-=p;}
      const d=s*depE,q=part[i]?s*invE:0;D[i]+=d;F+=d;eqSave[i]+=q;W[i]+=s-d-q;}
    funds.subscribe();

    /* ---------- entreprises : profit, échéances, disparition, versements, investissement ---------- */
    if(firmOn&&firms.length){let sumD=0;for(let j=0;j<N;j++)sumD+=D[j];let dInt=0,dLoss=0;
      for(const fm of firms){if(fm.dead)continue;fm.age++;
        let pi=fm.rho*fm.K,due=0;
        if(fm.debt>eps){// intérêts (gains libres seulement), reversés aux déposants ; échéance : intérêts + 10 % de la dette
          const intr=fm.debt*rate;if(intr>0){fm.debt+=intr;dInt+=intr;st.interest+=intr;}
          due=Math.min(intr+fm.debt*DEBT_AMORT,fm.debt);}
        // plus la marge est faible, plus la disparition est probable ; le capital est perdu, la banque perd ce qui lui reste dû
        const margin=(pi-due)/Math.max(fm.K,eps);
        if(rnd()<hazard(margin,fm.age)){if(margin<=0)fs.bankrupt++;
          fm.dead=true;fs.died++;if(fm.f>=0){if(fm.age<5)fail[fm.f]++;else succ[fm.f]++;}
          if(fm.debt>eps){fs.bankLoss+=fm.debt;dLoss+=fm.debt;fm.debt=0;}
          fs.lostR+=distribute(fm,fm.R,capped,W,funds.income,fs);fm.R=0;freeHoldings(fm);continue;}
        if(due>0){// l'échéance est payée sur le profit, puis sur les réserves ; ce qui manque reste dû
          let pay=Math.min(pi,due);pi-=pay;if(pay<due){const take=Math.min(fm.R,due-pay);fm.R-=take;pay+=take;}
          fm.debt-=pay;F+=pay;}
        // gains libres : une part P.payout du profit est versée ; gains interdits : tout est versé, dans la limite des mises
        if(world==='L'){const d=pi*P.payout;fm.R+=pi-d+distribute(fm,d,capped,W,funds.income,fs);}
        else fm.R+=distribute(fm,pi,capped,W,funds.income,fs);
        // investissement : d'abord sur les réserves, puis bourse et banque pour le reste
        const I=P.invest*fm.K;const fromR=Math.min(fm.R,I);fm.R-=fromR;if(capped)fm.selfC+=fromR;
        let rem=I-fromR,got=0;
        if(rem>eps&&(bank||stock)){const capE=stock?funds.capacity():0,capB=bank?Math.max(0,F):0;
          let nE=rem*phi,nB=rem-nE;
          if(nE>capE){nB+=nE-capE;nE=capE;}if(nB>capB){nE=Math.min(capE,nE+nB-capB);nB=capB;}
          if(nE>eps){// gains libres : les mises sont réévaluées à la valeur de l'entreprise avant l'entrée des nouveaux actionnaires
            if(world==='L'){const totC=totalStake(fm);const V=Math.max(eps,fm.K+fm.R-fm.debt);const f=V/Math.max(totC,eps);const hc=fm.hc;for(let k=0;k<fm.n;k++)hc[k]*=f;fm.selfC*=f;}
            const res=funds.raise(nE);for(let k=0;k<res.hi.length;k++)addHolder(fm,res.hi[k],res.hc[k],res.hc[k]);got+=res.got;fs.extE+=res.got;}
          if(nB>eps){F-=nB;fm.debt+=nB;got+=nB;fs.extB+=nB;}}
        fm.K+=fromR+got;fs.invested+=fromR+got;}
      if(sumD>0&&(dInt>0||dLoss>0)){const f=(dInt-dLoss)/sumD;for(let j=0;j<N;j++)D[j]+=D[j]*f;}}

    /* ---------- idées de création ---------- */
    for(let i=0;i<N;i++){
      if(rnd()>=P.pidea)continue;
      ideas[i]++;
      // le projet est tiré dès l'idée : réussite, coût et gain, inconnus de tous à l'avance
      const ok=rnd()<P.pok;const pj=drawProject(rnd,P);const ci=pj.cost,gain0=pj.gain;
      // apport personnel : liquidités, parts de fonds, puis dépôt (dans la limite de ce que la banque a en caisse)
      const depAvail=bank?Math.min(D[i],Math.max(F,0)):0;
      const fAv=stock?funds.available(i):0;const avail=W[i]+fAv+depAvail;
      const own=Math.min(avail,ci);const need=ci-own;
      const fromCash=Math.min(W[i],own),fromFund=Math.min(fAv,own-fromCash),fromDep=own-fromCash-fromFund;
      let lentDirect=false,needB=0,needE=0;
      if(need>eps){
        if(!bank&&!stock){// prêt direct des autres ménages, au prorata de leurs liquidités (interdit avec gains interdits)
          if(capped){st.refused++;refI[i]++;continue;}
          let pool=0;for(let j=0;j<N;j++)if(j!==i)pool+=W[j];
          if(pool<need){st.refused++;refI[i]++;continue;}
          for(let j=0;j<N;j++){lent[j]=(j!==i)?need*W[j]/pool:0;W[j]-=lent[j];}
          lentDirect=true;
        }else{// capacités : la bourse (trésorerie des fonds) et la banque (caisse, si pas déjà endetté)
          let capE=0;if(stock)capE=Math.max(0,funds.capacity()-fromFund/funds.M-P.feeE);
          const debtBlock=bank&&L[i]>eps;
          const capB=(bank&&!debtBlock)?Math.max(0,F-fromDep-P.fee):0;
          needE=need*phi;needB=need-needE;
          if(needE>capE){needB+=needE-capE;needE=capE;}
          if(needB>capB){needE+=needB-capB;needB=capB;}
          if(needE>capE+eps||needB>capB+eps){st.refused++;refI[i]++;if(debtBlock)st.refusedDebt++;else st.refusedFund++;continue;}
          if(needE<eps)needE=0;if(needB<eps)needB=0;}}
      W[i]-=fromCash;funds.redeem(i,fromFund);if(fromDep>eps){D[i]-=fromDep;F-=fromDep;}
      if(needB>0){F-=needB+P.fee;if(!firmOn)L[i]+=needB+P.fee;st.loans++;}
      let raised=0,res=null;
      if(needE>0){// levée auprès des fonds, coût d'introduction compris
        const totalE=needE+P.feeE;res=funds.raise(totalE);
        raised=totalE;st.issues++;st.eqRaised+=totalE;st.holders+=res.hi.length;}
      st.funded++;
      if(firmOn){// le projet devient une entreprise : capital, dette propre, propriétaires (fondateur et fonds)
        const fm=newHoldings({},8);addHolder(fm,i,Math.max(own,1e-6),Math.max(own,1e-6));
        if(raised>0)for(let k=0;k<res.hi.length;k++)addHolder(fm,res.hi[k],res.hc[k],res.hc[k]);
        const rho=drawRho(rnd,P);
        firms.push(Object.assign(fm,{K:ci,R:0,debt:needB>0?needB+P.fee:0,rho,age:0,f:i,selfC:0,dead:false,old:false}));fs.created++;
        continue;}
      // sans la brique « entreprises » : le projet réussit ou échoue tout de suite
      if(ok)succ[i]++;else fail[i]++;
      if(ok){let gain=gain0;
        if(lentDirect){const due=need*(1+P.r);const paid=Math.min(gain0,due);const f=paid/need;for(let j=0;j<N;j++)if(lent[j])W[j]+=lent[j]*f;gain-=paid;}
        if(L[i]>eps){const p=Math.min(gain,L[i]);L[i]-=p;F+=p;gain-=p;}
        if(raised>0){// les actionnaires possèdent la part du projet qu'ils ont payée ; avec gains interdits, ils récupèrent au plus leur mise
          const sh=raised/(own+raised);let claim=sh*gain;if(capped)claim=Math.min(claim,raised);
          const f=claim/raised;for(let k=0;k<res.hi.length;k++)funds.income[fundOfId(res.hi[k])]+=res.hc[k]*f;gain-=claim;st.eqPaid+=claim;}
        W[i]+=gain;}
      if(lentDirect)lent.fill(0);
    }

    /* ---------- versements des fonds, puis bilan de l'année ---------- */
    funds.payout();
    const eqv=new Float64Array(N);let unowned=0,firmV=0;funds.stake.fill(0);
    if(firmOn)for(const fm of firms){if(fm.dead)continue;const V=Math.max(0,fm.K+fm.R-fm.debt);firmV+=V;unowned+=V-valueHoldings(fm,V,capped,eqv,funds.stake);}
    {const fv=funds.value(eqv);fs.fundV=fv.total;fs.fundUn=fv.unclaimed;unowned+=fv.unclaimed;}
    fs.unowned=unowned;fs.firmV=firmV;uT[t]=unowned;
    let s=0;for(let i=0;i<N;i++){net[i]=W[i]+D[i]+eqSave[i]-L[i]+eqv[i];s+=net[i];}tot[t]=s;gi[t]=gini(net);
  }

  /* ---------- résultats ---------- */
  for(const fm of firms)if(!fm.dead&&fm.f>=0)succ[fm.f]++;
  partic.update(net,T);const part1=partic.stat(net);endDiagnostics(C,dg,part);
  let alive=0,oldAlive=0;for(const fm of firms)if(!fm.dead){alive++;if(fm.old)oldAlive++;}
  let debt=0,indebted=0;for(let i=0;i<N;i++){debt+=L[i];if(L[i]>eps)indebted++;}
  // parcours : 0 aucune idée, 1 idée(s) jamais financée(s), 2 réussites ≥ échecs, 3 plus d'échecs que de réussites
  const grp=new Int8Array(N),owes=new Int8Array(N);
  for(let i=0;i<N;i++){const p=succ[i]+fail[i];grp[i]=ideas[i]===0?0:p===0?1:succ[i]>=fail[i]?2:3;owes[i]=L[i]>eps?1:0;}
  const hasStart=P.ini||(firmOn&&P.exist);
  return {tot,gi,uT,...st,lor:lorenz(net,40),debt,indebted:indebted/N,fund:F,
    fCreated:fs.created,fAlive:alive,fBiz5:exist.biz5,fBizEx:exist.bizEx,fOld0:exist.exist0,fOldAlive:oldAlive,fDied:fs.died,fBankrupt:fs.bankrupt,fBankLoss:fs.bankLoss,
    fDiv:fs.divPaid,fInvested:fs.invested,fExtE:fs.extE,fExtB:fs.extB,fUnowned:fs.unowned,fValue:fs.firmV,
    fFundPaid:fs.fundPaid,fFundV:fs.fundV,fFundUn:fs.fundUn,fPart0:part0.all,fPart1:part1.all,fPart1T:part1.top,dg,
    net:Float64Array.from(net),grp,owes,qi,refI:Int32Array.from(refI),lor0:hasStart?lorenz(init0,40):null,gini0:hasStart?gini(init0):null};
}

/* ---------- diagnostics par âge et par revenu (comparés à l'Insee dans l'onglet Hypothèses) ---------- */
function groupMean(N,n,gf,vf){const s=new Float64Array(n),c=new Float64Array(n);for(let i=0;i<N;i++){const g=gf(i);s[g]+=vf(i);c[g]++;}return Array.from(s,(v,g)=>c[g]?v/c[g]:NaN);}
function groupMedian(N,n,gf,vf){const L=Array.from({length:n},()=>[]);for(let i=0;i<N;i++)L[gf(i)].push(vf(i));return L.map(a=>{if(!a.length)return NaN;a.sort((x,y)=>x-y);return a[Math.floor(a.length/2)];});}
function startDiagnostics(C,part){const {N,age0,init0,qi}=C;
  return {wAge:groupMedian(N,6,i=>ageGroup(age0[i]),i=>init0[i]),pA0:groupMean(N,6,i=>ageGroup(age0[i]),i=>part[i]),pQ0:groupMean(N,5,i=>qi[i],i=>part[i]),
    ageMed0:Float64Array.from(age0).sort()[Math.floor(N/2)]};}
function endDiagnostics(C,dg,part){dg.pQ1=groupMean(C.N,5,i=>C.qi[i],i=>part[i]);}
