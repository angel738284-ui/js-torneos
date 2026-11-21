from pathlib import Path
root=Path.home()/'js-torneos-pages'
p=root/'profile-tiktok.css'
s=p.read_text()
addition='''

/* Corrige el hueco entre la barra superior y la portada en móvil.
   El perfil está separado del contenedor .wrap; acercarlo no modifica
   la altura de su banner, foto, perfil ni las demás pestañas. */
@media (max-width:639px) {
  body.js-profile-tab:not(.js-auth-required):not(.js-auth-checking) #js-account-view {
    margin-top:-88px;
  }
}
'''
assert 'Corrige el hueco entre la barra superior' not in s
p.write_text(s+addition)
p=root/'torneos.html'
s=p.read_text()
old='profile-tiktok.css?v=1.0.0'
assert s.count(old)==1
p.write_text(s.replace(old,'profile-tiktok.css?v=1.0.1'))
print('MOBILE_PROFILE_GAP_REDUCED')
