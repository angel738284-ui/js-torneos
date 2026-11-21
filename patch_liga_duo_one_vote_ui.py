from pathlib import Path
root=Path(__file__).parent
def swap(text,old,new,label):
 count=text.count(old)
 if count!=1:raise RuntimeError(f"{label}: expected 1 got {count}")
 return text.replace(old,new,1)

p=root/"liga.js"
s=p.read_text()
s=swap(s,
 "'<p class=\"muted\">Primero formá tu dúo desde «Mi dúo». Después los dos podrán confirmar la búsqueda.</p>'+",
 "'<p class=\"muted\">Primero formá tu dúo desde «Mi dúo». Después, con que uno de los dos toque Buscar rival alcanza para activar la búsqueda.</p>'+",
 "search empty")
s=swap(s,"const label=ownReady&&partnerReady?\n  '🔄 Los dos confirmaron. Buscando otro dúo listo…':\n  ownReady?'✅ Confirmaste. Esperando a tu compañero…':\n  partnerReady?'🟢 Tu compañero ya confirmó. Falta tu aceptación.':\n   '⚪ Tu dúo todavía no está buscando.';",
"""const label=ownReady&&partnerReady?
  '🔄 Tu dúo está buscando rival…':
  ownReady?'✅ Ya activaste la búsqueda para tu dúo. Esperando rival…':
  partnerReady?'🟢 Tu compañero ya está buscando rival por los dos.':
   '⚪ Tu dúo todavía no está buscando.';""","search status")
s=swap(s,
"const commands=ownReady?\n   btn(\"✕ Cancelar búsqueda\",\"search_leave\",'',\"danger block\"):\n   btn(\"🎲 Confirmar y buscar rival\",\"search_join\",'',\"hot block\");",
"""const commands=ownReady||partnerReady?
   btn("✕ Cancelar búsqueda del dúo","search_leave",'',"danger block"):
   btn("🎲 Buscar rival para mi dúo","search_join",'',"hot block");""","search buttons")
s=swap(s,
"'<p class=\"muted\">Los dos jugadores activos del dúo tienen que confirmar por separado. Cuando otro dúo de la misma región haga lo mismo, el sistema los empareja automáticamente y crea el PvP.</p>'+",
"'<p class=\"muted\">Con que <b>uno de los dos</b> integrantes toque Buscar rival alcanza. Cuando otro dúo de la misma región haga lo mismo, se crea el PvP. Los cuatro IDs deben estar verificados.</p>'+",
"search copy")
s=swap(s,"'<div class=\"grid\"><div class=\"metric\"><b>'+count+'/2</b><small>TU DÚO CONFIRMADO</small></div>'+",
         "'<div class=\"grid\"><div class=\"metric\"><b>'+(count>=1?\"✅ Activa\":\"⚪ Inactiva\")+'</b><small>BÚSQUEDA DEL DÚO</small></div>'+","search metric")
s=swap(s,
"(ownReady&&partnerReady?'Mantené esta página abierta. La búsqueda se actualiza automáticamente.':\n   'Cada jugador confirma desde su propia cuenta JS Torneos.')",
"(ownReady||partnerReady?'Mantené esta página abierta si querés ver cuándo aparece un rival. El bot también puede ayudarte por privado.':\n   'Cualquiera de los titulares activos puede iniciar la búsqueda.')",
"search explanation")
s=swap(s,
"'<p class=\"muted\">⏳ La confirmación vence si un jugador deja de estar activo durante unos 90 segundos. Si cualquiera cancela, sale el dúo completo. Nunca emparejamos contra una región diferente.</p>');",
"'<p class=\"muted\">⏳ La búsqueda se renueva mientras esté activa en la web o con el bot. Si cualquiera la cancela, termina para todo el dúo. Nunca emparejamos regiones distintas.</p>');",
"search expiration")
s=swap(s,"if(b.state===\"playing\"&&participant&&b.my_vote?.result)actions='<p class=\"muted\">✅ Ya informaste: '+(b.my_vote.result===\"win\"?\"Gané\":\"Perdí\")+'. Esperando al resto.</p>';",
'''if(b.state==="playing"&&participant&&b.my_vote?.result)actions='<p class="muted">✅ Ya informaste: '+(b.my_vote.result==="win"?"Gané":"Perdí")+'. Solo falta la confirmación de un integrante del dúo contrario.</p>';''',
"result waiting message")
s=swap(s,
"'<div class=\"flex\"><span class=\"muted\">✅ '+b.confirmed+'/4 aceptaron · 📝 '+b.reported+'/4 resultados</span>'+",
"'<div class=\"flex\"><span class=\"muted\">✅ '+b.confirmed+'/4 aceptaron · 📝 '+b.reported+'/2 dúos informaron</span>'+",
"result count")
p.write_text(s)

p=root/"liga-plus.js"
s=p.read_text()
s=swap(s,
'<p class="muted">Cuando los cuatro coinciden, el resultado se acredita. Si se contradicen, JS decide.</p>',
'<p class="muted">Con una respuesta por dúo alcanza: uno informa Gané y el otro Perdí. Si se contradicen, JS revisa y no da puntos automáticamente.</p>',
"result details guidance")
s=swap(s,
"'\"<strong>🎮 Sala de espera · '+number+'/4 listos</strong>'+", 
"'\"<strong>🎮 Sala de espera · '+number+'/2 dúos listos</strong>'+", "ready header") if False else s
s=swap(s,
"'<strong>🎮 Sala de espera · '+number+'/4 listos</strong>'+",
"'<strong>🎮 Sala de espera · '+number+'/2 dúos listos</strong>'+",
"ready header")
s=swap(s,
"'<p class=\"muted\">'+(fully?\"✅ ¡Los cuatro están listos! Ya pueden jugar.\":\"Los cuatro deben tocar Estoy listo, cada uno desde su cuenta.\")+'</p>'+",
"'<p class=\"muted\">'+(fully?\"✅ ¡Ambos dúos están listos! Ya pueden jugar.\":\"Alcanza con que una persona de cada dúo marque Estoy listo.\")+'</p>'+",
"ready text")
p.write_text(s)

p=root/"liga.html";s=p.read_text()
s=swap(s,'liga.js?v=2.5.0','liga.js?v=2.6.0',"js version")
# Module uses static imports for extra controls: ensure cache version for changed dependency.
assert 'liga-plus.js' in (root/'liga.js').read_text()
p.write_text(s)
print("UX_UPDATED_FOR_ONE_VOTE")
