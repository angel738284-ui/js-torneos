from pathlib import Path
p=Path("bomba.html")
s=p.read_text()
def change(old,new,tag):
 global s
 count=s.count(old)
 if count!=1:raise RuntimeError(f"{tag}: got {count} matches")
 s=s.replace(old,new,1)
change('<script src="./config.js"></script>',
 '<link rel="stylesheet" href="./bomba_avatar.css?v=2">\n<script src="./config.js"></script>',"css import")
start=s.index('<section class="panel controls"><div class="editorHeader">')
end=s.index('</section>\n<section class="panel"><h2>📣 Lo que está pasando',start)
new='''<section class="panel controls avatarEditor">
<div class="avatarHero"><div><h2>🎨 Creador de personajes</h2>
<small>Diseñá tu look · 18 rasgos editables</small></div><span class="edition">AVATAR 2.0</span></div>
<div class="editorHeader"><strong>Elegí tu personaje</strong><span id="yourName" class="muted small">Espectador</span></div>
<div class="avatarGender" aria-label="Estilo del personaje">
 <button type="button" data-avatar-gender="man" aria-pressed="true">🧑 Hombre</button>
 <button type="button" data-avatar-gender="woman" aria-pressed="false">👩 Mujer</button>
</div>
<select id="gender" hidden><option value="man">Hombre</option><option value="woman">Mujer</option></select>
<div class="preview" id="preview"></div>
<p class="saveStatus">✨ Tus cambios se muestran en la vista previa. Guardalos para que aparezcan en la mesa.</p>
<div class="customSections">
 <details open><summary>🧍 Rostro y cuerpo</summary><div class="options">
  <label>Complexión<select id="body"><option value="regular">Normal</option><option value="slim">Delgado</option><option value="athletic">Atlético</option></select></label>
  <label>Forma de cara<select id="face"><option value="soft">Suave</option><option value="round">Redonda</option><option value="sharp">Angulosa</option></select></label>
  <label>Tono de piel<select id="skin"><option value="#f6d5b2">Clara</option><option value="#eac49b">Media clara</option><option value="#b87a5b">Canela</option><option value="#855036">Oscura</option><option value="#ffe0c6">Rosada</option><option value="#cd916f">Bronceada</option></select></label>
  <label>Color de ojos<select id="eyes"><option value="brown">Café</option><option value="blue">Azules</option><option value="green">Verdes</option><option value="violet">Violetas</option><option value="grey">Grises</option></select></label>
  <label>Expresión<select id="expression"><option value="smile">Sonrisa</option><option value="confident">Sonrisa pícara</option><option value="serious">Serio</option><option value="wink">Guiño</option><option value="happy">Feliz</option></select></label>
  <label>Barba / bigote<select id="beard"><option value="none">Sin barba</option><option value="stubble">Barba corta</option><option value="mustache">Bigote</option><option value="full">Barba completa</option></select></label>
 </div></details>
 <details open><summary>💇 Cabello</summary><div class="options">
  <label>Peinado<select id="hair"><option value="spiky">Puntas</option><option value="short">Corto</option><option value="long">Largo</option><option value="mohawk">Cresta</option><option value="bob">Carré</option><option value="curly">Rulos</option><option value="ponytail">Cola de caballo</option><option value="braids">Trenzas</option><option value="fade">Degradado</option><option value="waves">Ondulado</option><option value="bun">Rodete</option><option value="bangs">Flequillo</option></select></label>
  <label>Color de pelo<select id="hairColor"><option value="#262333">Negro</option><option value="#784c32">Castaño</option><option value="#f4d76b">Rubio</option><option value="#d84461">Rojo</option><option value="#d8ecf1">Blanco</option><option value="#5e58d2">Morado</option><option value="#34b7bb">Turquesa</option><option value="#f4a3c3">Rosa pastel</option><option value="#b76b33">Cobrizo</option></select></label>
 </div></details>
 <details><summary>👕 Ropa y zapatillas</summary><div class="options">
  <label>Prenda superior<select id="topStyle"><option value="tee">Remera</option><option value="hoodie">Buzo con capucha</option><option value="jacket">Campera</option><option value="jersey">Camiseta deportiva</option><option value="dress">Vestido</option><option value="crop">Top corto</option></select></label>
  <label>Color de ropa<select id="shirt"><option value="#775de6">Violeta</option><option value="#e7476f">Rosa</option><option value="#1eacc4">Turquesa</option><option value="#2eae77">Verde</option><option value="#ebba52">Amarillo</option><option value="#151b2b">Negro</option><option value="#f5f3ed">Blanco</option><option value="#ef793d">Naranja</option></select></label>
  <label>Estampado<select id="pattern"><option value="plain">Liso</option><option value="stripes">Rayas</option><option value="star">Estrella</option><option value="number">Número 456</option><option value="bolt">Rayo</option><option value="heart">Corazón</option></select></label>
  <label>Prenda inferior<select id="bottomStyle"><option value="pants">Pantalón</option><option value="cargo">Cargo</option><option value="shorts">Short</option><option value="skirt">Pollera</option><option value="jeans">Jeans</option></select></label>
  <label>Color de pantalón<select id="pants"><option value="#273751">Azul oscuro</option><option value="#181d29">Negro</option><option value="#a5acb8">Gris</option><option value="#824b62">Bordó</option><option value="#426b75">Azul petróleo</option><option value="#e5c4a5">Beige</option></select></label>
  <label>Zapatillas<select id="shoes"><option value="white">Blancas</option><option value="black">Negras</option><option value="red">Rojas</option><option value="gold">Doradas</option><option value="neon">Neón</option><option value="pink">Rosas</option></select></label>
 </div></details>
 <details><summary>✨ Accesorios y efectos</summary><div class="options">
  <label>Accesorio<select id="accessory"><option value="none">Ninguno</option><option value="glasses">Anteojos</option><option value="crown">Corona</option><option value="mask">Máscara</option><option value="cap">Gorra</option><option value="headphones">Auriculares</option><option value="earrings">Aros</option><option value="bandana">Vincha</option><option value="horns">Cuernos</option></select></label>
  <label>Aura<select id="aura"><option value="none">Sin aura</option><option value="cyan">Cian</option><option value="purple">Violeta</option><option value="gold">Dorada</option><option value="fire">Fuego</option><option value="pink">Rosa</option></select></label>
  <label>Pose<select id="pose"><option value="idle">Normal</option><option value="wave">Saludar</option><option value="confident">Fachero</option><option value="dance">Bailar</option></select></label>
 </div></details>
</div>
<button id="save" class="primary" type="button" disabled>💾 Guardar mi personaje</button>
<div id="notice" role="status">Para editar, abrí tu enlace personal enviado por JS Guardian.</div>
<div class="editorNote">El estilo de personaje no determina su ropa: podés combinar todas las prendas como quieras.</div>
</section>
'''
s=s[:start]+new+s[end:]
# Remove closing </section> from the original segment preserved on the right.
right_anchor='</section>\n<section class="panel"><h2>📣 Lo que está pasando'
assert s.count(right_anchor)==1
s=s.replace(right_anchor,'<section class="panel"><h2>📣 Lo que está pasando',1)

# Expand the avatar field validation on client, matching the backend exactly.
a=s.index('const fields=[');b=s.index('\nlet room=',a)
new_fields='''const fields=["gender","body","face","skin","eyes","expression","beard","hair","hairColor","topStyle","shirt","pattern","bottomStyle","pants","shoes","accessory","aura","pose"];
const defaults={gender:"man",body:"regular",face:"soft",skin:"#eac49b",
 eyes:"brown",expression:"smile",beard:"none",hair:"spiky",hairColor:"#262333",
 topStyle:"tee",shirt:"#775de6",pattern:"plain",bottomStyle:"pants",pants:"#273751",
 shoes:"white",accessory:"none",aura:"none",pose:"idle"};
const allowed={
 gender:["man","woman"],body:["regular","slim","athletic"],face:["soft","round","sharp"],
 skin:["#f6d5b2","#eac49b","#b87a5b","#855036","#ffe0c6","#cd916f"],
 eyes:["brown","blue","green","violet","grey"],
 expression:["smile","confident","serious","wink","happy"],
 beard:["none","stubble","mustache","full"],
 hair:["spiky","short","long","mohawk","bob","curly","ponytail","braids","fade","waves","bun","bangs"],
 hairColor:["#262333","#784c32","#f4d76b","#d84461","#d8ecf1","#5e58d2","#34b7bb","#f4a3c3","#b76b33"],
 topStyle:["tee","hoodie","jacket","jersey","dress","crop"],
 shirt:["#775de6","#e7476f","#1eacc4","#2eae77","#ebba52","#151b2b","#f5f3ed","#ef793d"],
 pattern:["plain","stripes","star","number","bolt","heart"],
 bottomStyle:["pants","cargo","shorts","skirt","jeans"],
 pants:["#273751","#181d29","#a5acb8","#824b62","#426b75","#e5c4a5"],
 shoes:["white","black","red","gold","neon","pink"],
 accessory:["none","glasses","crown","mask","cap","headphones","earrings","bandana","horns"],
 aura:["none","cyan","purple","gold","fire","pink"],pose:["idle","wave","confident","dance"]
};
const shoeColor={white:"#f5f5ff",black:"#252b3f",red:"#ff6275",gold:"#f4d57a",neon:"#75f8d5",pink:"#ffa6db"};
const eyeColor={brown:"#674a3d",blue:"#42a0e5",green:"#56ac80",violet:"#a278db",grey:"#8996ab"};'''
s=s[:a]+new_fields+s[b:]
a=s.index('function buildAvatar(value){');b=s.index('function showError(message){',a)
new_builder='''function buildAvatar(value){
 const a=avatarSafe(value),root=document.createElement("div");
 root.className="char";
 for(const prop of ["gender","body","face","expression","beard","hair","topStyle","pattern","bottomStyle","accessory","aura","pose"])
  root.dataset[prop==="topStyle"?"topStyle":prop==="bottomStyle"?"bottomStyle":prop]=a[prop];
 root.style.setProperty("--skin",a.skin);root.style.setProperty("--hair",a.hairColor);
 root.style.setProperty("--shirt",a.shirt);root.style.setProperty("--pants",a.pants);
 root.style.setProperty("--iris",eyeColor[a.eyes]||eyeColor.brown);
 root.style.setProperty("--shoe",shoeColor[a.shoes]||shoeColor.white);
 for(const name of ["auraRing","shadow","hairBack","hairTail","legs","bottomOverlay","shoeL","shoeR",
  "armL","armR","handL","handR","torso","topDetail","neck","earL","earR",
  "head","brows","eyes","eyeSparkle","nose","cheeks","smile","beard",
  "hair","glasses","mask","crown","earrings","cap","headphones","bandana","horns"]){
  const part=document.createElement("i");part.className=name;root.append(part);
 }
 const bomb=document.createElement("span");bomb.className="held-bomb";
 bomb.textContent="💣";root.append(bomb);
 return root;
}
'''
s=s[:a]+new_builder+s[b:]

# Synchronize visible gender buttons with the hidden backend field.
a='  el("save").disabled=false;preview();'
assert s.count(a)==1;s=s.replace(a,'  el("save").disabled=false;updateGenderButtons();preview();',1)
a='function preview(){el("preview").replaceChildren(buildAvatar(Object.fromEntries(fields.map(k=>[k,el(k).value]))));}'
b='''function updateGenderButtons(){
 for(const choice of document.querySelectorAll("[data-avatar-gender]")){
  choice.setAttribute("aria-pressed",String(choice.dataset.avatarGender===el("gender").value));
 }
}
for(const choice of document.querySelectorAll("[data-avatar-gender]")){
 choice.addEventListener("click",()=>{
  const before=el("gender").value,after=choice.dataset.avatarGender;
  if(!allowed.gender.includes(after))return;
  el("gender").value=after;
  if(before!==after){
   if(after==="woman"&&el("hair").value==="spiky")el("hair").value="ponytail";
   if(after==="man"&&el("hair").value==="ponytail")el("hair").value="short";
  }
  updateGenderButtons();preview();
 });
}
function preview(){el("preview").replaceChildren(buildAvatar(Object.fromEntries(fields.map(k=>[k,el(k).value]))));}'''
assert s.count(a)==1;s=s.replace(a,b,1)
# Existing preview() call remains and uses the 18 updated fields.
p.write_text(s)
print("BOMBA_AVATAR_18_FIELDS_READY",len(s),"HTML")
