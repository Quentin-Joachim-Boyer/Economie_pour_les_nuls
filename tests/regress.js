// Test de non-régression du moteur : exécute run() sur plusieurs configurations et compare à une référence.
// Usage : node tests/regress.js <fichier.html> [--save]
const fs=require('fs'),path=require('path'),vm=require('vm');
const html=fs.readFileSync(process.argv[2],'utf8');
const m=html.match(/<script id="engine">([\s\S]*?)<\/script>/);if(!m)throw new Error('moteur introuvable');
const ctx={console,Math,Float64Array,Int32Array,Int8Array,Uint8Array,Array,Object,Map,Set,JSON,isFinite,NaN,Infinity};vm.createContext(ctx);
vm.runInContext(m[1]+'\nthis.run=run;this.aggFrom=aggFrom;',ctx);
const defM=html.match(/const DEF=(\{[^;]*\});/);const DEF=eval('('+defM[1]+')');
const base={...DEF,N:300,runs:2};
const CONFIGS={def:{},noFirm:{firm:0},noBank:{bank:0},noStock:{stock:0},direct:{bank:0,stock:0},noIni:{ini:0},noInc:{inc:0},noExist:{exist:0},noVary:{vary:0},noFirmDirect:{firm:0,bank:0,stock:0},small:{N:120,T:15}};
const round=v=>typeof v==='number'?(isFinite(v)?Number(v.toPrecision(10)):String(v)):v;
const ser=x=>{if(x==null)return x;if(ArrayBuffer.isView(x))return Array.from(x,round);if(Array.isArray(x))return x.map(ser);if(typeof x==='object'){const o={};for(const k of Object.keys(x).sort())o[k]=ser(x[k]);return o;}return round(x);};
// sorties retirées volontairement lors du nettoyage (toujours nulles ou inutilisées)
const REMOVED=new Set(['pA1','pW0','pW1','eqFees','fDebt','fDivOut','fOutV','fPaidOut','fPart0T','fees','first','init0m','oT']);
const out={};const t0=Date.now();
for(const [name,c] of Object.entries(CONFIGS)){const P={...base,...c};for(const w of ['L','I'])for(const s of [1000,1001]){const x=ctx.run(w,s,P);out[`${name}/${w}/${s}`]=ser(x);}
  const xsL=[ctx.run('L',1000,P),ctx.run('L',1001,P)];const a=ctx.aggFrom('L',P,xsL);const eq={...a.eq};delete eq.net;out[`${name}/aggL`]=ser({eq,byq:a.byq,spread:a.spread,dg:a.dg,gi:a.gi});}
const ref=path.join(__dirname,'reference.json');
if(process.argv.includes('--save')){fs.writeFileSync(ref,JSON.stringify(out));console.log('référence enregistrée',Object.keys(out).length,'cas',Date.now()-t0,'ms');}
else{const R=JSON.parse(fs.readFileSync(ref,'utf8'));let bad=0;const cmp=(a,b,p)=>{if(bad>20)return;if(typeof a!==typeof b||Array.isArray(a)!==Array.isArray(b)){console.log('≠ type',p);bad++;return;}
    if(a&&typeof a==='object'){const ks=new Set([...Object.keys(a),...Object.keys(b)]);for(const k of ks){if(!(k in b)&&REMOVED.has(k))continue;if(!(k in a)||!(k in b)){console.log('≠ clé',p+'.'+k);bad++;continue;}cmp(a[k],b[k],p+'.'+k);}return;}
    if(typeof a==='number'&&typeof b==='number'){if(Math.abs(a-b)>1e-8*Math.max(1,Math.abs(a))){console.log('≠',p,a,b);bad++;}return;}if(a!==b){console.log('≠',p,a,b);bad++;}};
  for(const k of Object.keys(R))cmp(R[k],out[k],k);console.log(bad?`ÉCHEC : ${bad} différence(s)`:'OK : résultats identiques',Object.keys(R).length,'cas',Date.now()-t0,'ms');process.exit(bad?1:0);}
