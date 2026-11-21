from pathlib import Path
p=Path.home()/"js-torneos-pages/bomba.html"
s=p.read_text()
s=s.replace('<div id="content" class="mainGrid" hidden>','''<nav id="bombaMainMenu" class="bombaMainMenu" aria-label="Menú del juego" hidden>
 <button id="menuPlay" type="button" class="active" aria-pressed="true">🎮 Jugar</button>
 <button id="menuDress" type="button" aria-pressed="false">👕 Vestirse</button>
</nav>
<div id="content" class="mainGrid" hidden>''',1)
s=s.replace('<section class="panel arena">','<section class="panel arena" id="bombaGamePanel">',1)
s=s.replace('<section class="panel controls avatarEditor">','<section class="panel controls avatarEditor" id="bombaDressPanel" hidden>',1)
s=s.replace('<section class="panel"><h2>📣 Lo que está pasando</h2>','<section class="panel" id="bombaEventsPanel" hidden><h2>📣 Lo que está pasando</h2>',1)
s=s.replace(' <div class="soundControls"><button type="button" id="bombSoundToggle" aria-pressed="true">🔊 Sonidos activados</button><button type="button" id="openWardrobe">👕 Vestir muñeco</button></div>',
''' <div class="soundControls"><button type="button" id="bombSoundToggle" aria-pressed="true">🔊 Sonidos activados</button><button type="button" id="openWardrobe">👕 Vestirse</button></div>''',1)
anchor='<script>\n"use strict";'
assert s.count(anchor)==1
s=s.replace(anchor,'''<script>
(function(){
 "use strict";
 const byId=id=>document.getElementById(id);
 let current="play";
 function show(tab){
  current=tab==="dress"?"dress":"play";
  const dressing=current==="dress";
  byId("bombaGamePanel").hidden=dressing;
  byId("bombaDressPanel").hidden=!dressing;
  byId("bombaEventsPanel").hidden=true;
  byId("menuPlay").classList.toggle("active",!dressing);
  byId("menuDress").classList.toggle("active",dressing);
  byId("menuPlay").setAttribute("aria-pressed",String(!dressing));
  byId("menuDress").setAttribute("aria-pressed",String(dressing));
  if(dressing)window.JSWardrobe?.sync?.();
  byId("bombaMainMenu").scrollIntoView({behavior:"smooth",block:"start"});
 }
 byId("menuPlay").addEventListener("click",()=>show("play"));
 byId("menuDress").addEventListener("click",()=>show("dress"));
 byId("openWardrobe").addEventListener("click",()=>show("dress"));
 window.JSBombaShowMenu=show;
 const observer=new MutationObserver(()=>{
  byId("bombaMainMenu").hidden=byId("content").hidden;
 });
 observer.observe(byId("content"),{attributes:true,attributeFilter:["hidden"]});
})();
</script>
<script>
"use strict";''',1)
anchor=' .bombAudioMixer{width:100%;'
assert s.count(anchor)==1
s=s.replace(anchor,''' [hidden]{display:none!important}
 .bombaMainMenu{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 12px;position:sticky;top:4px;z-index:35;padding:8px;background:#0c2035ed;border:1px solid #34516c;border-radius:18px;backdrop-filter:blur(8px)}
 .bombaMainMenu button{min-height:56px;border:1px solid #456783;border-radius:12px;background:#22374e;color:#e7f3ff;font-size:18px;font-weight:800}
 .bombaMainMenu button.active{background:linear-gradient(110deg,#167b78,#4e508c);border-color:#75e4c9;box-shadow:0 0 0 1px #75e4c955}
 .mainGrid{display:block}
 .mainGrid>.arena,.mainGrid>.sidebar{width:100%;min-width:0}
 .mainGrid>.sidebar{display:block}
 .mainGrid>.sidebar>.panel{margin-bottom:10px}
 .hero{padding-bottom:8px}
 .hero p{display:none}
 .avatarEditor{max-width:780px;margin-inline:auto}
 .avatarEditor .editorNote{display:none}
 .bomb3dToolbar .soundControls #openWardrobe{display:none}
 .bombAudioMixer{width:100%;''',1)
# Avoid old wardrobe scroll action (menu switch takes precedence).
p.write_text(s)
print("Simple two-tab game/wardrobe interface ready")
