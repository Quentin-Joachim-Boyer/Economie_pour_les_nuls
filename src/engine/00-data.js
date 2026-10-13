/* =====================================================================
   Données de calage (France). Toutes les sources sont détaillées dans
   l'onglet « Hypothèses » de la page.
   Unité monétaire du modèle : une année de niveau de vie médian.
   ===================================================================== */
const UNIT_EUR=25760;                 // niveau de vie médian 2023 (Insee)
const toUnit=e=>e/UNIT_EUR;

/* ---------- patrimoine net des ménages, Insee début 2021 ----------
   déciles (€), seuils du top 5 % et du top 1 % (seuils bruts × 0,884, rapport net/brut
   au 9e décile), puis loi de Pareto au-delà du 99e centile (indice réglable, 1,85 par défaut) */
const WEALTH_Q=[[0,0],[.1,3000],[.2,10400],[.3,26500],[.4,67100],[.5,124800],[.6,192100],[.7,274700],[.8,394300],[.9,633200],[.95,915000],[.99,1980000]].map(([p,v])=>[p,toUnit(v)]);

/* ---------- revenu des ménages : par ménage, et non par unité de consommation ----------
   revenu disponible par ménage, France métropolitaine 2015 (Insee) : médiane 30 040 €, moyenne 36 300 €, D9/D1 = 4,6 ;
   niveau de vie médian 2015 : 20 300 € par unité de consommation, d'où un revenu médian par ménage ≈ 1,48 niveau de vie médian ;
   loi log-normale d'écart-type ln(4,6) / (2 × 1,2816) ≈ 0,595 */
const HH_INCOME_MEDIAN=30040/20300, HH_INCOME_SIGMA=Math.log(4.6)/(2*1.2816);

/* ---------- épargne selon le revenu : taux par quintile de niveau de vie, 2017 (Insee) ---------- */
const SAVE_BY_QUINTILE=[2.71,4.99,9.65,11.23,28.37];

/* ---------- âge de la personne de référence, recensement 2023 (Insee, MEN4) ----------
   tranches [début, fin, nombre de ménages] */
const AGE_PYRAMID=[[18,20,344684],[20,25,1280788],[25,30,1822468],[30,35,2202957],[35,40,2434690],[40,45,2590210],[45,50,2686224],[50,55,2982999],[55,60,3156957],[60,65,2539983],[65,70,2221891],[70,75,2286353],[75,80,1868108],[80,95,2856429]];
/* patrimoine net médian par âge début 2018 (12 700, 51 400, 106 600, 171 500, 194 300, 182 100 €),
   placé dans la distribution de 2021 : centiles de ces médianes */
const AGE_WEALTH_PCT=[23,38,48,59,62,60];

/* ---------- épargne en actions (qui en détient) ----------
   selon le patrimoine (Insee 2017, d'après Arrondel) : [borne haute du groupe en centile, taux de détention] */
const PART_BY_WEALTH=[[.25,.009],[.5,.026],[.7,.075],[.9,.166],[.99,.379],[1,.758]];
// seuils de ces groupes, fixés en euros (distribution de 2021 aux 25e, 50e, 70e, 90e et 99e centiles)
const PART_WEALTH_CUTS=[16600,124800,274700,633200,1980000].map(toUnit);
// selon l'âge : détention de valeurs mobilières début 2021 (Insee)
const PART_BY_AGE=[.086,.144,.198,.178,.164,.184];
// effet du revenu toutes choses égales par ailleurs (Insee, 2015) : −8, −5, −2, 0, +4 points autour de 9 %
const PART_INCOME_FACTOR=[1,4,7,9,13].map(v=>v/9);

/* ---------- entreprises ----------
   catégories, Insee (Ésane) 2023 : nombre et part des immobilisations corporelles */
const FIRM_CATS=[
  {n:'grandes entreprises',n1:'grande entreprise',c:327,k:0.4884,big:1},
  {n:'ETI',n1:'ETI',c:7296,k:0.2738,big:1},
  {n:'PME',n1:'PME',c:172520,k:0.1402,big:0},
  {n:'microentreprises',n1:'microentreprise',c:4831709,k:0.0975,big:0}];
const FIRM_CATS_TOTAL=FIRM_CATS.reduce((a,c)=>a+c.c,0);
const FIRM_SIZE_SIGMA=0.8;            // dispersion log-normale de la taille dans une catégorie
const SHAREHOLDERS_SMALL=10;          // actionnaires d'une PME ou microentreprise existante (en plus du propriétaire)
const SHAREHOLDERS_BIG=40;            // actionnaires d'une grande entreprise ou ETI existante (pas de propriétaire principal)
const EXIST_AGE_MIN=5, EXIST_AGE_SPAN=36; // âge des entreprises existantes : 5 à 40 ans
// détenteurs d'entreprises tirés avec un poids patrimoine^2,5 : les 5 % qui en détiennent le plus en ont alors environ 94 % (Insee : 95 %)
const HOLD_GAMMA=2.5;
/* usure du capital : compte des sociétés non financières 2023 (Insee, tableau 7.101) : consommation de capital fixe 282 Md€,
   investissement brut 336 Md€ ; rapportés au capital fixe net (~3 033 Md€, Banque de France) : usure ≈ 9,3 % et investissement ≈ 11 % par an */
const SNF_CAPITAL_EUR=3033e9, SNF_CCF_EUR=282e9, SNF_GFCF_EUR=336e9;
const RHO_CAP=1.5;                    // rentabilité maximale d'une entreprise
const HAZARD_MAX=0.9;                 // probabilité annuelle maximale de disparition
const DEBT_AMORT=0.1;                 // remboursement annuel du capital emprunté

/* ---------- consommation (économie bouclée) ----------
   propension à consommer le revenu : 1 − taux d'épargne (Insee) ; propension à consommer le patrimoine, France 1981-2016
   (Chauvin et Muellbauer, Économie et Statistique 2018) : 0,14 pour les actifs financiers liquides, 0,022 pour les actifs
   financiers peu liquides, 0,013 pour l'immobilier ; pondérée par la composition du patrimoine brut des ménages en 2021
   (Insee : financier 20,9 % dont environ la moitié liquide, immobilier 61,9 %, professionnel 10,6 %, autres 6,5 %) : ≈ 2,9 % par an */
const MPC_WEALTH=0.105*0.14+0.105*0.022+0.619*0.013+0.171*0.022;

/* ---------- État minimal (comptes des administrations publiques 2025, Insee, premiers résultats) ----------
   dépenses : rémunérations 370,0 Md€ (12,3 % du PIB), consommations intermédiaires 165,0 Md€ et investissement 131,6 Md€
   (9,9 % du PIB) ; intérêts 64,7 Md€ pour une dette de 3 460,5 Md€ fin 2025 (taux apparent ≈ 1,9 %) ; dette 115,6 % du PIB ;
   déficit 5,1 % du PIB. Prestations sociales et transferts (redistribution) : pas encore modélisés. */
const STATE_DEFAULTS={gW:0.123,gP:0.099,defT:0.051,debt0:1.156,rB:0.019};

/* ---------- fonds ---------- */
const FUND_ID_BASE=-10;               // un fonds f apparaît parmi les détenteurs sous l'identifiant −10 − f

/* ---------- chômage (économie bouclée) ----------
   taux de chômage BIT 2024 : 7,4 % ; par âge : 15-24 ans 18,8 %, 25-49 ans 6,7 %, 50 ans ou plus 4,9 % (Insee, « Chômage », 2024).
   Les personnes de référence de moins de 30 ans ont surtout 25-29 ans : on prend la moyenne des 15-24 et 25-49 ans (12,75 %).
   Les 50 ans ou plus gardent 4,9 % (la retraite n'est pas encore modélisée).
   Par catégorie socioprofessionnelle 2025 (Insee, « Inégalités face au chômage ») : ouvriers peu qualifiés 17,1 %, employés peu
   qualifiés 11,4 %, ouvriers qualifiés 8,6 %, employés qualifiés 7,3 %, professions intermédiaires 5,0 %, cadres 4,0 %.
   Rapprochement avec les quintiles de revenu (par ordre de salaire) : Q1 peu qualifiés (14,25 %), Q2 qualifiés (7,95 %),
   Q3 entre qualifiés et intermédiaires (6,5 %), Q4 intermédiaires (5,0 %), Q5 cadres (4,0 %).
   Transitions annuelles 2023-2024 (Insee, « Transitions sur le marché du travail ») : 40,3 % des chômeurs sont en emploi un an
   plus tard, 35,8 % encore au chômage (le reste devient inactif, ce que le modèle ne représente pas) : parmi ceux qui restent
   actifs, 53 % retrouvent un emploi dans l'année. Le flux d'entrée au chômage est calé pour que chacun ait, en régime stable,
   son taux de chômage cible : s = 0,53 × u / (1 − u).
   Durée annuelle effective du travail 2024 (Insee, enquête Emploi) : salariés à temps complet 1 661 h, à temps partiel 970 h
   (17,4 % des salariés), indépendants 1 916 h ; salariés ≈ 88 % des emplois : ≈ 1 586 h par emploi. */
const UNEMP_RATE=0.074;
const UNEMP_BY_AGE=[0.1275,0.067,0.067,0.049,0.049,0.049];   // groupes d'âge du modèle : <30, 30-39, 40-49, 50-59, 60-69, 70+
const UNEMP_BY_QUINTILE=[0.1425,0.0795,0.065,0.05,0.04];
const UNEMP_EXIT=0.403/(0.403+0.358);
const HOURS_PER_JOB=0.88*(0.826*1661+0.174*970)+0.12*1916;
