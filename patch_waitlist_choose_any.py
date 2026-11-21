from pathlib import Path
root=Path.home()/'js-torneos-pages'
p=root/'admin-waitlist.js'
s=p.read_text()
assert s.count('admit.disabled=!canAdmit||i!==0;admit.type="button";')==1
s=s.replace('admit.disabled=!canAdmit||i!==0;admit.type="button";','admit.disabled=!canAdmit;admit.type="button";')
assert s.count('Cuando se libere un cupo, podrás admitir al primer equipo de la lista.')==1
s=s.replace('Cuando se libere un cupo, podrás admitir al primer equipo de la lista.','Cuando se libere un cupo, podrás elegir qué equipo de la lista admitir.')
assert s.count('Abrí nuevamente las inscripciones para admitir al siguiente equipo.')==1
s=s.replace('Abrí nuevamente las inscripciones para admitir al siguiente equipo.','Abrí nuevamente las inscripciones para admitir al equipo que elijas.')
marker='''  function ask(text){'''
assert s.count(marker)==1
s=s.replace(marker,'''  if(canAdmit){
    box.append(make("p","✅ Podés admitir a cualquier equipo de la lista de espera. Quedan "+slots+" cupo(s); elegí a quiénes darles lugar.","small"));
  }
'''+marker)
p.write_text(s)
p=root/'admin.html';s=p.read_text()
assert s.count('admin-waitlist.js?v=0.5.0')==1
s=s.replace('admin-waitlist.js?v=0.5.0','admin-waitlist.js?v=0.5.1')
p.write_text(s)
for name in ('inscripcion-web-form.js','inscripcion.js'):
 p=root/name;s=p.read_text()
 old='Hay "+data.waitlist_count+" equipo(s) en espera. Se respeta el orden de llegada.'
 new='Hay "+data.waitlist_count+" equipo(s) en espera. Se muestran por orden de inscripción; el administrador elige a cuáles admitir.'
 assert s.count(old)==1,(name,s.count(old))
 s=s.replace(old,new)
 p.write_text(s)
p=root/'inscripcion.html';s=p.read_text()
assert s.count('inscripcion-web-form.js?v=1.0.2')==1
s=s.replace('inscripcion-web-form.js?v=1.0.2','inscripcion-web-form.js?v=1.0.3')
p.write_text(s)
print('WAITLIST_MANUAL_SELECTION_UI_PATCHED')
