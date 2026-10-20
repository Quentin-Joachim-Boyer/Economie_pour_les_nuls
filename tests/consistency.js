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

// Inventaire des paramètres (engine/40-inventory.js) : chaque constante de 00-data.js et chaque réglage de DEF y figure (ou est ignoré à dessein)
const html=require('fs').readFileSync(process.argv[2],'utf8');
const sec=html.split('/* ==== fichier : engine/00-data.js ==== */')[1].split('/* ==== fichier :')[0];
// noms déclarés au premier niveau : « const a=…, b=…; », virgules comptées hors parenthèses, crochets, accolades et chaînes
const declared=[];
for(let i=sec.indexOf('\nconst ');i>=0;i=sec.indexOf('\nconst ',i+1)){let k=i+7,depth=0,str=null,start=k;
  for(;k<sec.length;k++){const ch=sec[k];
    if(str){if(ch==='\\')k++;else if(ch===str)str=null;continue;}
    if(ch==="'"||ch==='"'||ch==='`')str=ch;else if('([{'.includes(ch))depth++;else if(')]}'.includes(ch))depth--;
    else if(depth===0&&(ch===','||ch===';')){declared.push(sec.slice(start,k).split('=')[0].trim());start=k+1;if(ch===';')break;}}}
const {E:I}=require('./lib').loadEngine(process.argv[2],['INVENTORY','INV_IGNORE','INV_IGNORE_DEF']);
const sw=(html.match(/const SWITCHES=\[([^\]]*)\]/)||[,''])[1].match(/'(\w+)'/g).map(x=>x.slice(1,-1));
const inv=new Set(I.INVENTORY.map(x=>x.k).filter(Boolean)),ign=new Set([...I.INV_IGNORE,...I.INV_IGNORE_DEF,...sw]);
const missing=[...declared,...Object.keys(DEF)].filter(k=>!inv.has(k)&&!ign.has(k));
const unknown=[...inv].filter(k=>!declared.includes(k)&&!(k in DEF));
const badCat=I.INVENTORY.filter(x=>!['M','A','C'].includes(x.c)||(x.c==='A'&&!x.f));
if(missing.length)console.log('Absents de l\'inventaire : '+missing.join(', '));
if(unknown.length)console.log('Inventoriés mais inconnus : '+unknown.join(', '));
if(badCat.length)console.log('Catégorie manquante, ou paramètre ajusté sans la statistique qu\'il consomme : '+badCat.map(x=>x.k||x.l).join(', '));
const bad2=missing.length+unknown.length+badCat.length;
console.log(bad2?'ÉCHEC : inventaire des paramètres incomplet':`OK : inventaire complet (${declared.length} constantes, ${I.INVENTORY.length} entrées)`);
process.exit(bad||bad2?1:0);
