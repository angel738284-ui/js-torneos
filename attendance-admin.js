"use strict";
(function(){
 const model=new Map();
 let refreshQueued=false;
 const q=id=>document.getElementById(id);
 const make=(tag,label,cls)=>{const el=document.createElement(tag);if(label!==undefined)el.textContent=label;if(cls)el.className=cls;return el};
 const fmt=n=>String(Math.floor(Math.max(0,n)/60)).padStart(2,"0")+":"+String(Math.max(0,n)%60).padStart(2,"0");
 function decorateMatch(match,card){
   const box=make("div",undefined,"attendance-admin-box");
   const heading=make("strong","✅ Asistencia de los equipos");
   const remaining=make("p","","attendance-clock");
   const members=make("div",undefined,"attendance-row");
   const statuses=[];
   for(const [key,letter] of [["team_a","A"],["team_b","B"]]){
     const el=make("div","Pendiente","attendance-pending");
     const teamName=teamCache.find(t=>t.id===match[key])?.name||"Por definir";
     el.textContent=letter+" · "+teamName+": pendiente";
     el.dataset.member=key;
     members.append(el);statuses.push({id:match[key],name:teamName,el});
   }
   const note=make("p","El contador comienza cuando enviás la sala. No se aplica descalificación automática.","small");
   box.append(heading,remaining,members,note);
   card.append(box);
   model.set(match.id,{card,match,box,remaining,statuses,rows:[]});
   renderState(model.get(match.id));
   if(!refreshQueued){
     refreshQueued=true;
     Promise.resolve().then(()=>{refreshQueued=false;refresh()});
   }
 }
 function renderState(info){
   if(!info.card.isConnected)return;
   const room=roomCache.get(info.match.id);
   const sent=room?.sent_at?Date.parse(room.sent_at):NaN;
   const left=Math.ceil((sent+600000-Date.now())/1000);
   const active=Number.isFinite(sent)&&sent<=Date.now()&&left>0&&
     !info.match.winner&&opened?.status!=="finished";
   info.remaining.textContent=active?"⏱️ Tiempo restante: "+fmt(left)+" / 10:00":
     !Number.isFinite(sent)?"🔒 Sala pendiente de envío":"⌛ Espera de 10 minutos finalizada";
   for(const p of info.statuses){
     const confirmed=Boolean(Number.isFinite(sent)&&p.id&&info.rows.some(a=>a.team_id===p.id&&Date.parse(a.room_sent_at)===sent));
     p.el.textContent=(confirmed?"✅ ":"⏳ ")+p.name+": "+(confirmed?"LISTO":"pendiente");
     p.el.className=confirmed?"attendance-ok":"attendance-pending";
   }
 }
 async function refresh(){
   if(!opened||!matchCache?.length||!db)return;
   const entries=[...model.values()].filter(e=>e.card.isConnected);
   if(!entries.length)return;
   const ids=entries.map(x=>x.match.id);
   const {data,error}=await db.from("js_match_attendance")
     .select("match_id,team_id,room_sent_at,confirmed_at").in("match_id",ids);
   if(error){console.warn("No se pudo actualizar asistencia:",error.message);return}
   const byMatch=new Map();
   for(const v of data||[]){if(!byMatch.has(v.match_id))byMatch.set(v.match_id,[]);byMatch.get(v.match_id).push(v)}
   for(const e of entries){e.rows=byMatch.get(e.match.id)||[];renderState(e)}
 }
 function tick(){for(const [id,e] of model){if(!e.card.isConnected){model.delete(id);continue;}renderState(e)}}
 setInterval(tick,1000);
 setInterval(()=>{
   if(document.visibilityState==="hidden"||!opened||!q("detailBrackets")||q("detailBrackets").classList.contains("hidden"))return;
   refresh();
 },10000);
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refresh()});
 window.JSAttendanceAdmin=Object.freeze({decorateMatch,refresh});
})();
