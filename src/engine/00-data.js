/* =====================================================================
   Données de calage (France). Toutes les sources sont détaillées dans
   l'onglet « Hypothèses » de la page.
   Unité monétaire du modèle : une année de niveau de vie médian.
   ===================================================================== */
const UNIT_EUR=25760;                 // niveau de vie médian 2023 (Insee)
/* PIB par ménage, en années de niveau de vie médian, même année 2023 : PIB 2 822,5 Md€ (Insee, comptes 2023 publiés le 31 mai 2024 ;
   révisé depuis à environ 2 834) / 31 274 741 ménages (recensement 2023) / 25 760 €. Sert à convertir en euros les grandeurs publiques
   données en part du PIB français, et à exprimer les ratios du modèle comme ceux de l'Insee. */
const GDP_HH=2822.5e9/31274741/25760;
const toUnit=e=>e/UNIT_EUR;
// patrimoine 2021 : converti avec le niveau de vie médian de la même année, 23 160 € (Insee Première n° 1973), pour garder le rapport patrimoine / revenu
const WEALTH_UNIT_EUR=23160, toUnit21=e=>e/WEALTH_UNIT_EUR;

/* ---------- patrimoine net des ménages, Insee début 2021 ----------
   déciles (€), seuils du top 5 % et du top 1 % (seuils bruts × 0,884, rapport net/brut
   au 9e décile), puis loi de Pareto au-delà du 99e centile (indice réglable, 1,85 par défaut) */
const WEALTH_Q=[[0,0],[.1,3000],[.2,10400],[.3,26500],[.4,67100],[.5,124800],[.6,192100],[.7,274700],[.8,394300],[.9,633200],[.95,915000],[.99,1980000]].map(([p,v])=>[p,toUnit21(v)]);

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
   placé dans la distribution de 2018 (interpolation entre ses déciles) : centiles de ces médianes */
const AGE_WEALTH_PCT=[23,38,48,59,62,60];

/* ---------- épargne en actions (qui en détient) ----------
   selon le patrimoine (Insee 2017, d'après Arrondel) : [borne haute du groupe en centile, taux de détention] */
const PART_BY_WEALTH=[[.25,.009],[.5,.026],[.7,.075],[.9,.166],[.99,.379],[1,.758]];
// seuils de ces groupes, fixés en euros (distribution de 2021 aux 25e, 50e, 70e, 90e et 99e centiles)
const PART_WEALTH_CUTS=[16600,124800,274700,633200,1980000].map(toUnit21);
// selon l'âge : détention de valeurs mobilières début 2021 (Insee)
const PART_BY_AGE=[.086,.144,.198,.178,.164,.184];
// effet du revenu toutes choses égales par ailleurs (Insee, 2015) : −8, −5, −2, 0, +4 points autour de 9 %
const PART_INCOME_FACTOR=[1,4,7,9,13].map(v=>v/9);

/* ---------- entreprises ----------
   catégories, Insee (Ésane) 2023 : nombre et part des immobilisations corporelles. Les microentreprises d'Ésane comprennent
   environ 1,9 million de micro-entrepreneurs (avertissement de la publication) : retirés ici, leur capital est négligeable */
const FIRM_CATS=[
  {n:'grandes entreprises',n1:'grande entreprise',c:327,k:0.4884,big:1},
  {n:'ETI',n1:'ETI',c:7296,k:0.2738,big:1},
  {n:'PME',n1:'PME',c:172520,k:0.1402,big:0},
  {n:'microentreprises',n1:'microentreprise',c:4831709-1900000,k:0.0975,big:0}];
const FIRM_CATS_TOTAL=FIRM_CATS.reduce((a,c)=>a+c.c,0);
/* défaillances d'ETI et de grandes entreprises : crédits des ETI-GE nouvellement défaillantes = 0,12 % des crédits aux ETI-GE par an
   en moyenne 2010-2019 (0,16 % en mai 2024 ; Banque de France, calculs BNP Paribas, Eco Flash 24.09, juin 2024). En nombre, c'est
   0,85 % des entreprises (65 défaillances en 2024 pour 7 623 ETI et grandes entreprises), mais ce sont surtout les plus petites :
   pour la part du capital qui fait défaut, on retient la part des crédits.
   Reprise des actifs : quand une entreprise disparaît, 40 % de la valeur comptable de son capital est repris par les autres
   entreprises, avec la dette correspondante (taux de récupération des créanciers sur les crédits aux entreprises en France : 35 %
   pour les PME, 49 % en moyenne pondérée pour les grandes entreprises, EBA/Rep/2020/29 ; environ un tiers des défaillances évitent
   la liquidation directe, Altares 2025) ; le reste est perdu. Repère : crédits des entreprises nouvellement défaillantes = 0,45 %
   des crédits aux entreprises par an en moyenne 2010-2019 (0,56 % au pic d'août 2009, mêmes sources). */
const BIG_FAIL_RATE=0.0012, FIRM_RECOVERY=0.40;
const FIRM_SIZE_SIGMA=0.8;            // dispersion log-normale de la taille dans une catégorie
const SHAREHOLDERS_SMALL=10;          // actionnaires d'une PME ou microentreprise existante (en plus du propriétaire)
const SHAREHOLDERS_BIG=40;            // actionnaires d'une grande entreprise ou ETI existante (pas de propriétaire principal)
const EXIST_AGE_MIN=5, EXIST_AGE_SPAN=36; // âge des entreprises existantes : 5 à 40 ans
// détenteurs d'entreprises tirés avec un poids patrimoine^2,5 : les 5 % qui en détiennent le plus en ont alors environ 94 % (Insee : 95 %)
const HOLD_GAMMA=2.5;
/* usure du capital : compte des sociétés non financières 2023 (Insee, tableau 7.101) : consommation de capital fixe 282 Md€,
   investissement brut 336 Md€ ; rapportés au capital fixe net (~3 033 Md€, Banque de France) : usure ≈ 9,3 % et investissement ≈ 11 % par an
   (réglages depr et invest de DEF) */
const RHO_CAP=1.5;                    // rentabilité maximale d'une entreprise
const HAZARD_MAX=0.9;                 // probabilité annuelle maximale de disparition
/* vitesse de retour vers la dette cible : plus de 30 % de l'écart résorbé chaque année (Flannery et Rangan, 2006, « Partial adjustment
   toward target capital structures », Journal of Financial Economics) */
const LEV_ADJ=0.3;
// rentabilité des grandes entreprises agrégées : celle de l'ensemble des sociétés non financières, EBE 497,5 Md€ (Insee Première n° 2105)
// pour un capital fixe net de 3 195 Md€ (Insee, comptes de patrimoine 2025, tableau 1.111)
const BIG_RHO=497.5/3195;
const DEBT_AMORT=0.1;                 // remboursement annuel du capital emprunté

/* ---------- consommation (économie bouclée) ----------
   propension à consommer le revenu : 1 − taux d'épargne (Insee) ; propension à consommer le patrimoine, France 1981-2016
   (Chauvin et Muellbauer, Économie et Statistique 2018) : 0,14 pour les actifs financiers liquides, 0,022 pour les actifs
   financiers peu liquides, 0,013 pour l'immobilier ; pondérée par la composition du patrimoine brut des ménages en 2021
   (Insee : financier 20,9 % dont environ la moitié liquide, immobilier 61,9 %, professionnel 10,6 %, autres 6,5 %).
   Le coefficient 0,14 porte sur les liquidités nettes des dettes (Chauvin et Muellbauer) : dettes ≈ 13,6 % du patrimoine brut
   (Insee 2021 : net moyen 274 000 €, brut 317 100 €). Rapporté au patrimoine net (× 317,1 / 274) : ≈ 1,1 % par an.
   La propension à consommer le revenu est ensuite calée par quintile pour que le total (revenu + patrimoine) redonne au départ
   les taux d'épargne observés : sans cela, l'effet de patrimoine s'ajouterait à une épargne qui l'inclut déjà. */
const MPC_WEALTH=(0.14*(0.105-0.136)+0.022*0.105+0.013*0.619+0.022*0.171)*317.1/274;

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

/* ---------- prix et salaires (économie bouclée) ----------
   Un seul bien, donc un seul prix : prix = coût du travail par unité produite × (1 + marge) (Kalecki).
   Marge de départ : part des salaires dans la valeur ajoutée des sociétés non financières, 65 % (Insee, tableau 7.101) : 1/0,65 − 1.
   La marge réagit à la tension : (1 + marge) × (1 + θ × écart), écart = demande réelle (y compris en attente) / production de départ − 1
   (la production de départ correspond au chômage de départ, pris comme chômage « sans tension »).
   θ ≈ 0,14 : courbe de Phillips française estimée par l'Insee (Note de conjoncture, mars 2018, dossier) : un point de chômage en plus
   réduit la hausse annuelle des salaires d'environ 0,48 point (1,2·10⁻³ par trimestre), et les prix en répercutent 0,30 : 0,30 × 0,48 ≈ 0,14.
   Salaires : ils suivent la productivité et l'inflation attendue, ancrée sur la cible de 2 % de la BCE : depuis la crise de 1992-1993,
   « l'inflation passée n'est plus un déterminant significatif des salaires » (Insee, « Les déterminants de la dynamique des salaires
   en France », 2024) ; la même norme vaut dans les deux scénarios (mêmes ménages, mêmes négociations). Lors d'un choc comme en 2022,
   l'inflation passée redevient déterminante (hausses négociées de 4,4 % pour 2023 après 5,2 % d'inflation en 2022, Banque de France,
   Bulletin 245) : le modèle ne reproduit pas ces chocs. Les salaires ne baissent pas en euros (rigidité à la baisse des salaires
   nominaux : Le Bihan, Montornès et Heckel, 2012, données françaises). */
const WAGE_SHARE0=0.65;
const MARKUP0=1/WAGE_SHARE0-1;
const PHILLIPS_THETA=0.30*0.0048*100;
const WAGE_ANCHOR=1;   // part de l'inflation attendue ancrée sur la cible (le reste suit l'inflation de l'année passée)

/* ---------- tableau de bord de représentativité : statistiques de référence de la France ----------
   Chaque entrée : valeur de référence, année, source (lien), tolérance (écart jugé acceptable), et nature :
   « mesure » (résultat du modèle) ou « réglage » (set : paramètre fixé, montré pour mémoire). Relevé du 15/10/2026.
   fix : ce qui impose la valeur de départ du modèle (part : en partie seulement) ; la comparaison au départ n'est alors pas un test,
   seule l'évolution l'est. Sans fix, l'indicateur est libre dès le départ. Voir l'inventaire des paramètres (40-inventory.js). */
const REF_FR=[
  {k:'gini',fix:'la distribution du patrimoine (Insee 2021)',l:'Gini du patrimoine net',v:0.676,y:'2021',tol:0.03,u:'idx',src:'Insee, RPM 2024, fiche 2.9 (enquête européenne HFCS)',url:'https://www.insee.fr/fr/statistiques/fichier/7941427/RPM2024-F29.pdf'},
  {k:'top10',fix:'la distribution du patrimoine (Insee 2021)',l:'Part du patrimoine net détenue par les 10 % les plus dotés',v:0.50,y:'2021',tol:0.05,u:'pct',src:'Insee, RPM 2024, fiche 2.9 (HFCS)',url:'https://www.insee.fr/fr/statistiques/fichier/7941427/RPM2024-F29.pdf'},
  {k:'wmed',fix:'la distribution du patrimoine (Insee 2021)',l:'Patrimoine net médian par ménage',v:148100,y:'2024',tol:0.15,rel:1,u:'eur',src:'Insee Focus n° 371 (enquête Histoire de vie et Patrimoine 2023-2024)',url:'https://www.insee.fr/fr/statistiques/8672665'},
  {k:'save',fix:'le taux d\'épargne réglé',l:'Taux d\'épargne financière des ménages (hors logement)',v:0.090,y:'2025',tol:0.02,u:'pct',src:'Insee Première n° 2105 (taux d\'épargne total : 17,9 %, dont l\'investissement en logement, absent du modèle)',url:'https://www.insee.fr/fr/statistiques/8996855'},
  {k:'margin',fix:'la part des salaires de départ (65 %)',part:1,l:'Taux de marge des entreprises, entrepreneurs individuels compris',v:486553/(1513050+138445),y:'2024',tol:0.03,u:'pct',src:'Eurostat, nasa_10_nf_tr : EBE des sociétés non financières / (leur valeur ajoutée + revenu mixte des entrepreneurs individuels). Le modèle compte le revenu des indépendants comme un revenu d\'activité ; sans eux, le taux de marge des sociétés est de 32,2 % en 2025 (Insee Première n° 2105)',url:'https://ec.europa.eu/eurostat/databrowser/view/nasa_10_nf_tr/default/table?lang=fr'},
  {k:'unemp',fix:'le chômage de départ (7,4 %)',l:'Taux de chômage',v:0.077,y:'2025',tol:0.015,u:'pct',src:'Insee Première n° 2096 (enquête Emploi)',url:'https://www.insee.fr/fr/statistiques/8901327'},
  {k:'ulong',l:'Part des chômeurs depuis un an ou plus',v:0.231,y:'2025',tol:0.05,u:'pct',src:'Insee, L\'essentiel sur le chômage',url:'https://www.insee.fr/fr/statistiques/4805248'},
  {k:'hours',fix:'les heures par emploi et les emplois par ménage',l:'Heures travaillées par ménage et par an',v:46.27e9/31.27e6,y:'2024',tol:0.05,rel:1,u:'h',src:'Eurostat nama_10_a10_e (46,27 Md d\'heures) ; Insee, 31,27 millions de ménages (2023)',url:'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nama_10_a10_e?geo=FR&na_item=EMP_DC&unit=THS_HW&nace_r2=TOTAL&lang=fr'},
  {k:'infl',fix:'la cible de la banque centrale et l\'ancrage des salaires',part:1,l:'Inflation annuelle',v:0.02,y:'cible',tol:0.01,u:'pct',src:'Cible de la BCE (observé : 5,2 % en 2022, 4,9 % en 2023, 2,0 % en 2024, 0,9 % en 2025, Insee)',url:'https://www.insee.fr/fr/statistiques/8726461'},
  {k:'growth',fix:'les gains de productivité réglés',part:1,l:'Croissance annuelle du PIB réel',v:0.0124,y:'2014-2024',tol:0.005,u:'pct',src:'Eurostat tec00115, moyenne géométrique des taux annuels (calcul)',url:'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tec00115?geo=FR&unit=CLV_PCH_PRE&na_item=B1GQ&lang=fr'},
  {k:'debt',fix:'la dette de départ',l:'Dette publique / PIB',v:1.157,y:'2025',tol:0.10,u:'pct',src:'Insee Première n° 2106 (comptes des administrations publiques 2025)',url:'https://www.insee.fr/fr/statistiques/8997691'},
  {k:'deficit',fix:'le déficit de départ (impôt résiduel)',l:'Déficit public / PIB',v:0.051,y:'2025',tol:0.01,u:'pct',src:'Insee Première n° 2106',url:'https://www.insee.fr/fr/statistiques/8997691'},
  {k:'stock',fix:'la part de ménages qui épargnent en actions',l:'Part des ménages détenant des valeurs mobilières',v:0.174,y:'2024',tol:0.03,u:'pct',src:'Insee Focus n° 354',url:'https://www.insee.fr/fr/statistiques/8569009'},
  {k:'spend',fix:'les salaires et achats publics de départ',part:1,l:'Dépenses publiques / PIB, hors « autres transferts »',v:0.124+0.054+0.044+0.064+0.194+0.022+0.019,y:'2025',tol:0.05,u:'pct',src:'Eurostat, gov_10a_main : rémunérations, consommations intermédiaires, investissement, prestations en nature et en espèces, intérêts, subventions (57,2 % du PIB en tout, dont 5,1 % d\'autres transferts que le modèle n\'a pas)',url:'https://ec.europa.eu/eurostat/databrowser/view/gov_10a_main/default/table?lang=fr'},
  {k:'po',fix:'les dépenses et le déficit de départ (identité du budget)',part:1,l:'Prélèvements obligatoires / PIB',v:0.436,y:'2025',tol:0.03,u:'pct',src:'Insee Première n° 2106',url:'https://www.insee.fr/fr/statistiques/8997691'},
  {k:'dep',fix:'la pyramide des âges',l:'Personnes de 65 ans ou plus pour 100 de 20 à 64 ans',v:0.401,y:'2026',tol:0.04,u:'pct',endProj:1,src:'Insee Première n° 2108 (personnes de 65 ans ou plus pour 100 de 20 à 64 ans : 40 en 2026 ; à la fin, comparé à la projection centrale : 49 en 2040, 62 en 2070)',url:'https://www.insee.fr/fr/statistiques/9004289'},
  {k:'fail',l:'Crédits des entreprises défaillantes / crédits aux entreprises (par an, médiane sur 10 ans)',v:0.0045,y:'2010-2019',tol:0.003,u:'pct',src:'Banque de France, calculs BNP Paribas (Eco Flash 24.09, 2024) : moyenne 2010-2019 de 0,45 % ; pic d\'août 2009 : 0,56 %',url:'https://economic-research.bnpparibas.com/pdf/fr-FR/France-Poids-economique-defaillances-entreprises-niveaux-eleves-relativiser-20/06/2024,49702'},
  {k:'credit',fix:'la dette des entreprises de départ (47 % du capital)',l:'Crédits bancaires aux entreprises / PIB',v:1437.1/2991.1,y:'2026',tol:0.10,u:'pct',src:'Banque de France, Financement des entreprises, août 2026 (1 437,1 Md€ de crédits aux sociétés non financières) ; PIB 2025 : 2 991,1 Md€ (Insee)',url:'https://www.banque-france.fr/fr/statistiques/credit/financement-des-entreprises-2026-08'},
  {k:'own',fix:'les propriétaires par décile et la primo-accession',l:'Ménages propriétaires d\'un logement',v:0.612,y:'2024',tol:0.05,u:'pct',src:'Insee, taux de détention du patrimoine immobilier, début 2024 (enquête Histoire de vie et Patrimoine)',url:'https://www.insee.fr/fr/statistiques/2412784'},
  {k:'prod',l:'Croissance de la productivité horaire',v:0.007,y:'2000-2025',tol:0.003,u:'pct',set:1,src:'COR, tendances démographiques et économiques, avril 2026 (« autour de 0,7 % par an » sur 25 ans)',url:'https://www.cor-retraites.fr/sites/default/files/2026-04/Doc_04_tendances_d%C3%A9mo_%C3%A9co.pdf'},
  {k:'surv5',l:'Survie à 5 ans des entreprises créées',v:0.69,y:'2018-2023',tol:0.05,u:'pct',set:1,src:'Insee Première n° 2070 (Sine, génération 2018, hors micro-entrepreneurs)',url:'https://insee.fr/fr/statistiques/8634190'},
  {k:'hhdebt',fix:'l\'encours de départ et la part de l\'investissement à crédit',l:'Crédits à l\'habitat des ménages / PIB',v:1288/2991.1,y:'2026',tol:0.10,u:'pct',src:'Banque de France, crédits aux particuliers, août 2026 (1 288 Md€) ; PIB 2025 (Insee)',url:'https://www.banque-france.fr/system/files/2026-10/Stat_info_Credits_aux_particuliers_202608.pdf'}];

/* ---------- gains de productivité ----------
   productivité horaire du travail : « le rythme tendanciel de croissance de la productivité horaire s'est établi autour de 0,7 % par an »
   sur 25 ans (COR, tendances démographiques et économiques, avril 2026) ; 1,0 % sur 35 ans, 0,4 % sur 15 ans.
   Les salaires réels suivent la productivité à long terme (Insee, Note de conjoncture mars 2018 : équation de salaire indexée
   à long terme sur la productivité). */
const PROD_GROWTH=0.007;

/* ---------- protection sociale et prélèvements (économie bouclée, avec l'État) ----------
   Le revenu tiré pour chaque ménage est son revenu disponible (Insee). Le coût du travail payé par l'employeur est plus élevé :
   - cotisations sociales : 571,8 Md€ pour 1 536,3 Md€ de rémunération des salariés et 138,4 Md€ de revenu mixte en 2024
     (Insee, France portrait social 2025, fiche revenu disponible) : 34,1 % du coût du travail ;
   - impôt sur le revenu + CSG-CRDS, en part du revenu avant redistribution, par quintile de niveau de vie, 2024 (Insee, France
     portrait social 2025, « Redistribution monétaire ») : 4,0 / 5,0 / 7,0 / 9,5 / 18,8 %.
   TVA : 207,8 Md€ pour 1 527,5 Md€ de consommation des ménages en 2024 (Insee) : 13,6 % du prix hors taxe.
   Impôt sur les sociétés : 68,0 Md€ avant crédits d'impôt pour 486,5 Md€ d'excédent brut d'exploitation des SNF (Insee 2024) : 14 %.
   Le reste des recettes (impôts sur la production) est un taux sur les ventes, calé pour retrouver le déficit de départ.
   Retraite : départ à 62 ans et 9 mois en moyenne (Drees 2023) ; pension = 64,5 % du revenu d'activité (pension nette moyenne,
   droits dérivés compris, rapportée au revenu d'activité net moyen : COR, rapport 2026) ; revalorisée sur les prix.
   Assurance chômage : 71 % du salaire net perdu (Unédic, 2015, avant les réformes de 2019-2021), durée potentielle d'environ
   un an et demi (486 à 564 jours, Unédic 2024-2025) : versée l'année de la perte d'emploi et la suivante. */
const COT_RATE=571.8/(1536.3+138.4);
const IR_BY_QUINTILE=[0.040,0.050,0.070,0.095,0.188];
const TVA_RATE=207.8/1527.5;
const IS_RATE=68.0/486.5;
const RET_AGE=62.75, PENSION_REPL=0.645, UI_REPL=0.71, UI_YEARS=2;

/* ---------- prestations sociales (hors retraites et chômage) et santé ----------
   Le revenu disponible tiré pour chaque ménage contient des prestations non contributives : prestations familiales, aides au
   logement, minima sociaux et prime d'activité. Montant moyen par unité de consommation en 2024, par quintile de niveau de vie :
   5 600, 1 720, 820, 500 et 260 € (1 770 € pour l'ensemble, 5,8 % du niveau de vie ; niveau de vie moyen 30 900 €) (Insee, France
   portrait social 2025, « Redistribution monétaire », figure 1). Pour un ménage d'âge actif, cette part de son revenu (rapportée au
   niveau de vie moyen de son quintile dans le modèle) est versée par l'État et non par l'employeur ; elle reste versée s'il perd son
   emploi (minima sociaux). Total France 2023 : 91,9 Md€, 3,1 % du PIB (Drees, Minima sociaux et prestations sociales, éd. 2025).
   Santé et autres prestations en nature achetées au secteur marchand (soins de ville, médicaments, cliniques) : 186 Md€ en 2024,
   6,4 % du PIB (Insee Première n° 2054) : des achats de l'État aux entreprises, en plus des consommations intermédiaires et de
   l'investissement publics (l'hôpital public est déjà dans les salaires et les achats publics). */
const BEN_UC=[5600,1720,820,500,260], NV_MEAN=30900, HEALTH_INKIND=186/2920;
/* Autres impôts sur la production payés par les entreprises (D.29 : taxes foncières des entreprises, CFE, C3S, taxes sur les salaires…) :
   en baisse de 1,8 Md€ (−2,5 %) en 2024, soit environ 72 Md€, 2,5 % du PIB (calcul d'après Insee Résultats n° 81, comptes des APU 2024).
   Le reste des recettes publiques qui ne sont ni cotisations, ni impôt sur le revenu et CSG, ni TVA, ni impôt sur les sociétés (autres
   impôts sur les produits comme les accises sur l'énergie, impôts sur le patrimoine des ménages, ventes des administrations, revenus
   de la propriété…) est prélevé sur la consommation des ménages, à un taux calé pour que le déficit de départ soit celui observé.
   Recettes publiques totales 2024 : 1 500,6 Md€, 51,4 % du PIB (même source). */
const PROD_TAX_GDP=72/2920;
/* Subventions d'exploitation reçues par les sociétés non financières (D.39) : 41,8 Md€ en 2024 pour une valeur ajoutée de 1 513,1 Md€,
   soit 2,8 % (Eurostat, nasa_10_nf_tr, base 2020). Elles s'ajoutent à l'excédent brut d'exploitation (l'Insee calcule le taux de marge
   ainsi) ; total des subventions versées par les administrations : 1,9 % du PIB en 2025 (Eurostat, gov_10a_main).
   Prélèvements sur les pensions : CSG 8,3 % + CRDS 0,5 % + Casa 0,3 % au taux plein (service-public.fr) ; sur les allocations
   chômage : CSG 6,2 % + CRDS 0,5 %. Taux pleins : les pensions modestes paient moins, ce qui surestime un peu ces montants. */
const SUBS_VA=41802/1513050, PENS_LEVY=0.083+0.005+0.003, UI_LEVY=0.062+0.005;
// emplois par ménage actif : 46,27 milliards d'heures (Eurostat, 2024) / 1 586 h par emploi, pour 31,27 millions de ménages dont
// ceux dont la personne de référence a moins de 62 ans et 9 mois (pyramide des ménages, Insee)
const ACTIVE_HH_SHARE=(()=>{let a=0,t=0;for(const [lo,hi,n] of AGE_PYRAMID){t+=n;a+=n*Math.max(0,Math.min(1,(RET_AGE-lo)/(hi-lo)));}return a/t;})();
const JOBS_PER_ACTIVE_HH=(46.27e9/HOURS_PER_JOB)/(31.27e6*ACTIVE_HH_SHARE);

/* ---------- démographie (ménages) ----------
   Décès : loi de Gompertz (risque × 2 tous les 8,5 ans d'âge : « +8 à 10 % par an d'âge », Ined) calée pour une espérance de vie
   à 60 ans de 25,9 ans (moyenne femmes 27,9 / hommes 23,9, Insee, bilan démographique 2025).
   Les jeunes ménages entrent à 25 ans (choix de travail : le départ du domicile parental se fait vers 19-20 ans, la formation d'un
   ménage plus tard), selon les générations réelles (voir ENTRY_RATE plus bas) ; le patrimoine d'un ménage disparu va à un ménage
   d'une génération plus jeune (25 à 35 ans de
   moins : âge moyen des mères à la naissance 31 ans ; âge moyen des héritiers ≈ 50 ans, CAE 2021), après des droits de
   succession effectifs de 5 % (France Stratégie 2017). */
const GOMPERTZ_B=Math.log(2)/8.5;
// niveau de la mortalité calé sur une espérance de vie à 60 ans donnée (25,9 ans en 2025 ; une autre valeur pour le test 2010 → 2024)
const gompertzA=target=>{const e60=a=>{let s=0,S=1;for(let x=60;x<130;x+=0.1){S*=Math.exp(-a*Math.exp(GOMPERTZ_B*x)*0.1);s+=S*0.1;}return s;};
  let lo=1e-9,hi=1e-2;for(let k=0;k<80;k++){const m=Math.sqrt(lo*hi);if(e60(m)>target)lo=m;else hi=m;}return Math.sqrt(lo*hi);};
const GOMPERTZ_A=gompertzA(25.9);
const deathProb=(age,A=GOMPERTZ_A)=>1-Math.exp(-A*Math.exp(GOMPERTZ_B*(age+0.5))*1);
const NEW_HH_AGE=25, HEIR_GAP=[25,35], ESTATE_TAX=0.05;

/* ---------- entrées selon les générations réelles, et allongement de la vie ----------
   Chaque année, il entre autant de jeunes ménages que le permet la génération qui atteint 25 ans, plus les migrants :
   naissances de l'année (né − 25 ans) + solde migratoire de 150 000 personnes par an (hypothèse centrale Insee, projections 2026),
   rapportées à la population de 20 ans ou plus de l'année de départ (53,555 millions au 1er janvier 2026 ; 48,603 millions
   au 1er janvier 2010 : Insee Première n° 2108, figure 5). Une place de ménage représente en effet une part fixe des adultes :
   31,27 millions de ménages pour 53,2 millions d'adultes, soit 0,59 ménage par adulte, ce qui donne aussi 0,59 ménage par jeune
   qui entre ; au départ, 1,8 % de nouveaux ménages par an, autant que de ménages qui disparaissent.
   Naissances vivantes : Insee Focus n° 357, figure 1a (France hors Mayotte, 1985-2013) et Insee, « Naissances et taux de natalité »
   (France, 2014-2025) ; à partir de 2026, projection centrale de l'Insee : 630 843 en 2026, 476 424 en 2070 (interpolation
   linéaire entre les deux, Insee Première n° 2108).
   Les entrées sont comptées en personnes : adultes du modèle au départ (personnes de référence et conjoints) × (génération + migrants)
   / adultes de France ; un ménage entrant compte 1 + (part des couples à 30 ans) adultes. Le nombre de ménages peut baisser (places
   vides) ou monter (jusqu'à +50 %, places de réserve) ; les statistiques par ménage ne portent que sur les ménages présents.
   Allongement de la vie : espérance de vie à la naissance de 83,1 ans en 2025 (moyenne femmes 85,9 / hommes 80,3) et 88,1 ans
   en 2070 (89,5 / 86,7, projection centrale Insee) : + 5 ans en 45 ans ; la table de mortalité glisse de 0,11 an d'âge par an. */
const BIRTHS={1985:796138,1986:805543,1987:795790,1988:800560,1989:796101,1990:793071,1991:790078,1992:774755,1993:741306,1994:740774,
  1995:759058,1996:764028,1997:757384,1998:767906,1999:775796,2000:807405,2001:803234,2002:792745,2003:793044,2004:799361,
  2005:806822,2006:829352,2007:818705,2008:828404,2009:824641,2010:832799,2011:823394,2012:821047,2013:811510,
  2014:818565,2015:798948,2016:783640,2017:769553,2018:758590,2019:753383,2020:735196,2021:742052,2022:725997,2023:677803,2024:660787,2025:645000};
const births=y=>BIRTHS[y]!=null?BIRTHS[y]:y<1985?BIRTHS[1985]:630843+(476424-630843)*Math.min(1,(y-2026)/(2070-2026));
const NET_MIGRATION=150000, POP20={2010:48.603e6,2026:53.555e6}, START_YEAR=2026;
const ENTRY_RATE=(y0,t)=>(births(y0+t-NEW_HH_AGE)+NET_MIGRATION)/(POP20[y0]||POP20[START_YEAR]);
const MORT_SHIFT=5.0/45, DEMO_RESERVE=0.5;   // places de réserve : jusqu'à +50 % de ménages

/* ---------- conjoint survivant ----------
   Un ménage en couple ne disparaît qu'au décès du second conjoint. Part des personnes vivant en couple selon l'âge, France 2023
   (Insee, recensement, dossier complet France, tableau FAM G3) : 10,9 % (15-24 ans), 63,3 % (25-39), 69,7 % (40-54), 67,6 % (55-64),
   65,9 % (65-79), 41,0 % (80 ans ou plus). Ce sont des personnes : pour les ménages, ces parts sont multipliées par un même
   facteur pour retrouver 49,0 % de ménages formés d'un couple (7 986 633 sans enfant + 7 349 137 avec, sur 31 274 741 ménages,
   même tableau FAM T1). Les jeunes ménages qui entrent ont la part des 25-39 ans (la mise en couple n'est pas modélisée).
   Le conjoint a 2,5 ans de moins que la personne de référence (écart moyen entre conjoints, Insee Première n° 1613) et la même
   mortalité (les sexes ne sont pas distingués). Au décès d'un conjoint, le revenu et la pension du ménage sont ramenés aux deux
   tiers : le niveau de vie est maintenu (1,5 unité de consommation → 1, échelle Insee), proche de ce qui est observé en moyenne
   (veuves −3 %, veufs +18 %, Bonnet et Hourriez 2008), grâce à la pension de réversion (54 % de la pension de base du défunt).
   Pas de droits de succession entre époux (exonération depuis 2007). Repère : environ 235 000 à 250 000 veuvages par an (COR 2012 ;
   246 700 nouveaux bénéficiaires d'une pension de réversion en 2023, Drees). */
const COUPLE_BY_AGE=a=>a<25?0.109:a<40?0.633:a<55?0.697:a<65?0.676:a<80?0.659:0.410;
const COUPLE_HH_SHARE=(7986633+7349137)/31274741, SPOUSE_GAP=2.5, WIDOW_INCOME=1/1.5;
// personnes de 65 ans ou plus pour 100 personnes de 20 à 64 ans : 40 en 2026, 49 en 2040, 62 en 2070 (projection centrale Insee,
// Insee Première n° 2108) ; 28,3 en 2010 et 38,8 en 2024 (calculés sur la figure 5)
const DEP_PROJ=y=>y<=2026?0.401:y<=2040?0.401+(0.49-0.401)*(y-2026)/14:0.49+(0.62-0.49)*Math.min(1,(y-2040)/30);

/* ---------- épargne selon l'âge ----------
   taux d'épargne net : 4 % pour les 18-29 ans, 15 % pour les 50-64 ans, 8 % pour les 65 ans et plus (Insee, travaux présentés au
   COR, février 2026) ; entre 30 et 49 ans, interpolation linéaire (choix) ; 60-69 ans : moitié 15 %, moitié 8 %.
   Groupes du modèle : <30, 30-39, 40-49, 50-59, 60-69, 70+. Profil relatif : il est combiné au profil par quintile de revenu
   (calage sur marges), le niveau d'ensemble restant le taux d'épargne choisi. */
const SAVE_BY_AGE=[4,7.7,11.3,15,11.5,8];

/* ---------- circulation de l'épargne ----------
   Les banques gardent en réserve 1 % des dépôts (réserves obligatoires de la BCE, 1 % depuis 2012) et placent le reste de leur
   caisse en obligations d'État : l'État emprunte d'abord à la banque. Les fonds gardent une poche de liquidités de 5 % de leur
   valeur (choix de travail : les fonds actions sont presque entièrement investis) et rendent le reste à leurs porteurs. */
const BANK_RESERVE=0.01, FUND_CASH=0.05;

/* ---------- test de validation : partir de 2010, comparer en 2024 ----------
   Comptes nationaux en base 2020 (Eurostat, séries de la France, consultées le 20 octobre 2026), cohérents entre 2010 et 2024 :
   - dette publique 86,3 % du PIB en 2010, 112,6 % en 2024 ; déficit 7,2 % et 5,8 % (gov_10dd_edpt1) ;
   - dépenses publiques 57,7 % et 57,0 % ; salaires publics 13,2 % ; consommations intermédiaires 5,4 % et investissement 4,8 % ;
     prestations en nature achetées au marché 6,1 % ; intérêts 2,5 % du PIB, soit un taux apparent de 2,5 / 86,3 ≈ 2,9 % (gov_10a_main) ;
   - prélèvements (impôts et cotisations, définition européenne, un peu plus large que celle de l'Insee) 44,2 % et 45,3 % (gov_10a_taxag) ;
   - taux de marge des sociétés non financières : EBE / valeur ajoutée = 313,5 / 996,8 = 31,4 % en 2010, 486,6 / 1 513,1 = 32,2 % en
     2024 (nasa_10_nf_tr) ;
   - chômage 9,3 % et 7,4 % (une_rt_a) ; inflation (IPCH) 1,7 % en 2010 et 1,2 % par an en moyenne de 2011 à 2019 (prc_hicp_aind) ;
     croissance du PIB en volume 2,0 % en 2010 et 1,3 % par an de 2011 à 2019 (nama_10_gdp). Ces deux moyennes s'arrêtent en 2019 :
     le modèle ne reproduit ni le Covid (−7,4 % en 2020) ni le choc énergétique de 2022-2023 ;
   - PIB 1 996,1 Md€ en 2010 (nama_10_gdp), pour 27,79 millions de ménages (recensement 2010, Insee, TEF 2014) et un niveau de vie
     médian de 19 270 € : 3,73 années de niveau de vie médian par ménage.
   Hors comptes nationaux : taux d'épargne financière 6,9 % (Insee, base 2005) ; patrimoine net médian 113 500 € pour un niveau de vie
   médian de 19 270 € (5,89 années, contre 5,39 en 2021 : la distribution 2021 est remise à cette échelle) ; taux directeur 0,25 % ;
   productivité horaire : 0,4 % par an sur 15 ans (COR, avril 2026).
   Indicateurs témoins (temoin) : jamais regardés pour choisir ou régler une partie du modèle, ils mesurent la ressemblance sans
   biais de mise au point ; les autres ont servi à juger des versions du modèle pendant le recalage d'octobre 2026. Règle : un témoin
   qui sert à décider d'un choix perd ce statut (le noter dans le carnet).
   Témoins ajoutés le 20 octobre 2026, choisis et définis avant tout calcul (pré-enregistrement dans le carnet) :
   - investissement des sociétés non financières : FBCF 201 868 M€ (2010) et 328 705 M€ (2024) ; valeur ajoutée 996 825 et 1 513 050 M€
     (Eurostat, nasa_10_nf_tr, S11, prix courants, consulté le 20 octobre 2026) ; modèle : investissement et créations / valeur ajoutée
     des entreprises, moyenne des trois dernières années ;
   - dividendes nets des sociétés non financières : D42 versés 212 511 et 301 932 M€, reçus 156 875 et 253 787 M€ ; EBE 313 477 et
     486 553 M€ (même source) ; modèle : dividendes versés / profit brut, moyenne des trois dernières années ;
   - patrimoine brut : « les 10 % de ménages les mieux dotés concentrent 48 % de la masse totale de patrimoine brut » (2010, Insee
     Première n° 1380) ; 47,9 % début 2024 (Insee, « Répartition de la masse totale de patrimoine brut entre les ménages ») ; modèle : fin
     de période, patrimoine brut = actifs sans déduire les dettes. Le témoin avait été pré-enregistré sur le patrimoine net ; l'Insee ne
     publie la part de 2010 que pour le patrimoine brut : la mesure du modèle a été alignée avant tout calcul.
   - prix des logements rapporté au revenu disponible par ménage (méthode de J. Friggit, IGEDD) : indice des prix des logements 99,74 (2010)
     et 126,39 (2024), base 2015 (Eurostat, prc_hpi_a) ; revenu disponible brut des ménages 1 306 007 et 1 937 425 M€ (Eurostat,
     nasa_10_nf_tr, S14_S15, B6G) ; ménages 27,79 millions (recensement 2010) et 31,27 millions (recensement 2023), prolongés jusqu'en 2024
     au rythme moyen de 2010-2023 (+0,91 % par an) ; d'où 0,970 en 2024 (2010 = 1). Repère : 1,55 au 3e trimestre 2024 en base 2000
     (J. Friggit, IGEDD, 2025). Modèle : prix / revenu disponible moyen par ménage, rapporté à sa valeur de départ. Il teste la règle
     « le prix suit le revenu ».
   Paramètres de 2010 (20 octobre 2026) : le test ne garde plus les valeurs récentes là où elles feraient fuir 2024 dans le résultat.
   - capital fixe net des sociétés non financières 1 942 496 M€ fin 2010 (Eurostat, nama_10_nfa_bs, N11N, S11 ; 3 007 Md€ en 2023 dans
     la même série, proche des 3 033 Md€ retenus pour le départ de 2026) pour 28,345 millions d'actifs (Insee Première n° 1391, France
     métropolitaine : le capital par actif est un peu surestimé, d'environ 3 %) et un niveau de vie médian de 19 270 € ;
   - investissement 201 868 M€, usure 180 108 M€ (P51C), rémunération des salariés 658 310 M€ pour une valeur ajoutée de 996 825 M€
     (Eurostat, nasa_10_nf_tr, S11, 2010) : investissement 10,4 % et usure 9,3 % du capital, part des salaires 66,0 % ;
   - crédits aux sociétés non financières 780,8 Md€ fin 2010 (Banque de France, Insee TEF 2013) : 40 % du capital ;
   - 61,7 % des ménages détiennent un patrimoine immobilier, 18,9 % des valeurs mobilières, 15,7 % un patrimoine professionnel
     (Insee Première n° 1325, enquête Patrimoine 2010) ; la part qui épargne en actions (20 % pour 17,4 % de détenteurs de valeurs
     mobilières en 2024) est remise à la même échelle : 21,7 % ;
   - crédits à l'habitat 796,6 Md€ (Banque de France, Insee TEF 2013) pour 3 262 Md€ de logements et 3 565 Md€ de terrains bâtis des
     ménages fin 2010 (Insee Première n° 1382, base 2005) : 11,7 % ; taux des crédits nouveaux à l'habitat 3,36 % et aux sociétés non
     financières 3,01 % en décembre 2010 (Bulletin de la Banque de France n° 183 ; il n'y a pas de taux propre aux PME) ;
   - non-résidents : « 70,6 % de la dette négociable était détenue par les non-résidents, au mois de juin 2010 » (réponse ministérielle,
     JO de l'Assemblée nationale, 28 décembre 2010, question n° 93357) ;
   - espérance de vie à 60 ans : 22,4 ans pour les hommes et 27,1 pour les femmes en 2010 (Insee, bilan démographique 2023, tableaux
     rétrospectifs) : 24,75 ans.
   Restent aux valeurs récentes, faute de source comparable : la pyramide des âges des ménages (recensement 2010 non accessible) et les
   fonds propres des banques (l'ACP donne pour 2010 le ratio Tier 1, 10,6 %, pas le CET1, et les exigences de l'époque n'étaient pas
   comparables), ainsi que tous les paramètres hors de la liste pré-enregistrée (âge de la retraite, taux d'imposition, etc.). */
const BACKTEST={from:2010,to:2024,P:{T:14,y0:2010,i0:0.0025,u0:0.093,debt0:0.863,defT:0.072,save:0.069,rB:0.025/0.863,gW:0.132,gP:0.054+0.048,hik:0.061,
    gdpHH:1996.0751e9/27.7859e6/19270,m0:(113500/19270)/(124800/23160),prodG:0.004,
    // paramètres de 2010 à la place des valeurs récentes (étape 2 de la feuille de route, voir le commentaire plus haut)
    k0:1942496.3e6/28.345e6/19270,invest:201868/1942496.3,depr:180108/1942496.3,ws0:658310/996825,creditK:780.8e3/1942496.3,
    own0:0.617,mortK:796.6/(3262+3565),rMort:0.0336,nonres:0.706,e60:(22.4+27.1)/2,rl:0.0301,part:0.20*18.9/17.4,hold:0.157},
  refs:[
    {k:'unemp',l:'Taux de chômage',a:0.093,b:0.074,u:'pct',src:'Eurostat, une_rt_a (définition du BIT)',url:'https://ec.europa.eu/eurostat/databrowser/view/une_rt_a/default/table?lang=fr'},
    {k:'ulong',temoin:1,l:'Part des chômeurs depuis un an ou plus',a:0.404,b:0.233,u:'pct',src:'Insee Première n° 1391 (2010, métropole) ; Insee Références 2025',url:'https://www.insee.fr/fr/statistiques/8376836'},
    {k:'debt',l:'Dette publique / PIB',a:0.863,b:1.126,u:'pct',src:'Eurostat, gov_10dd_edpt1 (base 2020)',url:'https://ec.europa.eu/eurostat/databrowser/view/gov_10dd_edpt1/default/table?lang=fr'},
    {k:'deficit',l:'Déficit public / PIB',a:0.072,b:0.058,u:'pct',src:'Eurostat, gov_10dd_edpt1 (base 2020)',url:'https://ec.europa.eu/eurostat/databrowser/view/gov_10dd_edpt1/default/table?lang=fr'},
    {k:'spend',l:'Dépenses publiques / PIB, hors « autres transferts »',a:0.132+0.054+0.048+0.061+0.191+0.025+0.017,b:0.124+0.055+0.043+0.063+0.192+0.020+0.020,u:'pct',src:'Eurostat, gov_10a_main (57,7 % et 57,0 % en tout ; les autres transferts, environ 5 % du PIB, sont hors du modèle)',url:'https://ec.europa.eu/eurostat/databrowser/view/gov_10a_main/default/table?lang=fr'},
    {k:'po',l:'Impôts et cotisations / PIB (définition européenne)',a:0.442,b:0.453,u:'pct',src:'Eurostat, gov_10a_taxag',url:'https://ec.europa.eu/eurostat/databrowser/view/gov_10a_taxag/default/table?lang=fr'},
    {k:'margin',l:'Taux de marge des entreprises, indépendants compris (moyenne de la période)',a:313477/(996825+114987),b:486553/(1513050+138445),u:'pct',src:'Eurostat, nasa_10_nf_tr : EBE des sociétés non financières / (valeur ajoutée + revenu mixte des indépendants), comme le modèle, qui compte le revenu des indépendants comme un revenu d\'activité',url:'https://ec.europa.eu/eurostat/databrowser/view/nasa_10_nf_tr/default/table?lang=fr'},
    {k:'save',l:'Taux d\'épargne financière (moyenne de la période)',a:0.069,b:0.097,u:'pct',src:'Insee Première n° 1349 et n° 2105',url:'https://www.insee.fr/fr/statistiques/8996855'},
    {k:'infl',l:'Inflation annuelle moyenne, 2011-2019',yb:'2011-19',a:0.017,b:0.0123,u:'pct',src:'Eurostat, prc_hicp_aind (IPCH)',url:'https://ec.europa.eu/eurostat/databrowser/view/prc_hicp_aind/default/table?lang=fr'},
    {k:'growth',l:'Croissance annuelle moyenne du PIB en volume, 2011-2019',yb:'2011-19',a:0.020,b:0.0134,u:'pct',src:'Eurostat, nama_10_gdp',url:'https://ec.europa.eu/eurostat/databrowser/view/nama_10_gdp/default/table?lang=fr'},
    {k:'wmed',temoin:1,l:'Patrimoine net médian, en années de niveau de vie médian',a:113500/19270,b:148100/26740,u:'x',src:'Insee Première n° 1380 et n° 1412 (2010) ; Insee Focus n° 371 et Insee Première n° 2117 (2024)',url:'https://www.insee.fr/fr/statistiques/8672665'},
    {k:'wd9',temoin:1,l:'Patrimoine net : 9e décile / médiane',a:501600/113500,b:750400/148100,u:'x',src:'Insee Première n° 1380 (2010) ; Insee, distribution du patrimoine 2024',url:'https://www.insee.fr/fr/statistiques/2388851'},
    {k:'inv',temoin:1,l:'Taux d\'investissement des sociétés non financières (FBCF / valeur ajoutée)',a:201868/996825,b:328705/1513050,u:'pct',src:'Eurostat, nasa_10_nf_tr (S11, P51G et B1G)',url:'https://ec.europa.eu/eurostat/databrowser/view/nasa_10_nf_tr/default/table?lang=fr'},
    {k:'div',temoin:1,l:'Dividendes nets versés / excédent brut d\'exploitation des sociétés non financières',a:(212511-156875)/313477,b:(301932-253787)/486553,u:'pct',src:'Eurostat, nasa_10_nf_tr (S11, D42 versés − reçus, B2A3G)',url:'https://ec.europa.eu/eurostat/databrowser/view/nasa_10_nf_tr/default/table?lang=fr'},
    {k:'top10g',temoin:1,l:'Part du patrimoine brut détenue par les 10 % les mieux dotés',a:0.48,b:0.479,u:'pct',src:'Insee Première n° 1380 (2010) ; Insee, enquêtes Histoire de vie et Patrimoine (2024)',url:'https://www.insee.fr/fr/statistiques/2502915'},
    {k:'hpi',temoin:1,l:'Prix des logements rapporté au revenu disponible par ménage (2010 = 1)',a:1,b:(126.39/99.74)/((1937425/(31274741e-6*Math.pow(31274741/27785900,1/13)))/(1306007/27.7859)),u:'x',src:'Eurostat, prc_hpi_a (prix des logements) et nasa_10_nf_tr (revenu disponible brut des ménages) ; Insee, recensements 2010 et 2023 (ménages)',url:'https://ec.europa.eu/eurostat/databrowser/view/prc_hpi_a/default/table?lang=fr'}]};

/* ---------- création monétaire par le crédit ----------
   « Les crédits font les dépôts » (Banque de France, « Comment est créée la monnaie ») : un prêt crée de la monnaie,
   son remboursement la détruit. La banque prête aux entreprises et achète des obligations publiques tant que ses fonds propres
   couvrent 11,2 % de ses prêts (exigence moyenne de CET1 de la BCE pour 2026, Pilier 2 et coussins compris, SREP 2025 ;
   pondération 100 % pour les entreprises, 0 % pour l'État en approche standard) et 3 % de son bilan (levier minimal, Bâle III).
   Elle verse en dividendes ce qui dépasse 16,1 % de ses prêts (ratio CET1 effectif : 16,1 % fin 2024 pour les banques
   françaises, ACPR ; 16,1 % au 2e trimestre 2025 dans la zone euro, BCE) : l'écart entre les deux ratios est sa marge de prêt.
   Au départ, les entreprises doivent à la banque 47 % de leur capital (crédits aux sociétés non financières 1 437 Md€, août 2026,
   Banque de France, pour 3 033 Md€ de capital) ; elles renouvellent leurs prêts et ne remboursent que ce qui dépasse ce ratio.
   Les déposants reçoivent 1,30 % (rémunération moyenne des dépôts des ménages, Banque de France) sur les intérêts perçus ;
   le reste est la marge de la banque, dont 67,9 % paie ses frais (coefficient d'exploitation 2024, ACPR).
   Si les pertes font passer les fonds propres sous l'exigence, les dépôts au-delà de 100 000 € (garantie des dépôts, FGDR)
   sont convertis en fonds propres (renflouement interne, directive BRRD 2014/59/UE). */
const DEPOSIT_GUARANTEE=100000/UNIT_EUR;
/* la banque ne finance qu'une part du déficit : établissements de crédit français = 10,5 % de la dette négociable de l'État au
   1er trimestre 2026 (Agence France Trésor, bulletin mensuel n° 434, d'après la Banque de France) ; le reste est emprunté aux
   ménages, qui représentent ici aussi les assureurs, les fonds et les non-résidents (57,5 %) */
const BANK_GOV_SHARE=0.105, NONRES_SHARE=0.575;   // non-résidents : 57,5 % de la dette négociable de l'État (AFT, 1er trimestre 2026)
const CET1_TARGET=0.161, CET1_MIN=0.112, LEVERAGE_MIN=0.03, SNF_CREDIT_K=1437/3033, DEPOSIT_RATE=0.013, BANK_COST_RATIO=0.679;

/* ---------- logement ----------
   Patrimoine de départ : part de l'immobilier dans le patrimoine brut par décile (Insee, enquête Histoire de vie et Patrimoine
   début 2024, « Composition du patrimoine brut par décile ») : 0 / 0,6 / 1,9 / 26,6 / 67,0 / 75,0 / 75,1 / 72,5 / 69,3 / 53,3 % ;
   dettes / patrimoine brut des propriétaires selon l'âge : 42 % avant 40 ans, 26 % de 40 à 49, 13 % de 50 à 59, moins de 4 % après
   (Insee Focus n° 371) ; la dette d'un propriétaire ne dépasse pas 77,7 % de son logement (apport moyen, ACPR 2024).
   Prix : en gains libres, il suit le revenu (salaire nominal) : le prix des logements a évolué comme le revenu par ménage de 1965
   à 2000 (Friggit, IGEDD) ; en gains interdits, il suit les prix (pas d'enrichissement réel).
   Crédit immobilier : taux 3,32 % (crédits nouveaux, août 2026, Banque de France ; le taux moyen de l'encours n'est pas publié),
   durée 22 ans 8 mois (Banque de France, juillet 2026), pondération en risque 9,4 % (approche IRB, ACPR 2024).
   Investissement en logement : 8,9 % du revenu disponible des ménages (taux d'épargne 17,9 % − épargne financière 9,0 %, Insee 2025),
   fait par les propriétaires, financé à 40 % à crédit (calé pour que l'encours de crédit immobilier reste stable rapporté au PIB :
   +0,2 % sur un an en août 2026, Banque de France ; la production de crédits, 147 Md€ en 2025, finance surtout des achats de
   logements existants, dont les vendeurs remboursent leur propre prêt). Usure : 0,9 % de la valeur par an (investissement 133 Md€ / logements et
   terrains bâtis 8 850 Md€ = 1,5 %, moins la croissance du parc, 38,14 → 38,38 millions de logements, +0,6 %, Insee).
   Primo-accession : chaque année, un ménage locataire de 25 à 59 ans devient propriétaire avec la probabilité 2,5 %, calée pour que
   la part des ménages propriétaires reste vers 61 % (Insee : 61,2 % détiennent de l'immobilier, début 2024 ; 57 % des 40-49 ans
   possèdent leur résidence principale) ; il paie l'apport qu'il peut, jusqu'à 22,3 % (16,3 % des prêts dépassent 100 % de la valeur
   du bien, ACPR 2024) ; prix = 6,2 ans de revenu (prêt à 77,7 % remboursé en 22,7 ans au taux de
   3,32 % avec un taux d'effort de 30,7 %, ACPR) ; il achète à un bailleur, qui rembourse au prorata son crédit.
   Loyers : 55 % des ménages non propriétaires louent dans le parc privé (23,4 % des ménages, contre 16,9 % en HLM et 2,3 % logés
   gratuitement, Insee Première n° 2090) ; ils paient 8 950 € par an (loyers 2024 du parc privé ≈ 65 Md€ pour 7,3 millions de
   ménages, d'après SDES), une partie de leur consommation versée aux bailleurs, au prorata de ce qu'ils possèdent au-delà de leur
   propre logement. En gains interdits, le loyer ne couvre que l'usure : 8 950 € × 0,9 % / 3,5 % (rendement locatif brut ≈ 3,5 %,
   loyers 310 Md€ / patrimoine logement 8 850 Md€, borne haute). */
const HOUSING_DEC=[0,.006,.019,.266,.670,.750,.751,.725,.693,.533];
// taux de détention d'un patrimoine immobilier par décile de patrimoine brut, début 2024 (Insee, « Taux de détention »)
const OWN_DEC=[0,.010,.028,.308,.863,.963,.983,.992,.982,.993];
// part des ménages qui détiennent un patrimoine immobilier, début 2024 (Insee, même source) : sert à remettre OWN_DEC à l'échelle d'une autre année
const OWN_REF=0.612;
const MORT_TO_HOUSING=1288/8850;
const MORT_DEBT_AGE=a=>a<40?0.42:a<50?0.26:a<60?0.13:0.03;
const MORT_RATE=0.0332, MORT_YEARS=22.7, MORT_LTV=0.777, RW_MORT=0.094;
const HOUSING_INV=0.089, HOUSING_DEPR=0.009, ACC_RATE=0.025, PRICE_INC=6.2, HOUSING_INV_CREDIT=0.4;
const PRIV_TENANT=23.4/(23.4+16.9+2.3), RENT_PRIV=8950/UNIT_EUR, RENT_YIELD=0.035;

/* ---------- banque centrale (gains libres) ----------
   Règle de taux : i = ρ·i(t−1) + (1−ρ)·[r* + π* + 1,5·(π − π*) + 0,5·écart de demande], plancher −0,5 %.
   π* = 2 % (cible de la BCE, stratégie 2021) ; r* = 0 (taux naturel réel de la zone euro entre −½ % et +½ %, Bulletin économique BCE
   1/2025) ; 1,5 sur l'inflation (règle de référence BCE, document de travail n° 2797, 2023 ; Taylor 1993 : 1 + 0,5) ; 0,5 sur l'écart
   (Taylor 1993) ; lissage ρ = 0,85 par trimestre (même document BCE), soit 0,85⁴ ≈ 0,52 par an ; plancher : −0,50 %, taux de la
   facilité de dépôt de 2019 à 2022. Départ : 2,50 % (facilité de dépôt depuis le 16 septembre 2026, BCE).
   Transmission (variations par rapport au départ) : crédits aux entreprises 0,78 (zone euro, +350 pb pour +450 pb, mai 2022 → oct. 2023,
   Bulletin BCE 8/2023) ; crédits à l'habitat 0,69 (France, 1,07 % → 4,17 %, janv. 2022 → janv. 2024, Banque de France) ; dépôts 0,25
   (part répercutée de long terme sur les dépôts à vue des ménages, BCE, document de travail n° 3255) ; dette publique : les nouvelles
   émissions se font au taux directeur + 0,9 point (taux moyen des émissions 2025 : 3,14 %, AFT, pour une facilité de dépôt d'environ
   2,25 %), et le taux apparent s'en rapproche de 1/8,5 par an (durée de vie moyenne de la dette : 8 ans et 180 jours, AFT, juin 2026).
   Effets : investissement des entreprises −3,4 % par point de taux réel (Mésange, choc de 100 pb à 3 ans, d'après la DG Trésor) ;
   investissement en logement −3,0 % par point (Mésange, semi-élasticité à 5 ans) ; primo-accession −19 % par point de taux immobilier
   (production de crédits à l'habitat −59 % pour +3,1 points, janv. 2022 → janv. 2024, Banque de France). Le taux réel est le taux
   nominal moins l'inflation anticipée, ancrée au départ sur la cible et mise à jour pour moitié chaque année par l'inflation constatée.
   Avec gains interdits, les taux réels sont nuls par construction : la banque centrale n'a pas de levier. */
const CB_I0=0.025, CB_RSTAR=0, CB_PI=0.02, CB_API=1.5, CB_AY=0.5, CB_RHO=Math.pow(0.85,4), CB_FLOOR=-0.005;
const PT_FIRM=0.78, PT_MORT=0.69, PT_DEP=0.25, GOV_SPREAD=(3.14-2.25)/100, GOV_MAT=8.5;
const SE_INV=3.4, SE_HINV=3.0, SE_ACC=19;

/* ---------- règle budgétaire européenne (volet correctif du pacte de stabilité) ----------
   Quand le déficit public dépasse 3 % du PIB, l'État améliore son solde structurel de 0,5 point de PIB par an (règlement 1467/97
   modifié en 2011 : « a minimum annual improvement of at least 0,5 % of GDP as a benchmark, in its cyclically adjusted balance » ;
   règlement 2024/1264, appliqué à la France par la recommandation du Conseil du 17 janvier 2025 : « un ajustement structurel annuel
   minimal d'au moins 0,5 % du PIB à titre de référence », retour sous 3 % « d'ici 2029 »). Les mesures prises restent en place.
   Partage : 2/3 en hausses de prélèvements, 1/3 en économies de dépenses, comme la France sur 2011-2019 (période de la précédente
   procédure de déficit excessif) : mesures nouvelles en prélèvements 1,0 ; 1,1 ; 1,4 ; 0,2 ; −0,1 ; −0,2 ; −0,1 ; −0,2 point de PIB
   (2011-2018), soit 3,1 ; effort en dépenses 0,2 ; 0,1 ; 0,0 ; 0,4 ; 0,5 ; 0,4 ; −0,2 ; 0,3 ; −0,1 (2011-2019), soit 1,6 (rapports
   des commissions des finances de l'Assemblée nationale et du Sénat, d'après le ministère des Finances ; 2013 vérifié : « dont effort
   en recettes 1,4 », « dont effort en dépenses 0,0 », AN, rapport n° 2069). La consolidation de 2011-2013 est passée à près de 90 %
   par les recettes (FMI, 2013 : « About 90 percent of the adjustment to date realized through revenue measures »), celle de
   2014-2018 par les dépenses. Dans le modèle, les prélèvements supplémentaires portent sur la consommation (le levier fiscal
   résiduel) et les économies sur les salaires et achats publics, au prorata. Pas d'effort l'année qui suit un recul du PIB en
   volume : le dépassement n'est alors pas « excessif » (règlement 1467/97, art. 2 : « a negative annual GDP volume growth rate »). */
/* Seuils observés en France (choix de l'utilisateur, 20 octobre 2026) : la règle prévoit un effort au-delà de 3 %, mais la France
   n'a resserré nettement qu'au-delà de 5 % (effort de 0,7 point en 2025 après 5,8 % en 2024 ; nul en 2024 après 5,4 % en 2023, HCFP)
   et a relâché sous 3 % (efforts de −0,2 point en 2017 et 2019, baisses d'impôts de 2018-2022, Sénat). Entre les deux, rien ne change. */
const FISC_DEF=0.05, FISC_REL=0.03, FISC_STEP=0.005, FISC_PO=3.1/(3.1+1.6);

/* ---------- consommation des revenus du capital ----------
   Les ménages consomment une part plus faible de leurs revenus du capital (intérêts, dividendes, loyers, versements des fonds) que
   de leurs autres revenus : un point de revenu du patrimoine en plus dans le revenu (revenu total inchangé) fait monter le taux
   d'épargne d'environ 0,4 point (Banque de France, Eco Notepad n° 397, 2025 : « would lead to a rise in the saving rate of around
   0.4 of a percentage point ») ; la propension à les consommer est donc inférieure de 0,4 à celle des autres revenus. Cohérent avec
   les dividendes versés, consommés à 40-60 % dans l'année (Di Maggio, Kermani et Majlesi, 2020). À long terme, l'équation de la
   Banque de France (Ouvrard et Thubin, 2020) va plus loin : propension « quasi nulle ». */
/* part des revenus du patrimoine dans le revenu disponible des ménages : 12,6 % (Insee, ERFS 2024) et 12,2 % (Filosofi 2023), la
   même dans les deux scénarios (mêmes ménages, mêmes comportements) */
const MPC_CAP_GAP=0.4, CAP_INC_SHARE=0.12;
