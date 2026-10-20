// Tableau de bord de représentativité : le modèle (gains libres, réglages par défaut) comparé aux statistiques françaises après 10 ans,
// et stabilité sur toute la durée (part des simulations où le capital s'effondre, dans les deux mondes).
// Usage : node tests/score.js <fichier.html> [N] [simulations]   (informatif : n'échoue pas)
const {E:ctx,DEF}=require('./lib').loadEngine(process.argv[2],['agg','scoreCard','collapseShare']);
const P={...DEF,N:+process.argv[3]||2000,runs:+process.argv[4]||8,...JSON.parse(process.argv[5]||"{}")};
const t0=Date.now();const w=ctx.agg('L',P);const S=ctx.scoreCard(w,P);
const f=(r,v)=>v==null?'—':r.u==='eur'?Math.round(v).toLocaleString('fr-FR')+' €':r.u==='h'?Math.round(v)+' h':r.u==='idx'?v.toFixed(3):(v*100).toFixed(1)+' %';
const mark=o=>o==null?' ':o?'✓':'✗';
console.log('Représentativité (gains libres, '+P.N+' ménages, '+P.runs+' simulations, '+((Date.now()-t0)/1000).toFixed(1)+' s)');
let ok=0,n=0;
for(const r of S){if(!r.set&&r.okEnd!=null){n++;if(r.okEnd)ok++;}
  console.log((r.set?'  [réglage] ':'  ')+r.l.padEnd(62)+' France '+f(r,r.v).padStart(10)+' | départ '+f(r,r.start).padStart(10)+' '+mark(r.okStart)+' | à '+r.hz+' ans '+f(r,r.end).padStart(10)+' '+mark(r.okEnd)+(r.vEnd!==r.v?' (projection '+f(r,r.vEnd)+')':''));}
console.log(`Dans la tolérance après ${S[0].hz} ans : ${ok} / ${n} indicateurs mesurés`);
const wI=ctx.agg('I',P);const pc=x=>Math.round(x*P.runs)+' / '+P.runs;
console.log(`Stabilité sur ${P.T} ans, capital effondré : gains libres ${pc(ctx.collapseShare(w))}, gains interdits ${pc(ctx.collapseShare(wI))}`);
