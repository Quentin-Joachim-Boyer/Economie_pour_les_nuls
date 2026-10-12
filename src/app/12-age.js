/* =====================================================================
   Hypothèses : âge, patrimoine et épargne en actions, comparés à l'Insee
   ===================================================================== */
const AGE_NAMES=['Moins de 30 ans','30-39 ans','40-49 ans','50-59 ans','60-69 ans','70 ans ou plus'];
const INSEE_WEALTH_BY_AGE=[12.7,51.4,106.6,171.5,194.3,182.1];   // k€, patrimoine net médian début 2018 (ramené à 2021 ×1,067)
const INSEE_STOCK_BY_AGE=[8.6,14.4,19.8,17.8,16.4,18.4];          // %, détention de valeurs mobilières début 2021
function renderAge(W){
  const d=W[0].dg;show('agecard',!!d);if(!d)return;
  setText('agemed',Math.round(d.ageMed0));
  const k=v=>isFinite(v)?fr(Math.round(v*UNIT_EUR/1000))+' k€':'n.d.',p=v=>isFinite(v)?Math.round(v*100)+' %':'–';
  const st=!!P.stock;
  let h=`<thead><tr><th>Âge au départ</th><th>Patrimoine médian, modèle</th><th>Insee</th>${st?'<th>Épargnent en actions, modèle</th><th>Insee (valeurs mobilières)</th>':''}</tr></thead><tbody>`;
  AGE_NAMES.forEach((nm,g)=>{h+=`<tr><td>${nm}</td><td>${P.ini?k(d.wAge[g]):'–'}</td><td class="src">${fr(Math.round(INSEE_WEALTH_BY_AGE[g]*1.067))} k€</td>${st?`<td>${p(d.pA0[g])}</td><td class="src">${fr(INSEE_STOCK_BY_AGE[g])} %</td>`:''}</tr>`;});
  setHTML('agetab',h+'</tbody>');
  const it=$('inctab');it.parentNode.hidden=!st;
  if(st){const qn=['20 % les plus modestes','2e cinquième','3e cinquième','4e cinquième','20 % les plus aisés'];
    it.innerHTML=`<thead><tr><th>Revenu</th><th>Épargnent en actions au départ</th><th>À la fin, gains libres</th><th>À la fin, gains interdits</th></tr></thead><tbody>`+
      qn.map((nm,q)=>`<tr><td>${nm}</td><td>${p(d.pQ0[q])}</td><td>${p(W[0].dg.pQ1[q])}</td><td>${p(W[1].dg.pQ1[q])}</td></tr>`).join('')+'</tbody>';}
  setText('agenote',`Patrimoine Insee : médiane du patrimoine net par âge début 2018, ramenée au niveau de 2021. ${st?`Le modèle vise une part d'ensemble de ${pct(P.part)} : les taux de l'Insee par âge et par patrimoine sont remis à cette échelle, puis le revenu module la probabilité (effet « toutes choses égales par ailleurs » de l'Insee). Ensuite, chaque année, le patrimoine et l'âge de chacun changent, et sa probabilité avec.`:''}`);
}
