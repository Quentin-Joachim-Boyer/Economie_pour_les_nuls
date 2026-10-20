/* =====================================================================
   Inventaire des paramètres (engine/40-inventory.js) : barres de synthèse et liste complète.
   Ne dépend d'aucune simulation : affiché au démarrage.
   ===================================================================== */
const esc=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
// une barre empilée : titre, total, segments [{n, cls, l}]
function invBar(title,segs){const tot=segs.reduce((a,s)=>a+s.n,0);
  return `<div class="ibar"><div class="ih"><b>${title}</b><span>${tot}</span></div>
    <div class="seg" role="img" aria-label="${esc(title)} : ${segs.map(s=>s.n+' '+s.l).join(', ')}">${segs.filter(s=>s.n>0).map(s=>`<span class="${s.cls}" style="flex:${s.n}" title="${esc(s.l)} : ${s.n}"></span>`).join('')}</div>
    <div class="ik">${segs.map(s=>`<span><i class="${s.cls}"></i>${s.l} <b>${s.n}</b></span>`).join('')}</div></div>`;}
// décompte de l'inventaire et des indicateurs de comparaison
function inventoryCounts(){const I=INVENTORY,n=f=>I.filter(f).length;
  return {M:n(x=>x.c==='M'),A:n(x=>x.c==='A'&&!x.auto),Aa:n(x=>x.c==='A'&&x.auto),
    Cn:n(x=>x.c==='C'&&!x.r&&!x.t&&!x.off),Cr:n(x=>x.c==='C'&&x.r),Ct:n(x=>x.c==='C'&&(x.t||x.off)),vu:n(x=>x.vu),
    set:REF_FR.filter(r=>r.set).length,imp:REF_FR.filter(r=>!r.set&&r.fix&&!r.part).length,part:REF_FR.filter(r=>!r.set&&r.part).length,
    free:REF_FR.filter(r=>!r.set&&!r.fix).length,seen:BACKTEST.refs.filter(r=>!r.temoin).length,wit:BACKTEST.refs.filter(r=>r.temoin).length};}
function renderInventory(){const k=inventoryCounts();
  setHTML('invbars',[
    invBar('Paramètres et règles du modèle',[{n:k.M,cls:'c-m',l:'mesurés'},{n:k.A,cls:'c-a',l:'ajustés à la main'},{n:k.Aa,cls:'c-p',l:'ajustés par le modèle au départ'},
      {n:k.Cn,cls:'c-c',l:'nombres choisis'},{n:k.Cr,cls:'c-r',l:'règles choisies'},{n:k.Ct,cls:'c-x',l:'bornes techniques, inactifs'}]),
    invBar('Tableau de bord : valeur de départ du modèle',[{n:k.imp,cls:'c-a',l:'imposée par un réglage'},{n:k.part,cls:'c-p',l:'imposée en partie'},
      {n:k.free,cls:'c-m',l:'libre'},{n:k.set,cls:'c-x',l:'réglages, pour mémoire'}]),
    invBar('Test 2010 → 2024 : valeurs de 2024',[{n:k.seen,cls:'c-a',l:'regardées pendant la mise au point'},{n:k.wit,cls:'c-m',l:'témoins'}])].join('')+
    `<p class="note" style="margin-top:0">${k.vu} des choix ont été retenus après avoir vu les résultats du modèle (règle budgétaire, financement à dette cible, circuit des ventes, règle des SCOP…) : ils ont pu s'adapter aux indicateurs regardés. Deux réglages ajustés à la main consomment des valeurs de fin du tableau de bord : la primo-accession garde la part de propriétaires, la part de l'investissement à crédit garde l'encours immobilier.</p>`);
  const org=x=>x.c==='M'?['c-m','mesuré']:x.c==='A'?[x.auto?'c-p':'c-a',x.auto?'ajusté au départ':'ajusté']:[x.t||x.off?'c-x':x.r?'c-r':'c-c',x.t?'borne technique':x.off?'choisi, inactif':'choisi'];
  const tags=x=>[x.r?'règle':'',x.u?'choix de l\'utilisateur':'',x.vu?'retenu après avoir vu les résultats':''].filter(Boolean).join(' · ');
  let h='<table class="dtab invt"><colgroup><col class="c1"><col class="c2"><col class="c3"><col class="c4"></colgroup><thead><tr><th>Paramètre ou règle</th><th>Valeur</th><th>Origine</th><th>Source, ou statistique consommée</th></tr></thead><tbody>',d=null;
  for(const x of INVENTORY){if(x.d!==d){d=x.d;h+=`<tr class="dom"><td colspan="4">${esc(d)}</td></tr>`;}
    const [cls,lab]=org(x),t=tags(x);
    h+=`<tr><td>${esc(x.l)}${x.k?`<span class="tg">${esc(x.k)}</span>`:''}</td><td>${esc(x.v||'')}</td><td class="org"><i class="${cls}"></i>${lab}${t?`<span class="tg">${esc(t)}</span>`:''}</td><td>${esc([x.s,x.f?(x.c==='A'?'consomme : ':'')+x.f:''].filter(Boolean).join(' ; '))}</td></tr>`;}
  setHTML('invtab',h+'</tbody></table>');}
