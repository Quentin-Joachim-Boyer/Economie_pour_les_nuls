# Économie pour les nuls : le laboratoire du rendement

Une expérience de pensée simulée : deux économies identiques, à une règle près. Dans l'une, prêter ou investir son argent peut rapporter (« gains libres ») ; dans l'autre, tout gain financier net est interdit (« gains interdits »). Le modèle est construit brique par brique (revenus, patrimoine, banque, bourse et fonds, entreprises, âge…), chaque hypothèse étant calée sur des données françaises (Insee, Banque de France, AMF) ou sur la littérature.

La page se trouve dans `dist/labo-capital.html` : elle s'ouvre directement dans un navigateur.

## Développement

La page publiée est un fichier HTML unique. Les sources sont découpées dans `src/` et assemblées par `build.py`.
Chaque fichier y est précédé d'un repère `/* ==== fichier : … ==== */` : `split.py` retrouve les sources à partir de la page publiée.

### Cycle de travail

1. Modifier `src/`.
2. `./check.sh` : assemble `dist/labo-capital.html` et compare moteur et interface à la référence. Un nettoyage ne doit rien changer.
3. Un changement voulu des résultats se vérifie à la main, puis `./check.sh --save` met à jour la référence.
4. Un enregistrement git par brique, avec un message qui dit ce qui change dans le modèle.

Prérequis : Python 3, Node, et Playwright avec Chromium pour le test d'interface (`pip install playwright && playwright install chromium`).

Si seule la page publiée est disponible, `python3 split.py page.html src` retrouve les sources.

### Structure

| Fichier | Rôle |
|---|---|
| `src/page.html` | balisage : panneau de réglages, onglets, cartes, sources, limites |
| `src/style.css` | styles (couleurs en variables, thème sombre) |
| `src/engine/00-data.js` | **toutes les données de calage** (Insee, BdF, AMF…), avec leur source |
| `src/engine/01-math.js` | générateur aléatoire, loi normale, Gini, Lorenz, tirages de rentabilité et de créations |
| `src/engine/02-population.js` | revenus, épargne, âges, patrimoine de départ |
| `src/engine/03-holdings.js` | détenteurs d'une entreprise, versements, valeur des parts |
| `src/engine/04-funds.js` | fonds : versements, retraits, levées, reversements, valeur des parts |
| `src/engine/05-firms.js` | paysage d'entreprises, risque de disparition, entreprises existantes |
| `src/engine/06-participation.js` | qui épargne en actions (patrimoine × âge × revenu) |
| `src/engine/07-labour.js` | emploi et chômage : qui travaille, selon la demande (économie bouclée) |
| `src/engine/10-run.js` | une simulation : le départ (population, logement, bilans, calage), puis la boucle des années, qui appelle une fonction par étape (`updatePrices`, `centralBank`, `stateBudget`, `payWages`, `householdsSpendAndSave`, `housingMarket`, `firmsYear`, `newIdeas`, `bankCapital`, `demography`, `closeYear`, `balanceSheets`…), puis les résultats |
| `src/engine/20-stats.js` | équité, quintiles, Atkinson, agrégation des simulations |
| `src/engine/30-score.js` | tableau de bord de représentativité (`REF_FR`) et test 2010 → 2024 (`BACKTEST`) |
| `src/engine/40-inventory.js` | **inventaire des paramètres** : chaque nombre et chaque règle, mesuré, ajusté (et la statistique qu'il consomme) ou choisi |
| `src/app/00-format.js` … `03-charts.js` | formats, paramètres, aides DOM, graphiques |
| `src/app/04-pool.js` | calcul en parallèle (workers) |
| `src/app/10-results.js` … `15-inventory.js` | cartes de résultats, synthèse, âge, effet du taux, aperçus, inventaire des paramètres |
| `src/app/20-panel.js`, `99-main.js` | panneau, onglets, lancement |

Le moteur (`src/engine/`) ne touche jamais au DOM : il est aussi exécuté dans les workers et par les tests.

Dans `run()`, les étapes de l'année sont des fonctions internes qui partagent l'état de la simulation (tableaux par ménage, bilans de la banque et de l'État, variables de l'année remises à zéro en tête de boucle). Leur ordre dans la boucle est celui des paiements dans l'année et fixe l'ordre des tirages : le changer change les résultats.

### Règles à respecter

- **Ordre des tirages.** Chaque mécanisme a son générateur : `prng` (population, identique dans les deux scénarios), `rnd` (événements : idées, disparitions), et des générateurs propres pour les entreprises existantes, le travail, la démographie (`dR`), les conjoints (`gS`) et le logement (`gH`). Un nouveau mécanisme prend son propre générateur ; un nouveau tirage dans un générateur existant va en fin de séquence (après `uP` pour `prng`), sinon toute la suite change.
- **Mêmes graines dans les deux scénarios** : c'est ce qui permet de compter les simulations où un écart « va dans le même sens ».
- **Unité monétaire** : une année de niveau de vie médian (`UNIT_EUR` = 25 760 €). Convertir avec `toUnit`.
- **Gains interdits** : partout où de l'argent revient à un détenteur, il est plafonné à sa mise restante (`capped`).

### Recettes

**Ajouter un paramètre** : une clé dans `DEF` et un format dans `FMT` (`app/01-params.js`) ; un curseur dans `page.html` (`id` = clé, sortie `clé_o`) ; si besoin, son affichage dans `syncScopes`. Augmenter `PARAMS_KEY` si les anciens réglages mémorisés ne doivent pas être repris. Toute nouvelle constante de `00-data.js` ou clé de `DEF` s'inscrit dans l'inventaire (`40-inventory.js`) : mesurée, ajustée (avec la statistique qu'elle consomme) ou choisie ; `tests/consistency.js` échoue sinon.

**Ajouter un résultat** : le renvoyer dans `run()` (`10-run.js`, groupé par préfixe) ; l'ajouter dans `20-stats.js` à `SERIES_KEYS` (série annuelle moyennée année par année), à `SUM_KEYS` (nombre moyenné) ou à `PER_RUN` (avec fourchette et robustesse) ; l'afficher dans `app/10-results.js` ou dans la synthèse (`verdictItems`, `app/11-verdict.js`).

**Ajouter une brique** : ses données dans `00-data.js` (avec source) ; sa mécanique dans une étape de l'année de `run()` (une fonction de plus, appelée au bon moment de la boucle) ou, si elle a son propre état, dans un module `engine/0x-….js` qui reçoit le contexte `C` ; un interrupteur dans `DEF` et `SWITCHES` et une configuration `noX` dans `tests/regress.js` ; ses sources et limites dans `page.html` (onglet Hypothèses).

**Recopier une donnée dans `DEF`** : `DEF` reste un objet littéral (les tests le lisent dans la page) ; une valeur sourcée qui y est recopiée est ajoutée à `tests/consistency.js`, qui vérifie qu'elle correspond toujours à `00-data.js`.

### Tests

- `tests/lib.js` : chargement du moteur depuis la page assemblée, commun aux tests et aux outils.
- `tests/regress.js` : 22 configurations × 2 scénarios × 2 graines, toutes les sorties comparées à 1e-8 près ; vérifie aussi que la monnaie est conservée.
- `tests/consistency.js` : les réglages par défaut recopiés des données (`DEF`) correspondent toujours à `00-data.js`, et chaque constante et réglage figure dans l'inventaire des paramètres.
- `tests/ui.py` : charge la page, lance 4 configurations, compare tout le texte affiché et les tracés SVG. `--shots` enregistre des captures des onglets, `--nospace` ignore les espaces.
- `tests/backtest.js` : test de validation 2010 → 2024, **mesure principale de la ressemblance avec la France** : le modèle part des conditions de 2010 et est comparé aux données de 2024 (comptes nationaux en base 2020, Eurostat) ; informatif, lancé par `check.sh`. Les indicateurs **témoins** (`temoin:1` dans `BACKTEST.refs`) sont comptés à part : ils ne servent jamais à choisir ou régler une partie du modèle ; un témoin qui a servi à décider perd ce statut (le noter dans le carnet).
- `tests/score.js` : tableau de bord, départ et fin de simulation comparés à la France d'aujourd'hui ; la fin juge surtout la stabilité sur la durée (informatif, lancé par `check.sh`).
- `tests/perf.js` : temps par simulation selon le nombre de ménages.

Outils d'analyse (informatifs, hors `check.sh`) :

- `tests/tools/traj.js` : trajectoires moyennes de quelques séries (chômage, inflation, taux, déficit, dette, crédits, capital, Gini), pour des réglages et des mondes donnés ; `--backtest` part de 2010.
- `tests/tools/seeds.js` : le tableau de bord (ou, avec `--backtest`, le test 2010 → 2024, témoins à part) sur plusieurs lots de graines, pour juger si un écart entre deux versions dépasse le hasard. Un écart de ±1 indicateur ou de ±0,1 d'écart moyen entre lots est du hasard.
