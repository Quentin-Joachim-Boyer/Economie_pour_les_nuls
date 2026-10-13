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
| `src/engine/10-run.js` | une simulation, année par année ; diagnostics |
| `src/engine/20-stats.js` | équité, quintiles, Atkinson, agrégation des simulations |
| `src/app/00-format.js` … `03-charts.js` | formats, paramètres, aides DOM, graphiques |
| `src/app/04-pool.js` | calcul en parallèle (workers) |
| `src/app/10-results.js` … `14-previews.js` | cartes de résultats, synthèse, âge, effet du taux, aperçus |
| `src/app/20-panel.js`, `99-main.js` | panneau, onglets, lancement |

Le moteur (`src/engine/`) ne touche jamais au DOM : il est aussi exécuté dans les workers et par les tests.

### Règles à respecter

- **Ordre des tirages.** Deux générateurs par simulation : `prng` (population, identique dans les deux scénarios) et `rnd` (événements). Ajouter un tirage `prng` en fin de séquence (après `uP` dans la participation), sinon toute la population change. Les entreprises existantes ont leur propre générateur.
- **Mêmes graines dans les deux scénarios** : c'est ce qui permet de compter les simulations où un écart « va dans le même sens ».
- **Unité monétaire** : une année de niveau de vie médian (`UNIT_EUR` = 25 760 €). Convertir avec `toUnit`.
- **Gains interdits** : partout où de l'argent revient à un détenteur, il est plafonné à sa mise restante (`capped`).

### Recettes

**Ajouter un paramètre** : une clé dans `DEF` et un format dans `FMT` (`app/01-params.js`) ; un curseur dans `page.html` (`id` = clé, sortie `clé_o`) ; si besoin, son affichage dans `syncScopes`. Augmenter `PARAMS_KEY` si les anciens réglages mémorisés ne doivent pas être repris.

**Ajouter un résultat** : le renvoyer dans `run()` (`10-run.js`) ; l'ajouter à `SUM_KEYS` (moyenne sur les simulations) ou à `PER_RUN` (avec fourchette et robustesse) dans `20-stats.js` ; l'afficher dans `app/10-results.js` ou dans la synthèse (`verdictItems`, `app/11-verdict.js`).

**Ajouter une brique** : ses données dans `00-data.js` (avec source), sa mécanique dans un module `engine/0x-….js` qui reçoit le contexte `C`, son appel au bon moment de l'année dans `run()`, un interrupteur dans `SWITCHES`, ses sources et limites dans `page.html`.

### Tests

- `tests/regress.js` : 14 configurations × 2 scénarios × 2 graines, toutes les sorties comparées à 1e-8 près.
- `tests/ui.py` : charge la page, lance 4 configurations, compare tout le texte affiché et les tracés SVG. `--shots` enregistre des captures des onglets, `--nospace` ignore les espaces.
- `tests/perf.js` : temps par simulation selon le nombre de ménages.
