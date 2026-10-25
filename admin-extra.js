"use strict";
function newTeamCode(){
 const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
 const bytes=crypto.getRandomValues(new Uint8Array(20));
 return "JS-EQ-"+[...bytes].map(x=>chars[x%chars.length]).join("");
}
async function teamCodeDigest(value){
 const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("js-torneos-team-access-v1:"+value));
 return [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function generateTeamCode(team){
 if(team.access_code_hash && !(await askConfirm("¿Renovar el código de "+team.name+"? El anterior dejará de funcionar.")))return;
 const code=newTeamCode();
 try{
  const {data,error}=await db.rpc("js_replace_team_access",{p_team:team.id,p_hash:await teamCodeDigest(code)});
  if(error||data!==true)throw error||new Error("No se confirmó la asignación");
  const overlay=document.createElement("div");
  overlay.style.cssText="position:fixed;inset:0;z-index:1000000;display:flex;align-items:center;justify-content:center;padding:18px;background:#020713ea";
  const panel=document.createElement("div");panel.className="panel";panel.style.cssText="width:100%;max-width:440px";
  const heading=document.createElement("h3");heading.textContent="🔐 Código privado de "+team.name;
  const desc=document.createElement("p");desc.className="small";desc.textContent="Mandáselo solo al capitán. Podrá consultar los enfrentamientos, horarios y salas. Guardalo: no se podrá recuperar el mismo código después.";
  const input=document.createElement("input");input.value=code;input.readOnly=true;input.style.fontWeight="900";
  const copy=document.createElement("button");copy.type="button";copy.className="secondary full";copy.textContent="Copiar código";
  copy.onclick=async()=>{
   try{await navigator.clipboard.writeText(code);copy.textContent="✓ Código copiado";}
   catch{
    input.focus();input.select();
    const success=document.execCommand("copy");
    copy.textContent=success?"✓ Código copiado":"Copiá el texto seleccionado";
   }
  };
  const close=document.createElement("button");close.type="button";close.className="ghost full";close.style.marginTop="10px";close.textContent="Cerrar";
  close.onclick=()=>overlay.remove();
  panel.append(heading,desc,input,copy,close);overlay.append(panel);document.body.append(overlay);
  await loadTeamsMatches();
 }catch(e){message("No se pudo generar el código del equipo: "+(e.message||String(e)),true)}
}
// Vista de administración de sala: no programa fechas. Enviar AHORA habilita
// la sala durante 10 minutos, luego el servidor la oculta automáticamente.
const ROOM_WINDOW_MS=10*60*1000; // Respaldo para salas creadas antes de configurar tolerancia.
function roomCountLabel(ms){
 const s=Math.max(0,Math.ceil(ms/1000));
 return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");
}
function appendRoomEditor(match,card){
 const stored=roomCache.get(match.id)||{};
 const details=document.createElement("details");
 details.className="room-editor";
 const summary=document.createElement("summary");
 summary.textContent="📨 Enviar sala a los dos equipos";
 details.append(summary);
 const panel=document.createElement("div");panel.className="room-fields";
 const status=document.createElement("div");
 status.className="room-send-status";
 const label=document.createElement("label");label.textContent="ID de la sala";
 const id=document.createElement("input");
 id.type="text";id.value=stored.room_id||"";id.maxLength=60;
 id.autocomplete="off";id.placeholder="Número o código de la sala";
 const passwordLabel=document.createElement("label");passwordLabel.textContent="Contraseña";
 const password=document.createElement("input");
 password.type="text";password.value=stored.room_password||"";password.maxLength=80;
 password.autocomplete="off";password.placeholder="Contraseña de la sala";
 const btn=document.createElement("button");btn.type="button";btn.className="good full";
 btn.textContent="📨 Guardar y enviar ahora";
 btn.style.marginTop="13px";
 const close=document.createElement("button");close.type="button";close.className="ghost full";
 close.textContent="🔒 Cerrar sala ahora";close.style.marginTop="10px";
 const note=document.createElement("p");note.className="small";
 note.textContent="Se publica en el mismo momento para los dos capitanes. El plazo depende de la tolerancia de este torneo (5 o 10 minutos), más una prórroga opcional del administrador. Nunca se aplica W.O. automáticamente.";
 const sentAt=stored.sent_at?Date.parse(stored.sent_at):0;
 const expiry=sentAt?(stored.expires_at?Date.parse(stored.expires_at):sentAt+ROOM_WINDOW_MS):0;
 function updateState(){
   const remaining=expiry-Date.now();
   if(sentAt&&remaining>0){
     status.textContent="🟢 Sala enviada · quedan "+roomCountLabel(remaining)+(stored.grace_extended?" (incluye 5 minutos extra)":"");
     status.className="room-send-status room-send-live";
     close.classList.remove("hidden");
   }else if(sentAt){
     status.textContent="⌛ Plazo de ingreso vencido. Si necesitás otra sala, enviá datos nuevos.";
     status.className="room-send-status room-send-expired";
     close.classList.add("hidden");
   }else{
     status.textContent=stored.room_id?"🔒 Sala guardada anteriormente, todavía no enviada con este sistema.":"🔒 Sala pendiente de envío";
     status.className="room-send-status";
     close.classList.add("hidden");
   }
 }
 updateState();
 if(sentAt&&expiry>Date.now()){
   const ticker=setInterval(()=>{
     if(!card.isConnected){clearInterval(ticker);return;}
     updateState();
     if(Date.now()>=expiry)clearInterval(ticker);
   },1000);
 }
 btn.onclick=async()=>{
   const room=id.value.trim(),pass=password.value.trim();
   if(!room||!pass)return message("Necesitás el ID y la contraseña para enviar la sala.",true);
   if(room.length>60||pass.length>80)return message("El ID o la contraseña superan el máximo permitido.",true);
   if(!match.team_a||!match.team_b)return message("Primero tienen que estar definidos los dos equipos del cruce.",true);
   if(sentAt&&expiry>Date.now()&&!(await askConfirm("La sala anterior sigue activa. ¿Querés reiniciar la tolerancia y las confirmaciones enviando esta sala nuevamente?")))return;
   if(!(await askConfirm("¿Enviar AHORA la sala a los dos equipos? Tendrán "+(opened?.absence_minutes||10)+" minutos para confirmar su presencia.")))return;
   btn.disabled=true;btn.textContent="Enviando…";
   try{
     const {data,error}=await db.rpc("js_send_match_room",{p_match:match.id,p_room_id:room,p_room_password:pass});
     if(error)throw error;
     if(!data?.ok)throw Error("El servidor no confirmó el envío");
     await openTour(opened.id);
     message("✅ Sala enviada a ambos equipos. Tienen "+(opened?.absence_minutes||10)+" minutos para entrar.");
   }catch(e){
     message("No se pudo enviar la sala: "+(e.message||String(e)),true);
     btn.disabled=false;btn.textContent="📨 Guardar y enviar ahora";
   }
 };
 close.onclick=async()=>{
   if(!(await askConfirm("¿Cerrar esta sala ahora? Los capitanes dejarán de ver la contraseña.")))return;
   close.disabled=true;
   try{
     const {data,error}=await db.rpc("js_close_match_room",{p_match:match.id});
     if(error||data!==true)throw error||Error("No se confirmó el cierre");
     await openTour(opened.id);
     message("Sala cerrada. Las credenciales ya no se muestran a los capitanes.");
   }catch(e){message("No se pudo cerrar la sala: "+(e.message||String(e)),true);close.disabled=false}
 };
 panel.append(status,label,id,passwordLabel,password,btn,close,note);
 details.append(panel);card.append(details);
}
