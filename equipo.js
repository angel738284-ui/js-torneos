"use strict";
const $=id=>document.getElementById(id);
const endpoint=String(window.JS_CONFIG?.supabaseUrl||"").replace(/\/$/,"")+"/functions/v1/torneo";
const notice=(text,bad=false)=>{
 const el=$("notice");el.textContent=text;el.className="status show"+(bad?" error":"");
};
const dateTime=value=>new Date(value).toLocaleString("es-AR",{
 timeZone:"America/Argentina/Buenos_Aires",weekday:"long",day:"numeric",month:"long",
 hour:"2-digit",minute:"2-digit",hour12:false})+" (Argentina)";
const make=(type,text="",cls="")=>{
 const e=document.createElement(type);e.textContent=text;if(cls)e.className=cls;return e;
};
let busy=false,refreshTimer=null,countdownTimer=null,activeCountdowns=[],verifiedCode="";
function addRow(parent,title,value,canCopy=false){
 const wrap=make("div","","team-detail-row");
 const label=make("div",title,"small");
 const line=make("div","","team-detail-value");
 const content=make("strong",value);
 line.append(content);
 if(canCopy){
   const button=make("button","Copiar","secondary");button.type="button";
   button.onclick=async()=>{
     try{await navigator.clipboard.writeText(value);notice("Dato de sala copiado.");}
     catch{
       const tmp=document.createElement("input");tmp.value=value;
       document.body.append(tmp);tmp.select();
       const ok=document.execCommand("copy");tmp.remove();
       notice(ok?"Dato de sala copiado.":"Seleccioná y copiá el dato manualmente.",!ok);
     }
   };
   line.append(button);
 }
 wrap.append(label,line);parent.append(wrap);
 return wrap;
}
function formatLeft(seconds){
 const s=Math.max(0,seconds);
 return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");
}
function tickCountdown(){
 for(const row of activeCountdowns){
   if(row.expired||!row.status.isConnected)continue;
   const seconds=Math.max(0,Math.ceil((row.expiresLocal-Date.now())/1000));
   if(seconds>0){
     row.status.textContent="🟢 Sala enviada AHORA · quedan "+formatLeft(seconds)+" para ingresar";
   }else{
     row.expired=true;
     // Ocultar ID/contraseña incluso si falla la siguiente consulta de red.
     row.secrets.replaceChildren();
     row.status.textContent="⌛ Tiempo de espera agotado (10 minutos). Pedile una sala nueva al administrador.";
     row.status.classList.remove("room-send-live");
     row.status.classList.add("room-send-expired");
     lookup(true);
   }
 }
}
async function lookup(silent=false){
 const access=$("teamAccess").value.toUpperCase().trim().replace(/\s+/g,"");
 $("teamAccess").value=access;
 if(!/^JS-EQ-[A-HJ-NP-Z2-9]{20}$/.test(access)){
   if(!silent)notice("Revisá tu código privado de equipo (empieza con JS-EQ-).",true);
   return;
 }
 if(busy)return;
 busy=true;const b=$("check");if(!silent){b.disabled=true;b.textContent="Consultando…";}
 try{
   const res=await fetch(endpoint,{
     method:"POST",cache:"no-store",headers:{"content-type":"application/json"},
     body:JSON.stringify({action:"team_dashboard",team_code:access})
   });
   const data=await res.json();
   if(!res.ok)throw Error(data.error||"No se pudo consultar el equipo");
   if(!Array.isArray(data.matches))throw Error("La respuesta del servidor está incompleta.");
   verifiedCode=access;
   $("teamName").textContent=data.team||"Equipo";
   $("tournamentName").textContent=(data.tournament||"Torneo")+" · "+(data.mode||"");
   $("tournamentStatus").textContent=data.tournament_status==="finished"?"Terminado":
     data.tournament_status==="open"?"Inscripciones abiertas":"Inscripciones cerradas";
   $("tournamentStart").textContent=data.tournament_start?
     "Fecha general del torneo: "+dateTime(data.tournament_start):"Fecha general del torneo: por confirmar";
   const list=$("matches");list.replaceChildren();
   activeCountdowns=[];
   // Calibrar cuenta regresiva con la hora de Supabase, no la del teléfono.
   const serverTime=Date.parse(data.server_now||"");
   const offset=Number.isFinite(serverTime)?Date.now()-serverTime:0;
   if(!data.matches.length){
     list.append(make("div","Todavía no se generaron los cruces. Cuando estén listos aparecerá tu contrincante.","item"));
   }else for(const match of data.matches){
     const card=make("div","","item team-private-match");
     card.append(make("div",match.final?"🏆 FINAL":"⚔️ RONDA "+match.round,"team-round"));
     card.append(make("h3",(data.team||"Tu equipo")+" VS. "+(match.opponent||"Por definir")));
     const result=match.winner==="win"?"✅ Ganaron":match.winner==="lose"?"Resultado: perdió tu equipo":"Resultado pendiente";
     addRow(card,"Estado",result);
     if(match.final&&match.final_score)
       addRow(card,"Marcador de la final",match.final_score.us+" – "+match.final_score.them);
     const status=make("div","","room-send-status");card.append(status);
     const secrets=make("div","","team-private-credentials");card.append(secrets);
     if(match.room_status==="active"&&match.room_id&&match.room_password&&match.room_expires_at){
       status.classList.add("room-send-live");
       addRow(secrets,"ID de sala",match.room_id,true);
       addRow(secrets,"Contraseña de sala",match.room_password,true);
       const expiry=Date.parse(match.room_expires_at)+offset;
       if(Number.isFinite(expiry))activeCountdowns.push({status,secrets,expiresLocal:expiry,expired:false});
       else{secrets.replaceChildren();status.textContent="No se pudo verificar el plazo. Actualizá la información.";}
     }else if(match.room_status==="expired"){
       status.textContent="⌛ Plazo de 10 minutos agotado. Esperá a que el administrador envíe una sala nueva.";
       status.classList.add("room-send-expired");
     }else if(match.room_status==="finished"){
       status.textContent="✅ Partida finalizada. Las credenciales de la sala ya no están disponibles.";
     }else{
       status.textContent="🔒 Sala pendiente: el administrador todavía no la envió.";
     }
     list.append(card);
   }
   $("teamPanel").classList.remove("hidden");
   tickCountdown();
   if(!silent)notice("Equipo encontrado. Cuando el organizador envíe la sala, aparecerá aquí automáticamente.");
   if(!refreshTimer){
     // Consulta sólo mientras esta página está abierta y visible; no genera alertas push.
     refreshTimer=setInterval(()=>{if(document.visibilityState!=="hidden")lookup(true)},12000);
     countdownTimer=setInterval(tickCountdown,1000);
   }
 }catch(e){
   // En caso de error de red, ocultar cualquier contraseña que pudiera quedar visible.
   $("teamPanel").classList.add("hidden");
   activeCountdowns=[];
   if(!silent)notice(e.message||"Error de conexión",true);
 }finally{
   busy=false;
   if(!silent){b.disabled=false;b.textContent="Consultar mis enfrentamientos";}
 }
}
$("check").onclick=()=>lookup(false);
$("refresh").onclick=()=>lookup(false);
$("teamAccess").onkeydown=e=>{if(e.key==="Enter")lookup(false)};
$("teamAccess").oninput=()=>{
 if($("teamAccess").value.trim().toUpperCase()!==verifiedCode){
   $("teamPanel").classList.add("hidden");
   activeCountdowns=[];verifiedCode="";
   if(refreshTimer){clearInterval(refreshTimer);refreshTimer=null;}
   if(countdownTimer){clearInterval(countdownTimer);countdownTimer=null;}
 }
};
document.addEventListener("visibilitychange",()=>{
 if(document.visibilityState==="visible"&&verifiedCode)lookup(true);
});
