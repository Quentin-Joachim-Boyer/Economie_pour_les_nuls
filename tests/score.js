// Tableau de bord de représentativité : le modèle (gains libres, réglages par défaut) comparé aux statistiques françaises.
// Usage : node tests/score.js <fichier.html> [N] [simulations]   (informatif : n'échoue pas)
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(process.argv[2],'utf8');
const m=html.match(/<script id="engine">([\s\S]*?)<\/script>/);if(!m)throw new Error('moteur introuvable');
const ctx={console,Math,Float64Array,Int32Array,Int8Array,Uint8Array,Array,Object,Map,Set,JSON,isFinite,NaN,Infinity};vm.createContext(ctx);
vm.runInContext(m[1]+'\nthis.agg=agg;this.scoreCard=scoreCard;',ctx);
const DEF=eval('('+html.match(/const DEF=(\{[^;]*\});/)[1]+')');
const P={...DEF,N:+process.argv[3]||2000,runs:+process.argv[4]||8};
const t0=Date.now();const w=ctx.agg('L',P);const S=ctx.scoreCard(w,P);
const f=(r,v)=>v==null?'—':r.u==='eur'?Math.round(v).toLocaleString('fr-FR')+' €':r.u==='h'?Math.round(v)+' h':r.u==='idx'?v.toFixed(3):(v*100).toFixed(1)+' %';
const mark=o=>o==null?' ':o?'✓':'✗';
console.log('Représentativité (gains libres, '+P.N+' ménages, '+P.runs+' simulations, '+((Date.now()-t0)/1000).toFixed(1)+' s)');
let ok=0,n=0;
for(const r of S){if(!r.set&&r.okEnd!=null){n++;if(r.okEnd)ok++;}
  console.log((r.set?'  [réglage] ':'  ')+r.l.padEnd(62)+' France '+f(r,r.v).padStart(10)+' | départ '+f(r,r.start).padStart(10)+' '+mark(r.okStart)+' | fin '+f(r,r.end).padStart(10)+' '+mark(r.okEnd));}
console.log(`Dans la tolérance à la fin : ${ok} / ${n} indicateurs mesurés`);
