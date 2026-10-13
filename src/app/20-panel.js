/* =====================================================================
   Panneau de réglages
   ===================================================================== */
// ordres de grandeur affichés sous les réglages (calculs simples, sans simulation)
function payback(D,s,r){if(r<=0)return Math.ceil(D/s);if(r*D>=s)return null;return Math.ceil(-Math.log(1-r*D/s)/Math.log(1+r));}
function derived(){
  const ev=P.pok*P.payoff-P.cost,yS=P.save*P.incM,wait=Math.ceil(P.cost/yS);
  const sg=(v,u='')=>`<b>${v>=0?'+':''}${v.toFixed(2).replace('.',',')}${u}</b>`;
  let h=`<div><span>Gain moyen d'une création</span>${sg(ev)}</div><div><span>Attente pour financer seul</span><b>${wait} ans</b></div>`;
  if(P.bank){const D=P.cost+P.fee;const pl=payback(D,yS,P.rl),pi=payback(D,yS,0);
    h+=`<div><span>Rembourser un prêt complet après un échec</span><b>libres ${pl==null?'jamais':pl+' ans'}<br>interdits ${pi} ans</b></div>`;}
  if(P.stock){const ret=P.pok*P.payoff/P.cost-1;
    h+=`<div><span>Rendement d'une action si toute la création était financée ainsi</span><b>libres ${(ret>=0?'+':'')+Math.round(ret*100)} %<br>interdits ${Math.round((P.pok-1)*100)} %</b></div>`;}
  if(!P.bank&&!P.stock){const lend=P.pok*Math.min(1+P.r,P.payoff/P.cost)-1;
    h+=`<div><span>Rendement moyen d'un prêt (gains libres)</span>${sg(lend*100,' %')}</div>`;}
  setHTML('derived',h);
}
// affiche les réglages des briques actives, et les résumés des groupes repliés
function syncScopes(){
  const lb=document.querySelector('label[for="pok"]');if(lb)lb.textContent=P.firm?'Survie à 5 ans':'Chance de réussite';
  $('payoff').closest('.ctl').hidden=!!P.firm;
  for(const [box,on] of [['in_exist',P.exist],['in_closed',P.closed],['in_state',P.state],['in_firm',P.firm],['in_inc',P.inc],['in_ini',P.ini],['in_vary',P.vary],['in_bank',P.bank],['in_stock',P.stock],['in_direct',!(P.bank||P.stock)],['wrap_phi',P.bank&&P.stock]])$(box).hidden=!on;
  setText('sum_soc',`${fr(P.N)} ménages · ${P.T} ans · épargne ${pct(P.save)}${P.inc?' · revenus inégaux':''}${P.ini?' · patrimoine':''}`);
  setText('sum_proj',`idée ${FMT.pidea(P.pidea)}/an · coût ${fr(P.cost)} · ${P.vary?'inégaux':'identiques'}${P.firm?' · entreprises':''}`);
  setText('sum_fin',P.bank&&P.stock?'banque + bourse':P.bank?'banque':P.stock?'bourse':'prêt direct');
  setText('sum_mes',`aversion ${f2(EPS)}`);
}
function markStale(){const st=$('status');st.classList.add('stale');st.textContent='Paramètres modifiés, résultats à relancer';document.querySelector('main').classList.add('stale');}
// recopie P dans les curseurs et les cases
function sync(){for(const k of ids){if(SWITCHES.includes(k)){$(k).checked=!!P[k];continue;}$(k).value=SCALE[k]?SCALE[k].to(P[k]):P[k];setText(k+'_o',FMT[k](P[k]));}derived();syncScopes();}
function syncEps(){$('eps').value=EPS;setText('eps_o',f2(EPS));}
// après tout changement de réglage
function onParamChange(){derived();syncScopes();drawPreviews();saveParams();markStale();}
function bindPanel(){
  for(const k of ids){
    if(SWITCHES.includes(k)){$(k).addEventListener('change',e=>{P[k]=e.target.checked?1:0;onParamChange();});continue;}
    const inp=$(k);inp.addEventListener('input',()=>{const v=parseFloat(inp.value);P[k]=SCALE[k]?SCALE[k].from(v):v;setText(k+'_o',FMT[k](P[k]));onParamChange();});}
  $('eps').addEventListener('input',e=>{EPS=parseFloat(e.target.value);syncEps();syncScopes();store.set('labo-eps',String(EPS));renderEquity();});
  $('reset').addEventListener('click',()=>{P={...DEF};store.del(PARAMS_KEY);sync();drawPreviews();markStale();});
  $('sweepmetric').addEventListener('change',renderSweep);
  $('broadmode').addEventListener('change',e=>{store.set('labo-broad',e.target.value);renderBroad();});
  {const v=store.get('labo-broad');if(v==='share'||v==='keur')$('broadmode').value=v;}
  $('sweepbtn').addEventListener('click',runSweep);
  // groupes repliables et aides : état mémorisé
  document.querySelectorAll('details.grp').forEach(d=>{const k='labo-open-'+d.dataset.k;const v=store.get(k);if(v!==null)d.open=v==='1';d.addEventListener('toggle',()=>store.set(k,d.open?'1':'0'));});
  const help=$('help'),panel=$('panel');help.checked=store.get('labo-help')==='1';panel.classList.toggle('help-off',!help.checked);
  help.addEventListener('change',()=>{panel.classList.toggle('help-off',!help.checked);store.set('labo-help',help.checked?'1':'0');});
}
// onglets (mémorisés, ou choisis par #ancre)
function bindTabs(){
  const btns=[...document.querySelectorAll('.tabs button')],panes=[...document.querySelectorAll('.tabpane')];
  const showTab=t=>{btns.forEach(b=>b.setAttribute('aria-selected',b.dataset.t===t?'true':'false'));panes.forEach(p=>p.classList.toggle('off',p.dataset.pane!==t));store.set('labo-tab',t);};
  btns.forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.t)));
  const valid=t=>btns.some(b=>b.dataset.t===t);let t=store.get('labo-tab')||'syn';const h=(location.hash||'').slice(1);if(valid(h))t=h;showTab(valid(t)?t:'syn');
}
// lance la simulation des deux scénarios et affiche les résultats
async function launch(){const btn=$('run'),prog=$('prog');btn.disabled=true;const t0=performance.now();prog.hidden=false;prog.value=0;
  try{const [Lw,Iw]=await simulate(P,(d,n)=>{btn.textContent=`Calcul… ${d} / ${n}`;prog.max=n;prog.value=d;});render(Lw,Iw,performance.now()-t0);}
  catch(e){setText('status','Erreur de calcul : '+e);}
  finally{btn.disabled=false;btn.textContent='Lancer la simulation';prog.hidden=true;}}
