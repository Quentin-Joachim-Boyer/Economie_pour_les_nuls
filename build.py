#!/usr/bin/env python3
"""Assemble la page unique à partir des sources (python3 build.py [sortie.html]).
   src/page.html   gabarit (balisage), avec {{STYLE}}, {{ENGINE}}, {{APP}}
   src/style.css   styles
   src/engine/*.js moteur de simulation (aussi exécuté dans les workers : aucune dépendance au DOM)
   src/app/*.js    interface
   Fichiers concaténés par ordre alphabétique (préfixes numériques). Chaque fichier est précédé d'un repère
   « ==== fichier : … ==== » qui permet à split.py de retrouver les sources à partir de la page publiée."""
import os, glob, sys
ROOT=os.path.dirname(os.path.abspath(__file__))
SRC=os.path.join(ROOT,'src')
def mark(rel): return f'/* ==== fichier : {rel} ==== */\n'
def cat(d): return ''.join(mark(f'{d}/{os.path.basename(f)}')+open(f).read().rstrip('\n')+'\n' for f in sorted(glob.glob(os.path.join(SRC,d,'*.js'))))
page=open(os.path.join(SRC,'page.html')).read()
out=(page.replace('{{STYLE}}',mark('style.css')+open(os.path.join(SRC,'style.css')).read())
         .replace('{{ENGINE}}',cat('engine')).replace('{{APP}}',cat('app')))
dst=sys.argv[1] if len(sys.argv)>1 else os.path.join(ROOT,'dist','labo-capital.html')
open(dst,'w').write(out);print('écrit',dst,len(out),'octets')
