# Consignes pour Claude

- Projet en français, pour comprendre l'économie par l'expérience de pensée « gains libres / gains interdits ». L'avis de l'utilisateur compte moins que les données : chaque hypothèse doit être calée sur des données françaises ou la littérature, avec sa source dans `src/engine/00-data.js` et dans l'onglet Hypothèses (`src/page.html`).
- Les deux scénarios évoluent toujours en parallèle : chaque brique s'applique aux deux.
- Lire `README.md` (structure, règles, recettes). Avant de livrer : `./check.sh`. Un nettoyage ne change aucun résultat ; un changement de modèle se vérifie, puis `./check.sh --save`.
- Ne jamais changer l'ordre des tirages aléatoires existants : ajouter les nouveaux tirages en fin de séquence.
- La page est aussi publiée comme artifact claude.ai (https://claude.ai/artifact/6Ff98oVmvRCyMk6NvzVFMc) : la republier depuis `dist/labo-capital.html` après chaque étape.
- Un carnet d'idées (document Claude Docs du projet « Economie pour les nuls ») garde la trace des choix et constats : y ajouter une section à chaque brique.
- Préférer les résultats visuels aux suites de chiffres ; demander avant les choix de modélisation qui reviennent à l'utilisateur.
