/* =====================================================================
   Résultats : cartes de chiffres et graphiques (W = [libres, interdits], sortie de aggFrom)
   ===================================================================== */
let LAST=null, EPS=1;
{const e=parseFloat(store.get('labo-eps'));if(!isNaN(e))EPS=e;}
const at=(W,f)=>W.map(f);   // une valeur par scénario

function render(Lw,Iw,ms){
  const W=[Lw,Iw];
  renderKpis(W);renderVerdict(W,P.T-1);renderAge(W);
  renderBank(W);renderCircuit(W);renderFirms(W);renderStock(W);renderQuintiles(W);
  LAST={worlds:W,T:P.T};renderEquity();
  renderCharts(W);
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
  setText('totlede',P.firm?'En trait plein : la richesse de toute l\'économie, c\'est-à-dire celle de la population, plus la valeur des entreprises qui n\'appartient à personne. En pointillé : la seule richesse de la population (liquidités, dépôts et parts d\'entreprises, moins les dettes). Moyenne sur les simulations.':'Somme des avoirs nets de toute la population (liquidités, dépôts et parts, moins les dettes), en moyenne sur les simulations.');
  // Gini au fil du temps
  lineChart($('ch_gini'),{...year,W:380,H:260,xs,yMax:Math.max(0.1,Math.ceil(Math.max(...Lw.gi,...Iw.gi)*10)/10),yTicks:4,xTicks:P.T%4===0?4:2,yFmt:f2,series:seriesLI(Lw.gi,Iw.gi)});
  // Lorenz, au départ et à la fin
  const lx=Array.from({length:41},(_,k)=>k*2.5);const lmin=Math.min(0,...Lw.lor,...Iw.lor)*100;
  const lser=seriesLI(Array.from(Lw.lor,v=>v*100),Array.from(Iw.lor,v=>v*100));
  if(Lw.lor0)lser.unshift({ys:Array.from(Lw.lor0,v=>v*100),color:'var(--muted)',dash:true,name:'Départ'});
  lineChart($('ch_lorenz'),{W:380,H:260,xs:lx,xMax:100,yMin:lmin<0?-Math.ceil(-lmin/25)*25:0,yMax:100,yTicks:4,xTicks:4,xLabel:'% de la population',yFmt:v=>Math.round(v)+' %',xFmt:v=>Math.round(v)+' %',tipX:v=>fr(v)+' % les moins riches',diag:true,series:lser});
  setText('lorlede',Lw.lor0?`Part de la richesse nette détenue par les x % les moins riches. En pointillé : le patrimoine de départ, identique dans les deux scénarios (Gini ${f2(Lw.gini0)}) ; à la fin, Gini ${f2(Lw.gi[L])} avec gains libres et ${f2(Iw.gi[L])} avec gains interdits. Sous zéro, ce sont des personnes endettées.`:'Part de la richesse nette détenue par les x % les moins riches, à la fin de la simulation. Sans patrimoine de départ, il n\'y a pas de courbe de départ. Sous zéro, ce sont des personnes endettées.');
}
