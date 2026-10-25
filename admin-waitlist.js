"use strict";
window.JSAdminWaitlist={
 render:async function(db,tour,teams,matches,onSaved){
  const box=document.getElementById("waitlistPanel");
  if(!box)return;
  box.replaceChildren();
  const make=(tag,text,cls)=>{
    const el=document.createElement(tag);
    if(text!==undefined)el.textContent=String(text);
    if(cls)el.className=cls;
    return el;
  };
  const heading=make("h3","⏳ Lista de espera");box.append(heading);
  const {data,error}=await db.from("js_tournament_waitlist")
   .select("id,team_name,created_at,status,roster")
   .eq("tournament_id",tour.id).eq("status","waiting")
   .order("created_at",{ascending:true}).order("id",{ascending:true}).limit(100);
  if(error){
   box.append(make("p","No se pudo cargar la lista: "+error.message,"small"));return;
  }
  const all=Array.isArray(data)?data:[];
  const active=teams.filter(x=>x.status==="registered").length;
  const slots=Math.max(0,tour.max_teams-active);
  const canAdmit=tour.status==="open"&&!tour.archived_at&&tour.rounds===0&&!matches.length&&slots>0;
  const summary=make("p","Equipos inscritos: "+active+"/"+tour.max_teams+" · En espera: "+all.length,"small");
  box.append(summary);
  if(!all.length){
    box.append(make("p","Todavía no hay equipos en lista de espera.","small"));return;
  }
  if(tour.rounds>0||matches.length){
    box.append(make("p","Las llaves ya fueron generadas: la lista queda registrada, pero no se admiten nuevos equipos.","small"));
  }else if(slots===0){
    box.append(make("p","Cuando se libere un cupo, podrás admitir al primer equipo de la lista.","small"));
  }else if(tour.status!=="open"){
    box.append(make("p","Abrí nuevamente las inscripciones para admitir al siguiente equipo.","small"));
  }
  function ask(text){
   return new Promise(resolve=>{
    const overlay=make("div");
    overlay.style.cssText="position:fixed;inset:0;z-index:999999;background:#040916ea;display:flex;align-items:center;justify-content:center;padding:18px";
    const dialog=make("div");dialog.style.cssText="width:min(100%,450px);background:#17253b;border:1px solid #60708b;padding:20px;border-radius:16px";
    dialog.append(make("h3","Confirmar cambio"),make("p",text,"small"));
    const row=make("div",undefined,"controls");
    const no=make("button","Cancelar","ghost"),yes=make("button","Confirmar","secondary");
    no.onclick=()=>{overlay.remove();resolve(false)};
    yes.onclick=()=>{overlay.remove();resolve(true)};
    row.append(no,yes);dialog.append(row);overlay.append(dialog);document.body.append(overlay);
   });
  }
  async function perform(entry,action){
    const words=action==="admit"
     ?"¿Admitir a «"+entry.team_name+"»? Ocupará el cupo libre con los ID verificados que registró."
     :"¿Quitar a «"+entry.team_name+"» de la lista? Esta acción no se puede deshacer.";
    if(!await ask(words))return;
    try{
     const {data:done,error:e}=await db.rpc("js_admin_manage_waitlist",{p_wait_id:entry.id,p_action:action});
     if(e)throw e;
     if(!done?.ok)throw Error("No se confirmó la operación.");
     await onSaved((action==="admit"?"✅ Equipo admitido: ":"⛔ Eliminado de la lista: ")+entry.team_name);
    }catch(e){window.alert("No se pudo gestionar la espera: "+(e.message||String(e)));}
  }
  all.forEach((entry,i)=>{
   const card=make("div",undefined,"item");
   const title=make("strong","#"+(i+1)+" · "+entry.team_name);
   const roster=Array.isArray(entry.roster)?entry.roster:[];
   const at=make("p","Anotado: "+new Date(entry.created_at).toLocaleString("es-AR")+
    " · "+roster.filter(p=>p.role==="titular").length+" titulares · "+roster.filter(p=>p.role==="suplente").length+" suplentes","small");
   const preview=make("p",roster.map(p=>p.nickname+(p.role==="suplente"?" (S)":"")).join(" · "),"small");
   card.append(title,at,preview);
   const actions=make("div",undefined,"controls");
   const admit=make("button","✅ Admitir al torneo","secondary");
   admit.disabled=!canAdmit||i!==0;admit.type="button";
   admit.onclick=()=>perform(entry,"admit");
   const remove=make("button","Retirar de espera","ghost");remove.type="button";
   remove.onclick=()=>perform(entry,"cancel");
   actions.append(admit,remove);card.append(actions);box.append(card);
  });
 }
};