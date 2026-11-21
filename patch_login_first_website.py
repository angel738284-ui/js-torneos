from pathlib import Path
path=Path.home()/'js-torneos-pages/torneos.html'
s=path.read_text()
assert s.count('<body><div class="wrap">') == 1
s=s.replace('<body><div class="wrap">','''<body class="js-auth-checking">
<div id="js-auth-loading" role="status" aria-live="polite">
  <div class="js-login-icon">JS</div>
  <strong>JS TORNEOS</strong>
  <p>Comprobando tu sesión…</p>
</div>
<div class="wrap">''')
anchor='</style></head>'
assert s.count(anchor)==1
css='''
/* Acceso inicial obligatorio a la portada. No altera las inscripciones guardadas. */
#js-auth-loading{display:none}
body.js-auth-checking #js-auth-loading{display:flex;position:fixed;inset:0;z-index:1000;align-items:center;justify-content:center;flex-direction:column;gap:10px;background:radial-gradient(ellipse at 50% 6%,#42233d,transparent 56%),#090e1a;text-align:center}
.js-login-icon{width:75px;height:75px;display:grid;place-items:center;font-size:28px;font-weight:1000;background:linear-gradient(130deg,#e95a76,#802944);border-radius:20px;box-shadow:0 12px 40px #f05a7833}
#js-auth-loading strong{font-size:22px;letter-spacing:1px}
#js-auth-loading p{font-size:13px;color:#afc0d4}
body.js-auth-checking .wrap,body.js-auth-checking nav,body.js-auth-checking .account-section{display:none!important}
body.js-auth-required .wrap,body.js-auth-required nav,body.js-auth-required #js-my-view,body.js-auth-required #js-notices-view{display:none!important}
body.js-auth-required{background:radial-gradient(ellipse at 80% 0,#42284075,transparent 50%),radial-gradient(ellipse at 0 75%,#203b5c55,transparent 55%),#080d1a;min-height:100vh}
body.js-auth-required #js-account-view{display:block!important;width:min(100% - 28px,480px);margin:0 auto 40px;padding:25px 16px 22px;background:transparent;border:0;box-shadow:none}
body.js-auth-required #js-account-view .js-web-profile-heading,
body.js-auth-required #js-account-view .js-web-profile-description{display:none!important}
#js-auth-welcome{display:none}
body.js-auth-required #js-auth-welcome{display:block;text-align:center;margin:23px auto 20px}
#js-auth-welcome .js-login-icon{margin:0 auto 14px}
#js-auth-welcome .js-welcome-kicker{font-size:11px;letter-spacing:2px;color:#8ceaca;font-weight:900}
#js-auth-welcome h1{font-size:clamp(28px,8vw,40px);line-height:1.13;letter-spacing:-1.3px;margin:13px 0 11px}
#js-auth-welcome h1 em{font-style:normal;color:#fc829c}
#js-auth-welcome p{font-size:13px;color:#b6c7d9;max-width:340px;margin:0 auto}
body.js-auth-required #js-account-guest{margin:16px auto 0;padding:21px 18px;border-radius:20px;border:1px solid #536079;background:linear-gradient(155deg,#1a2840,#10192a);box-shadow:0 15px 44px #0006}
body.js-auth-required #js-account-guest>.js-guest-intro{color:#e1e9f5;text-align:center;font-weight:850;margin:0 0 17px}
body.js-auth-required #js-google-login{width:100%;min-height:51px;border-radius:13px}
body.js-auth-required #js-account-guest details{background:#101a2d;padding:13px!important;margin-top:18px!important}
body.js-auth-required #js-account-guest details summary{color:#e4eefb}
body.js-auth-required #js-account-guest .account-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
body.js-auth-required #js-account-guest .account-row button{min-width:0;padding:10px 4px;min-height:45px;font-size:12px;border-radius:10px}
body.js-auth-required #js-account-status{border-radius:12px;padding:13px 14px}
body.js-auth-required #js-account-guest .js-guest-note{color:#b7c5d7;font-size:12px;line-height:1.55}
body.js-auth-required #js-account-view label{margin-top:10px}
body.js-auth-required #js-account-view input{font-size:16px}
'''
s=s.replace(anchor,css+anchor)
old='''<section id="js-account-view" class="account-section account-hide" aria-live="polite">
  <h2>👤 Mi perfil de jugador</h2>
  <p>Entrá con Google o correo electrónico para guardar tus torneos y códigos. También podés inscribirte sin cuenta y conservar tu código privado.</p>'''
new='''<section id="js-account-view" class="account-section account-hide" aria-live="polite">
  <div id="js-auth-welcome">
    <div class="js-login-icon">JS</div>
    <div class="js-welcome-kicker">JS FAMILY · FREE FIRE</div>
    <h1>Bienvenido a<br><em>JS Torneos</em></h1>
    <p>Iniciá sesión o creá tu cuenta para participar en torneos, seguir tus partidas y guardar tus resultados.</p>
  </div>
  <h2 class="js-web-profile-heading">👤 Mi perfil de jugador</h2>
  <p class="js-web-profile-description">Tu perfil, torneos e inscripciones de JS Family.</p>'''
assert s.count(old)==1
s=s.replace(old,new)
s=s.replace('<p>Iniciá sesión para recuperar tus torneos y códigos desde otro dispositivo.</p>','<p class="js-guest-intro">Elegí cómo querés entrar</p>')
assert s.count('<details style="margin-top:12px;border:1px solid #47617c;border-radius:12px;padding:12px">')==1
s=s.replace('<details style="margin-top:12px;border:1px solid #47617c;border-radius:12px;padding:12px">','<details open style="margin-top:12px;border:1px solid #47617c;border-radius:12px;padding:12px">')
s=s.replace('''<summary style="font-weight:900;cursor:pointer">✉️ Entrar o crear cuenta con correo</summary>''','''<summary style="font-weight:900;cursor:pointer">✉️ Usar correo electrónico</summary>''')
s=s.replace('''<p style="margin-top:12px">👤 Sin cuenta también podés participar: entrá a Torneos e inscribite, pero guardá tu código JS-EQ.</p>''','''<p class="js-guest-note" style="margin-top:15px">¿Es tu primera vez? Tocá <b>Crear cuenta</b>. Si ya tenés una cuenta de JS Torneos, usá <b>Iniciar sesión</b>.</p>''')
target=''' function menu(){
   const nav=document.querySelector("nav");if(!nav)return;'''
assert s.count(target)==1
insertion=''' function showAuthGate(guest){
   const body=document.body;
   const wasGuest=body.classList.contains("js-auth-required");
   body.classList.remove("js-auth-checking");
   body.classList.toggle("js-auth-required",guest);
   if(guest) switchTab("perfil");
   else if(wasGuest) switchTab("torneos");
 }
'''
s=s.replace(target,insertion+target)
old='''   if(error){status("No se pudo consultar la sesión. Abrí nuevamente la página.",false);return}
   session=data.session;
   select(q("js-account-guest"),!session);
   select(q("js-account-signed"),!!session);
   if(!session){profile=null;tournaments=[];renderProfile();status("Podés participar sin cuenta, o ingresar con correo / Google.");showMy();return}'''
new='''   if(error){showAuthGate(true);status("No se pudo comprobar tu sesión. Recargá la página para intentar de nuevo.",false);return}
   session=data.session;
   select(q("js-account-guest"),!session);
   select(q("js-account-signed"),!!session);
   showAuthGate(!session);
   if(!session){profile=null;tournaments=[];renderProfile();status("Ingresá con Google o correo. Si no tenés cuenta, creá una gratis.");showMy();return}'''
assert s.count(old)==1
s=s.replace(old,new)
path.write_text(s)
print("PATCH_COMPLETE",len(s),"auth-required toggles",s.count('showAuthGate('))
