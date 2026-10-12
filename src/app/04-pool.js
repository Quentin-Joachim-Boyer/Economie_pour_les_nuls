/* =====================================================================
   Calcul en arrière-plan
   Le moteur (script #engine) tourne dans plusieurs workers, un par cœur (au plus 8) ; chaque simulation est une tâche.
   Si le navigateur refuse les workers, le calcul se fait dans la page, simulation par simulation, sans la figer.
   ===================================================================== */
const POOL=(function(){const pool={ws:[],ok:false};
  try{const src=$('engine').textContent+`
onmessage=function(e){const d=e.data;try{const x=run(d.world,d.seed,d.P);const tr=new Set();for(const k in x){const v=x[k];if(v&&v.buffer instanceof ArrayBuffer)tr.add(v.buffer);}postMessage({id:d.id,x},[...tr]);}catch(err){postMessage({id:d.id,err:String(err)});}};`;
    const url=URL.createObjectURL(new Blob([src],{type:'text/javascript'}));const n=Math.max(1,Math.min(8,navigator.hardwareConcurrency||4));
    for(let k=0;k<n;k++)pool.ws.push(new Worker(url));pool.ok=true;}catch(e){pool.ws=[];pool.ok=false;}
  return pool;})();
let JOBSEQ=0;
// exécute des tâches {world, seed, P} ; onProg(fait, total) ; renvoie les résultats dans l'ordre des tâches.
// Un nouvel appel abandonne le précédent.
function runJobs(jobs,onProg){
  return new Promise((resolve,reject)=>{const res=new Array(jobs.length);let next=0,done=0;const gen=++JOBSEQ;
    const finish=()=>{if(onProg)onProg(done,jobs.length);if(done===jobs.length)resolve(res);};
    const runHere=j=>run(j.world,j.seed,j.P);
    const local=()=>{if(gen!==JOBSEQ||next>=jobs.length)return;const k=next++;try{res[k]=runHere(jobs[k]);}catch(e){reject(e);return;}done++;finish();setTimeout(local,0);};
    if(!POOL.ok||!POOL.ws.length){setTimeout(local,0);return;}
    const feed=w=>{if(gen!==JOBSEQ||next>=jobs.length)return;const k=next++;const j=jobs[k];
      w.onmessage=e=>{if(gen!==JOBSEQ)return;if(e.data.err){POOL.ok=false;res[k]=runHere(j);}else res[k]=e.data.x;done++;finish();if(POOL.ok)feed(w);else local();};
      w.onerror=ev=>{ev.preventDefault&&ev.preventDefault();POOL.ok=false;if(gen!==JOBSEQ)return;res[k]=runHere(j);done++;finish();local();};
      w.postMessage({id:k,world:j.world,seed:j.seed,P:j.P});};
    POOL.ws.forEach(feed);});
}
// les deux scénarios, toutes les simulations (mêmes graines dans les deux) ; renvoie [libres, interdits] agrégés
async function simulate(Q,onProg){const P1={...Q};const jobs=[];for(const w of ['L','I'])for(let s=0;s<P1.runs;s++)jobs.push({world:w,seed:1000+s,P:P1});
  const xs=await runJobs(jobs,onProg);return [aggFrom('L',P1,xs.slice(0,P1.runs)),aggFrom('I',P1,xs.slice(P1.runs))];}
