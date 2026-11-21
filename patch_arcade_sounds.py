from pathlib import Path
r=Path.home()/"js-torneos-pages"
p=r/"bomba3d/game.js";g=p.read_text()
def rep(old,new):
 global g
 assert g.count(old)==1,(old[:75],g.count(old))
 g=g.replace(old,new,1)
rep('import {createBombSFX} from "./sounds.js?v=1";','import {createBombSFX} from "./sounds.js?v=1";\nimport {createArcadeSFX} from "./arcade-sfx.js?v=1";')
rep('window.JSBombSFX=createBombSFX();','window.JSBombSFX=createBombSFX();\nwindow.JSArcadeSFX=createArcadeSFX();')
rep('if(newDeaths.length)window.JSBombSFX?.playExplosion?.();','if(newDeaths.length){window.JSBombSFX?.playExplosion?.();window.JSArcadeSFX?.explosion?.();}')
rep(' window.JSBombSFX?.playThrow?.();\n sender.action="throw";',' window.JSBombSFX?.playThrow?.();\n window.JSArcadeSFX?.whoosh?.();window.JSArcadeSFX?.grunt?.();\n sender.action="throw";')
rep('   window.JSBombSFX?.playThrow?.();\n   sender.action="throw";','   window.JSBombSFX?.playThrow?.();\n   window.JSArcadeSFX?.whoosh?.();window.JSArcadeSFX?.grunt?.();\n   sender.action="throw";')
rep('  window.JSBombSFX?.playExplosion?.();\n  window.JSBombDemoExplosion?.(demoVictimId);','  window.JSBombSFX?.playExplosion?.();\n  window.JSArcadeSFX?.explosion?.();\n  window.JSBombDemoExplosion?.(demoVictimId);')
rep('  demoChampionId=living[0]?.id||null;','  demoChampionId=living[0]?.id||null;\n  window.JSArcadeSFX?.markWinner?.(demoChampionId);')
rep(' demoRound++;\n const firstIndex=', ' demoRound++;\n window.JSArcadeSFX?.markRound?.("demo-"+demoRound,true);\n const firstIndex=')
rep(' resetDemoVisuals();\n return startDemoRound(performance.now());',' resetDemoVisuals();\n window.JSArcadeSFX?.markWinner?.(null);\n return startDemoRound(performance.now());')
rep(' const current=demoHolder||(roomData?.estado==="playing"?roomData.bomba_de:null);\n window.JSBombSFX?.setFuseActive?.(Boolean(current&&!flight&&!demoExplodedAt),fuseProgress);',
    ' const current=demoHolder||(roomData?.estado==="playing"?roomData.bomba_de:null);\n const activeRound=Boolean(current&&!demoExplodedAt);\n const remainSeconds=demoHolder&&demoFuseDeadlineAt?Math.max(0,(demoFuseDeadlineAt-time)/1000):\n  Math.max(0,(Date.parse(roomData?.vencimiento||0)-(Date.now()+serverClockOffset))/1000);\n const roundKey=demoHolder?"demo-"+demoRound:"real-"+String(roomData?.ronda||0);\n if(!demoHolder)window.JSArcadeSFX?.markRound?.(roundKey,roomData?.estado==="playing"&&activeRound);\n window.JSArcadeSFX?.countdown?.(remainSeconds,activeRound,roundKey);\n window.JSArcadeSFX?.updateMusic?.(activeRound,remainSeconds);\n window.JSBombSFX?.setFuseActive?.(Boolean(current&&!flight&&!demoExplodedAt),fuseProgress);')
rep('  flight=null;\n  projectile.root.visible=false;\n  if(recipient?.bomb', '  flight=null;\n  window.JSArcadeSFX?.catchBomb?.();\n  projectile.root.visible=false;\n  if(recipient?.bomb')
rep('  demoHolder=recipient.playerId;\n   window.JSBombSFX?.playThrow?.();','  demoHolder=recipient.playerId;\n   window.JSBombSFX?.playThrow?.();') if False else None
# Victory from server after state change, but not on every render.
rep('export function onGameTransition(before,after){\n if(!ready||!before||!after)return;',
    'export function onGameTransition(before,after){\n if(!ready||!before||!after)return;\n if(after.estado==="finished"&&after.ganador)window.JSArcadeSFX?.markWinner?.(after.ganador);')
p.write_text(g)
p=r/"bomba.html";h=p.read_text()
old=' <div class="soundControls"><button type="button" id="bombSoundToggle" aria-pressed="true">🔊 Sonidos activados</button><button type="button" id="openWardrobe">👕 Vestir muñeco</button></div>'
assert h.count(old)==1
new=old+'''
 <details id="bombAudioMixer" class="bombAudioMixer"><summary>🎛️ Mezclador de sonido · efectos, música y voces</summary>
 <div class="audioSliders">
 <label>💥 Efectos <output data-level="effects">78%</output><input type="range" data-mix="effects" min="0" max="100" step="1" value="78"></label>
 <label>🎵 Música <output data-level="music">35%</output><input type="range" data-mix="music" min="0" max="100" step="1" value="35"></label>
 <label>🗣️ Voces / esfuerzo <output data-level="voices">45%</output><input type="range" data-mix="voices" min="0" max="100" step="1" value="45"></label>
 <button type="button" id="bombAudioTest">▶ Probar sonidos arcade</button>
 </div></details>'''
h=h.replace(old,new,1)
old='<script type="module" src="./bomba3d/game.js?v=12"></script>'
assert h.count(old)==1;h=h.replace(old,'<script type="module" src="./bomba3d/game.js?v=13"></script>')
old='</style>\n</head>'
assert h.count(old)==1
h=h.replace(old,''' .bombAudioMixer{width:100%;background:#142f43;border:1px solid #3d7794;border-radius:12px;padding:9px 12px;margin:7px 0}
 .bombAudioMixer summary{font-size:12px;font-weight:800;cursor:pointer;min-height:26px}
 .audioSliders{display:grid;gap:10px;padding:12px 3px 3px}
 .audioSliders label{display:grid;grid-template-columns:1fr auto;gap:6px;font-size:12px;font-weight:750}
 .audioSliders output{color:#94ffe2;font-variant-numeric:tabular-nums}
 .audioSliders input{grid-column:1/-1;width:100%;accent-color:#76efcf;min-height:26px}
 .audioSliders button{background:#31577a;min-height:42px}
</style>
</head>''',1)
p.write_text(h)
print("Arcade effects integrated")
