"use strict";
window.JSBRAdmin={
 async render(db,tour,teams,refresh,showMessage,confirmChange){
  const root=document.getElementById("brRoomPanel");
  if(!root)return;
  root.replaceChildren();
  if(tour.mode!=="BR")return;
  const make=(tag,label,cls)=>{
   const node=document.createElement(tag);
   if(label!==undefined)node.textContent=label;
   if(cls)node.className=cls;
   return node;
  };
  const registered=teams.filter(t=>t.status==="registered");
  root.append(make("h3","🗺 Battle Royale · 3 mapas, 3 salas"));
  root.append(make("p","Un mismo torneo y los mismos participantes para Bermuda, Purgatorio y Kalahari. Cada mapa tiene su ID y contraseña. Enviá cada sala cuando corresponda; al publicar la siguiente se cierra la anterior.","small"));
  let br,maps;
  try{
   const [legacy,three]=await Promise.all([
    db.from("js_br_rooms").select("room_id,room_password,sent_at,is_open,winner_team,finished_at").eq("tournament_id",tour.id).maybeSingle(),
    db.rpc("js_br_admin_maps",{p_tournament:tour.id})
   ]);
   if(legacy.error)throw legacy.error;
   if(three.error||!three.data?.ok)throw three.error||Error("No se pudieron consultar las salas BR.");
   br=legacy.data;maps=three.data.maps||[];
  }catch(e){
   root.append(make("p","⚠️ No se pudieron cargar los mapas: "+(e.message||String(e)),"small"));
   return;
  }
  const winner=br?.winner_team?teams.find(t=>t.id===br.winner_team):null;
  if(winner){
   root.append(make("p","🏆 CAMPEÓN BR: "+(winner.name||"Ganador")+". Torneo finalizado.","br-shared-status"));
  }
  const lastPublished=Math.max(0,...maps.filter(x=>!!x.sent_at).map(x=>Number(x.map_number)));
  const hasNewRooms=lastPublished>0;
  if(br&&!hasNewRooms){
   const old=make("div",undefined,"item");
   old.append(make("h3","Sala antigua (formato anterior)"));
   old.append(make("p",br.is_open?"🟢 Sala antigua habilitada":"🔒 Sala antigua cerrada","small"));
   if(br.is_open){old.append(make("p","ID: "+br.room_id,"small"),make("p","Contraseña: "+br.room_password,"small"));}
   root.append(old);
  }
  for(const m of maps){
   const number=Number(m.map_number);
   const name=String(m.map_name||["Bermuda","Purgatorio","Kalahari"][number-1]||"Mapa");
   const box=make("section",undefined,"item js-br-map");
   box.style.cssText="border:1px solid "+(m.is_open?"#5dddb7":"#4b6078")+";border-radius:15px;padding:14px;margin:12px 0;background:#0f1b2ccc";
   box.append(make("div","MAPA "+number+" · "+name,"team-round"));
   box.append(make("p",m.is_open?"🟢 Sala publicada":m.sent_at?"🔒 Sala cerrada":"⏳ Sin publicar","small"));
   const idLabel=make("label","🎮 ID de sala · "+name);
   const roomId=make("input");roomId.type="text";roomId.maxLength=60;
   roomId.placeholder="ID de "+name;roomId.autocomplete="off";roomId.value=m.room_id||"";
   const passLabel=make("label","🔑 Contraseña · "+name);
   const password=make("input");password.type="text";password.maxLength=80;
   password.placeholder="Contraseña de "+name;password.autocomplete="off";password.value=m.room_password||"";
   box.append(idLabel,roomId,passLabel,password);
   const maySend=!winner&&!!registered.length&&tour.status!=="finished"&&number>=lastPublished&&number<=lastPublished+1;
   const send=make("button",m.sent_at?"🔁 Reenviar sala "+number:"📨 Publicar sala "+number,"good full");
   send.type="button";send.disabled=!maySend;
   send.onclick=async()=>{
    const rid=roomId.value.trim(),pw=password.value.trim();
    if(!rid||!pw)return showMessage("Completá ID y contraseña para "+name+".",true);
    if(!await confirmChange("¿Publicar "+name+" para los "+registered.length+" participantes/equipos? El mapa anterior quedará cerrado automáticamente."))return;
    send.disabled=true;
    try{
     const {data,error}=await db.rpc("js_br_publish_map",{
      p_tournament:tour.id,p_map_number:number,p_room_id:rid,p_password:pw
     });
     if(error||!data?.ok)throw error||Error("El servidor no confirmó la sala.");
     await refresh();
     showMessage("✅ Sala de "+name+" publicada. Los "+data.recipient_teams+" equipos verán el ID y contraseña.");
    }catch(e){showMessage("No se pudo publicar "+name+": "+(e.message||String(e)),true);send.disabled=false;}
   };
   box.append(send);
   if(m.is_open&&!winner){
    const close=make("button","🔒 Cerrar acceso a "+name,"secondary full");
    close.type="button";close.style.marginTop="9px";
    close.onclick=async()=>{
     if(!await confirmChange("¿Cerrar la sala "+number+" · "+name+"?"))return;
     close.disabled=true;
     try{
      const {data,error}=await db.rpc("js_br_close_map",{p_tournament:tour.id,p_map_number:number});
      if(error||!data?.ok)throw error||Error("No se confirmó el cierre");
      await refresh();showMessage("🔒 Sala "+name+" cerrada.");
     }catch(e){showMessage(e.message||String(e),true);close.disabled=false;}
    };
    box.append(close);
   }
   root.append(box);
  }
  if(!winner){
   const message=make("p","Secuencia: Bermuda → Purgatorio → Kalahari. Solo podés publicar el mapa siguiente después de enviar el anterior. Se mantiene una única inscripción.","small");
   root.append(message);
  }
  if(!br||winner)return;
  root.append(make("div",undefined,"divider"),make("h3","🏆 Confirmar ganador final del BR"));
  root.append(make("p","Después de disputar los tres mapas, elegí al ganador general. No se generan llaves para Battle Royale.","small"));
  const champion=make("select");champion.style.margin="8px 0 11px";
  const first=make("option","Seleccioná al ganador");first.value="";champion.append(first);
  for(const team of registered){
   const opt=make("option",team.name);opt.value=team.id;champion.append(opt);
  }
  const canFinish=hasNewRooms?lastPublished===3:!!br?.sent_at;
  const finalize=make("button","🏆 Finalizar BR y declarar campeón","good full");
  finalize.type="button";finalize.disabled=!registered.length||!canFinish;
  finalize.onclick=async()=>{
   const selected=registered.find(t=>t.id===champion.value);
   if(!selected)return showMessage("Elegí quién ganó el torneo BR.",true);
   if(!await confirmChange("¿Confirmás como campeón a «"+selected.name+"»? Este resultado finalizará el torneo y se notificará a los participantes."))return;
   finalize.disabled=true;
   try{
    const {data,error}=await db.rpc("js_br_finish",{p_tournament:tour.id,p_winner_team:selected.id});
    if(error||!data?.ok)throw error||Error("No se confirmó el campeón");
    await refresh();showMessage("🏆 Campeón BR confirmado: "+selected.name);
   }catch(e){showMessage("No se pudo finalizar el torneo BR: "+(e.message||String(e)),true);finalize.disabled=false;}
  };
  root.append(champion,finalize);
  if(!canFinish)root.append(make("p","Primero publicá los tres mapas para habilitar el ganador final.","small"));
 }
};
