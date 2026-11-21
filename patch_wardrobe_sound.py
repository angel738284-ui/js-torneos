from pathlib import Path
root=Path.home()/"js-torneos-pages"
page=root/"bomba.html"
s=page.read_text()
def replace_once(old,new):
 global s
 assert s.count(old)==1, (old[:70],s.count(old))
 s=s.replace(old,new,1)
replace_once('<link rel="stylesheet" href="./bomba3d/game.css?v=5">',
             '<link rel="stylesheet" href="./bomba3d/game.css?v=5">\n<link rel="stylesheet" href="./bomba3d/wardrobe-ui.css?v=1">')
replace_once('<script type="module" src="./bomba3d/game.js?v=11"></script>',
             '<script type="module" src="./bomba3d/game.js?v=12"></script>\n<script defer src="./bomba3d/wardrobe-ui.js?v=1"></script>')
replace_once(' <button type="button" id="bomb3dDemoExplode" hidden disabled>💥 Explotar ahora</button>',
             ' <button type="button" id="bomb3dDemoExplode" hidden disabled>💥 Explotar ahora</button>\n <div class="soundControls"><button type="button" id="bombSoundToggle" aria-pressed="true">🔊 Sonidos activados</button><button type="button" id="openWardrobe">👕 Vestir muñeco</button></div>')
replace_once('<p class="saveStatus">👀 Elegí «Con ropa» para vestirte. También podés dejar el muñeco clásico sin prendas. Los cambios se guardan en tu perfil.</p>\n<div class="customSections">',
             '<p class="saveStatus">👀 Elegí prendas tocando las tarjetas. Podés dejarlo clásico o personalizarlo y guardar tu look.</p>\n<div id="wardrobeCatalog" aria-label="Catálogo de prendas 3D"></div>\n<div class="customSections">')
replace_once(' window.Bomb3D?.syncPreview(avatar);\n}',
             ' window.Bomb3D?.syncPreview(avatar);\n window.JSWardrobe?.sync?.();\n}')
page.write_text(s)
game=root/"bomba3d/game.js"
g=game.read_text()
def rep(old,new):
 global g
 assert g.count(old)==1,(old[:90],g.count(old))
 g=g.replace(old,new,1)
rep('import * as THREE from "./vendor/three.module.js";',
    'import * as THREE from "./vendor/three.module.js";\nimport {createBombSFX} from "./sounds.js?v=1";\nwindow.JSBombSFX=createBombSFX();')
rep(' for(const p of newDeaths){\n  const actor=actors.get(p.id);',
    ' if(newDeaths.length)window.JSBombSFX?.playExplosion?.();\n for(const p of newDeaths){\n  const actor=actors.get(p.id);')
rep(' sender.action="throw";sender.until=now+Math.min(450,flight.duration*.58);',
    ' window.JSBombSFX?.playThrow?.();\n sender.action="throw";sender.until=now+Math.min(450,flight.duration*.58);')
rep('   demoHolder=recipient.playerId;\n   sender.action="throw";',
    '   demoHolder=recipient.playerId;\n   window.JSBombSFX?.playThrow?.();\n   sender.action="throw";')
rep('  window.JSBombDemoExplosion?.(demoVictimId);',
    '  window.JSBombSFX?.playExplosion?.();\n  window.JSBombDemoExplosion?.(demoVictimId);')
rep(' const current=demoHolder||(roomData?.estado==="playing"?roomData.bomba_de:null);\n for(const [id,actor] of actors){',
    ' const current=demoHolder||(roomData?.estado==="playing"?roomData.bomba_de:null);\n window.JSBombSFX?.setFuseActive?.(Boolean(current&&!flight&&!demoExplodedAt),fuseProgress);\n for(const [id,actor] of actors){')
game.write_text(g)
ward=root/"bomba3d/wardrobe-ui.js"
w=ward.read_text()
old=' catalog.classList.add("ready");\n})();'
assert w.count(old)==1
w=w.replace(old,' catalog.classList.add("ready");\n document.getElementById("openWardrobe")?.addEventListener("click",()=>{\n  document.querySelector(".avatarEditor")?.scrollIntoView({behavior:"smooth",block:"start"});\n });\n})();')
ward.write_text(w)
print("OK: wardrobe/sounds integrated in page and game")
