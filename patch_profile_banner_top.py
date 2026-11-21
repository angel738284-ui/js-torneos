from pathlib import Path
root=Path.home()/'js-torneos-pages'
p=root/'profile-tiktok.css'
s=p.read_text()
assert 'BANNER DESDE ARRIBA — PERFIL' not in s
s+='''

/* BANNER DESDE ARRIBA — PERFIL
   El encabezado vive dentro de .wrap, mientras el perfil está debajo de
   ese contenedor. Se saca el header del flujo SOLO en Perfil: la portada
   arranca en el borde superior y el botón de avisos flota sobre ella. */
body.js-profile-tab:not(.js-auth-required):not(.js-auth-checking) .wrap{
  position:relative;
  min-height:0;
  height:0;
  padding:0;
  margin:0 auto;
  overflow:visible;
  z-index:3;
}
body.js-profile-tab:not(.js-auth-required):not(.js-auth-checking) .wrap > header{
  position:absolute;
  inset:0 0 auto 0;
  height:0;
  min-height:0;
  width:100%;
  padding:0;
  margin:0;
  border:0;
  background:transparent;
  z-index:12;
  pointer-events:none;
  overflow:visible;
}
body.js-profile-tab:not(.js-auth-required):not(.js-auth-checking) header .brand{
  display:none!important;
}
body.js-profile-tab:not(.js-auth-required):not(.js-auth-checking) header .js-header-actions{
  position:absolute;
  top:14px;
  right:17px;
  pointer-events:auto;
}
body.js-profile-tab:not(.js-auth-required):not(.js-auth-checking) header .js-bell{
  width:46px;
  height:46px;
  border-radius:50%;
  background:#0a1329b8;
  border:1px solid #e4eaf87d;
  color:#fff;
  box-shadow:0 4px 14px #0008;
  backdrop-filter:blur(9px);
  -webkit-backdrop-filter:blur(9px);
}
body.js-profile-tab:not(.js-auth-required):not(.js-auth-checking) #js-web-cover{
  height:clamp(205px,54vw,300px);
  background-size:cover;
  background-position:center center;
}
body.js-profile-tab:not(.js-auth-required):not(.js-auth-checking) #js-web-avatar{
  margin-top:-53px;
}
@media(min-width:810px){
  body.js-profile-tab:not(.js-auth-required):not(.js-auth-checking) .wrap > header{
    left:0;
  }
}
'''
p.write_text(s)
p=root/'torneos.html'
s=p.read_text()
old='profile-tiktok.css?v=1.0.3'
assert s.count(old)==1
s=s.replace(old,'profile-tiktok.css?v=1.0.4')
p.write_text(s)
print('PROFILE_BANNER_TOP_FIX_PREPARED')
