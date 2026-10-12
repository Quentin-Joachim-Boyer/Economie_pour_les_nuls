// Temps de calcul d'une simulation selon le nombre de ménages. Usage : node tests/perf.js <fichier.html>
const fs=require('fs'),vm=require('vm');const html=fs.readFileSync(process.argv[2],'utf8');
const ctx={console,Math,Float64Array,Int32Array,Int8Array,Uint8Array,Array,Object,Map,Set,JSON,isFinite,NaN,Infinity};vm.createContext(ctx);
vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1]+'\nthis.run=run;',ctx);
const DEF=eval('('+html.match(/const DEF=(\{[^;]*\});/)[1]+')');
for(const N of (process.argv[3]?[+process.argv[3]]:[500,2000,10000,50000])){const t0=Date.now();ctx.run('L',1000,{...DEF,N});ctx.run('I',1000,{...DEF,N});console.log(N,'ménages :',((Date.now()-t0)/2).toFixed(0),'ms par simulation');}
