# Test de l'interface : charge la page, attend le calcul, relève textes et tracés, compare à une référence.
# Usage : python3 tests/ui.py <fichier.html> [--save] [--shots]
import asyncio, sys, json, os, hashlib
from playwright.async_api import async_playwright
HERE=os.path.dirname(os.path.abspath(__file__))
JS="""()=>{const pick=s=>[...document.querySelectorAll(s)];
 const txt=e=>e.textContent.replace(/\\s+/g,' ').trim();
 const st=document.getElementById('status');const keep=st.textContent;st.textContent='';
 const r={panel:txt(document.getElementById('panel')),main:txt(document.querySelector('main')),
   paths:pick('main svg path, main svg rect, main svg circle').map(e=>[e.getAttribute('d'),e.getAttribute('x'),e.getAttribute('y'),e.getAttribute('width'),e.getAttribute('height'),e.getAttribute('cx'),e.getAttribute('cy')].join('|'))};
 st.textContent=keep;return r;}"""
async def capture(page, path, cfg):
    html=open(path).read()
    await page.set_content('<!doctype html><html><head><meta charset="utf-8"></head><body>'+html+'</body></html>')
    await page.wait_for_function("document.getElementById('status').textContent.includes('calcul')", timeout=180000)
    out={}
    out['default']=await page.evaluate(JS)
    for name,js in cfg:
        await page.evaluate(js)
        await page.evaluate("async()=>{await launch();}")
        out[name]=await page.evaluate(JS)
    return out
async def main():
    path=sys.argv[1]
    cfg=[('small',"()=>{P.N=200;P.runs=4;sync();}"),('nofirm',"()=>{P.firm=0;sync();}"),('direct',"()=>{P.firm=1;P.bank=0;P.stock=0;sync();}")]
    async with async_playwright() as p:
        b=await p.chromium.launch();pg=await b.new_page(viewport={'width':1280,'height':1400})
        errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        out=await capture(pg,path,cfg)
        if '--shots' in sys.argv:
            for t in ['syn','ineq','fin','hyp']:
                await pg.click(f'button[data-t={t}]');await pg.wait_for_timeout(300)
                await pg.screenshot(path=os.path.join(HERE,f'shot_{t}.png'),full_page=True)
        await b.close()
    if errs: print('ERREURS JS :',errs)
    ref=os.path.join(HERE,'ui_reference.json')
    if '--save' in sys.argv:
        json.dump(out,open(ref,'w'));print('référence UI enregistrée');return
    R=json.load(open(ref));bad=0
    if '--nospace' in sys.argv:
        import re
        sq=lambda t:re.sub(r'[\s\u202f\u00a0]','',t)
        for k in R:
            for part in ['panel','main']:R[k][part]=sq(R[k][part]);out[k][part]=sq(out[k][part])
    for k in R:
        for part in ['panel','main']:
            if R[k][part]!=out[k][part]:
                bad+=1;a,b2=R[k][part],out[k][part];i=next((j for j in range(min(len(a),len(b2))) if a[j]!=b2[j]),min(len(a),len(b2)))
                print(f'≠ {k}/{part} à {i} :\n  avant : …{a[max(0,i-80):i+120]}\n  après : …{b2[max(0,i-80):i+120]}')
        if R[k]['paths']!=out[k]['paths']:
            bad+=1;print(f'≠ {k}/tracés : {len(R[k]["paths"])} → {len(out[k]["paths"])} éléments, {sum(1 for x,y in zip(R[k]["paths"],out[k]["paths"]) if x!=y)} différents')
    print('OK : interface identique' if not bad and not errs else f'ÉCHEC : {bad} différence(s)')
asyncio.run(main())
