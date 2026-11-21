from pathlib import Path
root=Path.home()/'js-torneos-pages'
p=root/'admin.html'
s=p.read_text()
old='''<p id="recoveryFeedback" class="small" role="status" aria-live="polite"></p>
</section>
<section id="adminRecoveryUpdate"'''
new='''<p id="recoveryFeedback" class="small" role="status" aria-live="polite"></p>
<div class="divider"></div>
<h3>🔢 Recuperar con código de correo</h3>
<p class="small">Si tu correo contiene un código de seis dígitos, escribilo acá. No hace falta abrir ningún enlace.</p>
<label for="recoveryOtpCode">Código de 6 dígitos</label>
<input id="recoveryOtpCode" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" placeholder="000000">
<button id="verifyRecoveryCode" class="secondary full" type="button" style="margin-top:12px">✓ Verificar código</button>
<p id="recoveryOtpFeedback" class="small" role="status" aria-live="polite"></p>
</section>
<section id="adminRecoveryUpdate"'''
assert s.count(old)==1
s=s.replace(old,new)
assert s.count("admin.js?v=0.6.6")==1
s=s.replace("admin.js?v=0.6.6","admin.js?v=0.6.7")
p.write_text(s)
p=root/'admin.js'
s=p.read_text()
marker='''$("saveRecoveryPassword").onclick=async()=>{'''
assert s.count(marker)==1
code='''$("verifyRecoveryCode").onclick=async()=>{
 if(!db)return message("No se pudo conectar con Supabase.",true);
 const email=$("recoveryEmail").value.trim();
 const token=$("recoveryOtpCode").value.trim();
 const feedback=$("recoveryOtpFeedback");
 if(!/^[^\\\\s@]+@[^\\\\s@]+\\\\.[^\\\\s@]+$/.test(email)){
   feedback.textContent="Ingresá primero el correo de tu cuenta.";return;
 }
 if(!/^\\\\d{6}$/.test(token)){
   feedback.textContent="El código debe tener exactamente seis números.";return;
 }
 const button=$("verifyRecoveryCode");
 if(button.disabled)return;
 button.disabled=true;
 feedback.textContent="Verificando código…";
 try{
   const {data,error}=await db.auth.verifyOtp({email,token,type:"recovery"});
   if(error)throw error;
   if(!data?.session)throw Error("No se pudo confirmar la sesión. Solicitá un código nuevo.");
   $("recoveryOtpCode").value="";
   recoveryMode=true;
   history.replaceState(null,"",location.pathname);
   showRecoveryUpdate();
   $("recoveryPassword").focus();
 }catch(error){
   feedback.textContent="⚠️ "+(error.message||"Código inválido o vencido.");
 }finally{button.disabled=false}
};
'''
# raw string above escapes; this patch will convert double backslash for JS regex to single.
code=code.replace('\\\\\\\\','\\\\')
s=s.replace(marker,code+marker)
p.write_text(s)
print("RECOVERY_OTP_STEP_ADDED")
