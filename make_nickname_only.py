from pathlib import Path
root=Path.home()/'js-torneos-pages'
for name in ('inscripcion-web-form.js','inscripcion.js'):
 p=root/name
 s=p.read_text()
 old='''      const detected=String(data.region||"").trim().toUpperCase();
      const allowed=String(tournament?.allowed_region||"SAC").trim().toUpperCase();
      if(!detected||detected!==allowed||data.eligible===false){
        throw new Error("❌ No podés participar: este torneo solo acepta región "+allowed+". Tu ID es "+(detected||"desconocida")+".");
      }
      state.verified={id,nickname:data.nickname,region:detected};'''
 new='''      // La inscripción solo requiere un apodo de Free Fire realmente verificado.
      // La región puede ser desconocida y no es requisito ni se muestra al jugador.
      if(data.eligible===false)throw new Error("Este ID no está habilitado para inscribirse.");
      state.verified={id,nickname:data.nickname,region:String(data.region||"PENDIENTE").trim().toUpperCase()||"PENDIENTE"};'''
 assert s.count(old)==1,(name,"verify count",s.count(old))
 s=s.replace(old,new)
 old='status.textContent="✓ "+data.nickname+" · "+id+" · "+state.verified.region;'
 assert s.count(old)==1
 s=s.replace(old,'status.textContent="✓ Apodo verificado: "+data.nickname+" · ID "+id;')
 old='''  $("regionRuleTitle").textContent="🌎 Región permitida: "+(data.allowed_region||"SAC");
  $("regionRuleNote").textContent="Solo pueden anotarse jugadores y suplentes verificados de "+(data.allowed_region||"SAC")+". Los ID de otras regiones se rechazan al verificar.";'''
 new='''  $("regionRuleTitle").textContent="✅ Inscripciones abiertas a todas las regiones";
  $("regionRuleNote").textContent="Solo necesitás un ID válido con apodo verificado en Free Fire. No se solicita comprobar la región.";'''
 assert s.count(old)==1
 s=s.replace(old,new)
 old=''' const invalidRegion=rows.find(row=>row.verified&&String(row.verified.region||"").trim().toUpperCase()!==String(tournament.allowed_region||"SAC").trim().toUpperCase());
 if(invalidRegion)return tell("❌ Hay un jugador de otra región. Este torneo admite únicamente "+(tournament.allowed_region||"SAC")+".",true);
'''
 assert s.count(old)==1
 s=s.replace(old,'')
 for old in ['+p.id+" · "+p.region','+p.id+" · "+p.region']:
  if old in s:
   s=s.replace(old,'+p.id')
 p.write_text(s)
p=root/'inscripcion-web-account.js'
s=p.read_text()
s=s.replace('" · Región "+profile.region+". Tus inscripciones se vinculan automáticamente."','". Tus inscripciones se vinculan automáticamente."')
s=s.replace('" · "+profile.region+" · ID verificado y guardado"','" · ID verificado y guardado"')
p.write_text(s)
p=root/'inscripcion.html';s=p.read_text()
s=s.replace('🌎 Región permitida: SAC','✅ Todas las regiones')
s=s.replace('Este torneo solo admite cuentas de la región indicada.','Solo se verifican ID y apodo de Free Fire. No se exige región.')
s=s.replace('aparecerán el nombre y la región de Free Fire.','aparecerá su apodo de Free Fire.')
assert s.count('inscripcion-web-form.js?v=1.0.1')==1
s=s.replace('inscripcion-web-form.js?v=1.0.1','inscripcion-web-form.js?v=1.0.2')
assert s.count('inscripcion-web-account.js?v=1.0.0')==1
s=s.replace('inscripcion-web-account.js?v=1.0.0','inscripcion-web-account.js?v=1.0.1')
p.write_text(s)
p=root/'admin.html';s=p.read_text()
old='<label for="allowedRegion">🌎 Región permitida de Free Fire</label>'
assert s.count(old)==1
s=s.replace(old,'<p class="small" style="color:#95edc8;font-weight:800">✅ Participan IDs de todas las regiones. Solo se verifica el apodo.</p><label for="allowedRegion" class="hidden">Región (compatibilidad interna)</label>')
s=s.replace('<select id="allowedRegion">','<select id="allowedRegion" class="hidden">')
s=s.replace('Solo podrán anotarse IDs cuya región detectada por el verificador coincida exactamente con la elegida, incluidos suplentes. No cambia la región de los torneos anteriores.','La región ya no es requisito para inscribir jugadores, titulares ni suplentes.')
s=s.replace('🌎 Región SAC</p>','✅ Todas las regiones</p>')
# Ya no se necesita mostrar confirmación manual en el panel.
s=s.replace('<div class="panel" id="regionAdminPanel">','<div class="panel hidden" id="regionAdminPanel">')
assert s.count('admin.js?v=0.6.8')==1
s=s.replace('admin.js?v=0.6.8','admin.js?v=0.6.9')
p.write_text(s)
p=root/'admin.js';s=p.read_text()
old='$("detailRegion").textContent="🌎 Región permitida: "+(t.allowed_region||"SAC");'
assert s.count(old)==1
s=s.replace(old,'$("detailRegion").textContent="✅ Torneo abierto a todas las regiones";')
p.write_text(s)
print("FRONTEND_ALL_REGIONS_NAME_ONLY_PATCHED")
