// Test de validation : le modèle part des conditions de 2010 et est comparé aux données de 2024.
// Usage : node tests/backtest.js <fichier.html> [N] [simulations] [réglages JSON]   (informatif)
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(process.argv[2],'utf8');
const m=html.match(/<script id="engine">([\s\S]*?)<\/script>/);if(!m)throw new Error('moteur introuvable');
const ctx={console,Math,Float64Array,Int32Array,Int8Array,Uint8Array,Array,Object,Map,Set,JSON,isFinite,NaN,Infinity};vm.createContext(ctx);
vm.runInContext(m[1]+'\nthis.agg=agg;this.backtestCard=backtestCard;this.BT=BACKTEST;',ctx);
const DEF=eval('('+html.match(/const DEF=(\{[^;]*\});/)[1]+')');
const P={...DEF,...ctx.BT.P,N:+process.argv[3]||2000,runs:+process.argv[4]||8,...JSON.parse(process.argv[5]||"{}")};
const w=ctx.agg('L',P);const S=ctx.backtestCard(w,P);
const f=(r,v)=>v==null?'—':r.u==='pct'?(v*100).toFixed(1)+' %':v.toFixed(2);
console.log(`Test ${ctx.BT.from} → ${ctx.BT.to} (gains libres, ${P.N} ménages, ${P.runs} simulations)`);
let d=0,c=0;for(const r of S){if(r.dirOK)d++;if(r.close)c++;
  console.log('  '+r.l.padEnd(60)+` ${ctx.BT.from} ${f(r,r.a).padStart(8)} → ${ctx.BT.to} ${f(r,r.b).padStart(8)} | modèle ${f(r,r.m).padStart(8)} ${r.dirOK?'bon sens':'sens contraire'}${r.close?', proche':''}`);}
console.log(`Bon sens d'évolution : ${d} / ${S.length} ; proches de ${ctx.BT.to} : ${c} / ${S.length}`);
