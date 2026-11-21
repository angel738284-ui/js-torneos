from pathlib import Path
p=Path.home()/'js-torneos-pages/torneos.html'
s=p.read_text()
a=s.index('  <div id="js-auth-welcome">')
b=s.index('  <div id="js-account-signed" class="account-hide">',a)
s=s[:a]+'''  <div id="js-auth-welcome">
    <div class="js-arena-eyebrow"><i></i> COMPETITIVE PLATFORM <span>FREE FIRE</span></div>
    <div class="js-arena-crest"><div class="js-arena-shield">JS</div><b>★</b></div>
    <div class="js-welcome-kicker">TORNEOS JS · TEMPORADA COMPETITIVA</div>
    <h1>ENTRÁ A<br><em>LA ARENA.</em></h1>
    <p>Competí, ganá y dejá tu marca. Tu camino a la victoria comienza acá.</p>
    <div class="js-arena-tags"><span>⚔️ PVP</span><span>🏆 BATTLE ROYALE</span><span>💎 PREMIOS</span></div>
  </div>
  <h2 class="js-web-profile-heading">👤 Mi perfil de jugador</h2>
  <p class="js-web-profile-description">Tu perfil, torneos e inscripciones de TORNEOS JS.</p>
  <div id="js-account-guest" class="account-card js-arena-panel">
    <div class="js-auth-tabs" role="tablist" aria-label="Acceso a TORNEOS JS">
      <button id="js-auth-tab-login" class="js-auth-tab active" role="tab" aria-selected="true" type="button" aria-controls="js-auth-form">INICIAR SESIÓN</button>
      <button id="js-auth-tab-register" class="js-auth-tab" role="tab" aria-selected="false" type="button" aria-controls="js-auth-form">CREAR CUENTA</button>
    </div>
    <h3 class="js-auth-head" id="js-auth-head">BIENVENIDO DE NUEVO</h3>
    <p class="js-auth-description" id="js-auth-description">Entrá y seguí compitiendo en TORNEOS JS.</p>
    <button id="js-google-login" class="js-auth-google" type="button"><span class="js-google-mark" aria-hidden="true">G</span> Continuar con Google <span aria-hidden="true">→</span></button>
    <div class="js-auth-separator">O CONTINUÁ CON TU CORREO</div>
    <div id="js-auth-form" role="tabpanel" aria-labelledby="js-auth-tab-login">
      <label for="js-email-address">CORREO ELECTRÓNICO</label>
      <div class="js-auth-input"><span aria-hidden="true">✉</span><input id="js-email-address" type="email" autocomplete="email" inputmode="email" placeholder="nombre@correo.com"></div>
      <label for="js-email-password">CONTRASEÑA</label>
      <div class="js-auth-input"><span aria-hidden="true">🔒</span><input id="js-email-password" type="password" autocomplete="current-password" minlength="8" placeholder="Ingresá tu contraseña"><button id="js-auth-show-password" type="button" aria-pressed="false" aria-label="Mostrar contraseña">◉</button></div>
      <div class="js-auth-help"><small id="js-auth-password-tip" class="account-hide">Mínimo 8 caracteres</small><button id="js-auth-forgot" type="button">¿Olvidaste tu contraseña?</button></div>
      <button id="js-email-signin" type="button" class="js-auth-submit">ENTRAR AL TORNEO <span>↗</span></button>
      <button id="js-email-signup" type="button" class="js-auth-submit account-hide">CREAR MI CUENTA <span>↗</span></button>
    </div>
    <div id="js-account-status" class="auth-status js-auth-status" aria-live="polite" role="status"></div>
    <div class="js-auth-bottom"><span id="js-auth-switch-caption">¿Todavía no tenés cuenta?</span><button type="button" id="js-auth-switch-bottom">Registrate gratis</button></div>
  </div>
  <div class="js-arena-foot">TORNEOS JS · COMPETÍ · GANÁ · DESTACATE</div>
'''+s[b:]
old=''' const status=(msg,ok)=>{
   q("js-account-status").textContent=msg;
   q("js-account-status").className="auth-status"+(ok===true?" good":ok===false?" warn":"");
 };'''
assert s.count(old)==1
s=s.replace(old,''' const status=(msg,ok)=>{
   const node=q("js-account-status");
   node.textContent=msg;
   node.className="auth-status js-auth-status"+(ok===true?" good":ok===false?" warn":"");
 };''')
anchor=' q("js-email-signin").onclick=async()=>{'
assert s.count(anchor)==1
controls=''' let jsSignupMode=false;
 function setAuthTab(register){
   jsSignupMode=!!register;
   q("js-auth-tab-login").classList.toggle("active",!register);
   q("js-auth-tab-register").classList.toggle("active",!!register);
   q("js-auth-tab-login").setAttribute("aria-selected",String(!register));
   q("js-auth-tab-register").setAttribute("aria-selected",String(!!register));
   q("js-auth-form").setAttribute("aria-labelledby",register?"js-auth-tab-register":"js-auth-tab-login");
   q("js-email-signin").classList.toggle("account-hide",!!register);
   q("js-email-signup").classList.toggle("account-hide",!register);
   q("js-auth-forgot").classList.toggle("account-hide",!!register);
   q("js-auth-password-tip").classList.toggle("account-hide",!register);
   q("js-email-password").autocomplete=register?"new-password":"current-password";
   q("js-auth-head").textContent=register?"CREÁ TU CUENTA":"BIENVENIDO DE NUEVO";
   q("js-auth-description").textContent=register?"Empezá a competir en los torneos de Free Fire.":"Entrá y seguí compitiendo en TORNEOS JS.";
   q("js-auth-switch-caption").textContent=register?"¿Ya tenés cuenta?":"¿Todavía no tenés cuenta?";
   q("js-auth-switch-bottom").textContent=register?"Iniciar sesión":"Registrate gratis";
   q("js-account-status").textContent="";
 }
 q("js-auth-tab-login").onclick=()=>setAuthTab(false);
 q("js-auth-tab-register").onclick=()=>setAuthTab(true);
 q("js-auth-switch-bottom").onclick=()=>setAuthTab(!jsSignupMode);
 q("js-auth-show-password").onclick=()=>{
   const input=q("js-email-password");const reveal=input.type==="password";
   input.type=reveal?"text":"password";
   q("js-auth-show-password").setAttribute("aria-pressed",String(reveal));
   q("js-auth-show-password").setAttribute("aria-label",reveal?"Ocultar contraseña":"Mostrar contraseña");
 };
 q("js-email-address").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();q("js-email-password").focus()}});
 q("js-email-password").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();q(jsSignupMode?"js-email-signup":"js-email-signin").click()}});
 q("js-auth-forgot").onclick=async()=>{
   const email=q("js-email-address").value.trim();
   if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))return status("Ingresá tu correo para recuperar la contraseña.",false);
   const btn=q("js-auth-forgot");btn.disabled=true;
   try{
     const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
     if(error)throw error;
     status("Si el correo tiene una cuenta, recibirás instrucciones para recuperar la contraseña.",true);
   }catch(e){status("No se pudo enviar el enlace: "+e.message,false)}
   finally{btn.disabled=false}
 };
 setAuthTab(false);
'''
s=s.replace(anchor,controls+anchor)
p.write_text(s)
print('HTML_AND_JS_DONE',len(s))
