"use strict";
(function(){
 const $=id=>document.getElementById(id);
 const make=(tag,label,cls)=>{const x=document.createElement(tag);if(label!==undefined)x.textContent=label;if(cls)x.className=cls;return x};
 const endpoint=String(window.JS_CONFIG?.supabaseUrl||"").replace(/\/$/,"")+"/functions/v1/torneo";
 const note=(msg,bad=false)=>{const n=$("notice");n.textContent=msg;n.className="status show"+(bad?" error":"")};
 const fmt=s=>String(Math.floor(Math.max(0,s)/60)).padStart(2,"0")+":"+String(Math.max(0,s)%60).padStart(2,"0");
 function decorateMatch(card,m,data){
   const box=make("section",undefined,"attendance-card");
   const h=make("strong","✅ Confirmación de asistencia");
   const progress=make("div",undefined,"attendance-row");
   const me=make("span",m.attendance_self?"✅ Tu equipo: listo":"⏳ Tu equipo: pendiente",m.attendance_self?"attendance-ok":"attendance-pending");
   const rival=make("span",m.attendance_opponent?"✅ Rival: listo":"⏳ Rival: pendiente",m.attendance_opponent?"attendance-ok":"attendance-pending");
   progress.append(me,rival);
   const clock=make("div",undefined,"attendance-clock");
   const label=make("p","Una confirmación por equipo. El administrador decide qué hacer si alguien falta.","small");
   box.append(h,progress,clock,label);
   let live=m.room_status==="active"&&Boolean(m.room_expires_at);
   let expires=0;
   if(live){
     const base=Date.parse(data.server_now||"");
     const offset=Number.isFinite(base)?Date.now()-base:0;
     expires=Date.parse(m.room_expires_at)+offset;
   }
   const confirm=make("button","✅ Estamos listos","good full");confirm.type="button";
   const update=()=>{
     if(!box.isConnected){clearInterval(timer);return;}
     const seconds=Math.max(0,Math.ceil((expires-Date.now())/1000));
     if(live&&seconds>0){
       clock.textContent="⏱️ Tiempo para ingresar: "+fmt(seconds)+" (tolerancia inicial: "+(m.absence_minutes||10)+" min)";
       if(!m.attendance_self)confirm.disabled=false;
     }else{
       clock.textContent=m.room_status==="expired"||live?"⌛ Terminó el plazo para ingresar.":
         m.room_status==="finished"?"Partida finalizada.":"La sala todavía no fue enviada.";
       confirm.disabled=true;confirm.classList.add("hidden");
       clearInterval(timer);
     }
   };
   if(live&&!m.attendance_self){
     confirm.onclick=async()=>{
       if(confirm.disabled||Date.now()>=expires)return;
       confirm.disabled=true;confirm.textContent="Confirmando…";
       try{
         const token=$("teamAccess").value.trim().toUpperCase();
         const res=await fetch(endpoint,{method:"POST",cache:"no-store",headers:{"content-type":"application/json"},
           body:JSON.stringify({action:"team_check_in",team_code:token,match_id:m.match_id})});
         const answer=await res.json();
         if(!res.ok||!answer.ok)throw Error(answer.error||"No se pudo confirmar la asistencia");
         m.attendance_self=true;
         me.textContent="✅ Tu equipo: listo";me.className="attendance-ok";
         confirm.remove();
         note("✅ Confirmaste asistencia para esta sala. Esperá las indicaciones del organizador.");
         await window.lookupTeamAfterRosterChange?.();
       }catch(err){note("No se pudo confirmar: "+err.message,true);confirm.textContent="✅ Estamos listos";update()}
     };
     box.append(confirm);
   }else if(m.attendance_self){
     box.append(make("p","Tu capitán ya confirmó que el equipo está listo.","attendance-ok small"));
   }
   card.append(box);
   const timer=setInterval(update,1000);
   update();
 }
 window.JSAttendanceCaptain=Object.freeze({decorateMatch});
})();
