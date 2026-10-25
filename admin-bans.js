"use strict";
window.JSAdminBans=(function(){
 const $=id=>document.getElementById(id);
 const el=(tag,value,className)=>{
  const n=document.createElement(tag);
  if(value!==undefined)n.textContent=String(value);
  if(className)n.className=className;
  return n;
 };
 const formatWhen=date=>{
  if(!date)return "Sin vencimiento (permanente)";
  const d=new Date(date);
  return Number.isFinite(d.valueOf())?d.toLocaleString("es-AR",{dateStyle:"short",timeStyle:"short"}):"Fecha desconocida";
 };
 const current=b=>!b.revoked_at&&(!b.expires_at||Date.parse(b.expires_at)>Date.now());
 let latest=[],loading=false;
 function notice(msg,error=false){
  const target=$("banFeedback");
  if(!target)return;
  target.textContent=msg;
  target.style.color=error?"#ffb4c3":"#aaf2d7";
 }
 async function load(){
  if(!db||!user)return;
  if(loading)return;
  loading=true;
  try{
   const {data,error}=await db.from("js_player_bans")
    .select("id,game_id,reason,created_at,expires_at,revoked_at")
    .order("created_at",{ascending:false}).limit(200);
   if(error)throw error;
   latest=Array.isArray(data)?data:[];
   render();
  }catch(e){
   notice("No pudimos cargar los bloqueos: "+(e?.message||String(e)),true);
  }finally{loading=false;}
 }
 function render(){
  const box=$("bannedPlayerList"),history=$("banHistoryList");
  if(!box||!history)return;
  box.replaceChildren();history.replaceChildren();
  const active=latest.filter(current);
  const inactive=latest.filter(b=>!current(b));
  $("banActiveCount").textContent=String(active.length);
  if(!active.length){
   box.append(el("p","No hay jugadores bloqueados actualmente.","small"));
  }
  for(const b of active){
   const card=el("div",undefined,"ban-entry");
   const title=el("strong","🚫 ID "+b.game_id);
   const when=el("p","Bloqueado: "+formatWhen(b.created_at)+" · "+
     (b.expires_at?"Finaliza: "+formatWhen(b.expires_at):"Permanente"),"small");
   const reason=el("p","Motivo: "+b.reason,"small");
   const restore=el("button","✓ Desbloquear jugador","secondary");
   restore.type="button";
   restore.onclick=async()=>{
    if(!await askConfirm("¿Levantar el bloqueo de ID "+b.game_id+
       "? Podrá volver a anotarse en nuevos torneos. Esto no modifica inscripciones anteriores."))return;
    restore.disabled=true;
    try{
     const {data,error}=await db.rpc("js_admin_manage_player_ban",{
      p_operation:"unban",p_game_id:b.game_id,p_reason:null,p_days:null
     });
     if(error||!data?.ok)throw error||Error("El servidor no confirmó el desbloqueo");
     notice("✅ ID "+b.game_id+" desbloqueado.");
     await load();
    }catch(e){notice("No se pudo desbloquear: "+(e?.message||String(e)),true);}
    finally{restore.disabled=false;}
   };
   card.append(title,when,reason,restore);box.append(card);
  }
  if(!inactive.length)history.append(el("p","Sin bloqueos anteriores.","small"));
  for(const b of inactive.slice(0,15)){
   const d=el("div",undefined,"ban-history-entry");
   d.append(el("strong","ID "+b.game_id+" · "+(b.revoked_at?"Levantado":"Vencido")));
   d.append(el("p",b.reason+" · "+formatWhen(b.created_at),"small"));
   history.append(d);
  }
 }
 function wire(){
  const submit=$("banSubmit"),refresh=$("banRefresh"),id=$("banGameId");
  if(!submit||!refresh||!id)return;
  id.addEventListener("input",()=>{id.value=id.value.replace(/\D/g,"");});
  refresh.onclick=()=>load();
  submit.onclick=async()=>{
   if(!db||!user)return notice("Primero iniciá sesión como administrador.",true);
   const game=id.value.trim(),reason=$("banReason").value.trim();
   const daysRaw=$("banDuration").value;
   const days=daysRaw==="permanent"?null:Number(daysRaw);
   if(!/^[0-9]{5,16}$/.test(game))return notice("Ingresá un ID de Free Fire numérico válido.",true);
   if(reason.length<8||reason.length>280)return notice("Escribí el motivo (8 a 280 caracteres).",true);
   if(daysRaw!=="permanent"&&![1,7,30,90,365].includes(days))return notice("Duración inválida.",true);
   const label=days===null?"permanente":days===1?"1 día":days+" días";
   const agreed=await askConfirm("¿Bloquear ID "+game+" durante "+label+
     "?\nMotivo: "+reason+
     "\n\nNo podrá inscribirse en ningún torneo nuevo ni entrar a listas de espera. Sus torneos pasados se mantienen.");
   if(!agreed)return;
   submit.disabled=true;
   try{
    const {data,error}=await db.rpc("js_admin_manage_player_ban",{
     p_operation:"ban",p_game_id:game,p_reason:reason,p_days:days
    });
    if(error||!data?.ok)throw error||Error("El servidor no confirmó el bloqueo");
    notice("✅ ID "+game+" bloqueado. "+
       (data.expires_at?"Vence: "+formatWhen(data.expires_at):"Bloqueo permanente."));
    id.value="";$("banReason").value="";
    await load();
   }catch(e){notice("No se pudo bloquear: "+(e?.message||String(e)),true);}
   finally{submit.disabled=false;}
  };
 }
 wire();
 return Object.freeze({load});
})();