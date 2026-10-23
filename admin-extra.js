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
function pickRoomDay(savedIso){
 const s=document.createElement("select");
 const none=document.createElement("option");none.textContent="Sin fecha definida";none.value="";s.append(none);
 const today=new Date();today.setHours(0,0,0,0);
 const stored=savedIso?new Date(savedIso):null;
 const format=new Intl.DateTimeFormat("es-AR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
 const values=new Set();
 const dateCode=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
 const append=d=>{
  const value=dateCode(d);if(values.has(value))return;
  values.add(value);const opt=document.createElement("option");opt.value=value;opt.textContent=format.format(d);s.append(opt);
 };
 if(stored&&!Number.isNaN(stored.getTime()))append(stored);
 for(let offset=0;offset<91;offset++)append(new Date(today.getFullYear(),today.getMonth(),today.getDate()+offset,12));
 s.value=stored&&!Number.isNaN(stored.getTime())?dateCode(stored):"";
 return s;
}
function appendRoomEditor(match,card){
 const saved=roomCache.get(match.id)||{};
 const details=document.createElement("details");details.className="room-editor";
 const summary=document.createElement("summary");
 summary.textContent=saved.room_id||saved.starts_at?"⚙️ Sala configurada · Editar":"＋ Configurar sala y horario";
 details.append(summary);
 const panel=document.createElement("div");panel.className="room-fields";
 const dayLabel=document.createElement("label");dayLabel.textContent="Día del enfrentamiento";
 const day=pickRoomDay(saved.starts_at);
 const timeLabel=document.createElement("label");timeLabel.textContent="Hora (Argentina)";
 const time=document.createElement("input");time.type="time";
 const old=saved.starts_at?new Date(saved.starts_at):null;
 time.value=old&&!Number.isNaN(old.getTime())?
   String(old.getHours()).padStart(2,"0")+":"+String(old.getMinutes()).padStart(2,"0"):"20:00";
 const roomLabel=document.createElement("label");roomLabel.textContent="ID de la sala";
 const room=document.createElement("input");room.value=saved.room_id||"";room.maxLength=60;room.placeholder="Ej.: 123456789";
 const passLabel=document.createElement("label");passLabel.textContent="Contraseña";
 const pass=document.createElement("input");pass.value=saved.room_password||"";pass.maxLength=80;pass.placeholder="Contraseña de la sala";
 const btn=document.createElement("button");btn.type="button";btn.className="secondary full";btn.style.marginTop="13px";btn.textContent="Guardar sala y horario";
 const note=document.createElement("p");note.className="small";note.textContent="Estos datos solo serán visibles para los equipos de este cruce que tengan su código privado.";
 btn.onclick=async()=>{
  const roomId=room.value.trim(),password=pass.value.trim();
  if(password&&!roomId)return message("Primero ingresá el ID de la sala.",true);
  if(roomId.length>60||password.length>80)return message("ID de sala o contraseña demasiado largos.",true);
  let starts=null;
  if(day.value){
    const date=new Date(day.value+"T"+(time.value||"20:00")+":00");
    if(!Number.isFinite(date.getTime()))return message("Fecha u hora inválidas.",true);
    starts=date.toISOString();
  }
  btn.disabled=true;
  try{
   const {error}=await db.from("js_match_rooms").upsert({
    match_id:match.id,room_id:roomId,room_password:password,starts_at:starts,
    updated_at:new Date().toISOString()
   },{onConflict:"match_id"});
   if(error)throw error;
   await openTour(opened.id);
   message("✓ Sala y horario guardados. Los equipos podrán consultarlos con su código privado.");
  }catch(e){message("No se pudo guardar la sala: "+(e.message||String(e)),true)}
  finally{btn.disabled=false;}
 };
 panel.append(dayLabel,day,timeLabel,time,roomLabel,room,passLabel,pass,btn,note);
 details.append(panel);card.append(details);
}
