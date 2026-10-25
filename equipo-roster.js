"use strict";
(function(){
 const $=id=>document.getElementById(id);
 const endpoint=String(window.JS_CONFIG?.supabaseUrl||"").replace(/\/$/,"")+"/functions/v1/torneo";
 let editing=false;
 const notify=(msg,bad=false)=>{
  const el=$("notice");el.textContent=msg;el.className="status show"+(bad?" error":"");
 };
 const node=(tag,text,cls)=>{
  const el=document.createElement(tag);if(cls)el.className=cls;
  if(text!==undefined)el.textContent=text;return el;
 };
 function askCaptain(question,acceptText="Sí, confirmar"){
  return new Promise(resolve=>{
   const overlay=node("div",undefined,"roster-modal");
   overlay.setAttribute("role","dialog");overlay.setAttribute("aria-modal","true");
   const box=node("div",undefined,"roster-dialog");
   box.append(node("h3","Confirmar cambio"));
   box.append(node("p",question));
   const choices=node("div",undefined,"roster-modal-buttons");
   const no=node("button","No, cancelar","secondary");no.type="button";
   const yes=node("button",acceptText,"good");yes.type="button";
   const done=decision=>{overlay.remove();resolve(decision)};
   no.onclick=()=>done(false);yes.onclick=()=>done(true);
   choices.append(no,yes);box.append(choices);overlay.append(box);document.body.append(overlay);
   no.focus();
  });
 }
 async function request(payload){
  const res=await fetch(endpoint,{method:"POST",cache:"no-store",headers:{"content-type":"application/json"},
    body:JSON.stringify({...payload,team_code:$("teamAccess").value.trim().toUpperCase()})});
  const data=await res.json();
  if(!res.ok)throw Error(data.error||"No se pudo completar la operación");
  return data;
 }
 function editor({oldPlayer=null,caption,postAction,successText}){
  const wrapper=node("div",undefined,"roster-edit-wrapper");
  const open=node("button",caption,"secondary");open.type="button";
  const form=node("div",undefined,"roster-edit hidden");
  const heading=node("div",oldPlayer?"Cambiar a "+oldPlayer.nickname:"Añadir un suplente verificado","small");
  const label=node("label","ID del nuevo jugador (Free Fire)");
  const field=node("input");field.type="text";field.inputMode="numeric";field.maxLength=16;
  field.placeholder="ID numérico de Free Fire";field.autocomplete="off";
  const verify=node("button","🔎 Verificar ID con Epinby","secondary");verify.type="button";
  const result=node("p","","small roster-verification-result");
  const submit=node("button",oldPlayer?"Confirmar reemplazo":"Agregar suplente","good");
  submit.type="button";submit.disabled=true;
  const cancel=node("button","Cancelar","ghost");cancel.type="button";
  let verified=null,pending=false;
  field.oninput=()=>{verified=null;submit.disabled=true;result.textContent=""};
  open.onclick=()=>{editing=true;form.classList.remove("hidden");open.classList.add("hidden");field.focus()};
  cancel.onclick=()=>{editing=false;verified=null;field.value="";form.classList.add("hidden");open.classList.remove("hidden")};
  verify.onclick=async()=>{
   const id=field.value.trim();
   if(!/^[0-9]{5,16}$/.test(id)||id===oldPlayer?.game_id){
    result.textContent="Ingresá un ID numérico válido y diferente al anterior.";return;
   }
   if(pending)return;
   pending=true;verified=null;submit.disabled=true;verify.disabled=true;
   result.textContent="Verificando con Epinby…";
   try{
    const data=await request({action:"team_verify_replacement",new_player_id:id});
    if(!data.verified||data.id!==id)throw Error("No fue posible verificar el ID");
    verified={id,nickname:data.nickname,region:data.region};
    result.textContent="✅ Verificado: "+data.nickname+" · "+(data.region||"LATAM");
    submit.disabled=false;
   }catch(e){result.textContent="❌ "+e.message}
   finally{pending=false;verify.disabled=false}
  };
  submit.onclick=async()=>{
   if(pending||!verified||field.value.trim()!==verified.id)return;
   const prompt=oldPlayer?
    "¿Reemplazar a «"+oldPlayer.nickname+"» por «"+verified.nickname+"»? Mantendrá el puesto de "+oldPlayer.player_role+".":
    "¿Agregar a «"+verified.nickname+"» como suplente? El equipo tendrá hasta 2 suplentes.";
   if(!(await askCaptain(prompt)))return;
   pending=true;submit.disabled=true;
   result.textContent="Guardando cambio…";
   try{
    const update=await request(postAction(oldPlayer,verified));
    if(!update.ok)throw Error("El servidor no confirmó el cambio");
    editing=false;
    await window.lookupTeamAfterRosterChange?.();
    notify("✅ "+successText+(oldPlayer?" → "+update.nickname:" · "+update.nickname)+". Lista actualizada.");
   }catch(e){result.textContent="❌ "+e.message;submit.disabled=false}
   finally{pending=false}
  };
  form.append(heading,label,field,verify,result,submit,cancel);
  wrapper.append(open,form);
  return wrapper;
 }
 async function removeSecondSubstitute(player){
  if(editing)return notify("Terminá o cancelá primero el cambio que estás haciendo.",true);
  if(!(await askCaptain("¿Quitar de la escuadra al suplente «"+player.nickname+"»? Podrás agregar otro después. Siempre tiene que quedar al menos 1 suplente.","Sí, quitar suplente")))return;
  editing=true;
  try{
   const data=await request({action:"team_manage_substitute",operation:"remove",player_id:player.game_id});
   if(!data.ok)throw Error("El servidor no confirmó la eliminación");
   editing=false;await window.lookupTeamAfterRosterChange?.();
   notify("✅ Suplente eliminado. El equipo conserva "+data.substitutes+" suplente(s).");
  }catch(e){notify("❌ No se pudo quitar al suplente: "+e.message,true)}
  finally{editing=false}
 }
 function draw(data){
  const panel=$("rosterPanel"),list=$("rosterList");list.replaceChildren();
  if(!Array.isArray(data.roster)){panel.classList.add("hidden");return}
  panel.classList.remove("hidden");
  const enabled=Boolean(data.can_edit_roster);
  const players=[...data.roster].sort((a,b)=>(a.player_role==='suplente')-(b.player_role==='suplente')||(a.roster_order||0)-(b.roster_order||0));
  const substitutes=players.filter(p=>p.player_role==="suplente");
  list.append(node("p","🔁 Suplentes: "+substitutes.length+" / 2 · Mínimo: "+(data.requires_substitute===false?"0":"1"),"roster-count"));
  $("rosterNote").textContent=enabled?
   "Antes de generar los cruces podés cambiar titulares, cambiar suplentes, agregar un segundo o quitar uno si hay dos. Cada nuevo ID se verifica con Epinby.":
   "Plantilla bloqueada: los cruces comenzaron, el torneo terminó o la escuadra no está activa.";
  for(const player of players){
   const card=node("div",undefined,"roster-player");
   card.append(node("div",(player.player_role==="suplente"?"🔁 SUPLENTE":"👤 TITULAR")+" · "+player.nickname,"roster-player-title"));
   card.append(node("div","ID: "+player.game_id+" · "+(player.region||"LATAM"),"small"));
   if(enabled){
    card.append(editor({oldPlayer:player,caption:"✏️ Cambiar jugador",
     postAction:(old,verified)=>({action:"team_replace_player",old_player_id:old.game_id,new_player_id:verified.id}),
     successText:"Jugador reemplazado"}));
    if(player.player_role==="suplente"&&substitutes.length>(data.requires_substitute===false?0:1)){
     const remove=node("button","🗑 Quitar este suplente","ghost");remove.type="button";
     remove.onclick=()=>removeSecondSubstitute(player);
     card.append(remove);
    }
   }
   list.append(card);
  }
  if(enabled&&substitutes.length<2){
   const extra=node("div",undefined,"roster-player roster-add-substitute");
   extra.append(node("div",substitutes.length===1?"➕ Segundo suplente (opcional)":(data.requires_substitute===false?"➕ Agregar suplente (opcional)":"➕ Agregar suplente obligatorio"),"roster-player-title"));
   extra.append(editor({caption:"➕ Agregar suplente",oldPlayer:null,
    postAction:(old,verified)=>({action:"team_manage_substitute",operation:"add",player_id:verified.id}),
    successText:"Suplente agregado"}));
   list.append(extra);
  }
 }
 window.JSRoster=Object.freeze({render:draw,get editing(){return editing;}});
})();
