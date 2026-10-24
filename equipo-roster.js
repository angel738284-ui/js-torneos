"use strict";
(function(){
 const $=id=>document.getElementById(id);
 const endpoint=String(window.JS_CONFIG?.supabaseUrl||"").replace(/\/$/,"")+"/functions/v1/torneo";
 let editing=false;
 const notify=(msg,bad=false)=>{
  const el=$("notice");el.textContent=msg;el.className="status show"+(bad?" error":"");
 };
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(cls)el.className=cls;
   if(text!==undefined)el.textContent=text;return el;};
 async function request(payload){
  const res=await fetch(endpoint,{method:"POST",cache:"no-store",headers:{"content-type":"application/json"},
    body:JSON.stringify({...payload,team_code:$("teamAccess").value.trim().toUpperCase()})});
  const result=await res.json();
  if(!res.ok)throw Error(result.error||"No se pudo completar la operación");
  return result;
 }
 function draw(data){
  const panel=$("rosterPanel"),list=$("rosterList");list.replaceChildren();
  if(!Array.isArray(data.roster)){panel.classList.add("hidden");return;}
  panel.classList.remove("hidden");
  const enabled=Boolean(data.can_edit_roster);
  $("rosterNote").textContent=enabled?
    "Solo podés cambiar jugadores antes de generar los cruces. Todos los nuevos ID se verifican con Epinby.":
    "La plantilla está bloqueada porque los cruces ya comenzaron o el equipo no está activo. Consultá al organizador.";
  const players=[...data.roster].sort((a,b)=>Number(a.roster_order||0)-Number(b.roster_order||0));
  for(const p of players){
   const card=node("div",undefined,"roster-player");
   card.append(node("div",(p.player_role==="suplente"?"🔁 SUPLENTE":"👤 TITULAR")+" · "+p.nickname,"roster-player-title"));
   card.append(node("div","ID: "+p.game_id+" · "+(p.region||"LATAM"),"small"));
   if(enabled){
    const button=node("button","✏️ Cambiar jugador","secondary");button.type="button";
    const form=node("div",undefined,"roster-edit hidden");
    const label=node("label","Nuevo ID de Free Fire");
    const field=node("input");field.type="text";field.inputMode="numeric";field.maxLength=16;
    field.placeholder="Ingresá ID del reemplazo";field.autocomplete="off";
    const verify=node("button","Verificar ID con Epinby","secondary");verify.type="button";
    const result=node("div","","small");
    const save=node("button","Confirmar reemplazo","good");save.type="button";save.disabled=true;
    const cancel=node("button","Cancelar","ghost");cancel.type="button";
    let checked=null,working=false;
    field.oninput=()=>{checked=null;save.disabled=true;result.textContent="";};
    button.onclick=()=>{editing=true;form.classList.remove("hidden");button.classList.add("hidden");field.focus();};
    cancel.onclick=()=>{editing=false;checked=null;field.value="";form.classList.add("hidden");button.classList.remove("hidden");};
    verify.onclick=async()=>{
     const id=field.value.trim();
     if(!/^[0-9]{5,16}$/.test(id)||id===p.game_id){result.textContent="Ingresá un ID numérico diferente al anterior.";return;}
     if(working)return;working=true;verify.disabled=true;checked=null;save.disabled=true;
     result.textContent="Verificando con Epinby…";
     try{
      const info=await request({action:"team_verify_replacement",new_player_id:id});
      if(info.verified&&info.id===id){checked={id,nickname:info.nickname,region:info.region};
       result.textContent="✅ Verificado: "+info.nickname+" · "+(info.region||"LATAM");save.disabled=false;
      }else throw Error("No se pudo verificar el ID");
     }catch(e){result.textContent="❌ "+e.message;}
     finally{working=false;verify.disabled=false;}
    };
    save.onclick=async()=>{
     if(!checked||checked.id!==field.value.trim()||working)return;
     if(!confirm("¿Confirmás reemplazar a "+p.nickname+" por "+checked.nickname+"? Se conservará su puesto de "+p.player_role+"."))return;
     working=true;save.disabled=true;result.textContent="Guardando reemplazo…";
     try{
      const updated=await request({action:"team_replace_player",old_player_id:p.game_id,new_player_id:checked.id});
      if(!updated.ok)throw Error("El servidor no confirmó el cambio");
      editing=false;await window.lookupTeamAfterRosterChange?.();
      notify("✅ Jugador reemplazado: "+p.nickname+" → "+updated.nickname+". La escuadra conserva sus puestos.");
     }catch(e){result.textContent="❌ "+e.message;save.disabled=false;}
     finally{working=false;}
    };
    form.append(label,field,verify,result,save,cancel);
    card.append(button,form);
   }
   list.append(card);
  }
 }
 window.JSRoster=Object.freeze({render:draw,get editing(){return editing;}});
})();
