from pathlib import Path
p=Path("bomba3d/wardrobe.js");s=p.read_text()
a=' const style=a.topStyle||"tee";'
assert s.count(a)==1
s=s.replace(a,' if(a.wear3d==="yes"){\n'+a,1)
a=' return {\n  group,\n  update:'
assert s.count(a)==1
s=s.replace(a,' }\n'+a,1)
p.write_text(s)
p=Path("bomba.html");s=p.read_text()
a='const fields=["gender","body","face","skin","eyes","expression","beard","hair","hairColor","topStyle","shirt","pattern","bottomStyle","pants","shoes","accessory","aura","pose","costume3d","bodyColor3d","hoodColor3d"];'
assert s.count(a)==1;s=s.replace(a,a.replace('"hoodColor3d"]','"hoodColor3d","wear3d"]'),1)
a='shoes:"white",accessory:"none",aura:"none",pose:"idle",costume3d:"plain",bodyColor3d:"#f83e50",hoodColor3d:"#f6c843"};'
assert s.count(a)==1;s=s.replace(a,a.replace('hoodColor3d:"#f6c843"','hoodColor3d:"#f6c843",wear3d:"no"'),1)
a='hoodColor3d:["#f6c843","#f83e50","#27b9e8","#4acb75","#ff84b6","#8970e8","#ef8f43","#2c344e","#eff0e8","#54d7ca"]'
assert s.count(a)==1;s=s.replace(a,a+',wear3d:["no","yes"]',1)
a='<details open class="real3dOptions"><summary>🎨 Color de la piel de goma</summary><div class="options">'
b='''<details open class="real3dOptions"><summary>🎮 Muñeco clásico o personalizado</summary><div class="options">
<label>Vestimenta 3D<select id="wear3d"><option value="no">🔴 Clásico, sin ropa</option><option value="yes">👕 Con ropa y accesorios 3D</option></select></label>'''
assert s.count(a)==1;s=s.replace(a,b,1)
a='const wardrobeFields=["bodyColor3d","topStyle","shirt","pattern","bottomStyle","pants","shoes","accessory","aura","pose"];'
assert s.count(a)==1;s=s.replace(a,a.replace('"bodyColor3d",','"wear3d","bodyColor3d",'),1)
a=' for(const k of wardrobeFields)el(k).value=allowed[k][Math.floor(Math.random()*allowed[k].length)];\n preview();notice('
b=' for(const k of wardrobeFields)el(k).value=allowed[k][Math.floor(Math.random()*allowed[k].length)];\n el("wear3d").value="yes";\n preview();notice('
assert s.count(a)==1;s=s.replace(a,b,1)
a='👀 Probá ropa y accesorios: los cambios aparecen al instante. Guardalos para que todos los vean en la mesa.'
assert s.count(a)==1;s=s.replace(a,'👀 Elegí «Con ropa» para vestirte. También podés dejar el muñeco clásico sin prendas. Los cambios se guardan en tu perfil.',1)
p.write_text(s)
print("3D_WARDROBE_CLOTHING_ENABLED_ONLY_WHEN_OPTED_IN")
