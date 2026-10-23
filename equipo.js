"use strict";
const $=id=>document.getElementById(id);
const endpoint=String(window.JS_CONFIG?.supabaseUrl||"").replace(/\/$/,"")+"/functions/v1/torneo";
const notice=(text,bad=false)=>{const el=$("notice");el.textContent=text;el.className="status show"+(bad?" error":"")};
const dateTime=value=>new Date(value).toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires",weekday:"long",day:"numeric",month:"long",hour:"2-digit",minute:"2-digit",hour12:false})+" (Argentina)";
const make=(type,text,cls)=>{const e=document.createElement(type);e.textContent=text;if(cls)e.className=cls;return e;};
function addRow(parent,title,value,privateValue=false){
 const wrap=make("div","","team-detail-row");
 const label=make("div",title,"small");
 const line=make("div","","team-detail-value");
 const content=make("strong",value);
 line.append(content);
 if(privateValue&&value&&value!=="Por confirmar"){
   const b=make("button","Copiar","secondary");
   b.type="button";b.onclick=async()=>{
     try{await navigator.clipboard.writeText(value);notice("Dato de sala copiado.");}
     catch{
       const tmp=document.createElement("input");tmp.value=value;document.body.append(tmp);tmp.select();
       try{document.execCommand("copy");notice("Dato de sala copiado.");}
       catch{notice("No se pudo copiar automáticamente. Seleccioná el texto.",true);}
       tmp.remove();
     }
   };line.append(b);
 }
 wrap.append(label,line);parent.append(wrap);
}
async function lookup(){
 const access=$("teamAccess").value.toUpperCase().trim().replace(/\s+/g,"");
 $("teamAccess").value=access;
 if(!/^JS-EQ-[A-HJ-NP-Z2-9]{20}$/.test(access))return notice("Revisá el código privado de equipo (empieza por JS-EQ-).",true);
 const b=$("check");b.disabled=true;b.textContent="Consultando…";
 try{
  const res=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({action:"team_dashboard",team_code:access})});
  const data=await res.json();
  if(!res.ok)throw Error(data.error||"No se pudo consultar el equipo");
  $("teamName").textContent=data.team;
  $("tournamentName").textContent=data.tournament+" · "+(data.mode||"");
  $("tournamentStatus").textContent=data.tournament_status==="finished"?"Terminado":
    data.tournament_status==="open"?"Inscripciones abiertas":"Inscripciones cerradas";
  $("tournamentStart").textContent=data.tournament_start?
   "Fecha general del torneo: "+dateTime(data.tournament_start):"Fecha general del torneo: por confirmar";
  const list=$("matches");list.replaceChildren();
  if(!Array.isArray(data.matches)||!data.matches.length){
   list.append(make("div","Todavía no hay un contrincante asignado. El administrador publicará los cruces cuando estén listos.","item"));
  }else{
   for(const m of data.matches){
    const card=make("div","","item team-private-match");
    card.append(make("div",m.final?"🏆 FINAL":"⚔️ RONDA "+m.round,"team-round"));
    card.append(make("h3",data.team+" VS. "+m.opponent));
    const result=m.winner==="win"?"✅ Ganaron":m.winner==="lose"?"Resultado: perdió tu equipo":"Resultado pendiente";
    addRow(card,"Estado",result);
    if(m.final&&m.final_score)addRow(card,"Marcador de la final",m.final_score.us+" – "+m.final_score.them);
    addRow(card,"Día y hora de esta partida",m.scheduled_at?dateTime(m.scheduled_at):"Por confirmar");
    addRow(card,"ID de la sala",m.room_id||"Por confirmar",true);
    addRow(card,"Contraseña de sala",m.room_password||"Por confirmar",true);
    list.append(card);
   }
  }
  $("teamPanel").classList.remove("hidden");
  notice("Información actualizada. Los horarios y salas pueden cambiar hasta que el organizador los confirme.");
 }catch(e){
  $("teamPanel").classList.add("hidden");
  notice(e.message||"Error de conexión",true);
 }finally{b.disabled=false;b.textContent="Consultar mis enfrentamientos";}
}
$("check").onclick=lookup;
$("refresh").onclick=lookup;
$("teamAccess").onkeydown=e=>{if(e.key==="Enter")lookup()};
