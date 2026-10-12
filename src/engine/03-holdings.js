/* =====================================================================
   Détenteurs d'une entreprise (tableaux typés)
   fm.hi : identifiant du détenteur (ménage ≥ 0, ou fonds : FUND_ID_BASE − f)
   fm.hc : sa mise, qui sert de pondération pour les versements
   fm.hr : avec gains interdits, ce qui lui reste à récupérer (sa mise moins ce qu'il a déjà reçu)
   fm.selfC : part sans propriétaire (réserves réinvesties avec gains interdits)
   Une table de hachage (fm.hk) retrouve la ligne d'un détenteur déjà présent.
   ===================================================================== */
const fundId=f=>FUND_ID_BASE-f, isFundId=j=>j<=FUND_ID_BASE, fundOfId=j=>FUND_ID_BASE-j;
function newHoldings(fm,cap){let c=4;while(c<cap)c*=2;fm.n=0;fm.hi=new Int32Array(c);fm.hc=new Float64Array(c);fm.hr=new Float64Array(c);fm.hk=new Int32Array(c*2);fm.hs=31-Math.log2(c);return fm;}
function holderSlot(fm,j){const m=fm.hk.length-1;let h=Math.imul(j+3,0x9E3779B1)>>>fm.hs;while(fm.hk[h]!==0&&fm.hi[fm.hk[h]-1]!==j)h=(h+1)&m;return h;}
function growHoldings(fm){const c=fm.hi.length*2;const hi=new Int32Array(c),hc=new Float64Array(c),hr=new Float64Array(c);hi.set(fm.hi);hc.set(fm.hc);hr.set(fm.hr);fm.hi=hi;fm.hc=hc;fm.hr=hr;fm.hk=new Int32Array(c*2);fm.hs=31-Math.log2(c);for(let k=0;k<fm.n;k++)fm.hk[holderSlot(fm,fm.hi[k])]=k+1;}
// ajoute une part (mise w, plafond cap), regroupée avec celle que le détenteur a déjà dans la même entreprise
function addHolder(fm,j,w,cap){let h=holderSlot(fm,j);const k=fm.hk[h]-1;
  if(k<0){if(fm.n>=fm.hi.length){growHoldings(fm);h=holderSlot(fm,j);}const n=fm.n++;fm.hi[n]=j;fm.hc[n]=w;fm.hr[n]=cap;fm.hk[h]=n+1;}else{fm.hc[k]+=w;fm.hr[k]+=cap;}}
function freeHoldings(fm){fm.hi=fm.hc=fm.hr=fm.hk=null;fm.n=0;}
// total des pondérations (mises + part sans propriétaire)
function totalStake(fm){let t=fm.selfC;const hc=fm.hc;for(let k=0;k<fm.n;k++)t+=hc[k];return t;}
/* Verse `amount` aux détenteurs, au prorata de leur mise ; avec gains interdits (capped), chacun au plus ce qui lui reste à récupérer.
   Les ménages reçoivent sur W, les fonds sur income. Renvoie ce qui reste dans l'entreprise. */
function distribute(fm,amount,capped,W,income,fs){if(amount<=1e-9)return 0;const totC=totalStake(fm);if(totC<=1e-9)return amount;
  let kept=amount*fm.selfC/totC,paid=0;const a=amount/totC,hi=fm.hi,hc=fm.hc,hr=fm.hr;
  for(let k=0;k<fm.n;k++){let x=a*hc[k];if(capped){const c=hr[k]>0?hr[k]:0;if(x>c){kept+=x-c;x=c;}hr[k]-=x;}const j=hi[k];if(j<=FUND_ID_BASE)income[FUND_ID_BASE-j]+=x;else W[j]+=x;paid+=x;}
  fs.divPaid+=paid;return kept;}
/* Valeur des parts : V au prorata des mises ; avec gains interdits, chacune au plus ce qui reste à récupérer.
   Ajoute aux ménages (eqv) et aux fonds (fundStake) ; renvoie la part de V attribuée. */
function valueHoldings(fm,V,capped,eqv,fundStake){const totC=totalStake(fm);let given=0;const a=totC>1e-9?V/totC:0,hi=fm.hi,hc=fm.hc,hr=fm.hr;
  for(let k=0;k<fm.n;k++){let x=a*hc[k];if(capped){const c=hr[k]>0?hr[k]:0;if(x>c)x=c;}const j=hi[k];if(j<=FUND_ID_BASE)fundStake[FUND_ID_BASE-j]+=x;else eqv[j]+=x;given+=x;}
  return given;}
