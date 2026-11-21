from pathlib import Path
root=Path.home()/'js-torneos-pages'
for name in ('index.html','torneos.html'):
 p=root/name
 s=p.read_text()
 original='''    <div class="js-profile-end" aria-label="Fin de tu perfil">'''
 assert s.count(original)==1
 replacement='''    <section class="account-card js-account-security" aria-label="Seguridad de tu cuenta">
      <h3>🔐 Seguridad de tu cuenta</h3>
      <p class="tiny">¿Olvidaste tu contraseña? Si ya iniciaste sesión, podés cambiarla acá sin usar correos de recuperación.</p>
      <button id="js-password-toggle" class="btn-alt" type="button">🔑 Cambiar contraseña</button>
      <div id="js-password-editor" hidden>
        <label for="js-new-password">Contraseña nueva</label>
        <input id="js-new-password" type="password" autocomplete="new-password" minlength="8" maxlength="128" placeholder="Mínimo 8 caracteres">
        <label for="js-confirm-password">Confirmar contraseña</label>
        <input id="js-confirm-password" type="password" autocomplete="new-password" minlength="8" maxlength="128" placeholder="Repetí la contraseña">
        <p id="js-password-status" class="tiny" role="status" aria-live="polite"></p>
        <button id="js-password-save" class="btn-action" type="button">✓ Guardar contraseña</button>
        <button id="js-password-cancel" class="btn-alt" type="button">Cancelar</button>
      </div>
      <p id="js-password-success" class="tiny" role="status" aria-live="polite"></p>
      <a id="js-admin-from-profile" href="/admin.html" class="js-admin-entry" hidden>🛡️ Entrar al panel de administrador</a>
    </section>
    <div class="js-profile-end" aria-label="Fin de tu perfil">'''
 s=s.replace(original,replacement)
 marker='''   if(profile.is_admin===true)badge.append(make("span","🛡️ ADM · Administrador","js-web-profile-admin"));'''
 assert s.count(marker)==1
 s=s.replace(marker,marker+'''
   q("js-admin-from-profile").hidden=profile.is_admin!==true;''')
 marker=''' q("js-web-edit-cancel").onclick=()=>{q("js-web-editor").hidden=true};'''
 assert s.count(marker)==1
 handler=''' q("js-password-toggle").onclick=()=>{
   q("js-password-editor").hidden=!q("js-password-editor").hidden;
   q("js-password-status").textContent="";
   q("js-password-success").textContent="";
 };
 q("js-password-cancel").onclick=()=>{
   q("js-password-editor").hidden=true;
   q("js-new-password").value="";
   q("js-confirm-password").value="";
   q("js-password-status").textContent="";
 };
 q("js-password-save").onclick=async()=>{
   const feedback=q("js-password-status");
   const password=q("js-new-password").value;
   if(password.length<8||password.length>128){
     feedback.textContent="⚠️ La contraseña debe tener al menos 8 caracteres.";return;
   }
   if(password!==q("js-confirm-password").value){
     feedback.textContent="⚠️ Las contraseñas no coinciden.";return;
   }
   const button=q("js-password-save");
   if(button.disabled)return;
   button.disabled=true;
   feedback.textContent="Verificando sesión…";
   try{
     if(!session?.user?.id)throw Error("Primero iniciá sesión desde tu perfil.");
     const {data,error:sessionError}=await sb.auth.getUser();
     if(sessionError||!data?.user||data.user.id!==session.user.id)
       throw Error("Tu sesión venció. Volvé a iniciar sesión.");
     feedback.textContent="Guardando la contraseña nueva…";
     const {error}=await sb.auth.updateUser({password});
     if(error)throw error;
     q("js-new-password").value="";
     q("js-confirm-password").value="";
     q("js-password-editor").hidden=true;
     feedback.textContent="";
     q("js-password-success").textContent="✅ Contraseña actualizada. Ya podés entrar con tu correo y tu nueva clave.";
     if(profile?.is_admin===true)q("js-admin-from-profile").hidden=false;
   }catch(e){
     feedback.textContent="⚠️ "+(e.message||"No se pudo actualizar la contraseña.")+
       (String(e?.message||"").toLowerCase().includes("reauth")?" Supabase requiere una verificación adicional por correo.":"");
   }finally{button.disabled=false}
 };
'''
 s=s.replace(marker,marker+'\n'+handler)
 marker='''   session=data.session;
   select(q("js-account-guest"),!session);'''
 assert s.count(marker)==1
 s=s.replace(marker,'''   session=data.session;
   if(!session){
     q("js-password-editor").hidden=true;
     q("js-new-password").value="";
     q("js-confirm-password").value="";
     q("js-password-status").textContent="";
     q("js-password-success").textContent="";
     q("js-admin-from-profile").hidden=true;
   }
   select(q("js-account-guest"),!session);''')
 # Note: CSS shared injected in existing inline style before </style>.
 marker='''</style>'''
 assert s.count(marker)==1
 css='''.js-account-security{margin-top:22px!important}
.js-account-security h3{margin:0 0 10px;font-size:18px;color:#f4f8ff}
.js-account-security .tiny{font-size:12px;line-height:1.55;color:#bac6da}
#js-password-editor[hidden],#js-admin-from-profile[hidden]{display:none!important}
#js-password-editor{margin-top:17px;padding:13px;border:1px solid #405672;background:#0b1528;border-radius:12px}
#js-password-editor label{display:block;margin:12px 0 5px;font-size:12px;font-weight:800}
#js-password-editor input{width:100%;min-height:48px;color:#fff;background:#0c1729;border:1px solid #4c6182;border-radius:11px;padding:11px}
#js-password-editor button{margin:14px 7px 0 0}
#js-password-success{color:#8ee5bd!important;font-weight:700}
.js-admin-entry{display:inline-flex;margin-top:14px;padding:11px 15px;text-decoration:none;background:#263b56;border:1px solid #4b617f;border-radius:11px;color:#d2f1ff;font-size:12px;font-weight:800}
'''
 s=s.replace(marker,css+marker)
 p.write_text(s)
assert (root/'index.html').read_text()==(root/'torneos.html').read_text()
print('AUTHENTICATED_SELF_SERVICE_PASSWORD_CHANGE_INSTALLED')
