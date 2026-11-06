"use strict";
(function(){
const q=id=>document.getElementById(id);
const cfg=window.JS_CONFIG;
const status=msg=>{q("feedback").textContent=msg};
if(!cfg?.supabaseUrl||!cfg?.publishableKey||!window.supabase){
 status("⚠️ No se pudo conectar con Supabase. Recargá la página.");return;
}
const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.publishableKey,{
 auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
});
let authorizedRecovery=false;
function showChangePassword(){
 authorizedRecovery=true;
 q("step-email").hidden=true;
 q("step-otp").hidden=true;
 q("step-password").hidden=false;
 status("✅ Código verificado. Ya podés elegir una contraseña nueva.");
}
sb.auth.onAuthStateChange((event)=>{
 if(event==="PASSWORD_RECOVERY")showChangePassword();
});
q("send").onclick=async()=>{
 const email=q("email").value.trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
  status("Ingresá un correo electrónico válido.");return;
 }
 const b=q("send");if(b.disabled)return;
 b.disabled=true;status("Solicitando código de recuperación…");
 try{
  const {error}=await sb.auth.resetPasswordForEmail(email,{
   redirectTo:"https://jstorneos.com/"
  });
  if(error)throw error;
  status("✅ Si el correo está registrado, recibirás un mensaje de recuperación. Escribí el código de seis dígitos aquí, sin abrir ningún enlace.");
 }catch(e){status("⚠️ "+(e.message||"No se pudo solicitar el correo."))}
 finally{b.disabled=false}
};
q("verify").onclick=async()=>{
 const email=q("email").value.trim();
 const token=q("otp").value.trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){status("Ingresá tu correo primero.");return}
 if(!/^\d{6}$/.test(token)){status("El código tiene que ser de seis números.");return}
 const b=q("verify");if(b.disabled)return;
 b.disabled=true;status("Verificando el código…");
 try{
  const {data,error}=await sb.auth.verifyOtp({email,token,type:"recovery"});
  if(error)throw error;
  if(!data?.session)throw Error("No se pudo verificar tu sesión. Pedí un código nuevo.");
  q("otp").value="";
  showChangePassword();
 }catch(e){status("⚠️ Código inválido o vencido. "+(e.message||""))}
 finally{b.disabled=false}
};
q("update").onclick=async()=>{
 if(!authorizedRecovery){status("Primero confirmá el código de tu correo.");return}
 const password=q("password").value;
 if(password.length<8||password.length>128){status("La contraseña debe tener al menos 8 caracteres.");return}
 if(password!==q("password2").value){status("Las contraseñas no coinciden.");return}
 const b=q("update");if(b.disabled)return;
 b.disabled=true;status("Guardando la nueva contraseña…");
 try{
  const {data}=await sb.auth.getSession();
  if(!data?.session)throw Error("La sesión de recuperación venció. Solicitá otro código.");
  const {error}=await sb.auth.updateUser({password});
  if(error)throw error;
  q("password").value="";q("password2").value="";
  await sb.auth.signOut();
  history.replaceState(null,"",location.pathname);
  authorizedRecovery=false;
  q("step-password").hidden=true;
  q("success").hidden=false;
  status("✅ Contraseña actualizada. Podés iniciar sesión desde el enlace de abajo.");
 }catch(e){status("⚠️ "+(e.message||"No se pudo guardar la nueva contraseña."))}
 finally{b.disabled=false}
};
})();