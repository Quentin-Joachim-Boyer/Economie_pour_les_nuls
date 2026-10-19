// Chargement du moteur depuis la page assemblée, commun aux tests et aux outils en ligne de commande.
// loadEngine(fichier, noms) : exécute le script #engine dans un contexte isolé et renvoie {E, DEF} ; E contient les noms demandés
// (fonctions ou constantes du moteur), DEF les réglages par défaut de la page.
const fs=require('fs'),vm=require('vm');
function loadEngine(file,names=['run']){
  const html=fs.readFileSync(file,'utf8');
  const m=html.match(/<script id="engine">([\s\S]*?)<\/script>/);if(!m)throw new Error('moteur introuvable');
  const E={console,Math,Float64Array,Int32Array,Int8Array,Uint8Array,Array,Object,Map,Set,JSON,isFinite,NaN,Infinity};vm.createContext(E);
  vm.runInContext(m[1]+'\n'+names.map(n=>`this.${n}=${n};`).join(''),E);
  const d=html.match(/const DEF=(\{[^;]*\});/);if(!d)throw new Error('réglages par défaut (DEF) introuvables');
  return {E,DEF:eval('('+d[1]+')')};
}
// moyenne d'une série annuelle sur plusieurs simulations
const meanSeries=(xs,k)=>Array.from(xs[0][k],(_,t)=>xs.reduce((a,x)=>a+x[k][t],0)/xs.length);
module.exports={loadEngine,meanSeries};
