// Compare deux versions du modèle (deux pages assemblées) sur les mêmes graines, par lots, pour juger si un écart dépasse le hasard.
// Mesure : écart moyen du test 2010 → 2024 (indicateurs regardés, et témoins à part) ou, sans --backtest, du tableau de bord après 10 ans.
// Différence B − A par lot (mêmes graines), moyenne et intervalle à 95 % (± 2 erreurs types) : un progrès n'est retenu que si
// l'intervalle exclut zéro.
// Usage : node tests/tools/compare.js <A.html> <B.html> [lots, défaut 6] [simulations par lot, défaut 8] [--backtest] [réglages JSON]
const {loadEngine}=require('../lib');
const bt=process.argv.includes('--backtest'),args=process.argv.slice(2).filter(a=>a!=='--backtest');
const lots=+args[2]||6,per=+args[3]||8,over=JSON.parse(args[4]||'{}');
const names=['run','aggFrom','scoreCard','backtestCard','BACKTEST'];
const err=(E,P,w)=>{
  if(bt){const S=E.backtestCard(w,P),e=G=>{let x=0,n=0;for(const r of G){if(r.m==null)continue;n++;x+=Math.min(3,Math.abs(r.m-r.b)/Math.max(Math.abs(r.b-r.a),Math.abs(r.b)*0.05));}return n?x/n:NaN;};
    return [e(S.filter(r=>!r.temoin)),e(S.filter(r=>r.temoin))];}
  let d=0,n=0;for(const r of E.scoreCard(w,P))if(!r.set&&r.okEnd!=null){n++;d+=Math.min(3,Math.abs(r.gapEnd)/r.tol);}return [d/n];};
const res=[args[0],args[1]].map(f=>{const {E,DEF}=loadEngine(f,names);const P={...DEF,N:2000,...(bt?E.BACKTEST.P:{}),...over,runs:per};
  return Array.from({length:lots},(_,b)=>err(E,P,E.aggFrom('L',P,Array.from({length:per},(_,s)=>E.run('L',1000+b*per+s,P)))));});
const labels=bt?['indicateurs regardés','témoins']:['tableau de bord à 10 ans'];
labels.forEach((l,k)=>{const a=res[0].map(x=>x[k]),b=res[1].map(x=>x[k]),d=b.map((v,i)=>v-a[i]);
  const m=d.reduce((s,v)=>s+v,0)/lots,sd=Math.sqrt(d.reduce((s,v)=>s+(v-m)**2,0)/Math.max(1,lots-1)),se=sd/Math.sqrt(lots);
  const mean=x=>(x.reduce((s,v)=>s+v,0)/lots).toFixed(3);
  console.log(`${l.padEnd(26)} A ${mean(a)}  B ${mean(b)}  B − A ${m>=0?'+':''}${m.toFixed(3)} ± ${(2*se).toFixed(3)}  ${Math.abs(m)>2*se?(m<0?'B meilleur':'B moins bon'):'pas de différence établie'}`);});
