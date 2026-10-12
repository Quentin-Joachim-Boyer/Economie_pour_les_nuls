/* =====================================================================
   Aides DOM
   ===================================================================== */
const $=id=>document.getElementById(id);
const setText=(id,t)=>{$(id).textContent=t;};
const setHTML=(id,h)=>{$(id).innerHTML=h;};
const show=(id,on)=>{$(id).hidden=!on;};
const NS='http://www.w3.org/2000/svg';
function el(tag,attrs,parent,text){const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(text!=null)e.textContent=text;parent.appendChild(e);return e}
// graphique remplacé par un message
function blankChart(id,msg){const svg=$(id);svg.innerHTML='';el('text',{x:190,y:110,'text-anchor':'middle',class:'lab'},svg,msg);}
// statistiques d'un échantillon : valeurs triées, médiane, moyenne, déciles, part des 10 % du haut
function distStats(x){const y=Float64Array.from(x).sort();const n=y.length;const q=p=>y[Math.min(n-1,Math.floor(p*n))];let s=0;for(const v of y)s+=v;let top=0;for(let i=Math.floor(n*0.9);i<n;i++)top+=y[i];
  return {y,med:q(0.5),mean:s/n,d1:q(0.1),d9:q(0.9),p90:q(0.9),p99:q(0.99),top10:s>0?top/s:0};}
