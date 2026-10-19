// Sensibilité du tableau de bord au hasard : le même modèle évalué sur plusieurs lots de graines (outil d'analyse, informatif).
// Pour chaque lot : indicateurs dans la tolérance à la fin, et écart moyen à la France en nombre de tolérances (plafonné à 3).
// Usage : node tests/tools/seeds.js <fichier.html> [réglages JSON] [lots, défaut 4] [simulations par lot, défaut 8]
const {loadEngine}=require('../lib');
const {E,DEF}=loadEngine(process.argv[2],['run','aggFrom','scoreCard']);
const P={...DEF,N:2000,...JSON.parse(process.argv[3]||'{}')};const lots=+process.argv[4]||4,per=+process.argv[5]||8;P.runs=per;
const res=[];
for(let b=0;b<lots;b++){const xs=Array.from({length:per},(_,s)=>E.run('L',1000+b*per+s,P));
  let ok=0,n=0,d=0;for(const r of E.scoreCard(E.aggFrom('L',P,xs),P))if(!r.set&&r.okEnd!=null){n++;if(r.okEnd)ok++;d+=Math.min(3,Math.abs(r.gapEnd)/r.tol);}
  res.push(`${ok}/${n} (écart ${(d/n).toFixed(2)})`);}
console.log((process.argv[3]||'réglages par défaut')+' : '+res.join('  '));
