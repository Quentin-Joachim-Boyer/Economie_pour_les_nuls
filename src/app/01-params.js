/* =====================================================================
   Paramètres : valeurs par défaut, formats des curseurs, mémoire du navigateur
   Pour ajouter un paramètre : une entrée dans DEF, un format dans FMT, un curseur (id = clé, sortie = clé_o) dans page.html,
   puis augmenter PARAMS_KEY si l'ancienne valeur mémorisée ne doit pas être reprise.
   ===================================================================== */
const DEF={N:2000,T:40,save:0.18,inc:1,sigI:0.49,sprof:1,ini:1,m0:1,alW:1.85,pidea:0.012,cost:4.3,pok:0.6,payoff:11,vary:1,firm:1,rho:0.107,payout:0.5,invest:0.11,depr:0.093,closed:1,mpcW:0.029,state:1,gW:0.123,gP:0.099,defT:0.051,debt0:1.156,rB:0.019,exist:1,k0:3.75,nf:17,own:0.5,hold:0.16,rhoIW:0.25,ageb:1.2,sig:2.4,alpha:1.5,bank:1,stock:1,r:0.8,dep:0.5,fee:0.05,rl:0.035,inv:0.25,phi:0.5,m:10,nfd:10,part:0.2,feeE:0.05,runs:30};
const SWITCHES=['inc','sprof','ini','vary','firm','exist','closed','state','bank','stock'];   // cases à cocher (0 ou 1)
const ids=Object.keys(DEF);
const none=()=>'',dec=n=>v=>fr(v,{maximumFractionDigits:n});
const FMT={N:v=>fr(v),T:v=>v,save:v=>v.toFixed(2),runs:v=>v,
  sigI:v=>v.toFixed(2),m0:v=>'× '+fr(v,{maximumFractionDigits:2}),alW:dec(2),rhoIW:dec(2),
  pidea:v=>fr(v*100,{maximumFractionDigits:1})+' %',cost:v=>fr(v)+' an'+(v>1?'s':'')+' de revenu',pok:pct,payoff:v=>fr(v),sig:v=>v.toFixed(1),alpha:v=>fr(v,{minimumFractionDigits:1,maximumFractionDigits:1}),
  rho:v=>fr(v*100,{maximumFractionDigits:1})+' %',payout:pct,invest:pct,depr:pct1,mpcW:pct1,gW:pct1,gP:pct1,defT:pct1,debt0:pct,rB:pct1,ageb:dec(1),k0:v=>fr(v)+' an'+(v>=2?'s':''),nf:v=>v,own:pct,hold:pct,
  r:pct,dep:pct,fee:v=>v.toFixed(2),rl:ratePct,inv:pct,phi:pct,m:v=>v,nfd:v=>v,part:pct,feeE:v=>v.toFixed(2)};
for(const k of SWITCHES)FMT[k]=none;
// curseurs à échelle non linéaire : nombre de ménages de 100 à 50 000, arrondi à deux chiffres significatifs
const SCALE={N:{from:s=>{const v=100*Math.pow(500,s/100);const p=Math.pow(10,Math.floor(Math.log10(v))-1);return Math.round(v/p)*p;},to:v=>Math.round(100*Math.log(v/100)/Math.log(500))}};

// mémoire du navigateur (peut être indisponible : toutes les lectures et écritures sont protégées)
const store={get(k){try{return localStorage.getItem(k);}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}},del(k){try{localStorage.removeItem(k);}catch(e){}}};
const PARAMS_KEY='labo-params-v24';
let P={...DEF};
try{const s=JSON.parse(store.get(PARAMS_KEY)||'null');if(s)for(const k of ids)if(typeof s[k]==='number')P[k]=s[k];}catch(e){}
const saveParams=()=>store.set(PARAMS_KEY,JSON.stringify(P));
