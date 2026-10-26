"use strict";
(function(){
 const $=id=>document.getElementById(id);
 const info=(message,error=false)=>{const el=$("js-web-message");el.textContent=message;el.style.color=error?"#ffbbc5":"#a9f3d4"};
 const conf=window.JS_CONFIG||{};
 if(!window.supabase?.createClient)return info("No se pudo cargar Google/correo; podés continuar sin cuenta y guardar el código.",true);
 const sb=window.supabase.createClient(conf.supabaseUrl,conf.publishableKey,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}
 });
 const api=conf.supabaseUrl+"/functions/v1/js-jugadores-cuenta";
 let session=null,profile=null;
 async function call(action,fields={}){
  const {data,error}=await sb.auth.getSession();
  if(error||!data.session?.access_token)throw Error("Iniciá sesión antes de guardar el código");
  const res=await fetch(api,{method:"POST",cache:"no-store",headers:{
   "content-type":"application/json","authorization":"Bearer "+data.session.access_token
  },body:JSON.stringify(Object.assign({action},fields))});
  const dataJson=await res.json();
  if(!res.ok||dataJson.ok!==true)throw Error(dataJson.error||"No se pudo contactar al servidor");
  return dataJson;
 }
 async function saved(){
  const host=$("js-web-saved");host.replaceChildren();
  if(!session||!profile?.game_id){host.textContent="Verificá tu ID de Free Fire para recuperar los códigos vinculados.";return;}
  try{
   const result=await call("my_web_codes");
   const rows=Array.isArray(result.codes)?result.codes:[];
   if(!rows.length){host.textContent="Aún no tenés códigos privados guardados en esta cuenta.";return;}
   for(const item of rows){
    const box=document.createElement("div");
    box.style.cssText="padding:12px;margin:9px 0;background:#13283a;border:1px solid #466d76;border-radius:12px;overflow-wrap:anywhere";
    const title=document.createElement("strong");title.textContent=item.tournament+" · "+item.name;
    const code=document.createElement("p");code.textContent="Código: "+item.code;code.style.fontWeight="800";
    const copy=document.createElement("button");copy.type="button";copy.className="secondary";copy.textContent="Copiar código";
    copy.onclick=async()=>{try{await navigator.clipboard.writeText(item.code);info("Código privado copiado");}catch{info("Seleccioná el código para copiarlo.",true)}};
    box.append(title,code,copy);host.append(box);
   }
  }catch(e){host.textContent="⚠️ "+e.message}
 }
 async function current(){
  try{
   const {data,error}=await sb.auth.getSession();
   if(error)throw error;
   session=data.session;
   const logged=Boolean(session);
   $("js-web-login").style.display=logged?"none":"grid";
   $("js-web-profile").style.display=logged?"block":"none";
   profile=null;
   if(logged){
    $("js-web-identity").textContent="✅ Cuenta: "+(session.user.email||session.user.user_metadata?.full_name||"Google");
    const p=await call("profile");
    profile=p.profile;
    if(profile?.game_id){
     $("js-web-game-id").value=profile.game_id;
     $("js-web-profile-id").style.display="none";
     info("✅ ID "+profile.game_id+" · "+profile.nickname+" · Región "+profile.region+". Tus inscripciones se vinculan automáticamente.");
    }else{
     $("js-web-profile-id").style.display="block";
     info("Verificá tu ID de Free Fire antes de inscribirte, para guardar el código en la cuenta.");
    }
    await saved();
   }else info("Podés continuar sin cuenta. Al inscribirte recibirás un código privado que tenés que guardar.");
  }catch(e){info("⚠️ "+e.message,true)}
 }
 $("js-web-guest").onclick=()=>{
  info("Modo sin cuenta: verificá los IDs y guardá el código al terminar.");
  $("code").scrollIntoView({behavior:"smooth",block:"start"});
 };
 $("js-web-signin").onclick=async()=>{
  const email=$("js-web-email").value.trim(),password=$("js-web-password").value;
  if(!email||!password)return info("Ingresá correo y contraseña.",true);
  info("Entrando con tu correo…");
  try{
   const {error}=await sb.auth.signInWithPassword({email,password});
   if(error)throw error;
   await current();
  }catch(e){info("No se pudo ingresar: "+e.message,true)}
 };
 $("js-web-signup").onclick=async()=>{
  const email=$("js-web-email").value.trim(),password=$("js-web-password").value;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<8)
   return info("Ingresá un correo válido y contraseña de al menos 8 caracteres.",true);
  info("Creando cuenta…");
  try{
   const {data,error}=await sb.auth.signUp({email,password,
    options:{emailRedirectTo:location.origin+location.pathname}});
   if(error)throw error;
   if(!data.session)info("✅ Revisá tu correo y confirmá la cuenta. Volvé aquí para iniciar sesión.");
   else{info("✅ Cuenta creada.");await current();}
  }catch(e){info("No se pudo registrar: "+e.message,true)}
 };
 $("js-web-google").onclick=async()=>{
  try{
   const {error}=await sb.auth.signInWithOAuth({provider:"google",
    options:{redirectTo:location.origin+location.pathname+location.search}});
   if(error)throw error;
  }catch(e){info("Google no disponible: "+e.message+". Podés ingresar con correo o sin cuenta.",true)}
 };
 $("js-web-logout").onclick=async()=>{await sb.auth.signOut();session=null;profile=null;await current()};
 $("js-web-verify").onclick=async()=>{
  const id=$("js-web-game-id").value.trim().replace(/\s+/g,"");
  if(!/^[0-9]{5,16}$/.test(id))return info("Ingresá un ID numérico de Free Fire válido.",true);
  $("js-web-verify").disabled=true;
  info("Verificando el ID en Free Fire…");
  try{
   const result=await call("verify_id",{game_id:id});
   profile=result.profile;
   info("✅ "+profile.nickname+" · "+profile.region+" · ID verificado y guardado");
   await current();
  }catch(e){info("⚠️ "+e.message,true)}
  finally{$("js-web-verify").disabled=false;}
 };
 async function saveCode(code){
  if(!session||!profile?.game_id)return false;
  const result=await call("save_web_code",{team_code:code});
  if(!result.saved)throw Error("El servidor no confirmó el guardado");
  await saved();
  info("✅ Código privado guardado en tu cuenta.");
  return true;
 }
 window.JSWebSaveAfterSignup=saveCode;
 $("js-web-save-code").onclick=async()=>{
  const code=$("teamCode").value.trim();
  if(!code)return info("Inscribite primero para obtener el código privado.",true);
  try{
   const savedOk=await saveCode(code);
   if(!savedOk)throw Error("Iniciá sesión y verificá tu ID de Free Fire para guardarlo");
   $("js-web-code-status").textContent="✅ Código guardado en tu cuenta.";
  }catch(e){info("⚠️ "+e.message,true)}
 };
 $("js-web-saved-refresh").onclick=saved;
 sb.auth.onAuthStateChange((event)=>{if(event==="SIGNED_IN"||event==="SIGNED_OUT")setTimeout(current,0)});
 current();
})();
