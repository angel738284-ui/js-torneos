from pathlib import Path
p=Path("bomba.html")
s=p.read_text()
def replace(old,new,label):
 global s
 n=s.count(old)
 if n!=1:raise RuntimeError(f"{label}: {n} matches")
 s=s.replace(old,new,1)
start=s.index('<section class="panel controls avatarEditor">')
end=s.index('</section>',start)+len('</section>')
old=s[start:end]
import re
fields=["gender","body","face","skin","eyes","expression","beard","hair","hairColor","topStyle","shirt","pattern","bottomStyle","pants","shoes","accessory","aura","pose","costume3d","bodyColor3d","hoodColor3d"]
select={}
for k in fields:
 m=re.search(r'<select id="'+k+r'"(?: hidden)?>(.*?)</select>',old,flags=re.S)
 if not m:raise RuntimeError("missing select "+k)
 select[k]='<select id="'+k+'">'+m.group(1)+'</select>'
label=lambda field,title:'<label>'+title+select[field]+'</label>'
hidden=[k for k in fields if k not in ["bodyColor3d","topStyle","shirt","pattern","bottomStyle","pants","shoes","accessory","aura","pose"]]
editor='''<section class="panel controls avatarEditor">
<div class="avatarHero"><div><h2>🎨 Vestidor de muñequitos 3D</h2>
<small>Un solo modelo GLB · armá tu ropa y accesorios</small></div><span class="edition">3D</span></div>
<div class="editorHeader"><strong>Tu estilo</strong><span id="yourName" class="muted small">Espectador</span></div>
<div class="preview" id="preview"><div class="previewWaiting" id="previewWaiting">Cargando vista previa 3D…</div></div>
<div class="avatarTools"><button type="button" id="avatarRandom">🎲 Look aleatorio</button><button type="button" id="avatarReset">↺ Reiniciar</button></div>
<p class="saveStatus">👀 Probá ropa y accesorios: los cambios aparecen al instante. Guardalos para que todos los vean en la mesa.</p>
<div class="customSections">
<details open class="real3dOptions"><summary>🎨 Color de la piel de goma</summary><div class="options">
'''+label("bodyColor3d","Color del muñeco")+'''
</div></details>
<details open><summary>👕 Ropa superior</summary><div class="options">
'''+label("topStyle","Tipo de prenda")+label("shirt","Color de la ropa")+label("pattern","Estampado")+'''
</div></details>
<details open><summary>👖 Pantalones y zapatillas</summary><div class="options">
'''+label("bottomStyle","Prenda inferior")+label("pants","Color del pantalón")+label("shoes","Color de las zapatillas")+'''
</div></details>
<details open><summary>👑 Accesorios y animación</summary><div class="options">
'''+label("accessory","Accesorio 3D")+label("aura","Efecto de aura")+label("pose","Pose del personaje")+'''
</div></details>
</div>
<div id="legacyAvatarValues" hidden aria-hidden="true">
'''+''.join(select[k] for k in hidden)+'''
</div>
<button id="save" class="primary" type="button" disabled>💾 Guardar mi look 3D</button>
<div id="notice" role="status">Para guardar tu look, abrí tu enlace personal de JS Guardian.</div>
<div class="editorNote">Todos usan el mismo muñeco GLB que elegiste. La ropa y los accesorios se construyen en 3D para este modelo. Las opciones antiguas quedan guardadas, pero ya no se muestran.</div>
</section>'''
s=s[:start]+editor+s[end:]
replace('''<div class="bomb3dToolbar">
 <button type="button" id="bomb3dToggle" aria-pressed="false">🎮 Preparando personajes 3D…</button>
 <span id="bomb3dStatus" role="status" aria-live="polite">El muñeco clásico usa tu GLB original. Los disfraces siguen disponibles; si tu celular va lento, usá 2D.</span>
</div>''',
'''<div class="bomb3dToolbar">
 <span id="bomb3dStatus" role="status" aria-live="polite">⏳ Cargando personajes GLB y ropa 3D…</span>
</div>''',"remove 2d switch")
replace('<link rel="stylesheet" href="./bomba_avatar.css?v=2">\n','',"remove legacy css")
replace('./bomba3d/game.css?v=2','./bomba3d/game.css?v=3','css new')
replace('./bomba3d/game.js?v=5','./bomba3d/game.js?v=6','new renderer version')
replace('const avatar=buildAvatar(p.avatar);',
'''const avatar=document.createElement("span");
  avatar.className="modelSpace";avatar.setAttribute("aria-hidden","true");''',"3d-only player")
# Classic CSS avatar generator and old gender buttons no longer exist.
beg=s.index('function buildAvatar(value){')
fin=s.index('function showError(message){',beg)
s=s[:beg]+s[fin:]
beg=s.index('function updateGenderButtons(){')
fin=s.index('function preview(){',beg)
s=s[:beg]+s[fin:]
replace('el("save").disabled=false;updateGenderButtons();preview();','el("save").disabled=false;preview();',"identity preview")
replace(''' el("preview2D").replaceChildren(buildAvatar(avatar));
 window.Bomb3D?.syncPreview(avatar);''',
''' window.Bomb3D?.syncPreview(avatar);''',"3d-only preview")
# Random and reset must only adjust wardrobe, not legacy hidden settings.
beg=s.index('el("avatarRandom").addEventListener("click",()=>{')
fin=s.index('preview();\nasync function save(){',beg)
s=s[:beg]+'''const wardrobeFields=["bodyColor3d","topStyle","shirt","pattern","bottomStyle","pants","shoes","accessory","aura","pose"];
el("avatarRandom").addEventListener("click",()=>{
 for(const k of wardrobeFields)el(k).value=allowed[k][Math.floor(Math.random()*allowed[k].length)];
 preview();notice("🎲 Look 3D generado. Tocá Guardar para conservarlo.");
});
el("avatarReset").addEventListener("click",()=>{
 for(const k of wardrobeFields)el(k).value=defaults[k];
 preview();notice("↺ Look 3D reiniciado. Guardalo para aplicar los cambios.");
});
'''+s[fin:]
p.write_text(s)
print("3D_ONLY_EDITOR_BUILT",len(editor),"bytes",len(fields),"preserved allowed fields",len(hidden),"legacy values hidden")
