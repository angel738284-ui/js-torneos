from pathlib import Path
root=Path.home()/'js-torneos-pages'
p=root/'profile-tiktok.css'
s=p.read_text()
old='''/* Corrige el hueco entre la barra superior y la portada en móvil.
   El perfil está separado del contenedor .wrap; acercarlo no modifica
   la altura de su banner, foto, perfil ni las demás pestañas. */
@media (max-width:639px) {
  body.js-profile-tab:not(.js-auth-required):not(.js-auth-checking) #js-account-view {
    margin-top:-88px;
  }
}
'''
new='''/* El encabezado está dentro de .wrap, pero el perfil va fuera de él.
   Quitar el padding inferior de .wrap elimina la franja vacía entre ambos. */
body.js-profile-tab:not(.js-auth-required):not(.js-auth-checking) .wrap{
  padding-bottom:0;
}
body.js-profile-tab:not(.js-auth-required):not(.js-auth-checking) #js-account-view{
  margin-top:0;
}
'''
assert old in s
s=s.replace(old,new)
p.write_text(s)
p=root/'torneos.html'
s=p.read_text()
assert s.count('profile-tiktok.css?v=1.0.1')==1
p.write_text(s.replace('profile-tiktok.css?v=1.0.1','profile-tiktok.css?v=1.0.2'))
print('REMOVED_GAP_AT_CAUSE')
