// Stabilité sur toute la durée : simulations où le capital des entreprises tombe sous la moitié de son départ, et l'année où cela arrive.
// Usage : node tests/tools/stability.js <fichier.html> [réglages JSON] [mondes, défaut L,I] [simulations, défaut 16]
const {loadEngine}=require('../lib');
const {E,DEF}=loadEngine(process.argv[2]);const over=JSON.parse(process.argv[3]||'{}');const n=+process.argv[5]||16;
for(const w of (process.argv[4]||'L,I').split(',')){const yrs=[];let uEnd=0,kEnd=0;const P={...DEF,N:2000,...over},L=P.T-1;
  for(let s=1000;s<1000+n;s++){const x=E.run(w,s,P);const k0=x.rK[0];const f=x.rK.findIndex(v=>v<0.5*k0);if(f>=0)yrs.push(f);uEnd+=x.lU[L]/n;kEnd+=x.rK[L]/k0/n;}
  console.log(`${w} ${(process.argv[3]||'réglages par défaut').padEnd(30)} effondrements ${String(yrs.length).padStart(2)} / ${n} | années ${yrs.sort((a,b)=>a-b).join(',')||'—'} | chômage final ${(uEnd*100).toFixed(1)} % | capital final ${(kEnd*100).toFixed(0)} % du départ`);}
