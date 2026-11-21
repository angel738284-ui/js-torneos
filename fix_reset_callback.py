from pathlib import Path
root=Path.home()/'js-torneos-pages'
redirect_script='''<script>
/* La URL principal es el redirect permitido para correos de Supabase Auth.
   Si el correo es para recuperar una clave de ADMIN, enviar el fragmento
   completo a la pantalla de restablecimiento antes de iniciar el cliente
   de jugadores (que de otro modo consumiría la sesión). */
(function(){
  const hash=new URLSearchParams(location.hash.slice(1));
  const query=new URLSearchParams(location.search.slice(1));
  if(hash.get("type")==="recovery"||query.get("type")==="recovery"){
    location.replace("/admin.html"+location.search+location.hash);
  }
})();
</script>
'''
for file in ["index.html","torneos.html"]:
 p=root/file
 s=p.read_text()
 assert redirect_script not in s
 old='<link rel="canonical" href="https://jstorneos.com/">'
 assert s.count(old)==1
 s=s.replace(old,old+'\n'+redirect_script)
 p.write_text(s)
p=root/'admin.js'
s=p.read_text()
old='redirectTo:location.origin+location.pathname'
assert s.count(old)==1
new='redirectTo:"https://jstorneos.com/"'
s=s.replace(old,new)
p.write_text(s)
p=root/'admin.html'
s=p.read_text()
assert s.count('admin.js?v=0.6.5')==1
s=s.replace('admin.js?v=0.6.5','admin.js?v=0.6.6')
p.write_text(s)
print('ADMIN_RECOVERY_CALLBACK_ROUTING_TO_ADMIN_ENABLED')
