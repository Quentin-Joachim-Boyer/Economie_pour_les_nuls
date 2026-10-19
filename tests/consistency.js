// Cohérence des réglages par défaut (DEF, app/01-params.js) avec les données sourcées (engine/00-data.js) dont ils sont recopiés.
// DEF doit rester un objet littéral (les tests le lisent dans la page) : ces valeurs y sont donc écrites à la main, arrondies.
// Usage : node tests/consistency.js <fichier.html>
const {E,DEF}=require('./lib').loadEngine(process.argv[2],['HH_INCOME_MEDIAN','HH_INCOME_SIGMA','MPC_WEALTH','PROD_GROWTH','STATE_DEFAULTS']);
const PAIRS={incM:E.HH_INCOME_MEDIAN,sigI:E.HH_INCOME_SIGMA,mpcW:E.MPC_WEALTH,prodG:E.PROD_GROWTH,...E.STATE_DEFAULTS};
// tolérance : une demi-unité du dernier chiffre écrit dans DEF
const halfUlp=v=>{const d=(String(v).split('.')[1]||'').length;return 0.5*Math.pow(10,-d)+1e-12;};
let bad=0;
for(const [k,ref] of Object.entries(PAIRS)){const v=DEF[k];if(Math.abs(v-ref)>halfUlp(v)){console.log(`≠ DEF.${k} = ${v}, donnée = ${ref}`);bad++;}}
console.log(bad?`ÉCHEC : ${bad} réglage(s) par défaut ne correspondent plus aux données`:`OK : réglages par défaut conformes aux données (${Object.keys(PAIRS).length})`);
process.exit(bad?1:0);
