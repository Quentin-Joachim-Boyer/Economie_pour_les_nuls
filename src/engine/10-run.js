/* =====================================================================
   Une simulation : world 'L' (gains libres) ou 'I' (gains interdits), une graine, des paramètres.
   Deux générateurs : prng pour la population (identique dans les deux scénarios), rnd pour les événements.
   Chaque année : qui épargne en actions → intérêts → (salaires et consommation) → épargne → fonds → entreprises → idées
   → versements des fonds → bilan.
   Économie bouclée (P.closed, avec la brique entreprises) : la monnaie est en quantité fixe. Les ménages reçoivent leurs salaires
   des entreprises et leur achètent des biens ; ce que dépensent ménages et entreprises (consommation, investissement, créations)
   forme les ventes de l'année suivante ; les ventes moins les salaires forment le profit brut des entreprises, réparti selon leur
   rentabilité (qui n'est plus qu'une rentabilité « notionnelle ») ; les coûts de la banque et des fonds paient des salaires.
   État minimal (P.state, en économie bouclée) : il prélève un impôt sur les ventes des entreprises, paie une partie des salaires
   (fonctionnaires), achète des biens aux entreprises et finance son déficit en vendant des obligations aux ménages, qui lui paient
   des intérêts avec gains libres et aucun avec gains interdits.
   ===================================================================== */
function run(world,seed,P){
  const N=P.N,T=P.T,eps=1e-9;
  const bank=!!P.bank,stock=!!P.stock,firmOn=!!P.firm,capped=world==='I',closed=firmOn&&!!P.closed,stateOn=closed&&!!P.state;
  let rate=world==='L'?P.rl:0;                         // taux d'intérêt (nul avec gains interdits ; avec les prix, l'inflation : gain réel nul)
  const depE=bank?P.dep:0,invE=stock?Math.min(P.inv,1-depE):0; // parts de l'épargne déposée et placée en actions
  const phi=stock?(bank?P.phi:1):0;                    // part d'un besoin de financement demandée à la bourse
  const C={world,seed,P,N,T,stock,prng:rng(seed*7919+13),rnd:rng(seed),firms:[],
    fs:{wear:0,created:0,died:0,bankrupt:0,bankLoss:0,divPaid:0,lostR:0,invested:0,extE:0,extB:0,fundPaid:0,fundV:0,fundUn:0,unowned:0,firmV:0}};
  const {rnd,firms,fs}=C;
  // W liquidités, D dépôts, eqSave épargne-actions de l'année (versée aux fonds), L dette personnelle, net patrimoine net
  const W=C.W=new Float64Array(N),D=new Float64Array(N),eqSave=C.eqSave=new Float64Array(N),L=new Float64Array(N),net=new Float64Array(N);
  const lent=new Float64Array(N);                      // prêt direct : apport de chacun au projet en cours
  const ideas=new Int32Array(N),succ=new Int32Array(N),fail=new Int32Array(N),refI=new Int32Array(N);

  // revenus du capital reçus en liquide dans l'année (économie bouclée : ils sont en partie consommés l'année suivante)
  const capInc=closed?(C.capInc=new Float64Array(N)):null;

  /* ---------- départ ---------- */
  const pop=makePopulation(P,N,C.prng);const {wage,sr,qi,age0}=pop;
  Object.assign(C,{W0:pop.W0,qi,age0});
  const funds=C.funds=makeFunds(C);
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

  /* ---------- circuit (économie bouclée) ----------
     pool : ventes de l'année, payées par les dépenses de l'année précédente (poolNext) ; feePot : coûts de la banque et des fonds,
     reversés en salaires. Au départ, le pool vaut salaires + profits notionnels des entreprises existantes. */
  // emploi : qui travaille (tous, sans la brique chômage) ; WB = masse salariale des personnes en emploi
  /* propension à consommer le revenu : 1 − taux d'épargne observé − effet du patrimoine « normal » du quintile (k = patrimoine / revenu
     du quintile au départ), pour que revenu + patrimoine redonnent au départ les taux d'épargne observés (consommation = cA × revenu + mpcW × patrimoine) */
  const cA=new Float64Array(N);
  const lab=makeLabour({N,P,seed,qi,age0,T,on:closed&&!!P.unemp},wage);const emp=lab.emp;
  let WB=0;for(let i=0;i<N;i++)if(emp[i])WB+=wage[i];
  let wageSum=0,back=0,GDP0=0,capGDP=0;const WB0=WB;const unmet=new Float64Array(T);
  // prix (un seul bien) : indice des prix Pidx, des salaires wIdx, marge ; écart de demande de l'année précédente
  const pricesOn=closed&&!!P.prices;let Pidx=1,wIdx=1,mk=MARKUP0,gapPrev=0,inflPrev=0,Pnet=1;
  // gains de productivité : la production par heure (et par unité de salaire) croît de gA par an ; les salaires réels suivent
  const gA=closed?(P.prodG||0):0;let Aprod=1;
  const pP=new Float64Array(T),pInfl=new Float64Array(T),pWr=new Float64Array(T),pGap=new Float64Array(T);
  // indicateurs d'économie réelle (Stiglitz, Sen et Fitoussi 2009) : consommation médiane et moyenne par ménage, production nette
  // de l'usure, utilisation des capacités (ventes / ventes que permettrait le capital, au rythme du départ)
  const consH=new Float64Array(N),consMed=new Float64Array(T),consMean=new Float64Array(T),ndp=new Float64Array(T),util=new Float64Array(T),kNet=new Float64Array(T);
  let cap0=0,K0=0,wearY=0;
  // où est la monnaie, en fin d'année (part de la monnaie totale) : ménages selon leur patrimoine net (50 % les moins dotés, 40 % suivants, 10 % les plus dotés),
  // trésorerie des entreprises, ventes de l'année à encaisser l'an prochain, reste (caisse de la banque, qui contient les dépôts, fonds, État)
  const mPoor=new Float64Array(T),mMid=new Float64Array(T),mTop=new Float64Array(T),mFirm=new Float64Array(T),mSale=new Float64Array(T),mOther=new Float64Array(T);
  // monnaie au sens large, par ménage, de la plus acceptée à la moins acceptée : liquidités (moins les dettes), dépôts, obligations d'État,
  // parts d'entreprises et de fonds (valeur comptable : capital + trésorerie − dettes) ; la valeur sans propriétaire est dans uT
  // reste du circuit, pour que rien ne soit oublié ni compté deux fois : ventes à encaisser (dues aux entreprises), fonds propres de la banque
  // (caisse − dépôts + prêts aux ménages et aux entreprises) et trésorerie de l'État. Total = monnaie (fixe) + obligations + capital des entreprises.
  const bCash=new Float64Array(T),bDep=new Float64Array(T),bBond=new Float64Array(T),bEq=new Float64Array(T),bSale=new Float64Array(T),bBank=new Float64Array(T);
  let pool=0,poolNext=0,feePot=0;const cc={wagePaid:0,wageShort:0,cons:0,inc:0,save:0,profit:0,drift:0};const cov=new Float64Array(T);
  const money=()=>{let m=F+pool+poolNext+feePot+back+funds.cash()+Sc;for(let i=0;i<N;i++)m+=W[i]+eqSave[i];for(const fm of firms)if(!fm.dead)m+=fm.R;return m;};
  // État : trésorerie Sc (monnaie), obligations détenues par chaque ménage (Bh), taux d'impôt tau calé au départ
  const Bh=new Float64Array(N),debtR=new Float64Array(T),defR=new Float64Array(T);let Sc=0,tau=0,pubDebt=0,GDPprev=0;let rB=stateOn&&world==='L'?P.rB:0;
  const sc={tax:0,gw:0,gp:0,int:0,cut:0,spend:0};
  let M0=0;
  if(closed){// propension à consommer le revenu, calée par quintile (voir cA)
    {const sw=new Float64Array(5),sy=new Float64Array(5);for(let i=0;i<N;i++){sw[qi[i]]+=init0[i];sy[qi[i]]+=wage[i]*emp[i];}
     for(let i=0;i<N;i++){const k=sy[qi[i]]>0?sw[qi[i]]/sy[qi[i]]:0;cA[i]=Math.max(0,1-sr[i]-P.mpcW*k);}}
    /* ventes de l'année 0 = dépenses que le modèle produit lui-même : consommation (revenus d'activité et patrimoine) + investissement
       des entreprises (+ achats publics). Le profit d'ensemble en découle (ventes − salaires − impôt) : le départ est cohérent. */
    let C0=0,I0=0;for(let i=0;i<N;i++)C0+=Math.max(0,cA[i]*wage[i]*emp[i]+P.mpcW*init0[i]);for(const fm of firms)I0+=P.invest*fm.K;
    pool=C0+I0;
    if(stateOn){// PIB = ventes + salaires publics, avec achats publics et salaires publics en part du PIB ; l'impôt laisse le déficit visé
      // (même taux dans les deux scénarios : il est calé avec le taux d'intérêt observé)
      const gdp=(C0+I0)/Math.max(0.05,1-P.gW-P.gP);const GW=P.gW*gdp,T0=(P.gW+P.gP+P.rB*P.debt0-P.defT)*gdp;pool=gdp-GW;tau=T0/pool;
      GDPprev=gdp;
      // dette de départ : une partie des liquidités des ménages est en fait détenue en obligations publiques
      let tw=0;for(let i=0;i<N;i++)tw+=Math.max(0,W[i]);const b=Math.min(P.debt0*gdp,0.9*tw);
      if(tw>0)for(let i=0;i<N;i++){const x=b*Math.max(0,W[i])/tw;W[i]-=x;Bh[i]+=x;}pubDebt=b;}
    cap0=pool;for(const fm of firms)if(!fm.dead)K0+=fm.K;
    // production possible au plein emploi (productivité proportionnelle au salaire)
    GDP0=stateOn?GDPprev:pool;{let wa=0;for(let i=0;i<N;i++)wa+=wage[i];capGDP=WB0>0?GDP0*wa/WB0:0;}
    M0=money();}

  for(let t=0;t<T;t++){
    if(t>0)partic.update(pricesOn&&Pnet!==1?Float64Array.from(net,v=>v/Pnet):net,t);

    /* ---------- prix : les salaires rattrapent l'inflation passée, la marge suit la tension ; le capital est réévalué ---------- */
    let infl=0;
    if(gA&&t>0){Aprod*=1+gA;if(!pricesOn)wIdx*=1+gA;}
    if(pricesOn&&t>0){wIdx*=(1+gA)*(1+Math.max(0,WAGE_INDEXATION*inflPrev));mk=Math.max(0,(1+mk)*(1+PHILLIPS_THETA*gapPrev)-1);
      const Pn=wIdx/Aprod*(1+mk)/(1+MARKUP0);infl=Pn/Pidx-1;Pidx=Pn;inflPrev=infl;
      for(const fm of firms)if(!fm.dead)fm.K*=1+infl;     // capital au coût de remplacement
      if(capped){// gains interdits, règle réelle : les mises restantes, dettes, dépôts et obligations sont indexés sur les prix
        const g=1+Math.max(0,infl);rate=g-1;if(stateOn)rB=g-1;
        for(const fm of firms)if(!fm.dead){const hr=fm.hr;for(let k=0;k<fm.n;k++)hr[k]*=g;}
        funds.index(g);}}
    const feeB=P.fee*Pidx,feeQ=P.feeE*Pidx;

    /* ---------- intérêts des dettes personnelles, reversés aux déposants ---------- */
    if(bank&&rate>0){let acc=0,sumD=0;for(let i=0;i<N;i++){if(L[i]>eps){const x=L[i]*rate;L[i]+=x;acc+=x;}sumD+=D[i];}
      if(acc>0&&sumD>0){for(let j=0;j<N;j++)D[j]+=acc*D[j]/sumD;st.interest+=acc;}}

    /* ---------- économie bouclée : salaires payés sur les ventes, puis sur la trésorerie des entreprises ---------- */
    let ratio=1,sales=0,GW=0;
    if(pricesOn){gapPrev=GDP0>0?((pool+back)+(stateOn?P.gW*GDPprev:0))/Pidx/(GDP0*Aprod)-1:0;pGap[t]=gapPrev;}
    if(closed&&lab.on){// la demande au-delà de ce que la population active peut produire attend l'année suivante (commandes en attente)
      pool+=back;back=0;const capS=Math.max(0,capGDP*Pidx*Aprod-(stateOn?P.gW*GDPprev:0));
      if(pool>capS){back=pool-capS;pool=capS;}unmet[t]=pool+back>0?back/(pool+back):0;}
    if(closed){sales=pool;{let K=0;for(const fm of firms)if(!fm.dead)K+=fm.K;util[t]=cap0>0&&K>0&&K0>0?sales/(cap0*K/K0):0;}
      if(stateOn){// impôt sur les ventes, puis dépenses (fonctionnaires, achats, intérêts) ; le déficit est emprunté aux ménages
        const tax=tau*pool;pool-=tax;Sc+=tax;sc.tax+=tax;
        GW=P.gW*GDPprev;let GP=P.gP*GDPprev,INT=rB*pubDebt;
        const need=GW+GP+INT-Sc;
        if(need>0){let tw=0;for(let i=0;i<N;i++)tw+=Math.max(0,W[i]);const x=Math.min(need,tw);
          if(x>0){for(let i=0;i<N;i++){const b=x*Math.max(0,W[i])/tw;W[i]-=b;Bh[i]+=b;}Sc+=x;pubDebt+=x;}}
        const spend=GW+GP+INT,f=spend>Sc?Sc/spend:1;sc.cut+=spend*(1-f);sc.spend+=spend;GW*=f;GP*=f;INT*=f;Sc-=GW+GP+INT;
        if(INT>0&&pubDebt>0)for(let i=0;i<N;i++){const x=INT*Bh[i]/pubDebt;W[i]+=x;capInc[i]+=x;}
        poolNext+=GP;sc.gw+=GW;sc.gp+=GP;sc.int+=INT;defR[t]=GDPprev>0?(GW+GP+INT-tax)/GDPprev:0;}
      // salaires privés : sur les ventes, puis sur la trésorerie des entreprises
      if(lab.on){lab.adjust(GDP0>0?WB0*(sales+GW)/Pidx/(GDP0*Aprod):0,t);WB=lab.effEmp()*wIdx;}else if(pricesOn||gA)WB=WB0*wIdx;
      wageSum+=WB;
      const WBp=Math.max(0,WB-GW);let paid=Math.min(pool,WBp);pool-=paid;
      if(paid<WBp){const need=WBp-paid;let totK=0;for(const fm of firms)if(!fm.dead)totK+=fm.K;
        if(totK>0)for(const fm of firms){if(fm.dead)continue;const x=Math.min(fm.R,need*fm.K/totK);fm.R-=x;paid+=x;}}
      ratio=WB>0?(paid+GW)/WB:0;cc.wagePaid+=paid+GW;cc.wageShort+=WB-paid-GW;}

    /* ---------- épargne : remboursement des dettes, dépôt, actions, liquidités ---------- */
    if(closed){// le ménage reçoit son salaire, consomme (revenu et patrimoine), puis place ce qui reste
      for(let i=0;i<N;i++){const y=wage[i]*wIdx*ratio*emp[i];W[i]+=y;const inc=y+capInc[i];
        const c=Math.max(0,cA[i]*inc+P.mpcW*(t===0?init0[i]:net[i]));
        let pc=Math.min(c,Math.max(0,W[i]));W[i]-=pc;
        if(c-pc>eps&&bank){const x=Math.min(c-pc,D[i],Math.max(F,0));D[i]-=x;F-=x;pc+=x;}
        poolNext+=pc;cc.cons+=pc;consH[i]=pc;cc.inc+=inc;cc.save+=inc-pc;capInc[i]=0;
        let s=y-pc;if(s<=eps)continue;
        if(L[i]>eps){const p=Math.min(s,L[i]);L[i]-=p;W[i]-=p;F+=p;s-=p;}
        const d=s*depE,q=part[i]?s*invE:0;D[i]+=d;F+=d;eqSave[i]+=q;W[i]-=d+q;}}
    else for(let i=0;i<N;i++){let s=wage[i]*sr[i];
      if(L[i]>eps){const p=Math.min(s,L[i]);L[i]-=p;F+=p;s-=p;}
      const d=s*depE,q=part[i]?s*invE:0;D[i]+=d;F+=d;eqSave[i]+=q;W[i]+=s-d-q;}
    funds.subscribe();

    /* ---------- entreprises : profit, échéances, disparition, versements, investissement ---------- */
    // économie bouclée : le profit brut de l'ensemble (ventes − salaires) est réparti entre les entreprises en retirant à toutes la
    // même rentabilité kappa à leur rentabilité notionnelle (sans descendre sous zéro) ; ce qui n'est pas attribué reste à vendre
    let kappa=0,E=0,piPaid=0;
    if(closed){E=pool;pool=0;let totK=0,notional=0,maxR=0;for(const fm of firms)if(!fm.dead){totK+=fm.K;notional+=fm.rho*fm.K;if(fm.rho>maxR)maxR=fm.rho;}
      cov[t]=notional>0?E/notional:0;
      if(totK<=0){poolNext+=E;E=0;}
      else if(E>=notional)kappa=(notional-E)/totK;
      else{let lo=0,hi=maxR;for(let it=0;it<60;it++){const m=(lo+hi)/2;let sm=0;for(const fm of firms)if(!fm.dead&&fm.rho>m)sm+=(fm.rho-m)*fm.K;if(sm>E)lo=m;else hi=m;}kappa=hi;}}
    if(firmOn&&firms.length){let sumD=0;for(let j=0;j<N;j++)sumD+=D[j];let dInt=0,dLoss=0;
      for(const fm of firms){if(fm.dead)continue;fm.age++;
        let pi=closed?Math.max(0,fm.rho-kappa)*fm.K:fm.rho*fm.K,due=0;
        if(fm.debt>eps){// intérêts (gains libres seulement), reversés aux déposants ; échéance : intérêts + 10 % de la dette
          const intr=fm.debt*rate;if(intr>0){fm.debt+=intr;dInt+=intr;st.interest+=intr;}
          due=Math.min(intr+fm.debt*DEBT_AMORT,fm.debt);}
        // plus la marge est faible, plus la disparition est probable ; le capital est perdu, la banque perd ce qui lui reste dû
        const margin=(pi-due)/Math.max(fm.K,eps);
        if(rnd()<hazard(margin,fm.age)){if(margin<=0)fs.bankrupt++;
          fm.dead=true;fs.died++;if(fm.f>=0){if(fm.age<5)fail[fm.f]++;else succ[fm.f]++;}
          // économie bouclée : la trésorerie rembourse d'abord la banque ; ce qui n'appartient à personne lui revient aussi
          if(closed&&fm.debt>eps&&fm.R>0){const p=Math.min(fm.R,fm.debt);fm.R-=p;fm.debt-=p;F+=p;}
          if(fm.debt>eps){fs.bankLoss+=fm.debt;dLoss+=fm.debt;fm.debt=0;}
          const lost=distribute(fm,fm.R,capped,W,funds.income,fs,capInc);if(closed)F+=lost;else fs.lostR+=lost;fm.R=0;freeHoldings(fm);continue;}
        piPaid+=pi;
        if(due>0){// l'échéance est payée sur le profit, puis sur les réserves ; ce qui manque reste dû
          let pay=Math.min(pi,due);pi-=pay;if(pay<due){const take=Math.min(fm.R,due-pay);fm.R-=take;pay+=take;}
          fm.debt-=pay;F+=pay;}
        // usure : le capital perd une part P.depr de sa valeur ; seul le profit net d'usure peut être versé
        const wear=P.depr*fm.K;fm.K-=wear;fs.wear+=wear;wearY+=wear;const net=Math.max(0,pi-wear);
        // gains libres : une part P.payout du profit net est versée ; gains interdits : tout est versé, dans la limite des mises
        if(world==='L'){const d=net*P.payout;fm.R+=pi-d+distribute(fm,d,capped,W,funds.income,fs,capInc);}
        else{const keep=pi-net;fm.R+=keep+distribute(fm,net,capped,W,funds.income,fs,capInc);fm.Rw=(fm.Rw||0)+keep;}
        // investissement : d'abord sur les réserves, puis bourse et banque pour le reste
        // gains interdits : les réserves réinvesties n'appartiennent à personne, sauf la part qui ne fait que compenser l'usure (Rw)
        const I=P.invest*fm.K;const fromR=Math.min(fm.R,I);fm.R-=fromR;
        if(capped){const fromW=Math.min(fm.Rw||0,fromR);fm.Rw=Math.min((fm.Rw||0)-fromW,fm.R);fm.selfC+=fromR-fromW;}
        let rem=I-fromR,got=0;
        if(rem>eps&&(bank||stock)){const capE=stock?funds.capacity():0,capB=bank?Math.max(0,F):0;
          let nE=rem*phi,nB=rem-nE;
          if(nE>capE){nB+=nE-capE;nE=capE;}if(nB>capB){nE=Math.min(capE,nE+nB-capB);nB=capB;}
          if(nE>eps){// gains libres : les mises sont réévaluées à la valeur de l'entreprise avant l'entrée des nouveaux actionnaires
            if(world==='L'){const totC=totalStake(fm);const V=Math.max(eps,fm.K+fm.R-fm.debt);const f=V/Math.max(totC,eps);const hc=fm.hc;for(let k=0;k<fm.n;k++)hc[k]*=f;fm.selfC*=f;}
            const res=funds.raise(nE);for(let k=0;k<res.hi.length;k++)addHolder(fm,res.hi[k],res.hc[k],res.hc[k]);got+=res.got;fs.extE+=res.got;}
          if(nB>eps){F-=nB;fm.debt+=nB;got+=nB;fs.extB+=nB;}}
        fm.K+=fromR+got;fs.invested+=fromR+got;
        if(closed){poolNext+=fromR+got;
          // trésorerie : l'entreprise garde ce qu'il lui faut pour investir l'année suivante et verse le reste à ses propriétaires
          // (sociétés non financières 2023 : épargne brute 320 Md€ pour 336 Md€ d'investissement, autofinancement ≈ 95 %) ;
          // avec gains interdits, ce qui dépasse les mises des propriétaires reste dans l'entreprise
          const target=P.invest*fm.K;if(fm.R>target){const ex=fm.R-target;fm.R=target+distribute(fm,ex,capped,W,funds.income,fs,capInc);if(capped)fm.Rw=Math.min(fm.Rw||0,fm.R);}}}
      if(sumD>0&&(dInt>0||dLoss>0)){const f=(dInt-dLoss)/sumD;for(let j=0;j<N;j++)D[j]+=D[j]*f;}}
    if(closed){poolNext+=E-piPaid;cc.profit+=piPaid;}

    /* ---------- idées de création ---------- */
    for(let i=0;i<N;i++){
      if(rnd()>=P.pidea)continue;
      ideas[i]++;
      // le projet est tiré dès l'idée : réussite, coût et gain, inconnus de tous à l'avance
      const ok=rnd()<P.pok;const pj=drawProject(rnd,P);const ci=pj.cost*Pidx,gain0=pj.gain*Pidx;
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
          let capE=0;if(stock)capE=Math.max(0,funds.capacity()-fromFund/funds.M-feeQ);
          const debtBlock=bank&&L[i]>eps;
          const capB=(bank&&!debtBlock)?Math.max(0,F-fromDep-feeB):0;
          needE=need*phi;needB=need-needE;
          if(needE>capE){needB+=needE-capE;needE=capE;}
          if(needB>capB){needE+=needB-capB;needB=capB;}
          if(needE>capE+eps||needB>capB+eps){st.refused++;refI[i]++;if(debtBlock)st.refusedDebt++;else st.refusedFund++;continue;}
          if(needE<eps)needE=0;if(needB<eps)needB=0;}}
      W[i]-=fromCash;funds.redeem(i,fromFund);if(fromDep>eps){D[i]-=fromDep;F-=fromDep;}
      if(needB>0){F-=needB+feeB;if(!firmOn)L[i]+=needB+feeB;st.loans++;}
      let raised=0,res=null;
      if(needE>0){// levée auprès des fonds, coût d'introduction compris
        const totalE=needE+feeQ;res=funds.raise(totalE);
        raised=totalE;st.issues++;st.eqRaised+=totalE;st.holders+=res.hi.length;}
      st.funded++;
      if(closed){poolNext+=ci;feePot+=(needB>0?feeB:0)+(needE>0?feeQ:0);}
      if(firmOn){// le projet devient une entreprise : capital, dette propre, propriétaires (fondateur et fonds)
        const fm=newHoldings({},8);addHolder(fm,i,Math.max(own,1e-6),Math.max(own,1e-6));
        if(raised>0)for(let k=0;k<res.hi.length;k++)addHolder(fm,res.hi[k],res.hc[k],res.hc[k]);
        const rho=drawRho(rnd,P);
        firms.push(Object.assign(fm,{K:ci,R:0,debt:needB>0?needB+feeB:0,rho,age:0,f:i,selfC:0,dead:false,old:false}));fs.created++;
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
    if(closed){// les coûts de la banque et des fonds sont les salaires de leurs employés (répartis comme les salaires) ; les dépenses de l'année font les ventes de la suivante
      let sw=0;for(let i=0;i<N;i++)sw+=wage[i]*emp[i];if(sw>0&&feePot>0)for(let i=0;i<N;i++){const x=feePot*wage[i]*emp[i]/sw;W[i]+=x;capInc[i]+=x;}
      feePot=0;pool+=poolNext;poolNext=0;
      if(stateOn){GDPprev=sales+GW;debtR[t]=GDPprev>0?pubDebt/GDPprev:0;}
      // en euros du départ (divisés par l'indice des prix)
      {const y=Float64Array.from(consH).sort();consMed[t]=y[Math.floor(N/2)]/Pidx;let sm=0;for(let i=0;i<N;i++)sm+=consH[i];consMean[t]=sm/N/Pidx;
       ndp[t]=(sales+GW-wearY)/N/Pidx;let K=0;for(const fm of firms)if(!fm.dead)K+=fm.K;kNet[t]=K/N/Pidx;}
      pP[t]=Pidx;pInfl[t]=infl;pWr[t]=wIdx/Pidx;
      lab.close(t);
      cc.drift=Math.max(cc.drift,Math.abs(money()-M0)/M0);}
    const eqv=new Float64Array(N);let unowned=0,firmV=0;funds.stake.fill(0);
    if(firmOn)for(const fm of firms){if(fm.dead)continue;const V=Math.max(0,fm.K+fm.R-fm.debt);firmV+=V;unowned+=V-valueHoldings(fm,V,capped,eqv,funds.stake);}
    {const fv=funds.value(eqv);fs.fundV=fv.total;fs.fundUn=fv.unclaimed;unowned+=fv.unclaimed;}
    fs.unowned=unowned;fs.firmV=firmV;uT[t]=unowned/Pidx;Pnet=Pidx;
    wearY=0;
    let s=0;for(let i=0;i<N;i++){net[i]=W[i]+D[i]+eqSave[i]-L[i]+eqv[i]+Bh[i];s+=net[i];}tot[t]=s/Pidx;gi[t]=gini(net);
    {let a=0,d=0,o=0,e=0;for(let i=0;i<N;i++){a+=W[i]+eqSave[i]-L[i];d+=D[i];o+=Bh[i];e+=eqv[i];}bCash[t]=a/N/Pidx;bDep[t]=d/N/Pidx;bBond[t]=o/N/Pidx;bEq[t]=e/N/Pidx;
     let l=0,fd=0;for(let i=0;i<N;i++)l+=L[i];for(const fm of firms)if(!fm.dead)fd+=fm.debt;bSale[t]=(pool+poolNext+feePot+back)/N/Pidx;bBank[t]=(F-d+l+fd+Sc)/N/Pidx;}
    if(closed&&M0>0){const y=Float64Array.from(net).sort(),c5=y[Math.floor(0.5*N)],c9=y[Math.floor(0.9*N)];let h0=0,h1=0,h2=0,R=0;
      for(let i=0;i<N;i++){const h=W[i]+eqSave[i];if(net[i]>=c9)h2+=h;else if(net[i]>=c5)h1+=h;else h0+=h;}
      for(const fm of firms)if(!fm.dead)R+=fm.R;
      mPoor[t]=h0/M0;mMid[t]=h1/M0;mTop[t]=h2/M0;mFirm[t]=R/M0;mSale[t]=(pool+poolNext+feePot+back)/M0;mOther[t]=(F+funds.cash()+Sc)/M0;}
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
    fDiv:fs.divPaid,fWear:fs.wear,fInvested:fs.invested,fExtE:fs.extE,fExtB:fs.extB,fUnowned:fs.unowned/Pidx,fValue:fs.firmV/Pidx,
    cCov:cov,mPoor,mMid,mTop,mFirm,mSale,mOther,bCash,bDep,bBond,bEq,bSale,bBank,lU:lab.out.uT,lLong:lab.out.longT,lHours:lab.out.hoursT,lUnmet:unmet,rCons:consMed,rConsMean:consMean,rNdp:ndp,rUtil:util,rK:kNet,sDebt:debtR,sDef:defR,sTau:tau,sTax:sc.tax,sWages:sc.gw,sPurch:sc.gp,sInt:sc.int,sCut:sc.spend>0?sc.cut/sc.spend:0,
    sBond10:(()=>{if(!stateOn||pubDebt<=0)return 0;const y=Float64Array.from(net).sort();const c9=y[Math.floor(0.9*N)];let b=0;for(let i=0;i<N;i++)if(net[i]>=c9)b+=Bh[i];return b/pubDebt;})(),cDrift:cc.drift,cWageShort:closed&&wageSum>0?cc.wageShort/wageSum:0,cSaveRate:cc.inc>0?cc.save/cc.inc:0,cWageShare:cc.wagePaid+cc.profit>0?cc.wagePaid/(cc.wagePaid+cc.profit):0,
    fFundPaid:fs.fundPaid,fFundV:fs.fundV/Pidx,fFundUn:fs.fundUn/Pidx,fPart0:part0.all,fPart1:part1.all,fPart1T:part1.top,dg,
    net:Float64Array.from(net,v=>v/Pidx),pP,pInfl,pWr,pGap,pInflAvg:Pidx>0?Math.pow(Pidx,1/Math.max(1,T-1))-1:0,grp,owes,qi,refI:Int32Array.from(refI),lor0:hasStart?lorenz(init0,40):null,gini0:hasStart?gini(init0):null};
}

/* ---------- diagnostics par âge et par revenu (comparés à l'Insee dans l'onglet Hypothèses) ---------- */
function groupMean(N,n,gf,vf){const s=new Float64Array(n),c=new Float64Array(n);for(let i=0;i<N;i++){const g=gf(i);s[g]+=vf(i);c[g]++;}return Array.from(s,(v,g)=>c[g]?v/c[g]:NaN);}
function groupMedian(N,n,gf,vf){const L=Array.from({length:n},()=>[]);for(let i=0;i<N;i++)L[gf(i)].push(vf(i));return L.map(a=>{if(!a.length)return NaN;a.sort((x,y)=>x-y);return a[Math.floor(a.length/2)];});}
function startDiagnostics(C,part){const {N,age0,init0,qi}=C;
  return {wAge:groupMedian(N,6,i=>ageGroup(age0[i]),i=>init0[i]),pA0:groupMean(N,6,i=>ageGroup(age0[i]),i=>part[i]),pQ0:groupMean(N,5,i=>qi[i],i=>part[i]),
    ageMed0:Float64Array.from(age0).sort()[Math.floor(N/2)]};}
function endDiagnostics(C,dg,part){dg.pQ1=groupMean(C.N,5,i=>C.qi[i],i=>part[i]);}
