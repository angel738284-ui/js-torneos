"use strict";
window.JSAdminRoster=Object.freeze({
 open:async function(db,tournament,team,players,onSaved){
  const uid=String(team.id);
  const roster=Array.isArray(players)?players.slice().sort((a,b)=>(a.player_role==="suplente")-(b.player_role==="suplente")||(a.roster_order||0)-(b.roster_order||0)):[];
  const subs=roster.filter(p=>p.player_role==="suplente");
  const node=(tag,txt,cls)=>{
   const e=document.createElement(tag);
   if(txt!==undefined)e.textContent=String(txt);
   if(cls)e.className=cls;
   return e;
  };
  const overlay=node("div",undefined,"js-admin-roster-backdrop");
  overlay.setAttribute("role","dialog");
  overlay.setAttribute("aria-modal","true");
  overlay.setAttribute("aria-label","Modificar integrantes del equipo");
  const panel=node("div",undefined,"js-admin-roster-dialog");
  const header=node("div",undefined,"row");
  const heading=node("h2","✏️ Cambiar jugadores · "+team.name);
  const close=node("button","✕ Cerrar","ghost");close.type="button";
  const closeIt=()=>overlay.remove();
  close.onclick=closeIt;
  header.append(heading,close);
  panel.append(header);
  panel.append(node("p","Solo el administrador puede modificar los integrantes. Los cambios quedan registrados y no alteran los cruces ni sus resultados.","small"));
  if(tournament.rounds>0)panel.append(node("p","Con las llaves armadas se permiten cambios de emergencia, pero no durante una sala o resultado pendiente.","small warn"));
  const label=node("label","Seleccioná al jugador que no podrá participar");
  panel.append(label);
  const choose=node("select");
  for(const player of roster){
   const option=node("option",(player.player_role==="suplente"?"🔁 Suplente · ":"👤 Titular · ")+player.nickname+" · ID "+player.game_id);
   option.value=player.game_id;
   choose.append(option);
  }
  panel.append(choose);
  const modeLabel=node("label","Qué querés hacer");
  panel.append(modeLabel);
  const mode=node("select");
  const regular=node("option","Reemplazarlo por un nuevo ID verificado");regular.value="replace";
  const promote=node("option","Ascender un suplente de este equipo a titular");promote.value="promote";
  mode.append(regular,promote);
  panel.append(mode);
  const helper=node("p","","small");
  panel.append(helper);
  const newPlayerWrap=node("div");
  const idLabel=node("label","Nuevo ID de Free Fire LATAM");
  const newInput=node("input");newInput.inputMode="numeric";newInput.maxLength=16;
  newInput.placeholder="ID numérico de Free Fire";newInput.autocomplete="off";
  const verify=node("button","🔍 Verificar nombre","secondary");verify.type="button";
  verify.style.marginTop="10px";
  const verification=node("p","Todavía no verificaste el nuevo ID.","small");
  newPlayerWrap.append(idLabel,newInput,verify,verification);
  panel.append(newPlayerWrap);
  const substituteWrap=node("div");
  const subsLabel=node("label","Suplente que pasa a titular");
  const selectSub=node("select");
  for(const sub of subs){
   const option=node("option",sub.nickname+" · ID "+sub.game_id);option.value=sub.game_id;selectSub.append(option);
  }
  substituteWrap.append(subsLabel,selectSub);
  panel.append(substituteWrap);
  const reasonLabel=node("label","Motivo del cambio (queda registrado)");
  const reason=node("input");reason.value="Baja de último momento";reason.maxLength=180;
  panel.append(reasonLabel,reason);
  const status=node("p","","small");status.setAttribute("role","status");panel.append(status);
  const submit=node("button","✓ Guardar reemplazo");submit.type="button";submit.className="full";
  panel.append(submit);
  const history=node("div",undefined,"js-admin-roster-history");
  panel.append(history);
  overlay.append(panel);document.body.append(overlay);
  let checked=null;let working=false;
  const setState=(v,fail)=>{
   status.textContent=v;status.style.color=fail?"#ffb9bd":"#92e7c7";
  };
  function selectedOld(){return roster.find(p=>p.game_id===choose.value);}
  function sync(){
   const old=selectedOld();
   const canPromote=Boolean(old&&old.player_role==="titular"&&subs.length>(tournament.requires_substitute===false?0:1));
   promote.disabled=!canPromote;
   if(!canPromote&&mode.value==="promote")mode.value="replace";
   const swap=mode.value==="promote";
   newPlayerWrap.classList.toggle("hidden",swap);
   substituteWrap.classList.toggle("hidden",!swap);
   checked=null;verification.textContent="Todavía no verificaste el nuevo ID.";
   setState(canPromote?"También podés subir un suplente ya inscrito a titular.":"Para cubrir la baja, verificá el ID del reemplazo. Si un suplente es el único y obligatorio, no se puede ascender sin otro suplente.",false);
  }
  choose.onchange=sync;
  mode.onchange=sync;
  newInput.oninput=()=>{newInput.value=newInput.value.replace(/\D/g,"");checked=null;verification.textContent="ID pendiente de verificación";};
  verify.onclick=async()=>{
   const id=newInput.value.trim();
   if(!/^[0-9]{5,16}$/.test(id)){setState("Ingresá un ID numérico válido.",true);return;}
   const old=selectedOld();
   if(!old){setState("Elegí primero a quién reemplazar.",true);return;}
   working=true;verify.disabled=true;verify.textContent="Verificando…";
   checked=null;
   try{
    const {data,error}=await db.functions.invoke("js-admin-roster",{body:{
      action:"verify",tournament_id:tournament.id,team_id:uid,player_id:id
    }});
    if(error)throw new Error(data?.error||error.message);
    if(data?.verified!==true||data?.id!==id||!data?.nickname)throw new Error(data?.error||"El servidor no confirmó el apodo");
    checked={id,nickname:data.nickname,region:data.region||"LATAM"};
    verification.textContent="✅ "+checked.nickname+" · ID "+id+" · "+checked.region;
    setState("ID verificado. Ahora podés confirmar el cambio.",false);
   }catch(e){verification.textContent="❌ No verificado";setState(e.message||"Error al verificar",true);}
   finally{working=false;verify.disabled=false;verify.textContent="🔍 Verificar nombre";}
  };
  async function loadHistory(){
   const {data,error}=await db.from("js_admin_roster_changes")
    .select("old_nickname,new_nickname,changed_at,change_kind,reason")
    .eq("team_id",uid).eq("tournament_id",tournament.id)
    .order("changed_at",{ascending:false}).limit(5);
   if(error)return;
   history.replaceChildren();
   if(!data?.length)return;
   history.append(node("h3","📋 Últimos cambios del equipo"));
   for(const rec of data){
    const item=node("p",new Date(rec.changed_at).toLocaleString("es-AR")+" · "+rec.old_nickname+" → "+rec.new_nickname+" · "+rec.reason,"small");
    history.append(item);
   }
  }
  submit.onclick=async()=>{
   if(working)return;
   const old=selectedOld();
   if(!old){setState("Elegí al jugador a reemplazar.",true);return;}
   const swap=mode.value==="promote";
   const candidate=swap?subs.find(p=>p.game_id===selectSub.value):checked;
   if(!candidate){setState(swap?"Seleccioná un suplente del equipo.":"Primero verificá el nuevo ID.",true);return;}
   if(!swap&&candidate.id!==newInput.value.trim()){setState("El ID cambió: verificá el nuevo número otra vez.",true);return;}
   const motive=reason.value.trim();
   if(motive.length<5||motive.length>180){setState("Indicá el motivo del cambio (5 a 180 caracteres).",true);return;}
   const messageText="Equipo: "+team.name+"\nSale: "+old.nickname+" ("+old.game_id+")\nEntra: "+candidate.nickname+" ("+(candidate.id||candidate.game_id)+")\nMotivo: "+motive+"\n\n¿Confirmás? No cambia los resultados.";
   // Local confirm is explicit; the server rechecks all authorization and match state.
   const accepted=await new Promise(resolve=>{
    const modal=node("div",undefined,"js-admin-roster-confirm");
    const inside=node("div",undefined,"js-admin-roster-confirm-panel");
    inside.append(node("h3","Confirmar sustitución"),node("p",messageText));
    const buttons=node("div",undefined,"row wraprow");
    const no=node("button","Cancelar","ghost");no.type="button";
    const yes=node("button","Sí, guardar","good");yes.type="button";
    no.onclick=()=>{modal.remove();resolve(false);};
    yes.onclick=()=>{modal.remove();resolve(true);};
    buttons.append(no,yes);inside.append(buttons);modal.append(inside);document.body.append(modal);
   });
   if(!accepted)return;
   working=true;submit.disabled=true;submit.textContent="Guardando…";
   try{
    const {data,error}=await db.rpc("js_admin_change_player",{
     p_tournament:tournament.id,p_team:uid,p_old_id:old.game_id,
     p_new_id:candidate.id||candidate.game_id,p_mode:swap?"promote":"replace",p_reason:motive
    });
    if(error)throw error;
    if(!data?.ok||!data.audit_saved)throw new Error("El servidor no confirmó el reemplazo");
    closeIt();
    await onSaved("✅ Cambio registrado: "+old.nickname+" → "+candidate.nickname+" en "+team.name+".");
   }catch(e){setState("❌ "+(e.message||"No se pudo actualizar el jugador"),true);}
   finally{working=false;submit.disabled=false;submit.textContent="✓ Guardar reemplazo";}
  };
  sync();
  loadHistory();
  choose.focus();
 }
});
