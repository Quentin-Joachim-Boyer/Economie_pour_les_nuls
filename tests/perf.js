// Temps de calcul d'une simulation selon le nombre de ménages. Usage : node tests/perf.js <fichier.html>
const {E:ctx,DEF}=require('./lib').loadEngine(process.argv[2]);
for(const N of (process.argv[3]?[+process.argv[3]]:[500,2000,10000,50000])){const t0=Date.now();ctx.run('L',1000,{...DEF,N});ctx.run('I',1000,{...DEF,N});console.log(N,'ménages :',((Date.now()-t0)/2).toFixed(0),'ms par simulation');}
