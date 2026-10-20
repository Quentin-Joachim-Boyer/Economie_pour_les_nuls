// Sensibilité des mesures au hasard : le même modèle évalué sur plusieurs lots de graines (outil d'analyse, informatif).
// Tableau de bord : indicateurs dans la tolérance à la fin, et écart moyen à la France en nombre de tolérances (plafonné à 3).
// --backtest : test 2010 → 2024 ; indicateurs dans le bon sens, proches, et écart moyen rapporté au chemin parcouru par la France,
// séparément pour les indicateurs regardés pendant la mise au point et pour les témoins.
// Usage : node tests/tools/seeds.js <fichier.html> [réglages JSON] [lots, défaut 4] [simulations par lot, défaut 8] [--backtest]
const {loadEngine}=require('../lib');
const bt=process.argv.includes('--backtest'),args=process.argv.slice(2).filter(a=>a!=='--backtest');
const {E,DEF}=loadEngine(args[0],['run','aggFrom','scoreCard','backtestCard','BACKTEST']);
const lots=+args[2]||4,per=+args[3]||8;
const P={...DEF,N:2000,...(bt?E.BACKTEST.P:{}),...JSON.parse(args[1]||'{}'),runs:per};
const res=[];
for(let b=0;b<lots;b++){const xs=Array.from({length:per},(_,s)=>E.run('L',1000+b*per+s,P));const w=E.aggFrom('L',P,xs);
  if(bt){const S=E.backtestCard(w,P);
    // regardés pendant la mise au point, puis témoins (séparés : seuls les témoins sont à l'abri du biais de mise au point)
    const part=G=>{let d=0,c=0,e=0,n=0;for(const r of G){if(r.m==null)continue;n++;if(r.dirOK)d++;if(r.close)c++;e+=Math.min(3,Math.abs(r.m-r.b)/Math.max(Math.abs(r.b-r.a),Math.abs(r.b)*0.05));}
      return `${d}/${n} bon sens, ${c}/${n} proches (écart ${(e/n).toFixed(2)})`;};
    res.push(part(S.filter(r=>!r.temoin))+' | témoins : '+part(S.filter(r=>r.temoin)));}
  else{let ok=0,n=0,d=0;for(const r of E.scoreCard(w,P))if(!r.set&&r.okEnd!=null){n++;if(r.okEnd)ok++;d+=Math.min(3,Math.abs(r.gapEnd)/r.tol);}
    res.push(`${ok}/${n} (écart ${(d/n).toFixed(2)})`);}}
console.log((bt?'test 2010 → 2024, ':'tableau de bord, ')+(args[1]||'réglages par défaut')+' :\n  '+res.join('\n  '));
