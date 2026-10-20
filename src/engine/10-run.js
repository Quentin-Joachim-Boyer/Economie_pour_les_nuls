/* =====================================================================
   Une simulation : world 'L' (gains libres) ou 'I' (gains interdits), une graine, des paramètres.
   Deux générateurs : prng pour la population (identique dans les deux scénarios), rnd pour les événements.
   Organisation : le départ (population, logement, bilans, calage), puis la boucle des années, qui appelle les étapes de l'année
   (fonctions définies sous la boucle, qui partagent l'état de la simulation), puis les résultats.
   Économie bouclée (P.closed, avec la brique entreprises) : la monnaie est en quantité fixe. Les ménages reçoivent leurs salaires
   des entreprises et leur achètent des biens ; la consommation et les achats publics font les ventes de l'année (les
   salaires sont avancés sur un fonds de roulement), l'investissement et les créations celles de l'année suivante ; les ventes moins les salaires forment le profit brut des entreprises, réparti selon leur
   rentabilité (qui n'est plus qu'une rentabilité « notionnelle ») ; les coûts de la banque et des fonds paient des salaires.
   État minimal (P.state, en économie bouclée) : il prélève un impôt sur les ventes des entreprises, paie une partie des salaires
   (fonctionnaires), achète des biens aux entreprises et finance son déficit en vendant des obligations aux ménages, qui lui paient
   des intérêts avec gains libres et aucun avec gains interdits.
   ===================================================================== */
function run(world,seed,P){
  /* N0 ménages au départ ; avec la démographie, N0/2 places de réserve (vides au départ) permettent au nombre de ménages de croître */
  const N0=P.N,T=P.T,eps=1e-9,dem0=!!(P.firm&&P.closed&&P.demo),N=dem0?N0+Math.round(DEMO_RESERVE*N0):N0;
  const bank=!!P.bank,stock=!!P.stock,firmOn=!!P.firm,capped=world==='I',closed=firmOn&&!!P.closed,stateOn=closed&&!!P.state;
  let rate=world==='L'?P.rl:0;                         // taux d'intérêt (nul avec gains interdits ; avec les prix, l'inflation : gain réel nul)
  const depE=bank?P.dep:0,invE=stock?Math.min(P.inv,1-depE):0; // parts de l'épargne déposée et placée en actions
  const phi=stock?(bank?P.phi:1):0;                    // part d'un besoin de financement demandée à la bourse
  const C={world,seed,P,N,N0,T,stock,prng:rng(seed*7919+13),rnd:rng(seed),firms:[],
    fs:{wear:0,scopPaid:0,created:0,died:0,bankrupt:0,bankLoss:0,divPaid:0,lostR:0,invested:0,extE:0,extB:0,fundPaid:0,fundV:0,fundUn:0,unowned:0,firmV:0}};
  const {rnd,firms,fs}=C;
  // W liquidités, D dépôts, eqSave épargne-actions de l'année (versée aux fonds), L dette personnelle, net patrimoine net
  const W=C.W=new Float64Array(N),D=new Float64Array(N),eqSave=C.eqSave=new Float64Array(N),L=new Float64Array(N),net=new Float64Array(N);
  const lent=new Float64Array(N);                      // prêt direct : apport de chacun au projet en cours
  const ideas=new Int32Array(N),succ=new Int32Array(N),fail=new Int32Array(N),refI=new Int32Array(N);

  // revenus du capital reçus en liquide dans l'année (économie bouclée : ils sont en partie consommés l'année suivante)
  const capInc=closed?(C.capInc=new Float64Array(N)):null;

  /* ---------- départ ---------- */
  const pop=makePopulation(P,N0,C.prng);
  if(N>N0)for(const k of ['wage','sr','qi','age0','W0']){const a=new pop[k].constructor(N);a.set(pop[k]);pop[k]=a;}
  const {wage,sr,qi,age0}=pop;
  const vac=new Uint8Array(N);for(let i=N0;i<N;i++)vac[i]=1;C.vac=vac;
  Object.assign(C,{W0:pop.W0,qi,age0});
  const funds=C.funds=makeFunds(C);
  // crédit : la banque crée la monnaie qu'elle prête (Mc = monnaie créée nette : prêts − remboursements de principal)
  const credit=C.creditOn=closed&&bank&&!!P.credit;let Mc=0;
  /* gains interdits : la banque ne s'enrichit pas, mais couvre ses pertes attendues (moyenne lissée des pertes passées) et ses frais
     (les mêmes, par euro prêté, qu'avec gains libres) : taux des prêts = inflation + pertes + frais ; ses fonds propres gardent leur valeur réelle */
  const costRate=BANK_COST_RATIO*Math.max(0,(P.rl||0)-DEPOSIT_RATE);let lossEst=0,bailY=0;
  /* logement : une partie du patrimoine Insee est un logement (hU, en unités de prix ; valeur hU × ph), avec un crédit (Mg) ;
     le reste (patrimoine brut hors logement) est tenu en liquidités, puis en parts, dépôts et obligations */
  const hous=closed&&!!P.housing,hU=new Float64Array(N),Mg=new Float64Array(N),hPriv=new Uint8Array(N);let ph=1,hShare=0;const gH=rng(seed*15485863+17);
  if(hous){const ord=Array.from({length:N0},(_,i)=>i).sort((a,b)=>pop.W0[a]-pop.W0[b]);
    const net0=Float64Array.from(pop.W0);
    ord.forEach((i,r)=>{const w=net0[i];const d=Math.min(9,Math.floor(r*10/N0)),h=HOUSING_DEC[d],p=OWN_DEC[d];if(w<=0||h<=0||gH()>=p)return;
      // propriétaire (taux de détention du décile) : logement = h/p du patrimoine brut g, dette selon l'âge, au plus 77,7 % du logement
      const e=MORT_DEBT_AGE(age0[i]);let g=w/(1-e),H=Math.min(1,h/p)*g,M=Math.min(e*g,MORT_LTV*H);g=w+M;H=Math.min(1,h/p)*g;
      hU[i]=H;Mg[i]=Math.min(M,MORT_LTV*H);});
    // dette immobilière d'ensemble : 14,6 % de la valeur des logements (1 288 Md€ de crédits habitat, BdF 2026 / 8 850 Md€, Insee 2024)
    {let sH=0,sM=0;for(let i=0;i<N0;i++){sH+=hU[i];sM+=Mg[i];}const k=sM>0?MORT_TO_HOUSING*sH/sM:0;
     for(let i=0;i<N0;i++){Mg[i]=credit?Math.min(Mg[i]*k,MORT_LTV*hU[i]):0;pop.W0[i]=net0[i]-hU[i]+Mg[i];}}
    for(let i=0;i<N0;i++)if(hU[i]<=0)hPriv[i]=gH()<PRIV_TENANT?1:0;}
  for(let i=0;i<N;i++)W[i]=pop.W0[i];
  const init0=C.init0=Float64Array.from(pop.W0);
  const hazard=hazardModel(P);
  let exist={exist0:0,biz5:0,bizEx:0};if(firmOn&&P.exist)exist=seedExistingFirms(C);
  if(hous)for(let i=0;i<N0;i++)init0[i]+=hU[i]-Mg[i];   // patrimoine net de départ : celui de l'Insee, logement compris
  const partic=makeParticipation(C);const part=partic.part;
  partic.update(init0,0);const part0=partic.stat(init0,vac);
  const dg=startDiagnostics({...C,N:N0},part);

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
  /* calage : le taux d'épargne observé porte sur tout le revenu, revenus du capital compris (environ 10 % du revenu disponible :
     revenus du patrimoine 21 % du RDB, Insee 2025, moins les loyers imputés des propriétaires, 215 Md€, absents du modèle) ; ceux-ci
     sont consommés à cA − 0,4 : cA = 1 − s + 0,4·κ/(1+κ) − mpcW·k/(1+κ), κ = 0,10, k = patrimoine / revenu. Dans le monde « gains
     interdits », les revenus du capital sont plus faibles (intérêts au niveau de l'inflation, loyers au coût, distributions plafonnées
     à l'apport) : κ = 0,06, part mesurée dans le modèle sur les dix premières années */
  const kap=CAP_INC_SHARE,cAof=(s,k)=>Math.max(0,1-s+MPC_CAP_GAP*kap/(1+kap)-P.mpcW*k/(1+kap));
  /* protection sociale (avec l'État) : retraités (hors population active, pension revalorisée sur les prix), allocation chômage,
     coût du travail = revenu disponible × lcF (cotisations, impôt sur le revenu et CSG), TVA, impôt sur les sociétés.
     démographie : décès, jeunes ménages, héritage (générateur propre) */
  const soc=stateOn&&!!P.social,dem=closed&&!!P.demo;
  // banque centrale (gains libres seulement) : taux directeur, inflation anticipée, taux bancaires, facteurs d'investissement
  const cb=closed&&bank&&!!P.credit&&!!P.cb&&world==='L',cbI0=P.i0??CB_I0;let iCB=cbI0,piE=CB_PI,rMort=MORT_RATE,rDep=DEPOSIT_RATE,fInv=1,fHinv=1,fAcc=1;const cbRate=new Float64Array(T);
  const gPe=P.gP+(soc?(P.hik??HEALTH_INKIND):0);   // achats publics aux entreprises, santé en nature comprise
  const retired=new Uint8Array(N),pens=new Float64Array(N),lcF=new Float64Array(N).fill(1);
  const act=new Uint8Array(N).fill(1);for(let i=N0;i<N;i++)act[i]=0;
  if(soc)for(let i=0;i<N0;i++){lcF[i]=1/((1-IR_BY_QUINTILE[qi[i]])*(1-COT_RATE));if(age0[i]>=RET_AGE){retired[i]=1;act[i]=0;pens[i]=PENSION_REPL*wage[i];}}   // même règle que pour les nouveaux retraités : pensions ≈ 13 % du PIB
  const lab=makeLabour({N,P,seed,qi,age0,T,on:closed&&!!P.unemp,act,jobs:soc?JOBS_PER_ACTIVE_HH:1},wage);const emp=lab.emp;
  let WB=0;for(let i=0;i<N;i++)if(emp[i])WB+=wage[i];
  /* prestations : bS = part du revenu d'un ménage d'âge actif versée par l'État (prestations familiales, logement, minima sociaux),
     selon son quintile ; un chômeur garde ses prestations et reçoit l'allocation chômage (deux ans) sur la part de revenu d'activité */
  const bS=new Float64Array(N),benQ=new Float64Array(5);
  if(soc){const sw=new Float64Array(5),nw=new Float64Array(5);let s=0;for(let i=0;i<N0;i++){sw[qi[i]]+=wage[i];nw[qi[i]]++;s+=wage[i];}const m=s/N0;
    for(let q=0;q<5;q++)benQ[q]=nw[q]>0?Math.min(0.9,BEN_UC[q]/(NV_MEAN*sw[q]/nw[q]/m)):0;
    for(let i=0;i<N0;i++){bS[i]=benQ[qi[i]];lcF[i]*=1-bS[i];}}
  const uiOf=i=>act[i]&&!emp[i]?(lab.dur[i]<UI_YEARS?UI_REPL*(1-bS[i])*wage[i]:0)+bS[i]*wage[i]:0;   // allocation chômage et prestations (unités du départ, avant wIdx)
  const sPub=new Float64Array(T),sPO=new Float64Array(T),deathsT=new Float64Array(T),retSh=new Float64Array(T);let deaths=0;
  // séries annuelles : logement (h…) et banque (k…)
  const hOwn=new Float64Array(T),hMort=new Float64Array(T),hVal=new Float64Array(T),hRent=new Float64Array(T),hAcc=new Float64Array(T);
  const kDef=new Float64Array(T),kEq=new Float64Array(T),kBail=new Float64Array(T),kCred=new Float64Array(T),kCET1=new Float64Array(T),kM=new Float64Array(T);
  let rhoS=1,LCsoc0=0;
  // calage de l'épargne : patrimoine / revenu et taux d'épargne par quintile (Q) et par case âge × quintile (Cell)
  const kQ=new Float64Array(5),srQ=new Float64Array(5),srCell=new Float64Array(30),kCell=new Float64Array(30);
  const dR=rng(seed*15485863+11),dZ=normalFrom(dR);
  // démographie : places de ménage vides (décès non remplacés) ; y0 = année de départ
  const y0=P.y0||START_YEAR;let entAcc=0,nAlive=N0;
  // conjoint survivant : sp = conjoint en vie (générateur propre) ; facteur k pour retrouver la part de couples parmi les ménages
  const gS=rng(seed*15485863+13),sp=new Uint8Array(N);let kC=0,wid=0,adults0=0,pE=0;const dWid=new Float64Array(T);
  if(dem){let s=0;for(let i=0;i<N0;i++)s+=COUPLE_BY_AGE(age0[i]);kC=COUPLE_HH_SHARE*N0/Math.max(s,1e-9);for(let i=0;i<N0;i++)sp[i]=gS()<Math.min(1,kC*COUPLE_BY_AGE(age0[i]))?1:0;
    for(let i=0;i<N0;i++)adults0+=1+sp[i];pE=Math.min(1,kC*COUPLE_BY_AGE(30));}
  const widow=i=>{sp[i]=0;wage[i]*=WIDOW_INCOME;pens[i]*=WIDOW_INCOME;wid++;};
  // valeurs des seuls ménages présents (les places vides sont exclues des statistiques)
  const liveOf=a=>{if(nAlive===N)return Float64Array.from(a);const o=new Float64Array(nAlive);let k=0;for(let i=0;i<N;i++)if(!vac[i])o[k++]=a[i];return o;};
  const depR=new Float64Array(T),hhN=new Float64Array(T);
  const wCut=(()=>{const y=Float64Array.from(wage).sort();return [1,2,3,4].map(k=>y[Math.floor(k*N/5)]);})();
  let wageSum=0,back=0,GDP0=0,GDPr0=0,capGDP=0;const WB0=WB;const unmet=new Float64Array(T);
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
  let pool=0,poolNext=0,feePot=0,scopPot=0,GP0=0,sales0=0,salesPrev=0,salesY=0,stTax=0;const cc={sub:0,wagePriv:0,prodTax:0,wagePaid:0,wageShort:0,cons:0,inc:0,save:0,profit:0,drift:0};const cov=new Float64Array(T);
  const money=()=>{let m=F+pool+poolNext+feePot+scopPot+back+funds.cash()+Sc;for(let i=0;i<N;i++)m+=W[i]+eqSave[i];for(const fm of firms)if(!fm.dead)m+=fm.R+(fm.wcap||0);return m;};
  // État : trésorerie Sc (monnaie), obligations détenues par chaque ménage (Bh), taux d'impôt tau calé au départ
  const Bh=new Float64Array(N),debtR=new Float64Array(T),defR=new Float64Array(T);let Sc=0,tau=0,tauC=0,pubDebt=0,BR=0,GDPprev=0;
  // règle budgétaire : efforts cumulés en prélèvements (effPO) et en dépenses (effG), en part du PIB ; cBase : assiette de la taxe sur la consommation
  const fisc=stateOn&&soc&&!!P.fiscal;let effPO=0,effG=0,dTauC=0,cBase=0,cBaseY=0;const fEff=new Float64Array(T),gdpR=new Float64Array(T);let rB=stateOn&&world==='L'?P.rB:0;
  const sc={tax:0,gw:0,gp:0,int:0,cut:0,spend:0,spendY:0};
  // parts du PIB du modèle prises par les salaires et achats publics ; kY : PIB français équivalent / PIB du modèle (fixé au départ)
  let gWm=P.gW,gPm=0,kY=1;
  // l'État emprunte aux ménages, au prorata de leurs liquidités
  const circ=stateOn&&!!P.circ;let Bb=0;   // obligations détenues par la banque
  // bilan de la banque : fonds propres = caisse + prêts + obligations − dépôts ; capacités de prêt (fonds propres, levier)
  const loansTot=()=>{let s=0;for(const fm of firms)if(!fm.dead)s+=fm.debt;for(let i=0;i<N;i++)s+=L[i];return s;};
  const sumDep=()=>{let s=0;for(let i=0;i<N;i++)s+=D[i];return s;};
  const mortTot=()=>{let s=0;for(let i=0;i<N;i++)s+=Mg[i];return s;};
  /* la monnaie créée par le crédit (Mc) est une dette de la banque envers ses détenteurs, comme un dépôt : sans elle, chaque prêt
     gonflerait les fonds propres de son montant et serait reversé en dividendes */
  const bankEq=()=>F+loansTot()+mortTot()+Bb-sumDep()-Mc;
  const capLev=()=>{const e=bankEq();return Math.max(0,e/LEVERAGE_MIN-(loansTot()+mortTot()+Bb+Math.max(0,F)));};
  // crédits immobiliers pondérés à 9,4 % dans les actifs pondérés (approche IRB)
  const capFirm=()=>{const e=bankEq(),l=loansTot(),m=mortTot();return Math.max(0,Math.min(e/CET1_MIN-l-RW_MORT*m,e/LEVERAGE_MIN-(l+m+Bb+Math.max(0,F))));};
  const borrow=need=>{if(credit&&need>0){const x=Math.min(need*BANK_GOV_SHARE,capLev());if(x>0){Bb+=x;Sc+=x;Mc+=x;pubDebt+=x;need-=x;}}
    if(circ&&!credit&&need>0){let sd=0;for(let i=0;i<N;i++)sd+=D[i];const x=Math.min(need,Math.max(0,F-BANK_RESERVE*sd));if(x>0){F-=x;Bb+=x;Sc+=x;pubDebt+=x;need-=x;}}
    let tw=0;for(let i=0;i<N;i++)tw+=Math.max(0,W[i]);const x=Math.min(need,tw);
    if(x>0){for(let i=0;i<N;i++){const b=x*Math.max(0,W[i])/tw;W[i]-=b;Bh[i]+=b;}Sc+=x;pubDebt+=x;}return x;};
  let M0=0;
  if(closed){// propension à consommer le revenu, calée par quintile (voir cA)
    // revenu disponible de départ : salaire, pension ou allocation chômage
    const y0=i=>emp[i]?wage[i]:soc?(retired[i]?pens[i]:uiOf(i)):0;
    {const sw=new Float64Array(5),sy=new Float64Array(5);for(let i=0;i<N;i++){sw[qi[i]]+=init0[i];sy[qi[i]]+=y0(i);srQ[qi[i]]=sr[i];}
     for(let q=0;q<5;q++)kQ[q]=sy[q]>0?sw[q]/sy[q]:0;
     for(let i=0;i<N;i++)cA[i]=cAof(sr[i],kQ[qi[i]]);}
    if(dem){/* avec la démographie : épargne selon l'âge et le revenu (calage sur marges, pondéré par le revenu), et patrimoine
        « normal » par case âge × quintile ; recalculés chaque année quand le ménage change de tranche d'âge */
      const fa=SAVE_BY_AGE.slice(),fq=SAVE_BY_QUINTILE.slice(),ga=i=>ageGroup(age0[i]);
      let ys=0,yt=0;for(let i=0;i<N;i++){ys+=sr[i]*y0(i);yt+=y0(i);}const mean=yt>0?ys/yt:P.save;
      const ty=new Float64Array(6),tq=new Float64Array(5);for(let i=0;i<N;i++){ty[ga(i)]+=y0(i);tq[qi[i]]+=y0(i);}
      let sa=0,sq=0;for(let g=0;g<6;g++)sa+=ty[g]*SAVE_BY_AGE[g];for(let q=0;q<5;q++)sq+=tq[q]*SAVE_BY_QUINTILE[q];
      const tA=SAVE_BY_AGE.map((v,g)=>v*mean*yt/sa),tQ=SAVE_BY_QUINTILE.map((v,q)=>v*mean*yt/sq);// cibles : taux moyens par groupe
      const s=(g,q)=>fa[g]*fq[q];
      for(let it=0;it<60;it++){const pa=new Float64Array(6),pq=new Float64Array(5);
        for(let i=0;i<N;i++)pa[ga(i)]+=s(ga(i),qi[i])*y0(i);for(let g=0;g<6;g++)if(pa[g]>0)fa[g]*=tA[g]*ty[g]/pa[g];
        for(let i=0;i<N;i++)pq[qi[i]]+=s(ga(i),qi[i])*y0(i);for(let q=0;q<5;q++)if(pq[q]>0)fq[q]*=tQ[q]*tq[q]/pq[q];}
      for(let g=0;g<6;g++)for(let q=0;q<5;q++)srCell[g*5+q]=Math.min(0.9,s(g,q));
      const cw=new Float64Array(30),cy=new Float64Array(30);for(let i=0;i<N;i++){const c=ga(i)*5+qi[i];cw[c]+=init0[i];cy[c]+=y0(i);}
      for(let c=0;c<30;c++)kCell[c]=cy[c]>0?cw[c]/cy[c]:kQ[c%5];
      for(let i=0;i<N;i++){const c=ga(i)*5+qi[i];sr[i]=srCell[c];cA[i]=cAof(sr[i],kCell[c]);}}
    /* ventes de l'année 0 = dépenses que le modèle produit lui-même : consommation (revenus d'activité et patrimoine) + investissement
       des entreprises (+ achats publics). Le profit d'ensemble en découle (ventes − salaires − impôt) : le départ est cohérent. */
    /* l'année 0 doit ressembler à l'année d'avant : les ménages disposent des revenus du capital de l'an passé (part κ du revenu, au
       prorata du patrimoine net), paient les intérêts de leur crédit immobilier et leur loyer ; les ventes de départ sont calculées
       avec la même règle de consommation que les années suivantes, sans quoi la première année connaît un choc de demande */
    if(capInc){let yt=0,wt=0;for(let i=0;i<N;i++){yt+=y0(i);wt+=Math.max(0,init0[i]);}
      if(wt>0)for(let i=0;i<N;i++)capInc[i]=kap*yt*Math.max(0,init0[i])/wt;}
    const rM0=capped?(credit?lossEst+costRate:0):MORT_RATE,rent0=hous?RENT_PRIV*(capped?HOUSING_DEPR/RENT_YIELD:1):0;
    const c0=i=>{if(vac[i])return 0;const ci=capInc?capInc[i]:0,mi=hous?Mg[i]*rM0:0;
      return Math.max(0,cA[i]*(y0(i)-mi)+Math.max(0,cA[i]-MPC_CAP_GAP)*ci+P.mpcW*init0[i]);};
    let C0=0,I0=0,rentT=0;for(let i=0;i<N;i++){const c=c0(i);C0+=c;if(hous&&hPriv[i]&&hU[i]<=eps)rentT+=Math.min(c,rent0);}
    C0-=rentT;   // les loyers vont aux bailleurs, pas aux entreprises
    for(const fm of firms)I0+=P.invest*(1-P.depr)*fm.K;   // l'investissement se calcule après l'usure de l'année
    if(hous){// part des dépenses des propriétaires consacrée au logement : 8,9 % du revenu de l'ensemble des ménages
      let co=0,yt=0;for(let i=0;i<N;i++){yt+=y0(i);if(hU[i]>eps)co+=c0(i);}hShare=co>0?Math.min(0.9,HOUSING_INV*yt/co):0;}
    pool=C0+I0;let tva0=0;
    if(stateOn){// PIB = ventes + salaires publics, avec achats publics et salaires publics en part du PIB ; l'impôt laisse le déficit visé
      // (même taux dans les deux scénarios : il est calé avec le taux d'intérêt observé)
      /* grandes masses publiques en euros : parts du PIB français (P.gW…) × PIB par ménage (P.gdpHH) × ménages ; le PIB du modèle
         (périmètre : entreprises marchandes, salaires publics, impôts sur les produits) en découle, et kY = PIB français / PIB du modèle
         sert ensuite à exprimer les ratios comme ceux de l'Insee */
      const Yeq=(P.gdpHH??GDP_HH)*N0,GW=P.gW*Yeq,GP=gPe*Yeq;GP0=GP;
      const gdp=C0+I0+GP+GW,T0=GW+GP+(soc?SUBS_VA*(C0+I0+GP):0)+(P.rB*P.debt0-P.defT)*Yeq;gWm=GW/gdp;gPm=GP/gdp;kY=Yeq/gdp;pool=gdp-GW;tau=T0/pool;
      if(soc){// recettes : cotisations et impôt sur le revenu (écart coût du travail / revenu disponible), TVA, impôt sur les sociétés,
        // et un impôt sur les ventes calé pour que le déficit de départ soit celui observé
        tva0=C0*TVA_RATE/(1+TVA_RATE);pool=gdp-GW-tva0;
        let LC0=0,Y0=0,TR0=0;for(let i=0;i<N;i++){if(emp[i]){LC0+=wage[i]*lcF[i];Y0+=wage[i];}else TR0+=retired[i]?pens[i]:uiOf(i);}
        LCsoc0=LC0;const LCp0=Math.max(0,LC0-GW),wedge0=LC0-Y0,R=T0+TR0;// T0 : dépenses hors transferts moins le déficit visé
        /* impôts sur la production des entreprises : 2,5 % du PIB ; le reste (X) est un impôt sur la consommation, qui réduit aussi les
           ventes des entreprises : X = R − cotisations et IR − TVA − impôts de production − IS(ventes − X − coût du travail − impôts de production) */
        const P0=pool,D29=PROD_TAX_GDP*Yeq;let X=(R-wedge0-tva0-D29-IS_RATE*Math.max(0,P0-D29-LCp0))/(1-IS_RATE);
        if(P0-X-D29-LCp0<0)X=R-wedge0-tva0-D29;X=Math.max(0,X);
        pool=P0-X;tau=pool>0?D29/pool:0;tauC=C0-tva0-X>0?X/(C0-tva0-X):0;tva0+=X;}   // tva0 : impôts sur les produits au départ
      GDPprev=gdp;
      // dette de départ : une partie des liquidités des ménages est en fait détenue en obligations publiques
      // non-résidents : 57,5 % de la dette (AFT) ; les ménages détiennent le reste, dans la limite de leurs liquidités
      BR=stateOn&&credit?NONRES_SHARE*P.debt0*Yeq:0;const dDom=P.debt0*Yeq-BR;
      let tw=0;for(let i=0;i<N;i++)tw+=Math.max(0,W[i]);const b=Math.min(dDom,0.9*tw);
      if(tw>0)for(let i=0;i<N;i++){const x=b*Math.max(0,W[i])/tw;W[i]-=x;Bh[i]+=x;}pubDebt=b;
      // ce que les ménages n'ont pas les liquidités de détenir (avec le logement, une grande partie de leur patrimoine n'est plus liquide)
      // est détenu par la banque, qui se refinance (elle tient lieu des non-résidents, 57,5 % de la dette de l'État)
      if(credit&&dDom>b+eps){const x=dDom-b;Bb+=x;F-=x;pubDebt+=x;}
      pubDebt+=BR;
      // avec la protection sociale, une partie de cette dette est la trésorerie de l'État : il paie salaires et achats publics en début
      // d'année et n'encaisse cotisations, impôt sur le revenu, TVA et impôt sur les sociétés qu'au fil de l'année
      if(soc)Sc=Math.min(pubDebt,GW+GP+P.rB*P.debt0*Yeq-tau*pool);}
    if(credit){/* bilan de départ de la banque : les prêts aux entreprises ont créé des dépôts, détenus par les ménages (pris sur leur
        patrimoine liquide Insee) ; fonds propres = 16,1 % des prêts, réserves = 1 % des dépôts */
      let lo=0;for(const fm of firms)lo+=fm.debt;const mo=mortTot(),E0=CET1_TARGET*(lo+RW_MORT*mo);lo+=mo;const D0=Math.max(0,(lo-E0)/(1-BANK_RESERVE));
      let tw=0;for(let i=0;i<N;i++)tw+=Math.max(0,W[i]);const x=Math.min(D0,0.9*tw);
      // fonds propres = E0 exactement ; si les ménages n'ont pas assez de liquidités pour les dépôts, la banque se refinance (caisse négative)
      if(tw>0)for(let i=0;i<N;i++){const d=x*Math.max(0,W[i])/tw;W[i]-=d;D[i]+=d;}F+=E0+x-lo;}
    /* ventes de l'année 0 : celles de l'investissement de l'an passé arrivent au début de l'année ; celles de la consommation et des
       achats publics arrivent pendant l'année. En attendant, les entreprises paient les salaires sur leur fonds de roulement (wcap),
       que les ventes de l'année reconstituent : il vaut au départ la consommation de l'année (même monnaie qu'avant). */
    sales0=pool;salesPrev=pool;
    {const wc=Math.max(0,pool-I0-GP0);let tk=0;for(const fm of firms)if(!fm.dead)tk+=fm.K;
     if(tk>0)for(const fm of firms)if(!fm.dead)fm.wcap=wc*fm.K/tk;pool=Math.min(pool,I0);}
    cap0=sales0;for(const fm of firms)if(!fm.dead)K0+=fm.K;
    // production possible au plein emploi (productivité proportionnelle au salaire)
    GDP0=stateOn?GDPprev:sales0;GDPr0=GDP0-tva0;{let wa=0;for(let i=0;i<N;i++)if(act[i])wa+=wage[i];capGDP=WB0>0?GDPr0*wa/WB0:0;}
    M0=money();}

  /* ==================== l'année, étape par étape ====================
     Chaque étape est une fonction ci-dessous ; elles partagent l'état de la simulation (variables de run). L'ordre compte :
     il fixe qui paie qui dans l'année et l'ordre des tirages aléatoires. */
  // variables de l'année, remises à zéro au début de chaque année
  let infl=0,feeB=0,feeQ=0,rentAmt=0,rM=0,ratio=1,sales=0,GW=0,kappa=0,E=0,piPaid=0;
  let levyY=0,subY=0,revY=0,trY=0,trF=1,tvaY=0,GPy=0,INTy=0,benE=0,rentPot=0,mortIntY=0,hInvY=0,rentY=0,accY=0;
  for(let t=0;t<T;t++){
    if(t>0)partic.update(pricesOn&&Pnet!==1?Float64Array.from(net,v=>v/Pnet):net,t);
    infl=0;ratio=1;sales=0;GW=0;kappa=0;E=0;piPaid=0;cBase=cBaseY;cBaseY=0;
    revY=0;trY=0;trF=1;levyY=0;subY=0;tvaY=0;GPy=0;INTy=0;benE=0;rentPot=0;mortIntY=0;hInvY=0;rentY=0;accY=0;
    updatePrices(t);                 // salaires, marge, prix ; réévaluation du capital
    centralBank(t);                  // taux directeur et taux bancaires
    startOfYear(t);                  // prix des logements, retraites, propensions à consommer
    chargeDebtInterest();            // intérêts des dettes personnelles
    demandAndBacklog(t);             // tension de la demande, commandes en attente
    if(closed){
      production(t);                 // ventes de l'année
      if(stateOn)stateBudget(t);     // impôts, dépenses, emprunt de l'État
      payWages(t);                   // salaires, cotisations, pensions, allocations
      householdsSpendAndSave(t);     // consommation, crédit immobilier, épargne
      if(hous)housingMarket(t);      // loyers, primo-accession
    }else householdsSaveOpen();
    funds.subscribe();               // l'épargne-actions va aux fonds
    if(closed)closeSales(t);         // fonds de roulement, commandes en attente, impôt sur la production
    splitProfits(t);                 // le profit d'ensemble réparti entre entreprises
    if(firmOn&&firms.length)firmsYear(t);   // échéances, disparitions, versements, investissement
    if(closed){poolNext+=E-piPaid;cc.profit+=piPaid;}   // profit non attribué : reste à vendre
    newIdeas(t);                     // créations d'entreprises
    bankCapital();                   // renflouement interne, dividendes de la banque
    funds.payout();if(circ)funds.release(FUND_CASH);
    if(dem)demography(t);            // décès, héritages, jeunes ménages
    if(closed)closeYear(t);          // PIB, comptes publics, indicateurs
    balanceSheets(t);                // patrimoines et monnaie de fin d'année
  }

  function updatePrices(t){
    /* ---------- prix : les salaires rattrapent l'inflation passée, la marge suit la tension ; le capital est réévalué ---------- */
    if(gA&&t>0){Aprod*=1+gA;if(!pricesOn)wIdx*=1+gA;}
    if(pricesOn&&t>0){wIdx*=(1+gA)*(1+Math.max(0,WAGE_ANCHOR*CB_PI+(1-WAGE_ANCHOR)*inflPrev));mk=Math.max(0,(1+mk)*(1+PHILLIPS_THETA*gapPrev)-1);
      const Pn=wIdx/Aprod*(1+mk)/(1+MARKUP0);infl=Pn/Pidx-1;Pidx=Pn;inflPrev=infl;
      for(const fm of firms)if(!fm.dead)fm.K*=1+infl;     // capital au coût de remplacement
      if(capped){// gains interdits, règle réelle : les mises restantes, dettes, dépôts et obligations sont indexés sur les prix
        const g=1+Math.max(0,infl);rate=g-1;if(stateOn)rB=g-1;
        for(const fm of firms)if(!fm.dead){const hr=fm.hr;for(let k=0;k<fm.n;k++)hr[k]*=g;}
        funds.index(g);}}
  }
  function centralBank(t){
    /* banque centrale (gains libres) : règle de taux lissée ; taux bancaires et taux de la dette publique en découlent ; l'investissement
       des entreprises, l'investissement en logement et la primo-accession réagissent au taux réel */
    if(cb&&t>0){piE=0.5*piE+0.5*inflPrev;
      const tgt=CB_RSTAR+CB_PI+CB_API*(inflPrev-CB_PI)+CB_AY*gapPrev;iCB=Math.max(CB_FLOOR,CB_RHO*iCB+(1-CB_RHO)*tgt);
      const di=iCB-cbI0;rate=P.rl+PT_FIRM*di;rMort=MORT_RATE+PT_MORT*di;rDep=Math.max(0,DEPOSIT_RATE+PT_DEP*di);
      if(stateOn)rB+=(Math.max(0,iCB+GOV_SPREAD)-rB)/GOV_MAT;
      const drr=(rate-piE)-(P.rl-CB_PI),drm=(rMort-piE)-(MORT_RATE-CB_PI);
      fInv=Math.max(0,1-SE_INV*drr);fHinv=Math.max(0,1-SE_HINV*drm);fAcc=Math.max(0,1-SE_ACC*(rMort-MORT_RATE));}
    if(cb)cbRate[t]=iCB;
  }
  // prix des logements, coûts d'émission, pensions et départs à la retraite, loyer, propension à consommer selon l'âge
  function startOfYear(t){
    if(hous)ph=capped?Pidx:wIdx;   // prix des logements : suit le revenu (gains libres) ou les prix (gains interdits)
    feeB=P.fee*Pidx;feeQ=P.feeE*Pidx;
    if(soc){// pensions revalorisées sur les prix ; départs à la retraite de l'année
      if(infl>0)for(let i=0;i<N;i++)if(retired[i])pens[i]*=1+infl;
      for(let i=0;i<N;i++)if(!retired[i]&&!vac[i]&&age0[i]+t>=RET_AGE){retired[i]=1;lab.retire(i);pens[i]=PENSION_REPL*wage[i]*wIdx;}}
    rentAmt=hous?RENT_PRIV*(capped?HOUSING_DEPR/RENT_YIELD:1)*ph:0;
    if(dem&&t>0)for(let i=0;i<N;i++){const c=ageGroup(age0[i]+t)*5+qi[i];sr[i]=srCell[c];cA[i]=cAof(sr[i],kCell[c]);}
  }
  function chargeDebtInterest(){
    /* ---------- intérêts des dettes personnelles, reversés aux déposants ---------- */
    if(bank&&rate>0){let acc=0,sumD=0;for(let i=0;i<N;i++){if(L[i]>eps){const x=L[i]*rate;L[i]+=x;acc+=x;}sumD+=D[i];}
      if(acc>0&&sumD>0){for(let j=0;j<N;j++)D[j]+=acc*D[j]/sumD;st.interest+=acc;}}
  }
  // économie bouclée : tension de la demande et commandes en attente
  function demandAndBacklog(t){
    // tension : demande de l'an passé (ventes et commandes en attente) rapportée à la production de départ
    if(pricesOn){gapPrev=GDPr0>0?((salesPrev+back)+(stateOn?gWm*GDPprev:0))/Pidx/(GDPr0*Aprod)-1:0;pGap[t]=gapPrev;}
    if(closed){pool+=back;salesY=pool;back=0;}
  }
  // ventes de l'année et utilisation des capacités
  function production(t){}
  /* fin des ventes de l'année : les entreprises reconstituent leur fonds de roulement ; la demande au-delà de ce que la population
     active peut produire attend l'année suivante (commandes en attente) ; impôt sur la production ; le reste est le profit brut */
  function closeSales(t){
    let drawn=0;for(const fm of firms)if(!fm.dead)drawn+=(fm.dW||0)+(fm.dR||0);
    if(drawn>0){const f=Math.min(1,pool/drawn);for(const fm of firms){if(fm.dead||!(fm.dW||fm.dR))continue;fm.wcap=(fm.wcap||0)+f*(fm.dW||0);fm.R+=f*(fm.dR||0);}pool-=f*drawn;}
    for(const fm of firms){fm.dW=0;fm.dR=0;}
    if(lab.on){const capS=Math.max(0,capGDP*Pidx*Aprod-(stateOn?gWm*GDPprev:0));if(salesY>capS){back=Math.min(pool,salesY-capS);pool-=back;}unmet[t]=salesY>0?back/salesY:0;}
    sales=salesY-back;salesPrev=sales;
    {let K=0;for(const fm of firms)if(!fm.dead)K+=fm.K;util[t]=cap0>0&&K>0&&K0>0?sales/(cap0*K/K0):0;}
    if(stateOn){const tax=tau*sales;pool-=tax;Sc+=tax;sc.tax+=tax;cc.prodTax+=tax;revY+=tax;stTax=tax;
      // subventions d'exploitation aux entreprises (2,8 % de leur valeur ajoutée) : elles entrent dans l'excédent brut d'exploitation
      if(soc){subY=SUBS_VA*sales;if(Sc<subY)borrow(subY-Sc);pool+=subY;Sc-=subY;cc.sub+=subY;sc.spend+=subY;}
      if(!soc)defR[t]=GDPprev>0?(sc.spendY-tax)/(GDPprev*kY):0;}
  }
  // État
  function stateBudget(t){
    // impôt sur les ventes, puis dépenses (fonctionnaires, achats, intérêts) ; le déficit est emprunté aux ménages
      // règle budgétaire : au-delà de 5 % de déficit l'an passé, 0,5 point de PIB d'effort de plus, 2/3 en prélèvements, 1/3 en dépenses
      // clause de récession : pas d'effort l'année qui suit un recul du PIB en volume
      if(fisc&&t>0&&defR[t-1]>FISC_DEF&&!(t>1&&gdpR[t-1]<gdpR[t-2])){effPO+=FISC_STEP*FISC_PO;effG+=FISC_STEP*(1-FISC_PO);}
      // sous 3 % de déficit, les mesures sont levées de 0,5 point par an (baisses d'impôts de 2018-2022)
      else if(fisc&&t>0&&defR[t-1]<FISC_REL&&effPO+effG>0){const e=effPO+effG,x=Math.min(FISC_STEP,e);effPO-=x*effPO/e;effG-=x*effG/e;}
      if(fisc){fEff[t]=effPO+effG;dTauC=cBase>0?effPO*GDPprev*kY/cBase:0;}
      const sG=fisc?Math.max(0,1-effG/(P.gW+gPe)):1;
      GW=gWm*sG*GDPprev;let GP=gPm*sG*GDPprev,INT=rB*pubDebt;
      // non-résidents : ils réinvestissent leurs intérêts en nouvelles obligations (rien ne sort du circuit, la dette grossit d'autant)
      const intR=pubDebt>0?INT*BR/pubDebt:0;BR+=intR;pubDebt+=intR;INT-=intR;
      const need=GW+GP+INT-Sc;
      if(need>0)borrow(need);
      const spend=GW+GP+INT,f=spend>Sc?Math.max(0,Sc)/spend:1;sc.cut+=spend*(1-f);sc.spend+=spend;GW*=f;GP*=f;INT*=f;Sc-=GW+GP+INT;
      const pubDom=pubDebt-BR;
      if(INT>0&&pubDom>0){for(let i=0;i<N;i++){const x=INT*Bh[i]/pubDom;W[i]+=x;capInc[i]+=x;}
        if(Bb>0){const xb=INT*Bb/pubDom;F+=xb;let sd=0;for(let i=0;i<N;i++)sd+=D[i];const pass=credit&&!capped?Math.min(1,rDep/Math.max(rate,1e-9)):1;
          if(sd>0)for(let i=0;i<N;i++)D[i]+=pass*xb*D[i]/sd;if(credit){const cost=BANK_COST_RATIO*(1-pass)*xb;F-=cost;feePot+=cost;}}}
      INT+=intR;pool+=GP;salesY+=GP;GPy=GP;INTy=INT;sc.gw+=GW;sc.gp+=GP;sc.int+=INT;sc.spendY=GW+GP+INT;
  }
  // salaires : sur les ventes, puis sur la trésorerie des entreprises ; puis prélèvements, pensions et allocations
  function payWages(t){
    // salaires privés : sur les ventes, puis sur la trésorerie des entreprises
    if(lab.on){lab.adjust(GDPr0>0?WB0*(salesPrev+GW)/Pidx/(GDPr0*Aprod):0,t);WB=lab.effEmp()*wIdx;}else if(soc||dem)WB=lab.effEmp()*wIdx;else if(pricesOn||gA)WB=WB0*wIdx;
    // protection sociale : les employeurs paient le coût du travail LC ; les ménages reçoivent le revenu disponible WB
    let WBd=WB;if(soc){let lc=0;for(let i=0;i<N;i++)if(emp[i])lc+=wage[i]*lcF[i];WB=lc*wIdx;}
    wageSum+=WB;
    const WBp=Math.max(0,WB-GW);let paid=Math.min(pool,WBp);pool-=paid;
    if(paid<WBp){const need=WBp-paid;let totK=0;for(const fm of firms)if(!fm.dead)totK+=fm.K;
      if(totK>0)for(const fm of firms){if(fm.dead)continue;const w=need*fm.K/totK,a=Math.min(fm.wcap||0,w),b=Math.min(fm.R,w-a);
        fm.wcap=(fm.wcap||0)-a;fm.R-=b;fm.dW=a;fm.dR=b;paid+=a+b;}}
    ratio=WB>0?(paid+GW)/WB:0;cc.wagePaid+=paid+GW;cc.wagePriv+=paid;cc.wageShort+=WB-paid-GW;
    if(soc){// cotisations et impôt sur le revenu (écart entre coût du travail et revenu disponible) ; puis pensions et allocations
      const wedge=ratio*(WB-WBd);Sc+=wedge;revY+=wedge;
      {let b=0;for(let i=0;i<N;i++)if(emp[i])b+=bS[i]*wage[i];benE=ratio*b*wIdx;revY+=benE;}   // prestations des actifs occupés : versées en même temps que le salaire
      let pnY=0,uiY=0;for(let i=0;i<N;i++){if(retired[i]){trY+=pens[i];pnY+=pens[i];}else{trY+=uiOf(i)*wIdx;if(act[i]&&!emp[i]&&lab.dur[i]<UI_YEARS)uiY+=UI_REPL*(1-bS[i])*wage[i]*wIdx;}}
      // pensions et allocations chômage sont versées brutes ; la CSG, la CRDS et la Casa qu'elles supportent reviennent à l'État
      // (opération blanche pour les ménages et le déficit, mais comptée dans les dépenses et les prélèvements, comme dans les comptes)
      levyY=pnY*PENS_LEVY/(1-PENS_LEVY)+uiY*UI_LEVY/(1-UI_LEVY);
      if(Sc<trY)borrow(trY-Sc);if(Sc<trY){trF=trY>0?Math.max(0,Sc)/trY:1;sc.cut+=trY*(1-trF);trY*=trF;}sc.spend+=trY;Sc-=trY;levyY*=trF;}
  }
  function householdsSpendAndSave(t){
    // le ménage reçoit son salaire, consomme (revenu et patrimoine), puis place ce qui reste
    rM=capped?Math.max(0,rate)+(credit?lossEst+costRate:0):rMort;
    for(let i=0;i<N;i++){const y=wage[i]*wIdx*ratio*emp[i]+(soc?trF*(retired[i]?pens[i]:uiOf(i)*wIdx):0);W[i]+=y;let inc=y+capInc[i];
      if(hous&&Mg[i]>eps){/* crédit immobilier : intérêts (revenu de la banque, en moins du revenu du ménage) et remboursement du principal
          en 22,7 ans (monnaie détruite) ; ce qui ne peut être payé s'ajoute à la dette */
        const it=Mg[i]*rM;Mg[i]+=it;inc-=it;const due=it+Mg[i]/MORT_YEARS;let paid=Math.min(due,Math.max(0,W[i]));W[i]-=paid;
        if(paid<due){const x=Math.min(due-paid,D[i]);D[i]-=x;F-=x;paid+=x;}
        Mg[i]-=paid;const ip=Math.min(paid,it);F+=ip;mortIntY+=ip;Mc-=paid-ip;
        // défaut : la dette ne peut pas dépasser la valeur du logement ; le reste est une perte de la banque
        const cap=hU[i]*ph;if(Mg[i]>cap){fs.bankLoss+=Mg[i]-cap;Mg[i]=cap;}}
      const c=Math.max(0,cA[i]*(inc-capInc[i])+Math.max(0,cA[i]-MPC_CAP_GAP)*capInc[i]+P.mpcW*(t===0?init0[i]:net[i]));   // revenus du capital moins consommés
      let pc=Math.min(c,Math.max(0,W[i]));W[i]-=pc;
      if(c-pc>eps&&bank){const x=Math.min(c-pc,D[i],credit?Infinity:Math.max(F,0));D[i]-=x;F-=x;pc+=x;}
      // loyer d'un locataire du parc privé : une partie de ses dépenses, versée aux bailleurs (pas aux entreprises)
      let rent=0;if(hous&&hPriv[i]&&hU[i]<=eps&&!vac[i]){rent=Math.min(pc,rentAmt);rentPot+=rent;}
      const pf=pc-rent;let netF=pf;
      if(soc){const v=pf*TVA_RATE/(1+TVA_RATE),tx=tauC+dTauC,vc=(pf-v)*tx/(1+tx);cBaseY+=(pf-v)/(1+tx);Sc+=v+vc;tvaY+=v+vc;pool+=pf-v-vc;salesY+=pf-v-vc;netF=pf-v-vc;}else{pool+=pf;salesY+=pf;}
      // investissement en logement des propriétaires : une part de leurs dépenses, qui accroît leur logement ; 77,7 % à crédit
      let hI=0;if(hous&&hU[i]>eps){hI=pf*hShare*fHinv;hU[i]+=hI/Math.max(pf,eps)*netF/ph;hInvY+=hI;
        if(credit){const ln=HOUSING_INV_CREDIT*hI;Mg[i]+=ln;W[i]+=ln;Mc+=ln;}}
      cc.cons+=pc;consH[i]=pc-hI;cc.inc+=inc;cc.save+=inc-pc;capInc[i]=0;
      let s=y-pc;if(s<=eps)continue;
      if(L[i]>eps){const p=Math.min(s,L[i]);L[i]-=p;W[i]-=p;F+=p;s-=p;}
      const d=s*depE,q=part[i]?s*invE:0;D[i]+=d;F+=d;eqSave[i]+=q;W[i]-=d+q;}
  }
  // logement : intérêts des crédits immobiliers, loyers, primo-accession, usure
  function housingMarket(t){
    // intérêts des crédits immobiliers : même partage que ceux des entreprises (déposants, frais de la banque, fonds propres)
    if(credit&&mortIntY>0){let sd=0;for(let j=0;j<N;j++)sd+=D[j];const rF=rM,pass=capped?(rF>0?Math.max(0,rate)/rF:1):Math.min(1,rDep/rM);
      if(sd>0)for(let j=0;j<N;j++)D[j]+=D[j]*pass*mortIntY/sd;const cost=(capped?(rF>0?costRate/rF:0):BANK_COST_RATIO*(1-pass))*mortIntY;F-=cost;feePot+=cost;}
    // loyers versés aux bailleurs, au prorata de ce qu'ils possèdent au-delà de leur propre logement (6,2 ans de leur revenu)
    const xs=new Float64Array(N);let sx=0;for(let j=0;j<N;j++){if(vac[j]||hU[j]<=eps)continue;xs[j]=Math.max(0,hU[j]*ph-PRICE_INC*wage[j]*wIdx);sx+=xs[j];}
    if(rentPot>0){if(sx>eps)for(let j=0;j<N;j++){if(xs[j]<=0)continue;const x=rentPot*xs[j]/sx;W[j]+=x;capInc[j]+=x;}
      else{pool+=rentPot;salesY+=rentPot;}rentY=rentPot;}
    // primo-accession : un locataire de 25 à 59 ans achète un logement (6,2 ans de revenu) à un bailleur, avec 22,3 % d'apport
    for(let i=0;i<N;i++){if(vac[i]||hU[i]>eps)continue;const a=age0[i]+t;if(a<25||a>=60||gH()>=ACC_RATE*fAcc)continue;
      let v=PRICE_INC*wage[i]*wIdx;if(v<=eps||sx<=eps)continue;
      let u=gH()*sx,j=0;for(;j<N;j++){u-=xs[j];if(u<=0&&xs[j]>0)break;}if(j>=N||xs[j]<=0)continue;
      v=Math.min(v,xs[j]);const liq=Math.max(0,W[i])+D[i];const down=credit?Math.min((1-MORT_LTV)*v,liq):v;if(liq<down)continue;
      let x=Math.min(down,Math.max(0,W[i]));W[i]-=x;if(x<down){D[i]-=down-x;F-=down-x;}
      if(credit){const ln=v-down;Mg[i]+=ln;Mc+=ln;}
      const uu=v/ph,sh=uu/hU[j];W[j]+=v;if(Mg[j]>eps){const pp=Mg[j]*sh;Mg[j]-=pp;W[j]-=pp;Mc-=pp;}
      hU[j]-=uu;hU[i]+=uu;xs[j]-=v;sx-=v;accY++;}
    for(let i=0;i<N;i++)hU[i]*=1-HOUSING_DEPR;
  }
  // économie ouverte (sans circuit) : chacun épargne une part fixe de son salaire
  function householdsSaveOpen(){
    for(let i=0;i<N;i++){let s=wage[i]*sr[i];
      if(L[i]>eps){const p=Math.min(s,L[i]);L[i]-=p;F+=p;s-=p;}
      const d=s*depE,q=part[i]?s*invE:0;D[i]+=d;F+=d;eqSave[i]+=q;W[i]+=s-d-q;}
  }
  function splitProfits(t){
    /* ---------- entreprises : profit, échéances, disparition, versements, investissement ---------- */
    // économie bouclée : le profit brut de l'ensemble (ventes − salaires) est réparti entre les entreprises en retirant à toutes la
    // même rentabilité kappa à leur rentabilité notionnelle (sans descendre sous zéro) ; ce qui n'est pas attribué reste à vendre

    // économie bouclée : au départ, le niveau des rentabilités notionnelles est ramené au profit que l'économie dégage vraiment
    // (forme de la distribution Insee conservée) ; le risque de disparition est calé sur ces rentabilités (survie à 5 ans = P.pok)
    if(closed&&t===0){let notional=0;for(const fm of firms)if(!fm.dead)notional+=fm.rho*fm.K;
      if(notional>0&&pool<notional){rhoS=pool/notional;for(const fm of firms)fm.rho*=rhoS;}}
    if(closed){E=pool;pool=0;let totK=0,notional=0,maxR=0;for(const fm of firms)if(!fm.dead){totK+=fm.K;notional+=fm.rho*fm.K;if(fm.rho>maxR)maxR=fm.rho;}
      cov[t]=notional>0?E/notional:0;
      if(totK<=0){poolNext+=E;E=0;}
      else if(E>=notional)kappa=(notional-E)/totK;
      else{let lo=0,hi=maxR;for(let it=0;it<60;it++){const m=(lo+hi)/2;let sm=0;for(const fm of firms)if(!fm.dead&&fm.rho>m)sm+=(fm.rho-m)*fm.K;if(sm>E)lo=m;else hi=m;}kappa=hi;}}
  }
  // entreprises : profit, échéances, disparition, versements, investissement ; puis reprise des actifs et intérêts aux déposants
  function firmsYear(t){
    let sumD=0;for(let j=0;j<N;j++)sumD+=D[j];let dInt=0,dLoss=0;
      const spr=credit&&capped?lossEst+costRate:0,rF=rate+spr;let lossY=0,lo0=0,defY=0,recK=0;if(credit)for(const fm of firms)if(!fm.dead)lo0+=fm.debt;
      for(const fm of firms){if(fm.dead)continue;fm.age++;
        let pi=closed?Math.max(0,fm.rho-kappa)*fm.K:fm.rho*fm.K,due=0,intrY=0;
        if(fm.debt>eps){// intérêts (gains libres seulement), reversés aux déposants ; échéance : intérêts + 10 % de la dette
          const intr=fm.debt*rF;intrY=intr;if(intr>0){fm.debt+=intr;dInt+=intr;st.interest+=intr;}
          /* crédit : les entreprises renouvellent leurs prêts ; elles ne remboursent le principal que pour la part de dette au-delà
             de 47 % de leur capital (endettement bancaire moyen des sociétés non financières) */
          due=Math.min(intr+(credit?Math.max(0,fm.debt-SNF_CREDIT_K*fm.K):fm.debt)*DEBT_AMORT,fm.debt);}
        // plus la marge est faible, plus la disparition est probable ; le capital est perdu, la banque perd ce qui lui reste dû
        const margin=(pi-due)/Math.max(fm.K,eps);
        /* grandes entreprises et ETI existantes : chacune représente des centaines d'entreprises réelles (une seule pour les 327 grandes
           entreprises françaises) ; au lieu de disparaître d'un coup, elle perd chaque année la part h de son capital et de sa dette
           (les entreprises représentées qui font faillite) : h = part du capital des ETI et grandes entreprises qui fait défaut (0,12 %)
           × risque relatif de sa marge par rapport à sa marge de la première année ; 40 % des actifs défaillants sont repris (reste dans
           l'entreprise, avec autant de dette) ; la banque perd ce qui lui est dû au-delà */
        const uH=rnd(),hz=hazard(margin/rhoS,fm.age);
        if(fm.old&&FIRM_CATS[fm.cat].big){if(fm.m0==null)fm.m0=Math.max(margin,1e-3);
          const h=Math.min(HAZARD_MAX,BIG_FAIL_RATE*hz/Math.max(hazard(fm.m0/rhoS,fm.age),1e-12));
          if(h>0){const rec=credit?FIRM_RECOVERY:0;defY+=h*fm.debt;fm.K-=(1-rec)*h*fm.K;const ld=Math.max(0,h*fm.debt-rec*h*fm.K/(1-(1-rec)*h));
            if(ld>eps){fm.debt-=ld;due=Math.min(due,fm.debt);fs.bankLoss+=ld;lossY+=ld;if(!credit)dLoss+=ld;}}}
        else if(uH<hz){if(margin<=0)fs.bankrupt++;
          fm.dead=true;fs.died++;if(fm.f>=0){if(fm.age<5)fail[fm.f]++;else succ[fm.f]++;}
          // économie bouclée : la trésorerie rembourse d'abord la banque ; ce qui n'appartient à personne lui revient aussi
          defY+=fm.debt;fm.R+=fm.wcap||0;fm.wcap=0;
          if(closed&&fm.debt>eps&&fm.R>0){const p=Math.min(fm.R,fm.debt);fm.R-=p;fm.debt-=p;if(credit)Mc-=p;else F+=p;}
          /* crédit : reprise de 40 % du capital par les autres entreprises (après la boucle), qui reprennent la dette à hauteur de cette
             valeur ; si la valeur dépasse la dette, elles empruntent la différence, versée aux propriétaires */
          if(credit&&fm.K>eps){const V=FIRM_RECOVERY*fm.K,as=Math.min(V,fm.debt),ex=V-as;fm.debt-=as;recK+=V;if(ex>eps){Mc+=ex;fm.R+=ex;}}
          if(fm.debt>eps){fs.bankLoss+=fm.debt;lossY+=fm.debt;if(!credit)dLoss+=fm.debt;fm.debt=0;}
          const lost=distribute(fm,fm.R,capped,W,funds.income,fs,capInc);if(closed)F+=lost;else fs.lostR+=lost;fm.R=0;freeHoldings(fm);continue;}
        piPaid+=pi;
        if(soc&&pi>0){const x=IS_RATE*pi;pi-=x;Sc+=x;revY+=x;}
        if(due>0){// l'échéance est payée sur le profit, puis sur les réserves ; ce qui manque reste dû
          let pay=Math.min(pi,due);pi-=pay;if(pay<due){const take=Math.min(fm.R,due-pay);fm.R-=take;pay+=take;}
          fm.debt-=pay;if(credit){const ip=Math.min(pay,intrY);F+=ip;Mc-=pay-ip;}else F+=pay;}
        // usure : le capital perd une part P.depr de sa valeur ; seul le profit net d'usure peut être versé
        const wear=P.depr*fm.K;fm.K-=wear;fs.wear+=wear;wearY+=wear;const piNet=Math.max(0,pi-wear);
        /* avec le crédit, financement à dette cible : l'entreprise garde d'abord la part de son profit net qui finance en fonds propres
           son investissement net (53 % : la dette des sociétés reste vers 47 % de leur capital) et résorbe 30 % par an de sa dette en excès */
        let keepE=0;if(credit){const In=Math.max(0,P.invest*fInv*fm.K-wear);keepE=Math.min(piNet,(1-SNF_CREDIT_K)*In+LEV_ADJ*Math.max(0,fm.debt-SNF_CREDIT_K*fm.K));}
        const distr=piNet-keepE;
        // gains libres : une part P.payout du reste est versée ; gains interdits : tout le reste est versé, dans la limite des mises
        if(world==='L'){const d=distr*P.payout;fm.R+=pi-d+distribute(fm,d,capped,W,funds.income,fs,capInc);}
        else{const keep=pi-piNet;fm.R+=keep+keepE+distribute(fm,distr,capped,W,funds.income,fs,capInc);fm.Rw=(fm.Rw||0)+keep;}
        // investissement : d'abord sur les réserves, puis bourse et banque pour le reste
        // gains interdits : les réserves réinvesties n'appartiennent à personne, sauf la part qui ne fait que compenser l'usure (Rw)
        const I=P.invest*fInv*fm.K;const fromR=Math.min(fm.R,I);fm.R-=fromR;
        if(capped){const fromW=Math.min(fm.Rw||0,fromR);fm.Rw=Math.min((fm.Rw||0)-fromW,fm.R);fm.selfC+=fromR-fromW;}
        let rem=I-fromR,got=0;
        if(rem>eps&&(bank||stock)){const capE=stock?funds.capacity():0,capB=bank?(credit?capFirm():Math.max(0,F)):0;
          let nE=rem*phi,nB=rem-nE;
          if(nE>capE){nB+=nE-capE;nE=capE;}if(nB>capB){nE=Math.min(capE,nE+nB-capB);nB=capB;}
          if(nE>eps){// gains libres : les mises sont réévaluées à la valeur de l'entreprise avant l'entrée des nouveaux actionnaires
            if(world==='L'){const totC=totalStake(fm);const V=Math.max(eps,fm.K+fm.R-fm.debt);const f=V/Math.max(totC,eps);const hc=fm.hc;for(let k=0;k<fm.n;k++)hc[k]*=f;fm.selfC*=f;}
            const res=funds.raise(nE);for(let k=0;k<res.hi.length;k++)addHolder(fm,res.hi[k],res.hc[k],res.hc[k]);got+=res.got;fs.extE+=res.got;}
          if(nB>eps){if(credit)Mc+=nB;else F-=nB;fm.debt+=nB;got+=nB;fs.extB+=nB;}}
        fm.K+=fromR+got;fs.invested+=fromR+got;
        if(closed){poolNext+=fromR+got;
          // trésorerie : l'entreprise garde ce qu'il lui faut pour investir l'année suivante et verse le reste à ses propriétaires
          // (sociétés non financières 2023 : épargne brute 320 Md€ pour 336 Md€ d'investissement, autofinancement ≈ 95 %) ;
          // avec gains interdits, ce qui dépasse les mises des propriétaires reste dans l'entreprise
          const target=P.invest*fm.K;
          // la trésorerie en excès rembourse d'abord la dette au-delà de la dette cible (47 % du capital), puis revient aux propriétaires
          if(credit&&fm.R>target){const rp=Math.min(fm.R-target,Math.max(0,fm.debt-SNF_CREDIT_K*fm.K));if(rp>0){fm.R-=rp;fm.debt-=rp;Mc-=rp;}}
          if(fm.R>target){const ex=fm.R-target;const left=distribute(fm,ex,capped,W,funds.income,fs,capInc);
            // gains interdits, règle des SCOP : ce que les propriétaires ne peuvent plus recevoir (mises remboursées) va aux salariés
            if(capped&&closed){scopPot+=left;fs.scopPaid+=left;fm.R=target;}else fm.R=target+left;if(capped)fm.Rw=Math.min(fm.Rw||0,fm.R);}}}
      if(recK>eps){// reprise des actifs des entreprises disparues, au prorata du capital des entreprises restantes, avec la dette correspondante
        let tk=0;for(const fm of firms)if(!fm.dead)tk+=fm.K;if(tk>eps)for(const fm of firms)if(!fm.dead){const x=recK*fm.K/tk;fm.K+=x;fm.debt+=x;}
        else{for(const fm of firms)if(fm.dead&&fm.debt<0)fm.debt=0;}}
      if(credit)kDef[t]=lo0>eps?defY/lo0:0;
      if(credit){// les déposants reçoivent leur taux ; la banque garde la marge, dont une partie paie ses frais (salaires)
        // gains interdits : les déposants reçoivent l'inflation, les frais sont payés, la couverture des pertes reste en fonds propres
        const pass=capped?(rF>0?rate/rF:1):Math.min(1,rDep/Math.max(rate,1e-9));if(sumD>0&&dInt>0)for(let j=0;j<N;j++)D[j]+=D[j]*pass*dInt/sumD;
        const cost=(capped?(rF>0?costRate/rF:0):BANK_COST_RATIO*(1-pass))*dInt;if(cost>0){F-=cost;feePot+=cost;}
        if(capped&&lo0>eps)lossEst=0.5*lossEst+0.5*lossY/lo0;}
      else if(sumD>0&&(dInt>0||dLoss>0)){const f=(dInt-dLoss)/sumD;for(let j=0;j<N;j++)D[j]+=D[j]*f;}
  }
  function newIdeas(t){
    /* ---------- idées de création ---------- */
    for(let i=0;i<N;i++){
      if(rnd()>=P.pidea||vac[i])continue;
      ideas[i]++;
      // le projet est tiré dès l'idée : réussite, coût et gain, inconnus de tous à l'avance
      const ok=rnd()<P.pok;const pj=drawProject(rnd,P);const ci=pj.cost*Pidx,gain0=pj.gain*Pidx;
      // apport personnel : liquidités, parts de fonds, puis dépôt (dans la limite de ce que la banque a en caisse)
      const depAvail=bank?(credit?D[i]:Math.min(D[i],Math.max(F,0))):0;
      const fAv=stock?funds.available(i):0;const avail=W[i]+fAv+depAvail;
      const own=Math.min(avail,ci);const need=ci-own;
      const fromCash=Math.min(W[i],own),fromFund=Math.min(fAv,own-fromCash),fromDep=own-fromCash-fromFund;
      let lentDirect=false,needB=0,needE=0;
      if(need>eps){
        if(!bank&&!stock){// prêt direct des autres ménages, au prorata de leurs liquidités (interdit avec gains interdits)
          if(capped){st.refused++;refI[i]++;continue;}
          let lendPool=0;for(let j=0;j<N;j++)if(j!==i)lendPool+=W[j];
          if(lendPool<need){st.refused++;refI[i]++;continue;}
          for(let j=0;j<N;j++){lent[j]=(j!==i)?need*W[j]/lendPool:0;W[j]-=lent[j];}
          lentDirect=true;
        }else{// capacités : la bourse (trésorerie des fonds) et la banque (caisse, si pas déjà endetté)
          let capE=0;if(stock)capE=Math.max(0,funds.capacity()-fromFund/funds.M-feeQ);
          const debtBlock=bank&&L[i]>eps;
          const capB=(bank&&!debtBlock)?(credit?Math.max(0,capFirm()-feeB):Math.max(0,F-fromDep-feeB)):0;
          needE=need*phi;needB=need-needE;
          if(needE>capE){needB+=needE-capE;needE=capE;}
          if(needB>capB){needE+=needB-capB;needB=capB;}
          if(needE>capE+eps||needB>capB+eps){st.refused++;refI[i]++;if(debtBlock)st.refusedDebt++;else st.refusedFund++;continue;}
          if(needE<eps)needE=0;if(needB<eps)needB=0;}}
      W[i]-=fromCash;funds.redeem(i,fromFund);if(fromDep>eps){D[i]-=fromDep;F-=fromDep;}
      if(needB>0){if(credit)Mc+=needB+feeB;else F-=needB+feeB;if(!firmOn)L[i]+=needB+feeB;st.loans++;}
      let raised=0,res=null;
      if(needE>0){// levée auprès des fonds, coût d'introduction compris
        const totalE=needE+feeQ;res=funds.raise(totalE);
        raised=totalE;st.issues++;st.eqRaised+=totalE;st.holders+=res.hi.length;}
      st.funded++;
      if(closed){poolNext+=ci;feePot+=(needB>0?feeB:0)+(needE>0?feeQ:0);}
      if(firmOn){// le projet devient une entreprise : capital, dette propre, propriétaires (fondateur et fonds)
        const fm=newHoldings({},8);addHolder(fm,i,Math.max(own,1e-6),Math.max(own,1e-6));
        if(raised>0)for(let k=0;k<res.hi.length;k++)addHolder(fm,res.hi[k],res.hc[k],res.hc[k]);
        const rho=drawRho(rnd,P)*rhoS;
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
  }
  function bankCapital(){
    /* ---------- versements des fonds, puis bilan de l'année ---------- */
    if(credit){/* renflouement interne (directive BRRD 2014/59/UE) : si les pertes font passer les fonds propres sous l'exigence, les dépôts
        au-delà de la garantie de 100 000 € (FGDR, directive 2014/49/UE) sont convertis en fonds propres, au prorata, jusqu'à la retrouver */
      const l=loansTot()+RW_MORT*mortTot(),need=CET1_MIN*l-bankEq();if(need>eps){const g=DEPOSIT_GUARANTEE*Pidx;let ex=0;for(let i=0;i<N;i++)ex+=Math.max(0,D[i]-g);
        if(ex>eps){const h=Math.min(1,need/ex);for(let i=0;i<N;i++)if(D[i]>g)D[i]-=h*(D[i]-g);bailY+=Math.min(need,ex);}}}
    if(credit){// dividendes de la banque : ce qui dépasse le ratio de fonds propres effectif, versé aux fonds (actionnaires) au prorata de leurs participations
      const l=loansTot(),m=mortTot(),ex=bankEq()-Math.max(CET1_TARGET*(l+RW_MORT*m),LEVERAGE_MIN*(l+m+Bb+Math.max(0,F)));
      if(ex>eps){const FS=funds.stake,FI=funds.income;let s=0;for(let f=0;f<FS.length;f++)s+=Math.max(0,FS[f]);
        for(let f=0;f<FS.length;f++)FI[f]+=ex*(s>eps?Math.max(0,FS[f])/s:1/FS.length);F-=ex;}}
  }
  function demography(t){
    /* démographie : décès (loi de Gompertz), héritage à un ménage d'une génération plus jeune (même fonds, pour lui transmettre
      ses parts), droits de succession à l'État ; le ménage disparu est remplacé par un jeune ménage sans patrimoine */
    for(let i=0;i<N;i++){const a=age0[i]+t,u=dR();if(vac[i])continue;
      if(u>=deathProb(a-MORT_SHIFT*t)){// le conjoint peut décéder seul : le ménage continue, avec un revenu réduit
        if(sp[i]&&gS()<deathProb(a-SPOUSE_GAP-MORT_SHIFT*t))widow(i);continue;}
      if(sp[i]){widow(i);age0[i]-=SPOUSE_GAP;continue;}   // le conjoint survivant devient la personne de référence, et garde le patrimoine
      deaths++;
      let j=-1;for(let k=0;k<60&&j<0;k++){const c=Math.floor(dR()*N);if(c!==i&&!vac[c]&&funds.fundOf[c]===funds.fundOf[i]){const ac=age0[c]+t;if(ac>=a-HEIR_GAP[1]&&ac<=a-HEIR_GAP[0])j=c;}}
      for(let k=0;k<200&&j<0;k++){const c=Math.floor(dR()*N);if(c!==i&&!vac[c]&&funds.fundOf[c]===funds.fundOf[i])j=c;}
      if(j<0){j=(i+1)%N;while(vac[j]&&j!==i)j=(j+1)%N;}
      const tx=stateOn?Math.min(Math.max(0,W[i]),ESTATE_TAX*Math.max(0,net[i])):0;if(tx>0){Sc+=tx;revY+=tx;}
      W[j]+=W[i]-tx;D[j]+=D[i];L[j]+=L[i];eqSave[j]+=eqSave[i];Bh[j]+=Bh[i];if(capInc)capInc[j]+=capInc[i];hU[j]+=hU[i];Mg[j]+=Mg[i];hU[i]=Mg[i]=0;
      W[i]=D[i]=L[i]=eqSave[i]=Bh[i]=0;if(capInc)capInc[i]=0;
      funds.move(i,j);
      for(const fm of firms){if(fm.dead)continue;const n=fm.n;for(let k=0;k<n;k++)if(fm.hi[k]===i&&(fm.hc[k]>0||fm.hr[k]>0)){const x=fm.hc[k],r=fm.hr[k];fm.hc[k]=0;fm.hr[k]=0;addHolder(fm,j,x,r);}}
      // la place reste vide jusqu'à l'entrée d'un jeune ménage
      vac[i]=1;nAlive--;retired[i]=0;pens[i]=0;consH[i]=0;lab.retire(i);}
    /* entrées : la génération qui atteint 25 ans et les migrants, dans les places vides (une génération plus nombreuse que les places
       libres attend l'année suivante, au plus une année de retard) */
    // en personnes : adultes du modèle au départ × (génération + migrants) / adultes de France ; un ménage entrant compte 1 + pE adultes
    const eY=adults0*ENTRY_RATE(y0,t)/(1+pE);entAcc=Math.min(entAcc+eY,2*eY);
    for(let i=0;i<N&&entAcc>=1;i++){if(!vac[i])continue;entAcc--;vac[i]=0;nAlive++;
      // jeune ménage : nouveau revenu (même loi), quintile, épargne et propension à consommer de son quintile
      age0[i]=NEW_HH_AGE-(t+1);retired[i]=0;pens[i]=0;sp[i]=gS()<pE?1:0;if(hous)hPriv[i]=gH()<PRIV_TENANT?1:0;
      wage[i]=P.inc?P.incM*Math.exp(P.sigI*dZ()):P.incM;let q=0;while(q<4&&wage[i]>=wCut[q])q++;qi[i]=q;
      {const c=ageGroup(NEW_HH_AGE)*5+q;sr[i]=srCell[c];cA[i]=cAof(sr[i],kCell[c]);}if(soc){bS[i]=benQ[q];lcF[i]=(1-bS[i])/((1-IR_BY_QUINTILE[q])*(1-COT_RATE));}lab.enter(i);}
    deathsT[t]=deaths;dWid[t]=wid;
  }
  // fin d'année (économie bouclée) : frais reversés en salaires, PIB, comptes publics, indicateurs
  function closeYear(t){
    // les coûts de la banque et des fonds sont les salaires de leurs employés (répartis comme les salaires) ; les dépenses de l'année font les ventes de la suivante
    let sw=0;for(let i=0;i<N;i++)sw+=wage[i]*emp[i];if(sw>0&&feePot>0)for(let i=0;i<N;i++){const x=feePot*wage[i]*emp[i]/sw;W[i]+=x;capInc[i]+=x;}
    // part des salariés (gains interdits) : un complément de salaire, au prorata des salaires
    if(sw>0&&scopPot>0){for(let i=0;i<N;i++)W[i]+=scopPot*wage[i]*emp[i]/sw;scopPot=0;}
    feePot=0;pool+=poolNext;poolNext=0;
    if(stateOn){
      GDPprev=sales+GW+tvaY;gdpR[t]=GDPprev/Pidx;debtR[t]=GDPprev>0?pubDebt/(GDPprev*kY):0;
      if(soc){revY+=tvaY+levyY;const spendY=GW+GPy+INTy+trY+benE+levyY+subY;const Yq=GDPprev*kY;defR[t]=Yq>0?(spendY-revY)/Yq:0;sPub[t]=Yq>0?spendY/Yq:0;sPO[t]=Yq>0?revY/Yq:0;}}
    // en euros du départ (divisés par l'indice des prix)
    {const y=liveOf(consH).sort();consMed[t]=y[Math.floor(y.length/2)]/Pidx;let sm=0;for(let i=0;i<N;i++)sm+=consH[i];consMean[t]=sm/nAlive/Pidx;
     ndp[t]=(sales+GW-wearY)/nAlive/Pidx;let K=0;for(const fm of firms)if(!fm.dead)K+=fm.K;kNet[t]=K/nAlive/Pidx;}
    pP[t]=Pidx;pInfl[t]=infl;pWr[t]=wIdx/Pidx;
    lab.close(t,nAlive);{let r=0,o=0,w=0;for(let i=0;i<N;i++){if(vac[i])continue;r+=retired[i];const a=age0[i]+t;if(a>=65)o++;else if(a>=20)w++;
        if(sp[i]){const b=a-SPOUSE_GAP;if(b>=65)o++;else if(b>=20)w++;}}   // en personnes : personne de référence et conjoint
      retSh[t]=r/nAlive;depR[t]=w>0?o/w:0;hhN[t]=nAlive/N0;}
    cc.drift=Math.max(cc.drift,Math.abs(money()-M0-Mc)/Math.max(Math.abs(M0),1e-9));
    if(hous){let o=0,hv=0,mg=0;for(let i=0;i<N;i++){if(vac[i])continue;if(hU[i]>eps)o++;hv+=hU[i]*ph;mg+=Mg[i];}
      hOwn[t]=o/nAlive;hMort[t]=GDPprev>0?mg/(GDPprev*kY):0;hVal[t]=GDPprev>0?hv/(GDPprev*kY):0;hRent[t]=GDPprev>0?rentY/(GDPprev*kY):0;hAcc[t]=accY/nAlive;}
    if(credit){let lo=0;for(const fm of firms)if(!fm.dead)lo+=fm.debt;
      kCred[t]=GDPprev>0?lo/(GDPprev*kY):0;kCET1[t]=lo>1e-3*N?bankEq()/lo:0;kEq[t]=GDPprev>0?bankEq()/(GDPprev*kY):0;
      let sd=0;for(let i=0;i<N;i++)sd+=D[i];kM[t]=(money()-F+sd)/nAlive/Pidx;kBail[t]=GDPprev>0?bailY/(GDPprev*kY):0;bailY=0;}
  }
  // bilans de fin d'année : valeur des parts, patrimoine net, monnaie au sens large, où est la monnaie
  function balanceSheets(t){
    const eqv=new Float64Array(N);let unowned=0,firmV=0;funds.stake.fill(0);
    if(firmOn)for(const fm of firms){if(fm.dead)continue;const V=Math.max(0,fm.K+fm.R-fm.debt);firmV+=V;unowned+=V-valueHoldings(fm,V,capped,eqv,funds.stake);}
    {const fv=funds.value(eqv);fs.fundV=fv.total;fs.fundUn=fv.unclaimed;unowned+=fv.unclaimed;}
    fs.unowned=unowned;fs.firmV=firmV;uT[t]=unowned/Pidx;Pnet=Pidx;
    wearY=0;
    let s=0;for(let i=0;i<N;i++){net[i]=W[i]+D[i]+eqSave[i]-L[i]+eqv[i]+Bh[i]+hU[i]*ph-Mg[i];s+=net[i];}tot[t]=s/Pidx;gi[t]=gini(nAlive<N?liveOf(net):net);
    {let a=0,d=0,o=0,e=0;for(let i=0;i<N;i++){a+=W[i]+eqSave[i]-L[i];d+=D[i];o+=Bh[i];e+=eqv[i];}bCash[t]=a/nAlive/Pidx;bDep[t]=d/nAlive/Pidx;bBond[t]=o/nAlive/Pidx;bEq[t]=e/nAlive/Pidx;
     let l=0,fd=0;for(let i=0;i<N;i++)l+=L[i];for(const fm of firms)if(!fm.dead)fd+=fm.debt;bSale[t]=(pool+poolNext+feePot+back)/nAlive/Pidx;bBank[t]=(F-d+l+fd+Sc+Bb)/nAlive/Pidx;}
    if(closed&&M0>0){const y=liveOf(net).sort(),c5=y[Math.floor(0.5*y.length)],c9=y[Math.floor(0.9*y.length)];let h0=0,h1=0,h2=0,R=0;
      /* avec le crédit, la monnaie est celle que détient le public (liquidités et dépôts, comme M1-M3) : les réserves de la banque
         n'en font pas partie, et le total grandit avec les prêts */
      for(let i=0;i<N;i++){if(vac[i])continue;const h=W[i]+eqSave[i]+(credit?D[i]:0);if(net[i]>=c9)h2+=h;else if(net[i]>=c5)h1+=h;else h0+=h;}
      for(const fm of firms)if(!fm.dead)R+=fm.R;
      const Mt=credit?h0+h1+h2+R+pool+poolNext+feePot+back+funds.cash()+Sc:M0;
      mPoor[t]=h0/Mt;mMid[t]=h1/Mt;mTop[t]=h2/Mt;mFirm[t]=R/Mt;mSale[t]=(pool+poolNext+feePot+back)/Mt;mOther[t]=((credit?0:F)+funds.cash()+Sc)/Mt;}
  }


  /* ---------- résultats ---------- */
  for(const fm of firms)if(!fm.dead&&fm.f>=0)succ[fm.f]++;
  partic.update(net,T);const part1=partic.stat(net,vac);endDiagnostics(C,dg,part,vac);
  let alive=0,oldAlive=0;for(const fm of firms)if(!fm.dead){alive++;if(fm.old)oldAlive++;}
  let debt=0,indebted=0;for(let i=0;i<N;i++){debt+=L[i];if(L[i]>eps)indebted++;}
  // résultats par ménage : seulement les ménages présents à la fin
  const keep=[];for(let i=0;i<N;i++)if(!vac[i])keep.push(i);const pick=a=>a.constructor.from(keep,i=>a[i]);
  // parcours : 0 aucune idée, 1 idée(s) jamais financée(s), 2 réussites ≥ échecs, 3 plus d'échecs que de réussites
  const grp=new Int8Array(N),owes=new Int8Array(N);
  for(let i=0;i<N;i++){const p=succ[i]+fail[i];grp[i]=ideas[i]===0?0:p===0?1:succ[i]>=fail[i]?2:3;owes[i]=L[i]>eps?1:0;}
  const hasStart=P.ini||(firmOn&&P.exist);
  const netL=pick(net);
  // part de la dette publique détenue par les 10 % les plus dotés
  const bond10=()=>{if(!stateOn||pubDebt<=0)return 0;const y=Float64Array.from(netL).sort();const c9=y[Math.floor(0.9*y.length)];
    let b=0;for(let i=0;i<N;i++)if(net[i]>=c9)b+=Bh[i];return b/pubDebt;};
  /* préfixes des séries : f entreprises et fonds, c circuit, m où est la monnaie, b monnaie au sens large, l travail, h logement,
     k banque et crédit, s État, d démographie, r économie réelle, p prix */
  return {
    // patrimoine et parcours
    tot,gi,uT,...st,lor:lorenz(netL,40),debt,indebted:indebted/nAlive,fund:F,dg,
    net:Float64Array.from(netL,v=>v/Pidx),grp:pick(grp),owes:pick(owes),qi:pick(qi),refI:Int32Array.from(keep,i=>refI[i]),
    lor0:hasStart?lorenz(init0.subarray(0,N0),40):null,gini0:hasStart?gini(init0.subarray(0,N0)):null,
    // entreprises et fonds
    fCreated:fs.created,fAlive:alive,fBiz5:exist.biz5,fBizEx:exist.bizEx,fOld0:exist.exist0,fOldAlive:oldAlive,fDied:fs.died,
    fBankrupt:fs.bankrupt,fBankLoss:fs.bankLoss,fDiv:fs.divPaid,fWear:fs.wear,fInvested:fs.invested,fExtE:fs.extE,fExtB:fs.extB,
    fUnowned:fs.unowned/Pidx,fValue:fs.firmV/Pidx,fFundPaid:fs.fundPaid,fFundV:fs.fundV/Pidx,fFundUn:fs.fundUn/Pidx,
    fPart0:part0.all,fPart1:part1.all,fPart1T:part1.top,
    // circuit
    cCov:cov,cDrift:cc.drift,cWageShort:closed&&wageSum>0?cc.wageShort/wageSum:0,cSaveRate:cc.inc>0?cc.save/cc.inc:0,
    cWageShare:cc.wagePaid+cc.profit>0?cc.wagePaid/(cc.wagePaid+cc.profit):0,
    // taux de marge des entreprises au sens de l'Insee : excédent brut / valeur ajoutée des entreprises (salaires privés, coût du travail
    // compris ; impôts sur la production compris dans la valeur ajoutée), sans les salaires publics
    cMargin:cc.wagePriv+cc.profit+cc.prodTax-cc.sub>0?cc.profit/(cc.wagePriv+cc.profit+cc.prodTax-cc.sub):0,
    // monnaie : où elle est, et au sens large
    mPoor,mMid,mTop,mFirm,mSale,mOther,bCash,bDep,bBond,bEq,bSale,bBank,
    // travail, prix, économie réelle
    lU:lab.out.uT,lLong:lab.out.longT,lHours:lab.out.hoursT,lUnmet:unmet,
    pP,pInfl,pWr,pGap,pInflAvg:Pidx>0?Math.pow(Pidx,1/Math.max(1,T-1))-1:0,
    rCons:consMed,rConsMean:consMean,rNdp:ndp,rUtil:util,rK:kNet,
    // logement, banque et crédit
    hOwn,hMort,hVal,hRent,hAcc,kDef,kEq,kBail,kCred,kCET1,kM,cbRate,
    // État
    sPub,sPO,sDebt:debtR,cKY:kY,sDef:defR,sTau:tau,sTax:sc.tax,sWages:sc.gw,sPurch:sc.gp,sInt:sc.int,sCut:sc.spend>0?sc.cut/sc.spend:0,
    sBond10:bond10(),fEff,
    // démographie
    depR,hhN,dWid,dDeaths:deathsT,dRet:retSh};
}

/* ---------- diagnostics par âge et par revenu (comparés à l'Insee dans l'onglet Hypothèses) ---------- */
function groupMean(N,n,gf,vf){const s=new Float64Array(n),c=new Float64Array(n);for(let i=0;i<N;i++){const g=gf(i);s[g]+=vf(i);c[g]++;}return Array.from(s,(v,g)=>c[g]?v/c[g]:NaN);}
function groupMedian(N,n,gf,vf){const L=Array.from({length:n},()=>[]);for(let i=0;i<N;i++)L[gf(i)].push(vf(i));return L.map(a=>{if(!a.length)return NaN;a.sort((x,y)=>x-y);return a[Math.floor(a.length/2)];});}
function startDiagnostics(C,part){const {N,age0,init0,qi}=C;
  return {wAge:groupMedian(N,6,i=>ageGroup(age0[i]),i=>init0[i]),pA0:groupMean(N,6,i=>ageGroup(age0[i]),i=>part[i]),pQ0:groupMean(N,5,i=>qi[i],i=>part[i]),
    ageMed0:Float64Array.from(age0).sort()[Math.floor(N/2)]};}
function endDiagnostics(C,dg,part,vac){const s=new Float64Array(5),c=new Float64Array(5);for(let i=0;i<C.N;i++){if(vac&&vac[i])continue;s[C.qi[i]]+=part[i];c[C.qi[i]]++;}dg.pQ1=Array.from(s,(v,g)=>c[g]?v/c[g]:NaN);}
