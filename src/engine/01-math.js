/* =====================================================================
   Outils mathématiques
   ===================================================================== */
// générateur pseudo-aléatoire (mulberry32) : même graine, mêmes tirages
function rng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
// tirage normal centré réduit (Box-Muller) à partir d'un générateur uniforme
const normalFrom=g=>()=>{const u1=Math.max(g(),1e-12),u2=g();return Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2);};
// fonction de répartition de la loi normale (approximation d'Abramowitz et Stegun) et son inverse (par dichotomie)
function Phi(z){const t=1/(1+0.2316419*Math.abs(z)),d=0.3989423*Math.exp(-z*z/2),p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return z>0?1-p:p;}
function PhiInv(x){let lo=-6,hi=6;for(let k=0;k<60;k++){const m=(lo+hi)/2;if(Phi(m)<x)lo=m;else hi=m;}return lo;}
function gini(x0){const x=Array.from(x0).sort((a,b)=>a-b);const n=x.length;let s=0,c=0;for(let i=0;i<n;i++){s+=x[i];c+=(2*i-n+1)*x[i];}return s>0?c/(n*s):0}
// courbe de Lorenz en pts+1 points
function lorenz(x0,pts){const x=Array.from(x0).sort((a,b)=>a-b);const n=x.length;const tot=x.reduce((a,b)=>a+b,0);const out=[];let cum=0,k=0;for(let p=0;p<=pts;p++){const upto=Math.round(p/pts*n);while(k<upto){cum+=x[k];k++;}out.push(tot>0?cum/tot:p/pts);}return out}

/* ---------- tirages propres au modèle ---------- */
// rentabilité d'une entreprise : loi de Pareto de médiane P.rho (si « créations inégales »), plafonnée
function drawRho(g,P){if(!P.vary)return P.rho;const u=Math.max(1-g(),1e-12);return Math.min(RHO_CAP,P.rho/Math.pow(2,1/P.alpha)*Math.pow(u,-1/P.alpha));}
// une création : coût log-normal de moyenne P.cost, gain de Pareto proportionnel au coût (si « créations inégales »)
function drawProject(g,P){if(!P.vary)return {cost:P.cost,gain:P.payoff};
  const sig=P.sig,alpha=P.alpha,xm=(P.payoff/P.cost)*(alpha-1)/alpha;
  const u1=Math.max(g(),1e-12),u2=g();const z=Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2);const cost=P.cost*Math.exp(sig*z-sig*sig/2);
  const u=Math.max(1-g(),1e-12);return {cost,gain:cost*xm*Math.pow(u,-1/alpha)};}
