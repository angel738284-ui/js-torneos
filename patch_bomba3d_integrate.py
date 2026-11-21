from pathlib import Path
p=Path('bomba.html');s=p.read_text()
def replace(a,b,tag):
 global s
 count=s.count(a)
 if count!=1:raise RuntimeError(f'{tag}: {count} matches')
 s=s.replace(a,b,1)

outfits={
 'Male':['Adventurer','Beach','Casual_2','Casual_Hoodie','Farmer','King','Punk','Spacesuit','Suit','Swat','Worker'],
 'Female':['Adventurer','Casual','Formal','Medieval','Punk','SciFi','Soldier','Suit','Witch','Worker']
}
labels={'Adventurer':'Aventurero','Beach':'Playa','Casual_2':'Casual','Casual':'Casual','Casual_Hoodie':'Buzo deportivo','Farmer':'Granjero','King':'Rey','Punk':'Punk','Spacesuit':'Astronauta','Suit':'Traje elegante','Swat':'SWAT','Worker':'Trabajador','Formal':'Formal','Medieval':'Medieval','SciFi':'Ciencia ficción','Soldier':'Soldado','Witch':'Bruja'}
items=[f'{g}/{name}' for g,names in outfits.items() for name in names]
options='\n'.join(f' <optgroup label="{"Hombre" if gender=="Male" else "Mujer"}">'+'\n'.join(f'<option value="{gender}/{name}">{labels.get(name,name)}</option>' for name in names)+'</optgroup>' for gender,names in outfits.items())
replace('<link rel="stylesheet" href="./bomba_avatar.css?v=2">',
'''<link rel="stylesheet" href="./bomba_avatar.css?v=2">
<link rel="stylesheet" href="./bomba3d/game.css?v=1">
<script type="importmap">{"imports":{"three":"./bomba3d/vendor/three.module.js"}}</script>
<script type="module" src="./bomba3d/game.js?v=1"></script>''','renderer imports')
replace('<div id="tableStage" class="tableStage" aria-label="Mesa redonda con todos los jugadores">',
'''<div class="bomb3dToolbar">
 <button type="button" id="bomb3dToggle" aria-pressed="false">🎮 Preparando personajes 3D…</button>
 <span id="bomb3dStatus" role="status" aria-live="polite">Los modelos 3D se descargan por atuendo. Si tu celular va lento, usá el modo 2D.</span>
</div>
<div id="tableStage" class="tableStage" aria-label="Mesa redonda con todos los jugadores">''','3d toggle')
replace('Diseñá tu look · 18 rasgos editables','Diseñá tu look · ropa y modelos 3D','editor title')
replace('AVATAR 2.0','AVATAR 3D','editor badge')
replace('<div class="preview" id="preview"></div>',
'<div class="preview" id="preview"><div id="preview2D"></div></div>','studio 2D wrapper')
replace('<div class="customSections">\n <details open>',
'''<div class="customSections">
 <details open class="real3dOptions"><summary>🧍 Atuendo 3D de Quaternius</summary><div class="options">
  <label class="modelChoice">Modelo 3D completo
   <select id="outfit3d">'''+options+'''</select>
  </label>
  <p class="modelNote">Los 21 atuendos son modelos 3D reales, con animaciones. Los colores de piel, pelo y algunas prendas se aplican al 3D. Los peinados y accesorios CSS anteriores siguen disponibles en modo ligero 2D.</p>
 </div></details>
 <details open>''','3d outfit editor')
replace('<div class="editorNote">El estilo de personaje no determina su ropa: podés combinar todas las prendas como quieras.</div>',
'''<div class="editorNote">El 3D utiliza atuendos completos de Quaternius. El editor 2D conserva el resto de las opciones para quienes elijan el modo ligero. Ambos usan el mismo perfil guardado.</div>''','editor note')
replace('"aura","pose"];','"aura","pose","outfit3d"];','fields19')
replace('shoes:"white",accessory:"none",aura:"none",pose:"idle"};',
'shoes:"white",accessory:"none",aura:"none",pose:"idle",outfit3d:"Male/Casual_Hoodie"};','defaults 3d')
replace('aura:["none","cyan","purple","gold","fire","pink"],pose:["idle","wave","confident","dance"]',
'aura:["none","cyan","purple","gold","fire","pink"],pose:["idle","wave","confident","dance"],\n outfit3d:'+str(items).replace("'",'"'),'whitelist 3d')
replace('  if(before!==after){\n   if(after==="woman"&&el("hair").value==="spiky")',
'''  if(before!==after){
   el("outfit3d").value=after==="woman"?"Female/Casual":"Male/Casual_Hoodie";
   if(after==="woman"&&el("hair").value==="spiky")''','gender changes outfit')
replace('function preview(){el("preview").replaceChildren(buildAvatar(Object.fromEntries(fields.map(k=>[k,el(k).value]))));}',
'''function preview(){
 const avatar=Object.fromEntries(fields.map(k=>[k,el(k).value]));
 el("preview2D").replaceChildren(buildAvatar(avatar));
 window.Bomb3D?.syncPreview(avatar);
}''','3d live preview')
replace(' renderEvents();\n const center=el("tableCenterName");',
''' renderEvents();
 window.Bomb3D?.syncRoom(room);
 const center=el("tableCenterName");''','3d table sync')
replace('  animateGameChanges(before,result);',
'''  animateGameChanges(before,result);
  window.Bomb3D?.onGameTransition(before,result);''','3d game effects')
replace(' const previousGender=el("gender").value;\n for(const k of fields)el(k).value=defaults[k];\n el("gender").value=previousGender;',
''' const previousGender=el("gender").value;
 for(const k of fields)el(k).value=defaults[k];
 el("gender").value=previousGender;
 el("outfit3d").value=previousGender==="woman"?"Female/Casual":"Male/Casual_Hoodie";''','reset model match')
replace(' for(const k of fields){if(k!=="gender")el(k).value=allowed[k][Math.floor(Math.random()*allowed[k].length)];}',
''' for(const k of fields){
  if(k==="gender"||k==="outfit3d")continue;
  el(k).value=allowed[k][Math.floor(Math.random()*allowed[k].length)];
 }
 const opts=allowed.outfit3d.filter(id=>id.startsWith(el("gender").value==="woman"?"Female/":"Male/"));
 el("outfit3d").value=opts[Math.floor(Math.random()*opts.length)];''','random outfit')
p.write_text(s)
print("3D_EDITOR_PATCH_OK",len(items),"OUTFITS",len(s),"HTML_BYTES")
