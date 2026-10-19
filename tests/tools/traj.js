// Trajectoires moyennes de quelques séries, sur plusieurs graines (outil d'analyse, informatif).
// Usage : node tests/tools/traj.js <fichier.html> [réglages JSON] [mondes, défaut L] [graines, défaut 4] [--backtest]
// Exemple : node tests/tools/traj.js dist/labo-capital.html '{"fiscal":0}' L,I 8
const {loadEngine,meanSeries}=require('../lib');
const bt=process.argv.includes('--backtest'),args=process.argv.slice(2).filter(a=>a!=='--backtest');
const {E,DEF}=loadEngine(args[0],['run','BACKTEST','START_YEAR','UNIT_EUR']);
const over=JSON.parse(args[1]||'{}'),worlds=(args[2]||'L').split(','),nSeeds=+args[3]||4;
const P={...DEF,N:2000,...(bt?E.BACKTEST.P:{}),...over};
const kEur=E.UNIT_EUR/1000;
// [titre, série, multiplicateur, décimales]
const COLS=[['chômage','lU',100,1],['inflation','pInfl',100,1],['taux dir.','cbRate',100,2],['déficit','sDef',100,1],['dette','sDebt',100,0],
  ['PO','sPO',100,1],['crédit','kCred',100,0],['habitat','hMort',100,0],['K k€/mén.','rK',kEur,0],['Gini','gi',1,3]];
const y0=P.y0||E.START_YEAR,step=P.T>20?3:1,pad=s=>String(s).padStart(10);
for(const w of worlds){
  const xs=Array.from({length:nSeeds},(_,s)=>E.run(w,1000+s,P));
  const mean=k=>xs.reduce((a,x)=>a+x[k],0)/nSeeds;
  console.log(`${w}, ${nSeeds} graines : écart de monnaie ${Math.max(...xs.map(x=>x.cDrift)).toExponential(1)}, `+
    `épargne ${(mean('cSaveRate')*100).toFixed(1)} %, marge ${(mean('cMargin')*100).toFixed(1)} %   (taux en % ; dette, crédits en % du PIB)`);
  console.log(['année',...COLS.map(c=>c[0])].map(pad).join(''));
  const S=Object.fromEntries(COLS.filter(c=>xs[0][c[1]]).map(c=>[c[1],meanSeries(xs,c[1])]));
  for(let t=0;t<P.T;t+=step)console.log([y0+t,...COLS.map(([,k,m,d])=>S[k]?(S[k][t]*m).toFixed(d):'—')].map(pad).join(''));
}
