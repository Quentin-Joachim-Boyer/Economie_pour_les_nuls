/* =====================================================================
   Résultats : cartes de chiffres et graphiques (W = [libres, interdits], sortie de aggFrom)
   ===================================================================== */
let LAST=null, EPS=1;
{const e=parseFloat(store.get('labo-eps'));if(!isNaN(e))EPS=e;}
const at=(W,f)=>W.map(f);   // une valeur par scénario

function render(Lw,Iw,ms){
  const W=[Lw,Iw];
  renderKpis(W);renderVerdict(W,P.T-1);renderReal(W);renderPrices(W);renderWork(W);renderMoney(W);renderBroad(W);renderAge(W);
  renderBank(W);renderCircuit(W);renderSocial(W);renderState(W);renderCredit(W);renderHousing(W);renderFirms(W);renderStock(W);renderQuintiles(W);
  LAST={worlds:W,T:P.T};renderEquity();
  renderCharts(W);renderScore(W);
  const st=$('status');st.classList.remove('stale');st.textContent=`calculé en ${ms<2000?Math.round(ms)+' ms':fr(ms/1000,{maximumFractionDigits:1})+' s'}${POOL.ok?` sur ${POOL.ws.length} cœurs`:''}`;
  document.querySelector('main').classList.remove('stale');
}

function renderKpis(W){
  setHTML('kpis',
    kpi('Richesse moyenne par personne',at(W,w=>w.eq.mean),f1,'high',range80(W,'mean',f1))+
    kpi('Moyenne des 10 % les plus pauvres',at(W,w=>w.eq.bottom10),f1,'high',range80(W,'bottom10',f1))+
    kpi('Part du 1 % le plus riche',at(W,w=>w.eq.top1),pct1,'low',range80(W,'top1',pct))+
    kpi('Entreprises créées',at(W,w=>w.funded),int,'high',range80(W,'funded',int)));
  setText('kpinote',P.runs>=3?`Moyenne de ${P.runs} simulations. Sous chaque valeur, la fourchette où tombent 80 % des simulations : plus elle est large, plus le hasard pèse sur ce résultat.`:'Avec moins de 3 simulations, la dispersion entre tirages n\'est pas affichée.');
}

function renderBank(W){
  show('bankcard',P.bank);show('sweepcard',P.bank);if(!P.bank)return;
  setHTML('bankrows',
    crow('Prêts accordés','',at(W,w=>w.loans),int)+
    crow('Refus faute de fonds','',at(W,w=>w.refusedFund),int)+
    crow('Refus car déjà endetté','',at(W,w=>w.refusedDebt),int)+
    crow('Intérêts versés aux déposants','Transférés des emprunteurs vers les déposants.',at(W,w=>w.interest),int)+
    crow('Dette restante','',at(W,w=>w.debt),int)+
    crow('Fonds inutilisés en caisse','',at(W,w=>w.fund),int));
}

// économie réelle (économie bouclée) : consommation médiane, production nette, capacités, capital
function renderReal(W){
  const on=!!(P.firm&&P.closed);show('realcard',on);if(!on)return;
  const xs=Array.from({length:P.T},(_,i)=>i+1),year={xMax:P.T,xFmt:v=>Math.round(v),xLabel:'année',tipX:v=>'Année '+v,xTicks:P.T%4===0?4:2};
  const k=a=>Array.from(a,v=>v*UNIT_EUR/1000),kf=v=>fr(Math.round(v))+' k€';
  const mx=(...a)=>niceMax(Math.max(...a.flat()));
  const cL=k(W[0].rCons),cI=k(W[1].rCons),mL=k(W[0].rConsMean),mI=k(W[1].rConsMean);
  lineChart($('ch_cons'),{...year,W:380,H:260,xs,yMax:mx(cL,cI,mL,mI),yTicks:4,yFmt:kf,
    series:[{ys:mI,color:'var(--i)',dash:true,name:'Interdits, moy.'},{ys:mL,color:'var(--l)',dash:true,name:'Libres, moy.'},{ys:cI,color:'var(--i)',name:'Interdits'},{ys:cL,color:'var(--l)',name:'Libres'}]});
  const nL=k(W[0].rNdp),nI=k(W[1].rNdp);
  lineChart($('ch_ndp'),{...year,W:380,H:260,xs,yMax:mx(nL,nI),yTicks:4,yFmt:kf,series:seriesLI(nL,nI)});
  const uL=Array.from(W[0].rUtil,v=>v*100),uI=Array.from(W[1].rUtil,v=>v*100);
  lineChart($('ch_util'),{...year,W:380,H:260,xs,yMax:mx(uL,uI,[100]),yTicks:4,yFmt:v=>Math.round(v)+' %',series:[{ys:xs.map(()=>100),color:'var(--muted)',dash:true,name:'Départ'},...seriesLI(uL,uI)]});
  setText('utilnote','Ventes rapportées à ce que le capital permet de produire, au rythme du départ (100 %). Au-dessus de 100 %, les entreprises vendent plus qu\'elles ne pourraient produire : le modèle n\'a encore ni limite de production ni prix qui monteraient, et ce signal montre où cela commence à compter.');
  const kL=k(W[0].rK),kI=k(W[1].rK);
  lineChart($('ch_k'),{...year,W:380,H:260,xs,yMax:mx(kL,kI),yTicks:4,yFmt:kf,series:seriesLI(kL,kI)});
}

// bornes « rondes » d'un axe à 4 graduations qui contient [lo, hi]
function niceRange(lo,hi,n=4){lo=Math.min(lo,0);const raw=(hi-lo)/n||1;const p=Math.pow(10,Math.floor(Math.log10(raw)));const m=raw/p;
  let step=(m<=1?1:m<=2?2:m<=2.5?2.5:m<=5?5:10)*p;let a=Math.floor(lo/step)*step;
  while(a+n*step<hi-1e-9){const k=[1,2,2.5,5,10];const i=k.findIndex(x=>x*p>step);step=i>=0?k[i]*p:step*2;a=Math.floor(lo/step)*step;}
  return [a,a+n*step];}
// les prix : inflation, niveau des prix, salaire réel, tension
function renderPrices(W){
  const on=!!(P.firm&&P.closed&&P.prices);show('pricecard',on);if(!on)return;
  const xs=Array.from({length:P.T},(_,i)=>i+1),year={xMax:P.T,xFmt:v=>Math.round(v),xLabel:'année',tipX:v=>'Année '+v,xTicks:P.T%4===0?4:2};
  const p100=a=>Array.from(a,v=>v*100),pf=v=>fr(Math.round(v*10)/10)+' %',ix=v=>fr(Math.round(v));
  const ref=(v,name)=>({ys:xs.map(()=>v),color:'var(--muted)',dash:true,name});
  const range=(...a)=>{const f=a.flat();return [Math.min(0,...f),Math.max(...f)];};
  const iL=p100(W[0].pInfl),iI=p100(W[1].pInfl);let [lo,hi]=range(iL,iI,[2]);const [a0,a1]=niceRange(lo,hi);
  lineChart($('ch_infl'),{...year,W:380,H:260,xs,yMin:a0,yMax:a1,yTicks:4,yFmt:pf,series:[ref(2,'Cible BCE'),...seriesLI(iL,iI)]});
  const pL=p100(W[0].pP),pI=p100(W[1].pP);
  lineChart($('ch_price'),{...year,W:380,H:260,xs,yMax:niceMax(Math.max(...pL,...pI,100)),yTicks:4,yFmt:ix,series:[ref(100,'Départ'),...seriesLI(pL,pI)]});
  const wL=p100(W[0].pWr),wI=p100(W[1].pWr);
  lineChart($('ch_wreal'),{...year,W:380,H:260,xs,yMin:50,yMax:Math.max(...wL,...wI)>150?250:150,yTicks:4,yFmt:ix,series:[ref(100,'Départ'),...seriesLI(wL,wI)]});
  const gL=p100(W[0].pGap),gI=p100(W[1].pGap);[lo,hi]=range(gL,gI);const m=niceMax(Math.max(Math.abs(lo),Math.abs(hi),5));
  lineChart($('ch_gap'),{...year,W:380,H:260,xs,yMin:-m,yMax:m,yTicks:4,yFmt:v=>(v>0?'+':'')+fr(Math.round(v))+' %',series:seriesLI(gL,gI)});
}

// le travail : chômage, heures travaillées, demande que la population active ne peut pas servir
function renderWork(W){
  const on=!!(P.firm&&P.closed&&P.unemp);show('workcard',on);if(!on)return;
  const xs=Array.from({length:P.T},(_,i)=>i+1),year={xMax:P.T,xFmt:v=>Math.round(v),xLabel:'année',tipX:v=>'Année '+v,xTicks:P.T%4===0?4:2};
  const p100=a=>Array.from(a,v=>v*100),pf=v=>fr(Math.round(v))+' %';
  const ref=(v)=>({ys:xs.map(()=>v),color:'var(--muted)',dash:true,name:'France'});
  const uL=p100(W[0].lU),uI=p100(W[1].lU);
  lineChart($('ch_unemp'),{...year,W:380,H:260,xs,yMax:niceMax(Math.max(10,...uL,...uI)),yTicks:4,yFmt:pf,series:[ref(7.4),...seriesLI(uL,uI)]});
  const hL=Array.from(W[0].lHours),hI=Array.from(W[1].lHours);
  lineChart($('ch_hours'),{...year,W:380,H:260,xs,yMax:2000,yTicks:4,yFmt:v=>fr(Math.round(v))+' h',series:[{ys:xs.map(()=>HOURS_PER_JOB),color:'var(--muted)',dash:true,name:'Plein emploi'},...seriesLI(hL,hI)]});
  setText('unmetnote','Part des achats que la population active ne peut pas produire dans l\'année : ils attendent l\'année suivante.'+(P.prices?' Avec les prix, la tension se reporte surtout sur les prix (carte « Les prix »).':' Dans la réalité, les prix monteraient : activer « Prix et salaires ».'));
  const mL=p100(W[0].lUnmet),mI=p100(W[1].lUnmet);
  lineChart($('ch_unmet'),{...year,W:380,H:260,xs,yMax:100,yTicks:4,yFmt:pf,series:seriesLI(mL,mI)});
  const lL=p100(W[0].lLong),lI=p100(W[1].lLong);
  lineChart($('ch_long'),{...year,W:380,H:260,xs,yMax:100,yTicks:4,yFmt:pf,series:[ref(23),...seriesLI(lL,lI)]});
}

// où est la monnaie ? sa quantité est fixe : on suit qui la détient, année par année
function renderMoney(W){
  const on=!!(P.firm&&P.closed);show('moneycard',on);if(!on)return;
  const xs=Array.from({length:P.T},(_,i)=>i+1);
  const lay=w=>[
    {ys:w.mPoor,color:'#9fc3e6',name:'50 % les moins dotés'},
    {ys:w.mMid,color:'#4f8fcc',name:'40 % suivants'},
    {ys:w.mTop,color:'#1f4f86',name:'10 % les plus dotés'},
    {ys:w.mSale,color:'#e9b77a',name:'Ventes à encaisser'},
    {ys:w.mFirm,color:'#c0762a',name:'Entreprises'},
    {ys:w.mOther,color:'#a3a3a3',name:'Banque, fonds, État'}];
  for(const [id,w] of [['ch_monL',W[0]],['ch_monI',W[1]]])stackChart($(id),{W:380,H:260,xs,layers:lay(w),xMax:P.T,xTicks:P.T%4===0?4:2,xLabel:'année',xFmt:v=>Math.round(v),tipX:v=>'Année '+v});
}

// monnaie au sens large : tout ce que détiennent les acteurs, consolidé (rien compté deux fois) ; total = monnaie + obligations + capital
function renderBroad(W){
  W=W||(LAST&&LAST.worlds);if(!W)return;
  const on=!!(P.firm&&P.closed);show('broadcard',on);if(!on)return;
  const xs=Array.from({length:P.T},(_,i)=>i+1),share=$('broadmode').value==='share';
  const k=a=>Array.from(a,v=>v*UNIT_EUR/1000);
  const lay=w=>{const L=[
    {ys:k(w.bCash),color:'#1d5c4f',name:'Liquidités'},
    {ys:k(w.bDep),color:'#2f8a74',name:'Dépôts'},
    {ys:k(w.bBond),color:'#6fb7a0',name:'Obligations d\'État'},
    {ys:k(w.bEq),color:'#b5dccd',name:'Parts'},
    {ys:k(Array.from(w.uT,v=>v/P.N)),color:'#c4c4c4',name:'Sans propriétaire'},
    {ys:k(w.bSale),color:'#e9b77a',name:'Ventes à encaisser'},
    {ys:k(w.bBank),color:'#8c8c8c',name:'Banque et État'}];
    if(share)for(let i=0;i<xs.length;i++){const t=L.reduce((a,l)=>a+Math.max(0,l.ys[i]),0);if(t>0)for(const l of L)l.ys[i]=Math.max(0,l.ys[i])/t;}
    return L;};
  const Ls=W.map(lay);
  const top=Math.max(...Ls.flatMap(L=>xs.map((_,i)=>L.reduce((a,l)=>a+Math.max(0,l.ys[i]),0))));
  const opt=share?{}:{yMax:Math.ceil(top/100)*100||1,yFmt:v=>fr(Math.round(v))+' k€',tipTotal:true};
  [['ch_brL',Ls[0]],['ch_brI',Ls[1]]].forEach(([id,L])=>stackChart($(id),{W:380,H:260,xs,layers:L,xMax:P.T,xTicks:P.T%4===0?4:2,xLabel:'année',xFmt:v=>Math.round(v),tipX:v=>'Année '+v,...opt}));
}

// économie bouclée : la demande suffit-elle à faire les profits ? où s'arrête la monnaie ?
function renderCircuit(W){
  const on=!!(P.firm&&P.closed);show('circuitcard',on);if(!on)return;
  const xs=Array.from({length:P.T},(_,i)=>i+1);const ys=W.map(w=>Array.from(w.cov,v=>v*100));
  lineChart($('ch_cov'),{W:760,H:260,xs,xMax:P.T,xFmt:v=>Math.round(v),xLabel:'année',tipX:v=>'Année '+v,yMax:niceMax(Math.max(100,...ys[0],...ys[1])),yTicks:4,xTicks:P.T%5===0?5:2,
    yFmt:v=>Math.round(v)+' %',marks:[],series:[{ys:xs.map(()=>100),color:'var(--muted)',dash:true,name:'Notionnel'},...seriesLI(ys[0],ys[1])]});
  setHTML('circrows',
    crow('Part des salaires dans la valeur ajoutée','Salaires / (salaires + profits bruts), sur toute la vie. Sociétés non financières en 2023 : 65 % (Insee, tableau 7.101).',at(W,w=>w.cWageShare),pct)+
    crow('Taux d\'épargne observé des ménages','Revenus non dépensés / revenus (salaires et revenus du capital). Il tient compte de la consommation tirée du patrimoine. Insee : 18 % du revenu disponible, dont environ la moitié placée en logement.',at(W,w=>w.cSaveRate),pct1)+
    crow('Salaires non versés','Part de la masse salariale que les entreprises n\'ont pas pu payer, faute de ventes et de trésorerie.',at(W,w=>w.cWageShort),pct1,{domain:[0,1]})+
    crow('Contrôle de la monnaie','Écart maximal entre la monnaie totale et celle du départ. Proche de zéro : rien ne fuit, rien n\'apparaît.',at(W,w=>w.cDrift),v=>v==null?'n.d.':v<1e-9?'< 0,000 000 1 %':pct1(v),{domain:[0,1]}));
}

// État minimal : dette, impôt, déficit
function renderSocial(W){
  const on=!!(P.firm&&P.closed&&P.state&&P.social);show('socialcard',on);if(!on)return;
  const xs=Array.from({length:P.T},(_,i)=>i+1),year={xMax:P.T,xFmt:v=>Math.round(v),xLabel:'année',tipX:v=>'Année '+v,xTicks:P.T%4===0?4:2};
  const p=a=>Array.from(a,v=>v*100),pf=v=>fr(Math.round(v))+' %';
  const dL=p(W[0].sPub),dI=p(W[1].sPub),oL=p(W[0].sPO),oI=p(W[1].sPO);
  lineChart($('ch_pub'),{...year,W:380,H:260,xs,yMax:niceMax(Math.max(60,...dL,...dI,...oL,...oI)),yTicks:4,yFmt:pf,
    series:[{ys:oI,color:'var(--i)',dash:true,name:'Prélèv. I'},{ys:oL,color:'var(--l)',dash:true,name:'Prélèv. L'},{ys:dI,color:'var(--i)',name:'Dépenses I'},{ys:dL,color:'var(--l)',name:'Dépenses L'}]});
  const rL=p(W[0].dRet),rI=p(W[1].dRet);
  lineChart($('ch_ret'),{...year,W:380,H:260,xs,yMax:100,yTicks:4,yFmt:pf,series:seriesLI(rL,rI)});
  show('ch_dep',!!P.demo);if(P.demo){const y0=P.y0||START_YEAR,dm=p(W[0].depR),pr=xs.map(x=>DEP_PROJ(y0+x-1)*100);
    lineChart($('ch_dep'),{W:760,H:260,xs,xMin:1,xMax:P.T,xFmt:v=>Math.round(y0+v-1),xLabel:'année',tipX:v=>'Année '+Math.round(y0+v-1),xTicks:P.T%5===0?5:2,yMax:niceMax(Math.max(70,...dm)),yTicks:4,yFmt:v=>fr(Math.round(v)),
      series:[{ys:pr,color:'var(--muted)',dash:true,name:'Insee'},{ys:dm,color:'var(--l)',name:'Modèle'}]});}
}
function renderState(W){
  const on=!!(P.firm&&P.closed&&P.state);show('statecard',on);if(!on)return;
  const xs=Array.from({length:P.T},(_,i)=>i+1);const ys=W.map(w=>Array.from(w.sDebt,v=>v*100));
  lineChart($('ch_debt'),{W:760,H:260,xs,xMax:P.T,xFmt:v=>Math.round(v),xLabel:'année',tipX:v=>'Année '+v,yMax:niceMax(Math.max(...ys[0],...ys[1],P.debt0*100)),yTicks:4,xTicks:P.T%5===0?5:2,
    yFmt:v=>Math.round(v)+' %',series:[{ys:xs.map(()=>P.debt0*100),color:'var(--muted)',dash:true,name:'Départ'},...seriesLI(ys[0],ys[1])]});
  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
  setHTML('staterows',
    crow('Taux de l\'impôt sur les ventes','Calé au départ pour retrouver le déficit de 2025 ; le même dans les deux scénarios.',at(W,w=>w.sTau),pct1)+
    crow('Déficit public moyen','En part du PIB, moyenne sur les années. France 2025 : 5,1 %.',at(W,w=>mean(Array.from(w.sDef))),pct1)+
    crow('Intérêts versés aux porteurs d\'obligations','Total sur la vie. Avec gains interdits, les obligations ne rapportent rien.',at(W,w=>w.sInt),int)+
    crow('Dette détenue par les 10 % les plus riches','À la fin. Le déficit est emprunté à ceux qui ont des liquidités.',at(W,w=>w.sBond10),pct)+
    crow('Dépenses publiques non financées','Part des dépenses que l\'État n\'a pas pu payer, faute d\'impôt et de prêteurs.',at(W,w=>w.sCut),pct1,{domain:[0,1]}));
}
function renderCredit(W){
  const on=!!(P.firm&&P.closed&&P.bank&&P.credit);show('creditcard',on);if(!on)return;
  const xs=Array.from({length:P.T},(_,i)=>i+1),year={xMax:P.T,xFmt:v=>Math.round(v),xLabel:'année',tipX:v=>'Année '+v,xTicks:P.T%4===0?4:2};
  const p=a=>Array.from(a,v=>v*100),pf=v=>fr(Math.round(v))+' %';
  const cL=p(W[0].kCred),cI=p(W[1].kCred);
  lineChart($('ch_cred'),{...year,W:380,H:260,xs,yMax:niceMax(Math.max(60,...cL,...cI)),yTicks:4,yFmt:pf,
    series:[{ys:xs.map(()=>48),color:'var(--muted)',dash:true,name:'France'},...seriesLI(cL,cI)]});
  // ratio des moyennes (fonds propres / PIB) / (crédits / PIB) ; 0 quand la banque ne prête presque plus
  const k=w=>Array.from(w.kEq,(e,t)=>w.kCred[t]>0.01?Math.max(0,Math.min(40,100*e/w.kCred[t])):0);const eL=k(W[0]),eI=k(W[1]);
  lineChart($('ch_cet1'),{...year,W:380,H:260,xs,yMax:40,yTicks:4,yFmt:pf,
    series:[{ys:xs.map(()=>11.2),color:'var(--muted)',dash:true,name:'Exigence'},{ys:xs.map(()=>16.1),color:'var(--muted)',dash:true,name:'Effectif'},...seriesLI(eL,eI)]});
  const m=a=>Array.from(a,v=>v*UNIT_EUR/1000),mL=m(W[0].kM),mI=m(W[1].kM);
  lineChart($('ch_mpub'),{...year,W:760,H:260,xs,xTicks:P.T%5===0?5:2,yMax:niceMax(Math.max(...mL,...mI)),yTicks:4,yFmt:v=>fr(Math.round(v))+' k€',series:seriesLI(mL,mI)});
}

function renderHousing(W){
  const on=!!(P.firm&&P.closed&&P.housing);show('housecard',on);if(!on)return;
  const xs=Array.from({length:P.T},(_,i)=>i+1),year={xMax:P.T,xFmt:v=>Math.round(v),xLabel:'année',tipX:v=>'Année '+v,xTicks:P.T%4===0?4:2};
  const p=a=>Array.from(a,v=>v*100),pf=v=>fr(Math.round(v))+' %';
  lineChart($('ch_own'),{...year,W:380,H:260,xs,yMax:100,yTicks:4,yFmt:pf,series:[{ys:xs.map(()=>61.2),color:'var(--muted)',dash:true,name:'France'},...seriesLI(p(W[0].hOwn),p(W[1].hOwn))]});
  const mL=p(W[0].hMort),mI=p(W[1].hMort);
  lineChart($('ch_mort'),{...year,W:380,H:260,xs,yMax:niceMax(Math.max(60,...mL,...mI)),yTicks:4,yFmt:pf,series:[{ys:xs.map(()=>43.1),color:'var(--muted)',dash:true,name:'France'},...seriesLI(mL,mI)]});
}

function renderFirms(W){
  show('firmcard',P.firm);if(!P.firm)return;
  let h=crow('Entreprises créées · encore en vie','',at(W,w=>w.fAlive),int,{subs:at(W,w=>int(w.fCreated)+' créées')})+
    crow('Disparitions','Plus une entreprise a une marge faible, plus elle risque de disparaître. Sous la valeur : celles qui ne couvraient même plus l\'échéance de leur dette.',at(W,w=>w.fDied),int,{subs:at(W,w=>int(w.fBankrupt)+' sans marge')});
  if(P.exist){h+=crow('Entreprises existantes au départ · encore en vie','',at(W,w=>w.fOldAlive),int,{subs:at(W,w=>int(w.fOld0)+' au départ')})+
      crow('Parts d\'entreprises détenues par les 5 % qui en ont le plus, au départ','Insee : 5 % des ménages détiennent 95 % du patrimoine professionnel.',at(W,w=>w.fBiz5),pct);
    if(P.ini)h+=crow('Parts d\'entreprises dépassant le patrimoine de leur détenteur','Ces parts sont prises dans le patrimoine Insee de leur détenteur. Ce qui dépasse s\'y ajoute et gonfle les grands patrimoines.',at(W,w=>w.fBizEx),pct);}
  h+=crow('Valeur des entreprises en vie','Capital + réserves − dettes.',at(W,w=>w.fValue),int)+
    crow('Dont sans propriétaire','Ce qui n\'appartient à personne : profits gardés par l\'entreprise au-delà des mises.',at(W,w=>w.fUnowned),int,{subs:at(W,w=>w.fValue>0?pct(w.fUnowned/w.fValue)+' de la valeur':'')})+
    crow('Versé aux ménages propriétaires','Dividendes et remboursements de mises, sur toute la vie.',at(W,w=>w.fDiv),int)+
    crow('Usure du capital','Total sur la vie : valeur perdue par les équipements qui s\'usent, prise sur le profit avant tout versement.',at(W,w=>w.fWear),int)+
    crow('Investissement des entreprises','Total sur la vie, dont part financée par l\'épargne des ménages.',at(W,w=>w.fInvested),int,{subs:at(W,w=>w.fInvested>0?pct((w.fExtE+w.fExtB)/w.fInvested)+' de l\'extérieur':'')})+
    crow('Pertes de la banque sur faillites','Supportées par les déposants.',at(W,w=>w.fBankLoss),int);
  setHTML('firmrows',h);
}

function renderStock(W){
  show('stockcard',P.stock);if(!P.stock)return;
  let h=crow('Créations financées en partie par actions','',at(W,w=>w.issues),int)+
    crow('Montant levé','Y compris le coût d\'introduction.',at(W,w=>w.eqRaised),int);
  // sans entreprises, les créations réussissent ou échouent tout de suite : on peut mesurer le rendement des actionnaires
  if(!P.firm)h+=crow('Versé aux actionnaires','Ce qu\'ils ont récupéré sur les créations qui ont réussi.',at(W,w=>w.eqPaid),int)+
    crow('Rendement moyen des actionnaires','Versé / levé − 1. Négatif : ils ont perdu en moyenne.',at(W,w=>w.eqReturn),v=>v==null?'n.d.':(v>=0?'+':'')+Math.round(v*100)+' %',{better:'high'});
  h+=crow('Ménages qui épargnent en actions, à la fin','Au départ, la même part dans les deux scénarios ; elle évolue avec les patrimoines. Elle dépend du niveau de patrimoine, avec des seuils fixes en euros. Sous la valeur : la part au départ, et chez les 10 % les plus riches à la fin.',at(W,w=>w.fPart1),pct,{subs:at(W,w=>`départ ${pct(w.fPart0)}<br>10 % plus riches ${pct(w.fPart1T)}`)})+
    crow('Fonds participant à chaque levée','En moyenne.',at(W,w=>w.holdersPer),f1)+
    crow('Versé par les fonds à leurs porteurs','Ce que les fonds ont reçu des entreprises et reversé aux ménages, sur toute la vie. Avec gains interdits, chacun au plus sa mise restante.',at(W,w=>w.fFundPaid),int)+
    crow('Valeur des fonds à la fin','Trésorerie non placée + participations.',at(W,w=>w.fFundV),int,{subs:at(W,w=>w.fFundUn>0.5?int(w.fFundUn)+' sans porteur':'')});
  setHTML('stockrows',h);
}

const QUINT_NAMES=['20 % les plus modestes','Deuxième cinquième','Cinquième du milieu','Quatrième cinquième','20 % les plus aisés'];
function renderQuintiles(W){
  show('qcard',P.inc);if(!P.inc)return;
  const all=[];W.forEach(w=>w.byq.forEach(q=>all.push(q.mean)));const domain=[Math.min(0,...all),Math.max(0,...all)];
  setHTML('qrows',QUINT_NAMES.map((nm,q)=>crow(nm,'',at(W,w=>w.byq[q].mean),f1,{domain,subs:at(W,w=>`création ${pct(w.byq[q].launch)}<br>refus ${pct(w.byq[q].refused)}`)})).join(''));
}

// onglet Inégalités : mesures de justice (l'aversion d'Atkinson se règle sans relancer le calcul)
function renderEquity(){
  if(!LAST)return;const W=LAST.worlds;const E=W.map(w=>w.eq);const L=LAST.T-1;
  const ak=E.map(e=>atkinson(e.net,EPS));
  setHTML('eqrows',
    crow('Richesse moyenne','Utilitarisme : seule la moyenne compte.',E.map(e=>e.mean),f1,{better:'high',subs:range80(W,'mean',f1)})+
    crow('Moyenne des 10 % les plus pauvres','Rawls : le sort des plus mal lotis.',E.map(e=>e.bottom10),f1,{better:'high',subs:range80(W,'bottom10',f1)})+
    crow(`Atkinson, aversion ${f2(EPS)}`,'Part de la richesse qu\'on sacrifierait pour une égalité parfaite. Plus bas, c\'est plus égal.',ak.map(a=>a.idx),f2,{better:'low',subs:ak.map(a=>'≈ '+f1(a.ede)+' chacun')})+
    crow('Gini','Écart global, surtout sensible au milieu. Plus bas, c\'est plus égal.',W.map(w=>w.gi[L]),f2,{better:'low',subs:range80(W,'gini',f2)})+
    crow('Part détenue par le 1 % le plus riche','Concentration au sommet. Plus bas, c\'est plus égal.',E.map(e=>e.top1),pct,{better:'low',subs:range80(W,'top1',pct)})+
    crow('Ratio de Palma','10 % les plus riches / 40 % les plus pauvres. Plus bas, c\'est plus égal.',E.map(e=>e.palma),f2,{better:'low'})+
    crow('Personnes encore endettées','Égalité relationnelle : dépendance envers un créancier.',E.map(e=>e.indebted),pct,{better:'low'}));
  const names=['N\'a jamais eu d\'idée','Idée(s), jamais financée(s)','Créations : réussites ≥ échecs','Créations : plus d\'échecs que de réussites'];
  const kinds=['Chance subie','Chance subie','Résultat du pari','Résultat du pari'];
  setHTML('dwrows',names.map((nm,g)=>crow(nm,kinds[g],E.map(e=>e.groups[g].mean),v=>v==null?'personne':f1(v),{subs:E.map(e=>pct(e.groups[g].share)+' des gens')})).join('')+
    crow('Part des écarts expliquée par le parcours','Le reste vient des différences à l\'intérieur des groupes (nombre de créations, montants).',E.map(e=>e.between),pct,{}));
}

function renderCharts([Lw,Iw]){
  const L=P.T-1,xs=Array.from({length:P.T},(_,i)=>i+1);const year={xMax:P.T,xFmt:v=>Math.round(v),xLabel:'année',tipX:v=>'Année '+v};
  // richesse au fil du temps : avec entreprises, celle de l'économie entière (y compris la valeur sans propriétaire)
  const total=w=>Array.from(w.tot,(v,t)=>v+w.uT[t]);
  const series=P.firm?[{ys:total(Iw),color:'var(--i)',soft:'var(--i-soft)',name:'Interdits, total'},{ys:total(Lw),color:'var(--l)',soft:'var(--l-soft)',name:'Libres, total'},
      {ys:Array.from(Iw.tot),color:'var(--i)',dash:true,name:'Interdits, ménages'},{ys:Array.from(Lw.tot),color:'var(--l)',dash:true,name:'Libres, ménages'}]
    :seriesLI(Lw.tot,Iw.tot,true);
  lineChart($('ch_total'),{...year,W:760,H:280,xs,yMax:niceMax(Math.max(...series.map(s=>Math.max(...s.ys)))),yTicks:4,xTicks:P.T%5===0?5:2,yFmt:fmtN,tipY:int,area:false,series});
  setText('totlede',P.firm?'En trait plein : la richesse de toute l\'économie, c\'est-à-dire celle de la population, plus la valeur des entreprises qui n\'appartient à personne. En pointillé : la seule richesse de la population (liquidités, dépôts et parts d\'entreprises, moins les dettes). Moyenne sur les simulations'+(P.closed&&P.prices?', en euros du départ (corrigés de l\'inflation).':'.'):'Somme des avoirs nets de toute la population (liquidités, dépôts et parts, moins les dettes), en moyenne sur les simulations.');
  // Gini au fil du temps
  lineChart($('ch_gini'),{...year,W:380,H:260,xs,yMax:Math.max(0.1,Math.ceil(Math.max(...Lw.gi,...Iw.gi)*10)/10),yTicks:4,xTicks:P.T%4===0?4:2,yFmt:f2,series:seriesLI(Lw.gi,Iw.gi)});
  // Lorenz, au départ et à la fin
  const lx=Array.from({length:41},(_,k)=>k*2.5);const lmin=Math.min(0,...Lw.lor,...Iw.lor)*100;
  const lser=seriesLI(Array.from(Lw.lor,v=>v*100),Array.from(Iw.lor,v=>v*100));
  if(Lw.lor0)lser.unshift({ys:Array.from(Lw.lor0,v=>v*100),color:'var(--muted)',dash:true,name:'Départ'});
  lineChart($('ch_lorenz'),{W:380,H:260,xs:lx,xMax:100,yMin:lmin<0?-Math.ceil(-lmin/25)*25:0,yMax:100,yTicks:4,xTicks:4,xLabel:'% de la population',yFmt:v=>Math.round(v)+' %',xFmt:v=>Math.round(v)+' %',tipX:v=>fr(v)+' % les moins riches',diag:true,series:lser});
  setText('lorlede',Lw.lor0?`Part de la richesse nette détenue par les x % les moins riches. En pointillé : le patrimoine de départ, identique dans les deux scénarios (Gini ${f2(Lw.gini0)}) ; à la fin, Gini ${f2(Lw.gi[L])} avec gains libres et ${f2(Iw.gi[L])} avec gains interdits. Sous zéro, ce sont des personnes endettées.`:'Part de la richesse nette détenue par les x % les moins riches, à la fin de la simulation. Sans patrimoine de départ, il n\'y a pas de courbe de départ. Sous zéro, ce sont des personnes endettées.');
}

// tableau de bord de représentativité (gains libres comparé à la France)
function renderScore(W){
  const S=scoreCard(W[0],P);
  const fv=(r,v)=>v==null||!isFinite(v)?'—':r.u==='eur'?fr(Math.round(v/100)*100)+' €':r.u==='h'?fr(Math.round(v))+' h':r.u==='idx'?fr(v,{minimumFractionDigits:2,maximumFractionDigits:2}):pct1(v);
  const row=r=>{const vals=[r.v,r.vEnd,r.start,r.end].filter(v=>v!=null&&isFinite(v));
    const lo0=r.rel?r.v*(1-r.tol):r.v-r.tol,hi0=r.rel?r.v*(1+r.tol):r.v+r.tol;
    let lo=Math.min(0,...vals,lo0),hi=Math.max(...vals,hi0)*1.08;if(hi<=lo)hi=lo+1;
    const x=v=>((v-lo)/(hi-lo)*100).toFixed(2)+'%';
    const dot=(v,cls)=>v==null||!isFinite(v)?'':`<span class="dot ${cls}" style="left:${x(v)}" title="${cls==='start'?'départ':'fin'} : ${fv(r,v)}"></span>`;
    return `<div class="srow${r.set?' set':''}"><div class="slabel">${r.l}<small>France ${r.y} : <a href="${r.url}" target="_blank" rel="noopener">${r.src}</a></small></div>
      <div class="strack" role="img" aria-label="${r.l} : France ${fv(r,r.v)}, modèle au départ ${fv(r,r.start)}, à la fin ${fv(r,r.end)}"><span class="axis"></span><span class="band" style="left:${x(lo0)};width:calc(${x(hi0)} - ${x(lo0)})"></span><span class="ref" style="left:${x(r.v)}"></span>${dot(r.start,'start')}${dot(r.end,'end'+(r.okEnd?' ok':''))}</div>
      <div class="sval">France <b>${fv(r,r.v)}</b><br>départ ${fv(r,r.start)}<br>fin <b>${fv(r,r.end)}</b>${r.vEnd!==r.v?`<br>projection ${fv(r,r.vEnd)}`:''}</div></div>`;};
  const meas=S.filter(r=>!r.set),done=meas.filter(r=>r.okEnd!=null),ok=done.filter(r=>r.okEnd).length;
  setText('scoresum',done.length?`${ok} indicateur${ok>1?'s':''} sur ${done.length} dans l'écart acceptable à la fin de la simulation.`:'Activer l\'économie bouclée pour comparer le modèle à la France.');
  setHTML('scorerows',meas.map(row).join(''));setHTML('scoreset',S.filter(r=>r.set).map(row).join(''));
}

// test de validation 2010 → 2024 (lancé à la demande)
async function runBacktest(){const btn=$('btbtn');btn.disabled=true;btn.textContent='Calcul…';
  try{const Q={...P,...BACKTEST.P};const [Lw]=await simulate(Q,(d,n)=>{btn.textContent=`Calcul… ${d} / ${n}`;});renderBacktest(backtestCard(Lw,Q));}
  catch(e){setText('btsum','Erreur de calcul : '+e);}
  finally{btn.disabled=false;btn.textContent='Lancer le test';}}
function renderBacktest(S){
  const fv=(r,v)=>v==null||!isFinite(v)?'—':r.u==='pct'?pct1(v):fr(v,{minimumFractionDigits:2,maximumFractionDigits:2});
  const row=r=>{const vals=[r.a,r.b,r.m].filter(v=>v!=null&&isFinite(v));let lo=Math.min(0,...vals),hi=Math.max(...vals)*1.1;if(hi<=lo)hi=lo+1;
    const x=v=>((v-lo)/(hi-lo)*100).toFixed(2)+'%';
    return `<div class="srow"><div class="slabel">${r.l}<small><a href="${r.url}" target="_blank" rel="noopener">${r.src}</a></small></div>
      <div class="strack" role="img" aria-label="${r.l} : France ${BACKTEST.from} ${fv(r,r.a)}, ${BACKTEST.to} ${fv(r,r.b)}, modèle ${fv(r,r.m)}"><span class="axis"></span><span class="ref" style="left:${x(r.b)}"></span><span class="dot start" style="left:${x(r.a)}"></span>${r.m!=null&&isFinite(r.m)?`<span class="dot end${r.close?' ok':''}" style="left:${x(r.m)}"></span>`:''}</div>
      <div class="sval">${BACKTEST.from} ${fv(r,r.a)}<br>${BACKTEST.to} <b>${fv(r,r.b)}</b><br>modèle <b>${fv(r,r.m)}</b></div></div>`;};
  const d=S.filter(r=>r.dirOK).length,c=S.filter(r=>r.close).length;
  setText('btsum',`Évolution dans le bon sens : ${d} indicateurs sur ${S.length} ; proches de la valeur ${BACKTEST.to} : ${c} sur ${S.length}.`);
  setHTML('btrows',S.map(row).join(''));
}
