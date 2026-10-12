/* =====================================================================
   Synthèse : ce qui change quand on interdit les gains
   Chaque indicateur : libellé, lecture (get), format, sens favorable, clé PER_RUN pour la robustesse.
   ===================================================================== */
function verdictItems(L){
  const V=[
    {l:'Richesse moyenne par personne',get:w=>w.eq.mean,f:f1,dir:'high',k:'mean'},
    {l:'Moyenne des 10 % les plus pauvres',get:w=>w.eq.bottom10,f:f1,dir:'high',k:'bottom10'},
    {l:'Part détenue par le 1 % le plus riche',get:w=>w.eq.top1,f:pct1,dir:'low',k:'top1'},
    {l:'Gini du patrimoine',get:w=>w.gi[L],f:f2,dir:'low',k:'gini'},
    {l:'Entreprises créées',get:w=>w.funded,f:int,dir:'high',k:'funded'},
    {l:'Idées abandonnées faute de financement',get:w=>w.refused,f:int,dir:'low',k:'refused'},
    {l:'Personnes encore endettées',get:w=>w.eq.indebted,f:pct,dir:'low',k:'indebted'}];
  if(P.inc)V.push({l:'Richesse des 20 % les plus aisés rapportée à celle des 20 % les plus modestes',get:w=>w.byq[0].mean>0?w.byq[4].mean/w.byq[0].mean:null,f:v=>v==null?'n.d.':fr(v,{maximumFractionDigits:1})+' fois',dir:'low',k:'qratio'});
  if(P.firm)V.push({l:'Richesse totale de l\'économie (population et entreprises)',get:w=>w.tot[L]+w.uT[L],f:int,dir:'high',k:'totE'},
    {l:'Valeur des entreprises sans propriétaire',get:w=>w.fUnowned,f:int,dir:null,k:'fUnowned'},
    {l:'Entreprises disparues',get:w=>w.fDied,f:int,dir:'low',k:'fDied'});
  if(P.firm&&P.closed)V.push({l:'Consommation du ménage médian, la dernière année',get:w=>w.rCons[L]*UNIT_EUR,f:v=>fr(Math.round(v/100)*100)+' €',dir:'high',k:'cons'},
    {l:'Utilisation des capacités, la dernière année',get:w=>w.rUtil[L],f:pct,dir:null,k:'util'});
  if(P.bank||P.firm)V.push({l:'Intérêts reçus par les déposants',get:w=>w.interest,f:int,dir:null,k:'interest'});
  return V;
}
// les deux scénarios utilisent les mêmes tirages : on compte les simulations où l'écart va dans le même sens que la moyenne
function agreement(W,k,sign){if(!k||!W[0].per||W[0].R<3)return null;const a=W[0].per[k],b=W[1].per[k];let c=0,n=0;
  for(let s=0;s<a.length;s++){if(!isFinite(a[s])||!isFinite(b[s]))continue;n++;if(Math.sign(b[s]-a[s])===sign)c++;}return n?{c,n,f:c/n}:null;}
// description de l'écart, du point de vue des gains interdits
function describeGap(a,b){const fx=v=>fr(v,{maximumFractionDigits:1});
  if(Math.abs(a)<1e-9)return 'nul avec gains libres';
  if(Math.abs(b)<1e-9)return 'nul avec gains interdits';
  if(a*b<0)return (b>0?'positif':'négatif')+' avec gains interdits, '+(a>0?'positif':'négatif')+' avec gains libres';
  const r=b/a;
  if(r>=1.5)return fx(r)+' fois plus élevé avec gains interdits';
  if(r<=1/1.5)return fx(1/r)+' fois plus faible avec gains interdits';
  const v=Math.round((r-1)*100);return (v>0?'+':'−')+Math.abs(v)+' % avec gains interdits';}

function renderVerdict(W,L){
  const act=[];if(P.inc)act.push(P.sprof?'revenus inégaux (les plus aisés épargnent davantage)':'revenus inégaux');if(P.ini)act.push('patrimoine de départ');if(P.vary)act.push('créations inégales');if(P.firm)act.push(P.exist?'entreprises (avec un paysage existant)':'entreprises');
  if(P.bank)act.push('banque');if(P.stock)act.push('bourse');if(!P.bank&&!P.stock)act.push('prêt direct');
  setText('vmodel',`Modèle actuel : ${act.join(', ')}. ${P.N} ménages, ${P.T} ans, moyenne de ${P.runs} simulations.`);
  const items=verdictItems(L).map(o=>{const vl=o.get(W[0]),vi=o.get(W[1]);const ok=vl!=null&&vi!=null&&isFinite(vl)&&isFinite(vi);
    const same=ok&&o.f(vl)===o.f(vi);const d=ok&&!same?Math.abs(vi-vl)/Math.max(Math.abs(vl),Math.abs(vi),1e-9):0;
    return {...o,vl,vi,ok,d,agree:ok?agreement(W,o.k,Math.sign(vi-vl)):null};}).filter(o=>o.ok);
  const big=items.filter(o=>o.d>=0.05).sort((x,y)=>y.d-x.d),small=items.filter(o=>o.d<0.05);
  const pill=o=>{if(!o.dir)return '';const iBetter=o.dir==='high'?o.vi>o.vl:o.vi<o.vl;return `<span class="pill">plus favorable : gains ${iBetter?'interdits':'libres'}</span>`;};
  const robust=a=>a?` · même sens dans ${a.c} simulation${a.c>1?'s':''} sur ${a.n}${a.f<0.8?' <span class="pill frag">fragile</span>':''}`:'';
  let h=big.map(o=>`<li><span class="vl">${o.l}${pill(o)}</span><span class="vv" title="gains libres, puis gains interdits"><i style="background:var(--l)"></i>${o.f(o.vl)}<i style="background:var(--i)"></i>${o.f(o.vi)}</span><span class="vd">${describeGap(o.vl,o.vi)}${robust(o.agree)}</span></li>`).join('');
  if(!big.length)h='<li><span class="vl">Aucun écart notable entre les deux scénarios.</span></li>';
  if(small.length)h+=`<li><span class="vd">Presque identiques (moins de 5 % d'écart) : ${small.map(o=>o.l.charAt(0).toLowerCase()+o.l.slice(1)).join(' ; ')}.</span></li>`;
  setHTML('vlist',h);
}
