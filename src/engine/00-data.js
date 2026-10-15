/* =====================================================================
   Données de calage (France). Toutes les sources sont détaillées dans
   l'onglet « Hypothèses » de la page.
   Unité monétaire du modèle : une année de niveau de vie médian.
   ===================================================================== */
const UNIT_EUR=25760;                 // niveau de vie médian 2023 (Insee)
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
const BIG_FAIL_RATE=0.0012, FIRM_RECOVERY=0.40, DEFAULT_CREDIT_SHARE=0.0045;
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
   Salaires : ils rattrapent 85 % de l'inflation de l'année précédente (Banque de France, Bulletin 245, 2023 : hausses négociées
   de 4,4 % pour 2023 après 5,2 % d'inflation en 2022, Smic indexé), et ne baissent pas en euros (rigidité à la baisse des salaires
   nominaux : Le Bihan, Montornès et Heckel, 2012, données françaises). */
const WAGE_SHARE0=0.65;
const MARKUP0=1/WAGE_SHARE0-1;
const PHILLIPS_THETA=0.30*0.0048*100;
const WAGE_INDEXATION=4.4/5.2;

/* ---------- tableau de bord de représentativité : statistiques de référence de la France ----------
   Chaque entrée : valeur de référence, année, source (lien), tolérance (écart jugé acceptable), et nature :
   « mesure » (résultat du modèle) ou « réglage » (paramètre fixé, montré pour mémoire). Relevé du 15/10/2026. */
const REF_FR=[
  {k:'gini',l:'Gini du patrimoine net',v:0.676,y:'2021',tol:0.03,u:'idx',src:'Insee, RPM 2024, fiche 2.9 (enquête européenne HFCS)',url:'https://www.insee.fr/fr/statistiques/fichier/7941427/RPM2024-F29.pdf'},
  {k:'top10',l:'Part du patrimoine net détenue par les 10 % les plus dotés',v:0.50,y:'2021',tol:0.05,u:'pct',src:'Insee, RPM 2024, fiche 2.9 (HFCS)',url:'https://www.insee.fr/fr/statistiques/fichier/7941427/RPM2024-F29.pdf'},
  {k:'wmed',l:'Patrimoine net médian par ménage',v:148100,y:'2024',tol:0.15,rel:1,u:'eur',src:'Insee Focus n° 371 (enquête Histoire de vie et Patrimoine 2023-2024)',url:'https://www.insee.fr/fr/statistiques/8672665'},
  {k:'save',l:'Taux d\'épargne financière des ménages (hors logement)',v:0.090,y:'2025',tol:0.02,u:'pct',src:'Insee Première n° 2105 (taux d\'épargne total : 17,9 %, dont l\'investissement en logement, absent du modèle)',url:'https://www.insee.fr/fr/statistiques/8996855'},
  {k:'margin',l:'Taux de marge des entreprises (excédent brut / valeur ajoutée, hors administrations)',v:0.322,y:'2025',tol:0.03,u:'pct',src:'Insee Première n° 2105 (sociétés non financières)',url:'https://www.insee.fr/fr/statistiques/8996855'},
  {k:'unemp',l:'Taux de chômage',v:0.077,y:'2025',tol:0.015,u:'pct',src:'Insee Première n° 2096 (enquête Emploi)',url:'https://www.insee.fr/fr/statistiques/8901327'},
  {k:'ulong',l:'Part des chômeurs depuis un an ou plus',v:0.231,y:'2025',tol:0.05,u:'pct',src:'Insee, L\'essentiel sur le chômage',url:'https://www.insee.fr/fr/statistiques/4805248'},
  {k:'hours',l:'Heures travaillées par ménage et par an',v:46.27e9/31.27e6,y:'2024',tol:0.05,rel:1,u:'h',src:'Eurostat nama_10_a10_e (46,27 Md d\'heures) ; Insee, 31,27 millions de ménages (2023)',url:'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nama_10_a10_e?geo=FR&na_item=EMP_DC&unit=THS_HW&nace_r2=TOTAL&lang=fr'},
  {k:'infl',l:'Inflation annuelle',v:0.02,y:'cible',tol:0.01,u:'pct',src:'Cible de la BCE (observé : 5,2 % en 2022, 4,9 % en 2023, 2,0 % en 2024, 0,9 % en 2025, Insee)',url:'https://www.insee.fr/fr/statistiques/8726461'},
  {k:'growth',l:'Croissance annuelle du PIB réel',v:0.0124,y:'2014-2024',tol:0.005,u:'pct',src:'Eurostat tec00115, moyenne géométrique des taux annuels (calcul)',url:'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tec00115?geo=FR&unit=CLV_PCH_PRE&na_item=B1GQ&lang=fr'},
  {k:'debt',l:'Dette publique / PIB',v:1.157,y:'2025',tol:0.10,u:'pct',src:'Insee Première n° 2106 (comptes des administrations publiques 2025)',url:'https://www.insee.fr/fr/statistiques/8997691'},
  {k:'deficit',l:'Déficit public / PIB',v:0.051,y:'2025',tol:0.01,u:'pct',src:'Insee Première n° 2106',url:'https://www.insee.fr/fr/statistiques/8997691'},
  {k:'stock',l:'Part des ménages détenant des valeurs mobilières',v:0.174,y:'2024',tol:0.03,u:'pct',src:'Insee Focus n° 354',url:'https://www.insee.fr/fr/statistiques/8569009'},
  {k:'spend',l:'Dépenses publiques / PIB',v:0.573,y:'2025',tol:0.05,u:'pct',src:'Insee Première n° 2106 (modèle : sans dépenses de santé, de famille ni minima sociaux)',url:'https://www.insee.fr/fr/statistiques/8997691'},
  {k:'po',l:'Prélèvements obligatoires / PIB',v:0.436,y:'2025',tol:0.03,u:'pct',src:'Insee Première n° 2106',url:'https://www.insee.fr/fr/statistiques/8997691'},
  {k:'dep',l:'Personnes de 65 ans ou plus pour 100 de 20 à 64 ans',v:0.401,y:'2026',tol:0.04,u:'pct',endProj:1,src:'Insee Première n° 2108 (personnes de 65 ans ou plus pour 100 de 20 à 64 ans : 40 en 2026 ; à la fin, comparé à la projection centrale : 49 en 2040, 62 en 2070)',url:'https://www.insee.fr/fr/statistiques/9004289'},
  {k:'fail',l:'Crédits des entreprises défaillantes / crédits aux entreprises (par an, médiane sur 10 ans)',v:0.0045,y:'2010-2019',tol:0.003,u:'pct',src:'Banque de France, calculs BNP Paribas (Eco Flash 24.09, 2024) : moyenne 2010-2019 de 0,45 % ; pic d\'août 2009 : 0,56 %',url:'https://economic-research.bnpparibas.com/pdf/fr-FR/France-Poids-economique-defaillances-entreprises-niveaux-eleves-relativiser-20/06/2024,49702'},
  {k:'credit',l:'Crédits bancaires aux entreprises / PIB',v:1437.1/2991.1,y:'2026',tol:0.10,u:'pct',src:'Banque de France, Financement des entreprises, août 2026 (1 437,1 Md€ de crédits aux sociétés non financières) ; PIB 2025 : 2 991,1 Md€ (Insee)',url:'https://www.banque-france.fr/fr/statistiques/credit/financement-des-entreprises-2026-08'},
  {k:'prod',l:'Croissance de la productivité horaire',v:0.007,y:'2000-2025',tol:0.003,u:'pct',set:1,src:'COR, tendances démographiques et économiques, avril 2026 (« autour de 0,7 % par an » sur 25 ans)',url:'https://www.cor-retraites.fr/sites/default/files/2026-04/Doc_04_tendances_d%C3%A9mo_%C3%A9co.pdf'},
  {k:'surv5',l:'Survie à 5 ans des entreprises créées',v:0.69,y:'2018-2023',tol:0.05,u:'pct',set:1,src:'Insee Première n° 2070 (Sine, génération 2018, hors micro-entrepreneurs)',url:'https://insee.fr/fr/statistiques/8634190'},
  {k:'hhdebt',l:'Dette des ménages / PIB',v:0.591,y:'2025',tol:0.10,u:'pct',set:1,src:'Banque de France, taux d\'endettement des agents non financiers, T4 2025 (modèle : pas de crédit immobilier)',url:'https://www.banque-france.fr/fr/statistiques/comptes-nationaux-financiers/taux-dendettement-des-agents-non-financiers-comparaisons-internationales-2025-q4'}];

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
const GOMPERTZ_A=(()=>{const e60=a=>{let s=0,S=1;for(let x=60;x<130;x+=0.1){S*=Math.exp(-a*Math.exp(GOMPERTZ_B*x)*0.1);s+=S*0.1;}return s;};
  let lo=1e-9,hi=1e-2;for(let k=0;k<80;k++){const m=Math.sqrt(lo*hi);if(e60(m)>25.9)lo=m;else hi=m;}return Math.sqrt(lo*hi);})();
const deathProb=age=>1-Math.exp(-GOMPERTZ_A*Math.exp(GOMPERTZ_B*(age+0.5))*1);
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
   Conditions de départ 2010 (Insee ; comptes nationaux en base 2005 sauf mention) : chômage 9,3 % ; dette 82,3 % du PIB ; déficit 7,2 %
   (base 2020) ; taux d'épargne financière 6,9 % ; taux apparent de la dette ≈ 3,2 % (intérêts 50,5 Md€ pour une dette de 82,3 % d'un PIB
   de 1 923 Md€, calcul) ; patrimoine net médian 113 500 € pour un niveau de vie médian de 19 270 € (5,89 années, contre 5,39 en 2021 :
   la distribution 2021 est remise à cette échelle) ; productivité horaire : 0,4 % par an sur 15 ans (COR, avril 2026).
   Non repris : la crise des dettes souveraines, le Covid (−7,4 % de PIB en 2020), l'inflation de 2022-2023 ; salaires et achats publics
   en part du PIB gardés à leur niveau 2025. */
const BACKTEST={from:2010,to:2024,P:{T:14,y0:2010,u0:0.093,debt0:0.823,defT:0.072,save:0.069,rB:0.032,m0:(113500/19270)/(124800/23160),prodG:0.004},
  refs:[
    {k:'unemp',l:'Taux de chômage',a:0.093,b:0.074,u:'pct',src:'Insee, L\'essentiel sur le chômage',url:'https://www.insee.fr/fr/statistiques/4805248'},
    {k:'ulong',l:'Part des chômeurs depuis un an ou plus',a:0.404,b:0.233,u:'pct',src:'Insee Première n° 1391 (2010, métropole) ; Insee Références 2025',url:'https://www.insee.fr/fr/statistiques/8376836'},
    {k:'debt',l:'Dette publique / PIB',a:0.823,b:1.126,u:'pct',src:'Insee Première n° 1348 (2010) et n° 2106 (2024)',url:'https://www.insee.fr/fr/statistiques/8997691'},
    {k:'deficit',l:'Déficit public / PIB',a:0.072,b:0.058,u:'pct',src:'Insee Première n° 2106',url:'https://www.insee.fr/fr/statistiques/8997691'},
    {k:'spend',l:'Dépenses publiques / PIB',a:0.577,b:0.570,u:'pct',src:'Insee Première n° 2106',url:'https://www.insee.fr/fr/statistiques/8997691'},
    {k:'po',l:'Prélèvements obligatoires / PIB',a:0.425,b:0.427,u:'pct',src:'Insee Première n° 1348 et n° 2106',url:'https://www.insee.fr/fr/statistiques/8997691'},
    {k:'margin',l:'Taux de marge des entreprises (moyenne de la période)',a:0.302,b:0.327,u:'pct',src:'Insee Première n° 1349 et n° 2105',url:'https://www.insee.fr/fr/statistiques/8996855'},
    {k:'save',l:'Taux d\'épargne financière (moyenne de la période)',a:0.069,b:0.097,u:'pct',src:'Insee Première n° 1349 et n° 2105',url:'https://www.insee.fr/fr/statistiques/8996855'},
    {k:'wmed',l:'Patrimoine net médian, en années de niveau de vie médian',a:113500/19270,b:148100/26740,u:'x',src:'Insee Première n° 1380 et n° 1412 (2010) ; Insee Focus n° 371 et Insee Première n° 2117 (2024)',url:'https://www.insee.fr/fr/statistiques/8672665'},
    {k:'wd9',l:'Patrimoine net : 9e décile / médiane',a:501600/113500,b:750400/148100,u:'x',src:'Insee Première n° 1380 (2010) ; Insee, distribution du patrimoine 2024',url:'https://www.insee.fr/fr/statistiques/2388851'}]};

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
const CET1_TARGET=0.161, CET1_MIN=0.112, LEVERAGE_MIN=0.03, SNF_CREDIT_K=1437/3033, DEPOSIT_RATE=0.013, BANK_COST_RATIO=0.679;
