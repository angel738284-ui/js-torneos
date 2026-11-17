/**
 * One-time link between a Google-authenticated JS Torneos account and its
 * WhatsApp chat with Guardian. Codes are only displayed in this browser;
 * secrets for the bot remain on the Samsung Termux instance.
 */
export function createLeagueWhatsApp({sb,getMe,getView,render,flash,btn,esc}){
 let uid=null,loaded=false,loading=false,linked=false,hint="",code="",expiry="",error="";
 async function rpc(name,args={}){
  const {data,error:callError}=await sb.rpc(name,args);
  if(callError)throw callError;
  if(!data?.ok)throw Error(data?.message||"No se pudo vincular WhatsApp.");
  return data;
 }
 function reset(){
  uid=null;loaded=false;loading=false;linked=false;hint="";code="";expiry="";error="";
 }
 async function refresh(force=false){
  const me=getMe();
  if(!me)return;
  if(uid!==me)reset();
  uid=me;
  if(loading||loaded&&!force)return;
  loading=true;error="";
  try{
   const info=await rpc("js_liga_wa_estado");
   linked=info.linked===true;
   hint=info.phone_hint||"";
   loaded=true;
   if(linked){code="";expiry="";}
  }catch(e){loaded=false;error=e?.message||"No pudimos consultar la vinculación.";}
  finally{loading=false;if(getView()==="whatsapp")render();}
 }
 function screen(){
  if(!getMe())return '<section class="panel"><h2>💬 WhatsApp</h2><p>Iniciá sesión para conectar JS Guardian.</p></section>';
  return '<section class="panel wa-link-card">'+
   '<h2>💬 Jugar 2VS2 por WhatsApp</h2>'+
   '<p class="muted">Usá el privado de *JS Guardian* para buscar rival con tu dúo, informar Gané o Perdí y consultar o enviar la sala. Los puntos y las partidas son los mismos que en esta web.</p>'+
   '<div class="wa-link-status">'+
    (loaded?(linked?
      '<strong>✅ WhatsApp vinculado '+esc(hint)+'</strong>'+
       '<p class="muted">Ya podés enviar *.liga2 buscar* al bot por privado.</p>':
      '<strong>🔒 Aún no vinculaste tu WhatsApp</strong>'+
       '<p class="muted">Vinculá una sola vez tu cuenta Google de JS Torneos. No compartas tu código.</p>'):
       '<p class="muted">'+(loading?"Consultando conexión…":esc(error||"Conectando…"))+'</p>')+
   '</div>'+
   (linked?
    btn("↻ Revisar conexión","wa_refresh",'',"small")+
    btn("🔗 Desvincular WhatsApp","wa_unlink",'',"danger small"):
    '<div class="wa-link-steps">'+
      '<p><b>1.</b> Tocá Generar código y copialo.</p>'+
      '<p><b>2.</b> Abrí el chat privado con tu JS Guardian.</p>'+
      '<p><b>3.</b> Enviá <b>.liga2 vincular CÓDIGO</b>.</p>'+
    '</div>'+
    btn("🔐 Generar código por 10 minutos","wa_generate",'',"hot block")+
    (code?'<div class="wa-code-display"><small>Tu código temporal</small>'+
      '<strong>'+esc(code)+'</strong>'+
      '<span>Caduca: '+esc(new Date(expiry).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"}))+'</span>'+
      btn("📋 Copiar comando para WhatsApp","wa_copy",'',"good block")+
      '</div>':"")+
    btn("↻ Ya lo envié: comprobar vinculación","wa_refresh",'',"small block"))+
   '<details class="wa-link-help"><summary>📋 Comandos para jugar por privado</summary>'+
    '<p class="muted"><b>.liga2 buscar</b> — Cada integrante confirma la búsqueda.</p>'+
    '<p class="muted"><b>.liga2 mio</b> — Ver si tenés rival o un PvP activo.</p>'+
    '<p class="muted"><b>.liga2 gane</b> / <b>.liga2 perdi</b> — Dar tu resultado.</p>'+
    '<p class="muted"><b>.liga2 sala 123456 CLAVE</b> — Publicar sala para los cuatro.</p>'+
    '<p class="muted"><b>.liga2 sala ver</b> — Consultar ID y contraseña.</p>'+
    '<p class="muted"><b>.liga2 salir</b> — Cancelar la búsqueda.</p>'+
    '<p class="muted">El bot no crea las salas dentro de Free Fire: solo guarda y comparte sus datos. Las contraseñas se envían únicamente por privado a jugadores vinculados.</p>'+
   '</details>'+
   '</section>';
 }
 async function runAction(action){
  if(!["wa_generate","wa_copy","wa_refresh","wa_unlink"].includes(action))return false;
  if(action==="wa_copy"){
   if(!code)return true;
   const command=".liga2 vincular "+code;
   try{
    if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(command);flash("✅ Comando copiado. Enviáselo al bot por privado.");
    }else window.prompt("Copiá el comando:",command);
   }catch(e){flash("Copialo manualmente desde esta pantalla.",true);}
   return true;
  }
  if(loading)return true;
  if(action==="wa_refresh"){await refresh(true);return true;}
  if(action==="wa_unlink"&&!window.confirm("¿Desvincular WhatsApp? Dejarás de poder buscar y recibir salas por privado hasta volver a vincular."))
   return true;
  loading=true;
  try{
   if(action==="wa_generate"){
    const generated=await rpc("js_liga_wa_code");
    code=generated.code||"";expiry=generated.expires_at||"";
    flash("✅ Código creado. Se vence en 10 minutos.");
   }else{
    const result=await rpc("js_liga_wa_desvincular");
    linked=false;code="";expiry="";hint="";
    flash(result.message||"WhatsApp desvinculado.");
   }
  }catch(e){flash(e?.message||"No se pudo realizar la operación.",true);}
  finally{loading=false;render();}
  return true;
 }
 return {screen,refresh,reset,runAction};
}
