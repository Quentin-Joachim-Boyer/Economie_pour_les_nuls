#!/usr/bin/env python3
"""Inverse de build.py : retrouve les sources à partir de la page publiée (python3 split.py page.html [dossier]).
   Utile dans une nouvelle session : lire l'artifact, l'enregistrer, puis le découper ici."""
import os, re, sys
html=open(sys.argv[1]).read();dst=sys.argv[2] if len(sys.argv)>2 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'src')
blocks={'STYLE':re.search(r'<style>\n(.*?)</style>',html,re.S),'ENGINE':re.search(r'<script id="engine">\n(.*?)</script>',html,re.S),'APP':re.search(r'<script>\n(/\* ==== fichier : app/.*?)</script>',html,re.S)}
page=html
for k,m in blocks.items():
    if not m: sys.exit('bloc introuvable : '+k)
    page=page.replace(m.group(1),'{{%s}}'%k,1)
    for part in re.split(r'(?=/\* ==== fichier : )',m.group(1)):
        h=re.match(r'/\* ==== fichier : (.+?) ==== \*/\n',part)
        if not h: continue
        p=os.path.join(dst,h.group(1));os.makedirs(os.path.dirname(p),exist_ok=True);open(p,'w').write(part[h.end():])
open(os.path.join(dst,'page.html'),'w').write(page);print('sources écrites dans',dst)
