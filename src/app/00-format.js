/* =====================================================================
   Formats d'affichage (français)
   ===================================================================== */
const KEYS=['l','i'], LABELS=['Gains libres','Gains interdits'], SHORT=['Libres','Interdits'];
const fr=(v,o)=>v.toLocaleString('fr-FR',o);
const int=v=>{if(v==null)return 'jamais';const r=Math.round(v);return fr(r===0?0:r);};
const f1=v=>v==null?'n.d.':fr(v,{minimumFractionDigits:1,maximumFractionDigits:1});
const f2=v=>v==null?'n.d.':fr(v,{minimumFractionDigits:2,maximumFractionDigits:2});
const pct=v=>v==null?'n.d.':Math.round(v*100)+' %';                       // 37 %
const pct1=v=>v==null?'n.d.':fr(v*100,{maximumFractionDigits:1})+' %';     // 37,4 %
const ratePct=v=>fr(v*100,{maximumFractionDigits:2})+' %';                  // 3,5 %
// un montant en années de niveau de vie médian, converti en euros : 480 k€, 2,3 M€, 6 100 €
const eur=v=>{const e=v*UNIT_EUR;const a=Math.abs(e);return a>=1e9?fr(e/1e9,{maximumFractionDigits:1})+' Md€':a>=1e6?fr(e/1e6,{maximumFractionDigits:1})+' M€':a>=1e4?fr(Math.round(e/1000))+' k€':fr(Math.round(e/100)*100)+' €';};
// une durée en années de revenu : 0,23 an, 4,3 ans, 19 ans
const yrs=v=>{const a=Math.abs(v);return fr(v,{maximumFractionDigits:a>=10?0:a>=1?1:2})+(a>=2?' ans':' an');};
// nombres compacts pour les axes : 1,2 k, 35 k
const fmtN=v=>{if(Math.abs(v)>=10000)return Math.round(v/1000)+' k';if(Math.abs(v)>=1000)return (v/1000).toFixed(1).replace('.',',')+' k';return Number.isInteger(v)?String(v):v.toFixed(2).replace('.',',')};
