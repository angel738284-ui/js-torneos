"use strict";
window.JSBRAdmin={
 async render(db,tour,teams,refresh,showMessage,confirmChange){
  const root=document.getElementById("brRoomPanel");
  if(!root)return;
  root.replaceChildren();
  if(tour.mode!=="BR")return;
  const make=(tag,label,cls)=>{
   const el=document.createElement(tag);
   if(label!==undefined)el.textContent=label;
   if(cls)el.className=cls;
   return el;
  };
  const registered=teams.filter(t=>t.status==="registered");
  root.append(make("h3","📨 Sala Battle Royale · todos contra todos"));
  root.append(make("p","Una sola sala para todos. Enviá el ID y la contraseña una vez: los "+registered.length+
   " participantes/equipos inscritos los verán desde Mi equipo o la app de jugadores.","small"));
  let br;
  try{
   const {data,error}=await db.from("js_br_rooms")
     .select("room_id,room_password,sent_at,is_open,winner_team,finished_at")
     .eq("tournament_id",tour.id).maybeSingle();
   if(error)throw error;
   br=data;
  }catch(e){
   root.append(make("p","⚠️ No se pudo consultar la sala: "+(e.message||String(e)),"small"));
   return;
  }
  const status=make("div",undefined,"br-shared-status");
  if(br?.winner_team){
   const winner=teams.find(t=>t.id===br.winner_team);
   status.textContent="🏆 CAMPEÓN BR: "+(winner?.name||"Ganador")+". Torneo finalizado.";
  }else if(br?.is_open){
   status.textContent="🟢 Sala enviada a todos · "+
     (br.sent_at?new Date(br.sent_at).toLocaleString("es-AR"):"")+
     " · Inscripciones cerradas.";
  }else if(br){
   status.textContent="🔒 Sala cerrada. Podés enviar otra sala general con datos nuevos.";
  }else{
   status.textContent="⏳ Sala pendiente de envío. Los jugadores esperan los datos.";
  }
  root.append(status);
  if(br?.winner_team)return;
  const fields=make("div",undefined,"br-shared-fields");
  const labelId=make("label","ID de sala BR");
  const roomId=make("input");roomId.type="text";roomId.maxLength=60;
  roomId.placeholder="ID de la sala";roomId.autocomplete="off";
  roomId.value=br?.room_id||"";
  const labelPass=make("label","Contraseña (igual para todos)");
  const pass=make("input");pass.type="text";pass.maxLength=80;
  pass.autocomplete="off";pass.placeholder="Contraseña de la sala";
  pass.value=br?.room_password||"";
  const send=make("button",br?.is_open?"🔁 Reenviar sala a todos":"📨 Enviar sala a todos","good full");
  send.type="button";send.disabled=!registered.length||tour.status==="finished";
  send.onclick=async()=>{
   const rid=roomId.value.trim(),password=pass.value.trim();
   if(!rid||!password)return showMessage("Escribí el ID y la contraseña.",true);
   if(!await confirmChange("¿Enviar UNA sola sala BR a los "+registered.length+
    " participantes/equipos? Todos recibirán el mismo ID y contraseña en su cuenta y las inscripciones se cerrarán."))
    return;
   send.disabled=true;
   try{
    const {data,error}=await db.rpc("js_br_send_room",{
     p_tournament:tour.id,p_room_id:rid,p_password:password
    });
    if(error||!data?.ok)throw error||Error("No se confirmó el envío");
    await refresh();
    showMessage("✅ Sala BR enviada a los "+data.recipient_teams+" equipos/participantes inscritos.");
   }catch(e){showMessage("No se pudo enviar la sala: "+(e.message||String(e)),true);}
   finally{send.disabled=false;}
  };
  fields.append(labelId,roomId,labelPass,pass,send);root.append(fields);
  if(br?.is_open){
   const close=make("button","🔒 Cerrar acceso a la sala","secondary full");
   close.type="button";close.style.marginTop="10px";
   close.onclick=async()=>{
    if(!await confirmChange("¿Cerrar el acceso al ID y contraseña BR? Podrás reenviar la sala luego."))return;
    close.disabled=true;
    try{
     const {data,error}=await db.rpc("js_br_close_room",{p_tournament:tour.id});
     if(error||!data?.ok)throw error||Error("No se confirmó el cierre");
     await refresh();showMessage("Acceso a la sala BR cerrado.");
    }catch(e){showMessage(e.message||String(e),true);close.disabled=false;}
   };
   root.append(close);
  }
  if(br){
   const line=make("div",undefined,"divider");root.append(line);
   root.append(make("h3","🏆 Confirmar único ganador BR"));
   root.append(make("p","Una vez termine la partida, elegí el participante, dúo o escuadra campeón. No hay llaves ni mejor de tres.","small"));
   const winner=make("select");winner.style.margin="8px 0 11px";
   winner.append(make("option","Seleccioná al ganador"));
   winner.firstChild.value="";
   for(const t of registered){
    const opt=make("option",t.name);opt.value=t.id;winner.append(opt);
   }
   const finalize=make("button","🏆 Finalizar BR y declarar campeón","good full");
   finalize.type="button";finalize.disabled=!registered.length;
   finalize.onclick=async()=>{
    const selected=registered.find(t=>t.id===winner.value);
    if(!selected)return showMessage("Elegí quién ganó el Battle Royale.",true);
    if(!await confirmChange("¿Confirmar que «"+selected.name+"» es el ÚNICO ganador del torneo BR? "+
      "Esta decisión termina el torneo y se notificará a todos."))return;
    finalize.disabled=true;
    try{
     const {data,error}=await db.rpc("js_br_finish",{p_tournament:tour.id,p_winner_team:selected.id});
     if(error||!data?.ok)throw error||Error("No se confirmó el campeón");
     await refresh();showMessage("🏆 Campeón BR confirmado: "+selected.name);
    }catch(e){showMessage("No se pudo finalizar el BR: "+(e.message||String(e)),true);finalize.disabled=false;}
   };
   root.append(winner,finalize);
  }
 }
};