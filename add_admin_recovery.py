from pathlib import Path
root=Path.home()/'js-torneos-pages'
p=root/'admin.html'
s=p.read_text()
old='<section id="login" class="panel hidden"><h2>Acceso administrador</h2><label>Correo electrónico</label><input id="email" type="email" autocomplete="username"><label>Contraseña</label><input id="password" type="password" autocomplete="current-password"><div class="two-actions" style="margin-top:17px"><button id="signIn">Ingresar</button><button id="signUp" class="secondary">Crear usuario</button></div><p class="small">Solo las cuentas aprobadas como administradores podrán crear torneos. Después del registro, activá tu cuenta desde Supabase SQL Editor.</p></section>'
new='''<section id="login" class="panel hidden">
<h2>Acceso administrador</h2>
<label for="email">Correo electrónico</label><input id="email" type="email" autocomplete="username">
<label for="password">Contraseña</label><input id="password" type="password" autocomplete="current-password">
<div class="two-actions" style="margin-top:17px"><button id="signIn" type="button">Ingresar</button><button id="signUp" class="secondary" type="button">Crear usuario</button></div>
<button id="forgotPassword" class="ghost" type="button" style="display:block;margin:15px auto 10px;padding:10px;text-decoration:underline;text-underline-offset:4px;color:#9fead8">¿Olvidaste tu contraseña?</button>
<p class="small">Solo las cuentas aprobadas como administradores podrán crear torneos. Después del registro, activá tu cuenta desde Supabase SQL Editor.</p>
</section>
<section id="adminRecoveryRequest" class="panel hidden">
<h2>🔐 Recuperar contraseña</h2>
<p class="small">Te enviaremos un enlace al correo de tu cuenta de administrador.</p>
<label for="recoveryEmail">Correo electrónico</label>
<input id="recoveryEmail" type="email" inputmode="email" autocomplete="email" placeholder="tu@correo.com">
<div class="two-actions" style="margin-top:17px">
<button id="sendRecoveryLink" type="button">📧 Enviar enlace</button>
<button id="cancelRecovery" class="secondary" type="button">← Volver</button>
</div>
<p id="recoveryFeedback" class="small" role="status" aria-live="polite"></p>
</section>
<section id="adminRecoveryUpdate" class="panel hidden">
<h2>🔑 Crear contraseña nueva</h2>
<p class="small">Accediste desde el enlace de recuperación. Elegí una contraseña nueva para tu cuenta.</p>
<label for="recoveryPassword">Contraseña nueva (mínimo 8 caracteres)</label>
<input id="recoveryPassword" type="password" minlength="8" maxlength="128" autocomplete="new-password">
<label for="recoveryPasswordRepeat">Repetir contraseña</label>
<input id="recoveryPasswordRepeat" type="password" minlength="8" maxlength="128" autocomplete="new-password">
<button id="saveRecoveryPassword" class="full" type="button" style="margin-top:17px">✓ Guardar contraseña nueva</button>
<p id="recoveryUpdateFeedback" class="small" role="status" aria-live="polite"></p>
</section>'''
assert s.count(old)==1,"Cannot find exact login form"
s=s.replace(old,new)
s=s.replace('admin.js?v=0.6.4','admin.js?v=0.6.5')
p.write_text(s)
p=root/'admin.js'
s=p.read_text()
old='let db=null,user=null,opened=null,teamCache=[],matchCache=[],finalGameCache=[],roomCache=new Map(),currentConfig=null,currentTourTab="teams",savingFinalGame=false;'
new=old+'\nlet recoveryMode=/(?:^|[&#?])type=recovery(?:[&#&]|$)/.test(location.hash+location.search);'
assert s.count(old)==1
s=s.replace(old,new)
old=''' show("setup",false);checkUser();
}
async function checkUser(){
 const {data,error}=await db.auth.getUser();user=data?.user||null;'''
new=''' show("setup",false);
 // Supabase entrega una sesión temporal al abrir el correo de recuperación.
 // No ejecutar el panel normal hasta que el dueño cambie su contraseña.
 db.auth.onAuthStateChange((event)=>{
   if(event==="PASSWORD_RECOVERY"){
     recoveryMode=true;
     showRecoveryUpdate();
   }
 });
 if(recoveryMode){
   showRecoveryUpdate();
   return;
 }
 checkUser();
}
function showRecoveryUpdate(){
 show("login",false);show("app",false);show("logout",false);
 show("adminRecoveryRequest",false);
 show("adminRecoveryUpdate",true);
}
async function checkUser(){
 if(recoveryMode)return;
 const {data,error}=await db.auth.getUser();user=data?.user||null;
 if(recoveryMode)return;'''
assert s.count(old)==1,"Cannot find launch/checkUser segment"
s=s.replace(old,new)
old='''$("signIn").onclick=async()=>{
 const email=$("email").value.trim(),password=$("password").value;
 const {error}=await db.auth.signInWithPassword({email,password});if(error)return message(error.message,true);
 await checkUser();
};'''
new='''$("forgotPassword").onclick=()=>{
 $("recoveryEmail").value=$("email").value.trim();
 $("recoveryFeedback").textContent="";
 show("login",false);
 show("adminRecoveryRequest",true);
};
$("cancelRecovery").onclick=()=>{
 show("adminRecoveryRequest",false);show("login",true);
};
$("sendRecoveryLink").onclick=async()=>{
 if(!db)return message("No se pudo conectar con Supabase.",true);
 const email=$("recoveryEmail").value.trim();
 if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)){
   $("recoveryFeedback").textContent="Ingresá un correo válido.";return;
 }
 const button=$("sendRecoveryLink");
 if(button.disabled)return;
 button.disabled=true;
 $("recoveryFeedback").textContent="Solicitando correo de recuperación…";
 try{
   const {error}=await db.auth.resetPasswordForEmail(email,{
     redirectTo:location.origin+location.pathname
   });
   if(error)throw error;
   $("recoveryFeedback").textContent="✅ Si el correo está registrado, recibirás un enlace para cambiar tu contraseña. Revisá también Spam.";
 }catch(error){
   $("recoveryFeedback").textContent="⚠️ No se pudo solicitar el enlace: "+(error.message||"Error");
 }finally{button.disabled=false}
};
$("saveRecoveryPassword").onclick=async()=>{
 if(!db||!recoveryMode)return;
 const password=$("recoveryPassword").value;
 if(password.length<8||password.length>128){
   $("recoveryUpdateFeedback").textContent="La contraseña debe tener al menos 8 caracteres.";return;
 }
 if(password!==$("recoveryPasswordRepeat").value){
   $("recoveryUpdateFeedback").textContent="Las contraseñas no coinciden.";return;
 }
 const button=$("saveRecoveryPassword");
 if(button.disabled)return;
 button.disabled=true;
 $("recoveryUpdateFeedback").textContent="Actualizando contraseña…";
 try{
   const {data:session}=await db.auth.getSession();
   if(!session?.session)throw Error("El enlace venció o no se pudo verificar. Solicitá uno nuevo.");
   const {error}=await db.auth.updateUser({password});
   if(error)throw error;
   $("recoveryPassword").value="";
   $("recoveryPasswordRepeat").value="";
   await db.auth.signOut();
   recoveryMode=false;
   history.replaceState(null,"",location.pathname);
   show("adminRecoveryUpdate",false);
   show("login",true);
   $("password").value="";
   message("✅ Contraseña actualizada. Ya podés iniciar sesión con tu correo y la nueva contraseña.");
 }catch(error){
   $("recoveryUpdateFeedback").textContent="⚠️ "+(error.message||"No se pudo cambiar la contraseña.");
 }finally{button.disabled=false}
};
$("signIn").onclick=async()=>{
 const email=$("email").value.trim(),password=$("password").value;
 const {error}=await db.auth.signInWithPassword({email,password});if(error)return message(error.message,true);
 await checkUser();
};'''
assert s.count(old)==1,"Cannot find signIn"
s=s.replace(old,new)
p.write_text(s)
print('ADMIN_PASSWORD_RECOVERY_UI_AND_AUTH_FLOW_ADDED')
