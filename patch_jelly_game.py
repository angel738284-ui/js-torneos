from pathlib import Path
p=Path('bomba.html');s=p.read_text()
def change(old,new,label):
 global s
 count=s.count(old)
 if count!=1:raise RuntimeError(f'{label}: {count} matches')
 s=s.replace(old,new,1)
start=s.index('<details open class="real3dOptions">')
end=s.index('</details>',start)+len('</details>')
costumes=[
 ('plain','🔴 Clásico'),('dino','🦖 Dinosaurio'),('cat','🐱 Gatito'),('frog','🐸 Ranita'),
 ('chicken','🐥 Pollito'),('bear','🐻 Osito'),('bunny','🐰 Conejito'),
 ('hero','🦸 Héroe'),('office','👔 Oficinista'),('ninja','🥷 Ninja'),
 ('robot','🤖 Robot'),('astronaut','🧑‍🚀 Astronauta')
]
body=[('#f83e50','Rojo'),('#27b9e8','Azul'),('#4acb75','Verde'),('#ffcf45','Amarillo'),
 ('#ff84b6','Rosa'),('#8970e8','Morado'),('#ef8f43','Naranja'),('#2c344e','Negro'),
 ('#eff0e8','Blanco'),('#54d7ca','Turquesa')]
hood=[('#f6c843','Amarillo'),('#f83e50','Rojo'),('#27b9e8','Azul'),('#4acb75','Verde'),
 ('#ff84b6','Rosa'),('#8970e8','Morado'),('#ef8f43','Naranja'),('#2c344e','Negro'),
 ('#eff0e8','Blanco'),('#54d7ca','Turquesa')]
def opts(values):return ''.join(f'<option value="{v}">{name}</option>' for v,name in values)
new='''<details open class="real3dOptions"><summary>🧸 Muñequitos 3D · Disfraces</summary><div class="options">
 <label class="modelChoice">Elegí tu disfraz<select id="costume3d">'''+opts(costumes)+'''</select></label>
 <label>Color del muñeco<select id="bodyColor3d">'''+opts(body)+'''</select></label>
 <label>Color de la capucha<select id="hoodColor3d">'''+opts(hood)+'''</select></label>
 <p class="modelNote">Muñequitos 3D originales de JS Family: ojos blancos, cuerpo de gelatina y disfraces animados. Elegí un jugador y tocá PASAR BOMBA para jugar.</p>
 </div></details>'''
s=s[:start]+new+s[end:]
change('type="importmap">{"imports":{"three":"./bomba3d/vendor/three.module.js"}}</script>\n','', 'remove unused importmap') if False else None
change('<script type="importmap">{"imports":{"three":"./bomba3d/vendor/three.module.js"}}</script>','', 'remove unused importmap')
change('./bomba3d/game.css?v=1','./bomba3d/game.css?v=2','CSS version')
change('./bomba3d/game.js?v=1','./bomba3d/game.js?v=2','JS version')
change('Diseñá tu look · ropa y modelos 3D','Diseñá tu look · 12 disfraces 3D originales','title')
change('AVATAR 3D','MUÑECOS 3D','badge')
change('El 3D utiliza atuendos completos de Quaternius. El editor 2D conserva el resto de las opciones para quienes elijan el modo ligero. Ambos usan el mismo perfil guardado.',
       'Los disfraces, colores, complexión, expresiones, accesorios y poses funcionan en 3D. Los peinados y algunas prendas del editor anterior siguen disponibles únicamente en modo ligero 2D.',
       'editor note')
change('const fields=["gender","body","face","skin","eyes","expression","beard","hair","hairColor","topStyle","shirt","pattern","bottomStyle","pants","shoes","accessory","aura","pose","outfit3d"];',
       'const fields=["gender","body","face","skin","eyes","expression","beard","hair","hairColor","topStyle","shirt","pattern","bottomStyle","pants","shoes","accessory","aura","pose","costume3d","bodyColor3d","hoodColor3d"];',
       'fields schema')
change('outfit3d:"Male/Casual_Hoodie"','costume3d:"plain",bodyColor3d:"#f83e50",hoodColor3d:"#f6c843"','defaults')
start=s.index(' outfit3d:["Male/Adventurer"')
end=s.index('\n};',start)
s=s[:start]+''' costume3d:['''+','.join('"'+k+'"' for k,_ in costumes)+'''],
 bodyColor3d:['''+','.join('"'+k+'"' for k,_ in body)+'''],
 hoodColor3d:['''+','.join('"'+k+'"' for k,_ in hood)+''']'''+s[end:]
change('''  if(!el("outfit3d").value.startsWith(el("gender").value==="woman"?"Female/":"Male/"))
   el("outfit3d").value=el("gender").value==="woman"?"Female/Casual":"Male/Casual_Hoodie";
''','', 'legacy outfit identity cleanup')
change('   el("outfit3d").value=after==="woman"?"Female/Casual":"Male/Casual_Hoodie";\n','', 'legacy gender change')
change(''' for(const k of fields){
  if(k==="gender"||k==="outfit3d")continue;
  el(k).value=allowed[k][Math.floor(Math.random()*allowed[k].length)];
 }
 const opts=allowed.outfit3d.filter(id=>id.startsWith(el("gender").value==="woman"?"Female/":"Male/"));
 el("outfit3d").value=opts[Math.floor(Math.random()*opts.length)];''',
''' for(const k of fields){
  if(k==="gender")continue;
  el(k).value=allowed[k][Math.floor(Math.random()*allowed[k].length)];
 }''','random costume')
change(' el("outfit3d").value=previousGender==="woman"?"Female/Casual":"Male/Casual_Hoodie";\n','','reset costume')
p.write_text(s)
print('JELLY_CHARACTER_EDITOR_PATCH',len(costumes),'COSTUMES',len(fields) if 'fields' in globals() else 'new UI')
