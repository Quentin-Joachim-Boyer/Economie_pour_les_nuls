#!/bin/sh
# Assemble la page (dist/labo-capital.html) puis vérifie que moteur et interface donnent les mêmes résultats que la référence.
# Après un changement voulu des résultats : ./check.sh --save
set -e
cd "$(dirname "$0")"
python3 build.py
node tests/regress.js dist/labo-capital.html $1
python3 tests/ui.py dist/labo-capital.html $1 2>&1 | grep -v 'agent-proxy\|fonts.google\|For details\|While this' || true
# tableau de bord de représentativité (informatif)
node tests/score.js dist/labo-capital.html 2000 8 | tail -1
