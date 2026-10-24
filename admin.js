"use strict";
const $=id=>document.getElementById(id);
const show=(id,on)=>$(id).classList.toggle("hidden",!on);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
let db=null,user=null,opened=null,teamCache=[],matchCache=[],finalGameCache=[],roomCache=new Map(),currentConfig=null,currentTourTab="teams",savingFinalGame=false;
const message=(txt,bad=false)=>{let n=$("notice");n.textContent=txt;n.className="status show"+(bad?" error":"");n.scrollIntoView({behavior:"smooth",block:"nearest"});};
// Confirmación dentro de la página: Android WebView no tiene que implementar window.confirm().
function askConfirm(question){
 return new Promise(resolve=>{
   const overlay=document.createElement("div");
   overlay.style.cssText="position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:20px";
   const panel=document.createElement("div");
   panel.style.cssText="background:#172132;color:#f4f7ff;border:1px solid #45536b;border-radius:18px;padding:22px;width:100%;max-width:420px;box-shadow:0 12px 40px #0009";
   const heading=document.createElement("h3");heading.textContent="Confirmar acción";heading.style.margin="0 0 14px";
   const description=document.createElement("p");description.textContent=question;description.style.cssText="white-space:pre-wrap;line-height:1.5;font-size:15px";
   const buttons=document.createElement("div");buttons.style.cssText="display:flex;gap:10px;justify-content:flex-end;margin-top:20px";
   const cancel=document.createElement("button");cancel.type="button";cancel.textContent="Cancelar";cancel.className="secondary";
   const agree=document.createElement("button");agree.type="button";agree.textContent="Confirmar";agree.className="good";
   const done=value=>{overlay.remove();resolve(value);};
   cancel.onclick=()=>done(false);
   agree.onclick=()=>done(true);
   buttons.append(cancel,agree);panel.append(heading,description,buttons);overlay.append(panel);document.body.append(overlay);
 });
}


function confirmDeleteYesNo(t){
 return new Promise(resolve=>{
  const overlay=document.createElement("div");
  overlay.setAttribute("role","dialog");overlay.setAttribute("aria-modal","true");
  overlay.style.cssText="position:fixed;inset:0;z-index:1000000;background:#03050bee;display:flex;align-items:center;justify-content:center;padding:18px";
  const panel=document.createElement("div");
  panel.style.cssText="padding:22px;background:#192237;border:1px solid #a85462;border-radius:16px;color:white;max-width:420px;width:100%;box-shadow:0 14px 45px #0009";
  const heading=document.createElement("h3");heading.textContent="🗑️ ¿Estás seguro de eliminar este torneo?";
  const name=document.createElement("p");name.style.cssText="font-weight:800;font-size:18px;overflow-wrap:anywhere";name.textContent=t.name;
  const warning=document.createElement("p");warning.style.cssText="line-height:1.5;color:#c5cddc";warning.textContent="Se eliminarán también los equipos, jugadores, cruces y resultados. Esta acción no se puede deshacer.";
  const buttons=document.createElement("div");buttons.style.cssText="display:flex;flex-wrap:wrap;gap:10px;margin-top:18px";
  const no=document.createElement("button");no.textContent="No, cancelar";no.type="button";no.className="secondary";no.style.cssText="flex:1;min-width:125px";
  const yes=document.createElement("button");yes.textContent="Sí, eliminar";yes.type="button";yes.style.cssText="flex:1;min-width:125px;background:#cf415b;color:white";
  const done=value=>{overlay.remove();resolve(value)};
  no.onclick=()=>done(false);yes.onclick=()=>done(true);
  buttons.append(no,yes);panel.append(heading,name,warning,buttons);overlay.append(panel);document.body.append(overlay);no.focus();
 });
}
function prizeText(t){
 const n=Number(t.prize_quantity)||0;
 if(!t.prize_kind||t.prize_kind==="ninguno"||n<=0)return "Sin premio anunciado";
 const unit=t.prize_kind==="diamantes"?"diamantes 💎":t.prize_kind==="pases"?(n===1?"pase 🎟️":"pases 🎟️"):"premio(s)";
 return "Premio: "+n.toLocaleString("es-AR")+" "+unit+(t.prize_details?" · "+t.prize_details:"");
}
function prizeInput(kindId,qtyId,detailsId){
 const kind=$(kindId).value, n=kind==="ninguno"?0:Number($(qtyId).value);
 if(kind!=="ninguno"&&(!Number.isSafeInteger(n)||n<1||n>10000000))throw new Error("Cantidad de premio inválida (1 a 10.000.000).");
 return {prize_kind:kind,prize_quantity:n,prize_details:$(detailsId).value.trim().slice(0,160)};
}
function prizeFormState(kindId,qtyId,detailsId){
 const enabled=$(kindId).value!=="ninguno";$(qtyId).disabled=!enabled;$(detailsId).disabled=!enabled;
}
function navigate(view){
  for(const key of ["homeScreen","createScreen","detail"])show(key,key===view);
  $("notice").classList.remove("show");
  window.scrollTo({top:0,behavior:"instant"});
}
function chooseTourTab(tab){
  currentTourTab=tab;
  for(const value of ["teams","brackets","settings"]){
    show("detail"+value.charAt(0).toUpperCase()+value.slice(1),value===tab);
    const b=$("tab"+value.charAt(0).toUpperCase()+value.slice(1));
    b.classList.toggle("active",value===tab);
    b.setAttribute("aria-pressed",String(value===tab));
  }
}
$("newTournament").onclick=()=>navigate("createScreen");
$("cancelCreate").onclick=()=>navigate("homeScreen");
$("tabTeams").onclick=()=>chooseTourTab("teams");
$("tabBrackets").onclick=()=>chooseTourTab("brackets");
$("tabSettings").onclick=()=>chooseTourTab("settings");

// En vez del calendario numérico de Android, usar nombres de día + semana.
const weekdayDateFormat=new Intl.DateTimeFormat("es-AR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
const weekLabelFormat=new Intl.DateTimeFormat("es-AR",{day:"numeric",month:"long",year:"numeric"});
function dateYMD(date){
 return [date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
}
function capitalized(str){return str.charAt(0).toLocaleUpperCase("es-AR")+str.slice(1);}
function mondayOfWeek(today){
 const d=new Date(today.getFullYear(),today.getMonth(),today.getDate(),12,0,0,0);
 d.setDate(d.getDate()-(d.getDay()+6)%7);
 return d;
}
function updateDayPicker(){
 const weekOffset=Number($("tourWeek").value||0);
 const monday=mondayOfWeek(new Date());
 monday.setDate(monday.getDate()+weekOffset*7);
 const dropdown=$("tourDay");
 const previous=dropdown.value;
 dropdown.replaceChildren();
 const none=document.createElement("option");none.value="";none.textContent="Sin fecha por ahora";dropdown.append(none);
 const startToday=new Date();startToday.setHours(0,0,0,0);
 for(let day=0;day<7;day++){
  const d=new Date(monday.getFullYear(),monday.getMonth(),monday.getDate()+day,12);
  if(d<startToday)continue;
  const opt=document.createElement("option");
  opt.value=dateYMD(d);
  opt.textContent=capitalized(weekdayDateFormat.format(d));
  dropdown.append(opt);
 }
 if([...dropdown.options].some(opt=>opt.value===previous))dropdown.value=previous;
 else dropdown.value="";
 updateDatePreview();
}
function updateDatePreview(){
 const date=$("tourDay").value;
 const time=$("tourTime");
 time.disabled=!date;
 if(!date){
  $("tourDatePreview").textContent="Sin fecha programada: podés crear el torneo ahora.";
  return;
 }
 const d=new Date(date+"T12:00:00");
 const clock=time.value||"20:00";
 $("tourDatePreview").textContent="📅 "+capitalized(weekdayDateFormat.format(d))+" · "+clock+" hs";
}
function initializeDayPicker(){
 const select=$("tourWeek");select.replaceChildren();
 const monday=mondayOfWeek(new Date());
 for(let week=0;week<26;week++){
  const d=new Date(monday.getFullYear(),monday.getMonth(),monday.getDate()+week*7,12);
  const o=document.createElement("option");o.value=String(week);
  o.textContent=(week===0?"Esta semana":week===1?"Próxima semana":"Semana del "+weekLabelFormat.format(d));
  select.append(o);
 }
 select.value="0";
 select.onchange=updateDayPicker;
 $("tourDay").onchange=updateDatePreview;
 $("tourTime").onchange=updateDatePreview;
 updateDayPicker();
}
const cfg=()=>{const defaults=window.JS_CONFIG||{};try{return {...defaults,...JSON.parse(localStorage.getItem("js_torneo_cfg")||"{}")}}catch{return defaults}};
function launch(){
 currentConfig=cfg();
 const url=String(currentConfig.supabaseUrl||"").replace(/\/$/,"");
 if(!/^https:\/\/[a-z\d-]+\.supabase\.co$/.test(url)||!currentConfig.publishableKey){
  show("setup",true);show("login",false);show("app",false);
  $("sbUrl").value=currentConfig.supabaseUrl||"";$("sbKey").value=currentConfig.publishableKey||"";$("siteUrl").value=currentConfig.siteUrl||"";return;
 }
 if(!window.supabase){message("No cargó la biblioteca de Supabase. Revisá Internet.",true);return;}
 try{db=window.supabase.createClient(url,currentConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true}});}catch(e){message(e.message,true);return;}
 show("setup",false);checkUser();
}
async function checkUser(){
 const {data,error}=await db.auth.getUser();user=data?.user||null;
 if(error||!user){show("login",true);show("app",false);show("logout",false);return;}
 const {data:a,error:err}=await db.from("js_admins").select("uid").eq("uid",user.id).maybeSingle();
 if(err||!a){show("login",true);show("app",false);show("logout",true);message("Cuenta creada, pero todavía no autorizada. Agregá tu correo a js_admins desde Supabase SQL Editor.",true);return;}
 show("login",false);show("app",true);show("logout",true);navigate("homeScreen");await loadTours();
}
$("detailPrizeKind").onchange=()=>prizeFormState("detailPrizeKind","detailPrizeQty","detailPrizeDetails");

const modeRuleDrafts=Object.create(null);
let currentRulesMode="BY";
function defaultRules(mode){return window.JS_RULE_PRESETS?.[mode]||""}
function refreshRulesPreview(){
 const text=$("rules").value;
 const box=$("rulesPreview");
 window.JSRuleFormat.render(box,text);
 if(!text.trim())box.textContent="No se especificaron reglas. Podés agregar unas desde Modificar reglas.";
}
function changeModeRules(){
 const next=$("tourMode").value;
 modeRuleDrafts[currentRulesMode]=$("rules").value;
 currentRulesMode=next;
 $("rules").value=Object.prototype.hasOwnProperty.call(modeRuleDrafts,next)?
                  modeRuleDrafts[next]:defaultRules(next);
 $("rulesPreviewBox").dataset.mode=next;
 const custom=next==="OTRA";
 $("customLabel").classList.toggle("hidden",!custom);
 $("customMode").classList.toggle("hidden",!custom);
 if(next==="VV2")$("teamSize").value="2";
 else if(next==="PVP")$("teamSize").value="1";
 else if(next==="BY")$("teamSize").value="6";
 refreshRulesPreview();
}
$("tourMode").onchange=changeModeRules;
$("editRules").onclick=()=>{
 show("rulesEditor",true);
 $("editRules").classList.add("hidden");
 $("rules").focus();
};
$("finishRules").onclick=()=>{
 show("rulesEditor",false);
 $("editRules").classList.remove("hidden");
 refreshRulesPreview();
};
$("restoreRules").onclick=async()=>{
 if(!await askConfirm("¿Restaurar las reglas predeterminadas de "+$("tourMode").value+"? Las modificaciones de este modo serán reemplazadas."))return;
 $("rules").value=defaultRules($("tourMode").value);
 modeRuleDrafts[$("tourMode").value]=$("rules").value;
 refreshRulesPreview();
};
$("rules").oninput=()=>{
 modeRuleDrafts[currentRulesMode]=$("rules").value;
 refreshRulesPreview();
};
function resetNewTournamentRules(){
 for(const key of Object.keys(modeRuleDrafts))delete modeRuleDrafts[key];
 currentRulesMode=$("tourMode").value;
 $("rules").value=defaultRules(currentRulesMode);
 $("rulesPreviewBox").dataset.mode=currentRulesMode;
 show("rulesEditor",false);
 $("editRules").classList.remove("hidden");
 refreshRulesPreview();
}

$("saveConfig").onclick=()=>{
 const url=$("sbUrl").value.trim(),key=$("sbKey").value.trim(),site=$("siteUrl").value.trim();
 if(!/^https:\/\/[a-z\d-]+\.supabase\.co\/?$/.test(url)||key.length<20){message("Revisá la URL y la clave pública de Supabase.",true);return;}
 localStorage.setItem("js_torneo_cfg",JSON.stringify({supabaseUrl:url.replace(/\/$/,""),publishableKey:key,siteUrl:site}));
 launch();
};
$("signIn").onclick=async()=>{
 const email=$("email").value.trim(),password=$("password").value;
 const {error}=await db.auth.signInWithPassword({email,password});if(error)return message(error.message,true);
 await checkUser();
};
$("signUp").onclick=async()=>{
 const email=$("email").value.trim(),password=$("password").value;
 const {error}=await db.auth.signUp({email,password});
 message(error?error.message:"Cuenta creada. Confirmá tu email si es necesario, y autorízala en js_admins desde SQL Editor.",!!error);
};
$("logout").onclick=async()=>{await db?.auth.signOut();user=null;show("detail",false);await checkUser()};
$("create").onclick=async()=>{
 const name=$("tourName").value.trim();if(name.length<4)return message("Poné el nombre del torneo.",true);
 if($("tourMode").value==="OTRA" && !$("customMode").value.trim())return message("Escribí el nombre de la dinámica.",true);
 const day=$("tourDay").value;
 const clock=$("tourTime").value||"20:00";
 const start=day?new Date(day+"T"+clock+":00"):null;
 if(start && (!Number.isFinite(start.getTime()) || start.getTime()<Date.now()))
  return message("Elegí un día y una hora futuros.",true);
 const row={name,team_size:Number($("teamSize").value),max_teams:Number($("maxTeams").value),mode:$("tourMode").value==="OTRA"?$("customMode").value.trim().slice(0,60):$("tourMode").value,starts_at:start?start.toISOString():null,rules:$("rules").value.trim().slice(0,1500),created_by:user.id};
 $("create").disabled=true;
 try{const {data,error}=await db.from("js_tournaments").insert(row).select().single();if(error)throw error;
  $("tourName").value="";initializeDayPicker();resetNewTournamentRules();message("Torneo creado. Código: "+data.code);await loadTours();await openTour(data.id,true);
 }catch(e){message("No se pudo crear: "+e.message,true);}finally{$("create").disabled=false}
};

function drawTournamentCard(t,history){
 const el=document.createElement("div");el.className="item";
 const header=document.createElement("div");header.className="row";
 const left=document.createElement("div");
 const name=document.createElement("strong");name.textContent=t.name;
 const code=document.createElement("div");code.className="code";code.textContent=t.code;
 const meta=document.createElement("div");meta.className="small";meta.textContent=t.team_size+" vs "+t.team_size+" · "+t.max_teams+" equipos · "+(t.mode||"PVP");
 const award=document.createElement("div");award.className="small";award.textContent=prizeText(t);
 left.append(name,code,meta,award);
 const tag=document.createElement("span");tag.className="tag "+(history?"closed":"");tag.textContent=t.status==="finished"?"🏆 Jugado":t.archived_at?"Archivado":t.status==="open"?"Abierto":"Cerrado";
 header.append(left,tag);el.append(header);
 const actions=document.createElement("div");actions.style.cssText="display:flex;flex-wrap:wrap;gap:9px;margin-top:12px;align-items:stretch";
 const btn=document.createElement("button");btn.className="secondary";btn.style.cssText="flex:1;min-width:135px";btn.textContent=history?"Ver resultados →":"Ver inscripciones →";
 btn.onclick=()=>openTour(t.id,true);
 const remove=document.createElement("button");remove.type="button";remove.className="ghost";
 remove.style.cssText="color:#ffb5c1;border-color:#865268;min-width:105px;flex:0 0 auto";
 remove.textContent="🗑️ Eliminar torneo";
 remove.onclick=()=>deleteTournament(t,remove);
 actions.append(btn,remove);el.append(actions);return el;
}
async function loadTours(){
 const {data,error}=await db.from("js_tournaments").select("*").eq("created_by",user.id).order("created_at",{ascending:false});
 if(error)return message(error.message,true);
 const active=$("tours"),history=$("historyTours");active.replaceChildren();history.replaceChildren();
 for(const t of data)(t.status==="finished"||t.archived_at?history:active).append(drawTournamentCard(t,t.status==="finished"||!!t.archived_at));
 if(!active.children.length)active.textContent="No hay torneos activos.";
 if(!history.children.length)history.textContent="Todavía no hay torneos jugados ni archivados.";
}
async function openTour(id,resetTab=false){
 const {data:t,error}=await db.from("js_tournaments").select("*").eq("id",id).single();if(error)return message(error.message,true);
 opened=t;navigate("detail");chooseTourTab(resetTab?"teams":currentTourTab);$("detailName").textContent=t.name;$("detailCode").textContent=t.code;
 $("detailStatus").textContent={open:"Inscripción abierta",closed:"Inscripción cerrada",finished:"Torneo finalizado"}[t.status];
 $("detailStatus").className="tag"+(t.status!=="open"?" closed":"");
 $("detailMeta").textContent=`${t.team_size}vs${t.team_size} · máximo ${t.max_teams} equipos`+(t.starts_at?" · "+new Date(t.starts_at).toLocaleString("es-AR"):"");
 $("toggleOpen").textContent=t.status==="open"?"Cerrar inscripciones":"Abrir inscripciones";
 $("toggleOpen").disabled=t.rounds>0||t.status==="finished";
 $("startBracket").disabled=t.rounds>0||t.status==="finished";
 $("archiveTour").classList.toggle("hidden",t.status==="finished"||!!t.archived_at);
 $("restoreTour").classList.toggle("hidden",!t.archived_at||t.status==="finished");
 $("detailPrizeKind").value=t.prize_kind||"ninguno";
 $("detailPrizeQty").value=t.prize_quantity>0?t.prize_quantity:1;
 $("detailRulesPreview").parentElement.dataset.mode=t.mode||"";
 $("detailRules").value=t.rules||"";
 window.JSRuleFormat.render($("detailRulesPreview"),t.rules||"");
 if(!t.rules)$("detailRulesPreview").textContent="Este torneo todavía no tiene reglas.";
 show("existingRulesEditor",false);
 $("editExistingRules").classList.remove("hidden");
 $("detailPrizeDetails").value=t.prize_details||"";
 prizeFormState("detailPrizeKind","detailPrizeQty","detailPrizeDetails");
 $("prizeBanner").textContent=prizeText(t);
 $("championBox").classList.add("hidden");
 await loadTeamsMatches();
}
async function loadTeamsMatches(){if(!opened)return;
 const [a,b,c]=await Promise.all([
  db.from("js_teams").select("*").eq("tournament_id",opened.id).order("created_at"),
  db.from("js_players").select("*").eq("tournament_id",opened.id),
  db.from("js_matches").select("*").eq("tournament_id",opened.id).order("round").order("slot")
 ]);
 if(a.error||b.error||c.error)return message("No se pudieron cargar datos: "+(a.error||b.error||c.error).message,true);
 teamCache=a.data;matchCache=c.data;
 // Las victorias parciales de la final se consultan aparte y solo las ve el administrador.
 finalGameCache=[];
 const final=m=>m.round===opened.rounds&&m.slot===1;
 const finalMatch=opened.rounds>0?c.data.find(final):null;
 if(finalMatch){
   const {data:games,error:gamesError}=await db.from("js_final_games")
     .select("match_id,game_number,winner").eq("match_id",finalMatch.id).order("game_number");
   if(gamesError)return message("No se pudo cargar el historial de la final: "+gamesError.message,true);
   finalGameCache=games||[];
 }
 roomCache=new Map();
 if(matchCache.length){
   const {data:rooms,error:roomsError}=await db.from("js_match_rooms")
     .select("match_id,room_id,room_password,sent_at").in("match_id",matchCache.map(m=>m.id));
   if(roomsError)return message("No se pudieron cargar las salas: "+roomsError.message,true);
   for(const room of rooms||[])roomCache.set(room.match_id,room);
 }
 const playerByTeam={};for(const p of b.data)(playerByTeam[p.team_id]??=[]).push(p);
 const approved=a.data.filter(t=>t.status==="registered");$("teamCount").textContent=approved.length+" / "+opened.max_teams;
 $("teamList").replaceChildren();
 if(!a.data.length)$("teamList").textContent="Ningún equipo inscrito todavía.";
 for(const t of a.data){const el=document.createElement("div");el.className="item";
 const roster=(playerByTeam[t.id]||[]).sort((a,b)=>(a.player_role==='suplente')-(b.player_role==='suplente')||(a.roster_order||0)-(b.roster_order||0)).map(p=>`<li>${p.player_role==='suplente'?'<strong style="color:#82e4bd">🔁 SUPLENTE</strong> ':''}<strong>${esc(p.nickname)}</strong> <span class="idcell">${esc(p.game_id)}</span> <span class="small">${esc(p.region)}</span></li>`).join("");
 el.innerHTML=`<div class="row"><strong>${esc(t.name)}</strong><span class="tag ${t.status!=="registered"?"closed":""}">${esc(t.status)}</span></div><ul class="checks">${roster}</ul>`;
 if(opened.rounds===0){const del=document.createElement("button");del.className="ghost";del.textContent=t.status==="registered"?"Descalificar equipo":"Restablecer equipo";
 del.onclick=()=>updateTeam(t.id,t.status==="registered"?"disqualified":"registered");el.append(del);}
 const accessBtn=document.createElement("button");
 accessBtn.type="button";accessBtn.className="secondary";accessBtn.style.marginTop="10px";
 accessBtn.textContent=t.access_code_hash?"🔐 Renovar código del equipo":"🔐 Generar código del equipo";
 accessBtn.onclick=()=>generateTeamCode(t);
 el.append(accessBtn);
 if(opened.rounds===0){
  const removeTeam=document.createElement("button");
  removeTeam.type="button";removeTeam.className="ghost";
  removeTeam.style.cssText="margin:10px 0 0 9px;color:#ffc1c7;border-color:#96515d";
  removeTeam.textContent="🗑 Eliminar escuadra definitivamente";
  removeTeam.onclick=()=>deleteTeamCompletely(t);
  el.append(removeTeam);
 }
 $("teamList").append(el);
 }
 drawMatches();
}
async function deleteTeamCompletely(team){
 if(!opened||opened.rounds!==0)return message("No se puede eliminar una escuadra después de generar los cruces.",true);
 if(!await askConfirm("¿Estás seguro de ELIMINAR POR COMPLETO a «"+team.name+"»?\nSe borrarán sus jugadores y código privado y se liberará el cupo. Podrá inscribirse otra vez.\nEsta acción NO se puede deshacer."))return;
 const tourId=opened.id;
 try{
  const {data,error}=await db.rpc("js_delete_team_completely",{p_team:team.id});
  if(error)throw error;
  if(!data?.ok)throw new Error("El servidor no confirmó la eliminación");
  await openTour(tourId);
  await loadTours();
  message("✅ Escuadra eliminada definitivamente: "+team.name+". Sus ID y el cupo quedaron disponibles.");
 }catch(e){message("No se pudo eliminar: "+(e.message||String(e)),true);}
}
async function updateTeam(teamId,status){if(!await askConfirm("¿Cambiar el estado de este equipo?"))return;
 const {error}=await db.from("js_teams").update({status}).eq("id",teamId);if(error)return message(error.message,true);await loadTeamsMatches();}
$("refresh").onclick=async()=>{await loadTours();if(opened)await openTour(opened.id);message("Inscripciones actualizadas.")};
$("closeDetail").onclick=()=>{opened=null;navigate("homeScreen");};
$("copyCode").onclick=()=>copy(opened.code);
const siteRoot=()=>String(currentConfig.siteUrl||location.href.replace(/\/admin\.html.*$/,"")).replace(/\/$/,"");
const enrollmentLink=()=>siteRoot()+"/inscripcion.html?codigo="+encodeURIComponent(opened.code);
$("copyLink").onclick=()=>{if(!currentConfig.siteUrl && location.protocol==="file:")return message("Configurá la URL pública del sitio antes de compartir inscripciones.",true);copy(enrollmentLink())};
async function copy(text){try{await navigator.clipboard.writeText(text);message("Copiado: "+text);}catch{prompt("Copiá este texto:",text)}}
$("toggleOpen").onclick=async()=>{
 if(opened.rounds>0||opened.status==="finished")return;
 const next=opened.status==="open"?"closed":"open";
 const {error}=await db.from("js_tournaments").update({status:next}).eq("id",opened.id);
 if(error)return message(error.message,true);await openTour(opened.id);
};

$("editExistingRules").onclick=()=>{
 show("existingRulesEditor",true);
 $("editExistingRules").classList.add("hidden");
 $("detailRules").focus();
};
$("detailRules").oninput=()=>window.JSRuleFormat.render($("detailRulesPreview"),$("detailRules").value);
$("restoreExistingRules").onclick=async()=>{
 if(!opened)return;
 const defaults=defaultRules(opened.mode);
 if(!defaults)return message("No hay reglas predeterminadas para esta modalidad. Podés escribir unas personalizadas.",true);
 if(!await askConfirm("¿Reemplazar las reglas editadas por las predeterminadas de "+opened.mode+"?"))return;
 $("detailRules").value=defaults;
 window.JSRuleFormat.render($("detailRulesPreview"),defaults);
};
$("saveExistingRules").onclick=async()=>{
 if(!opened)return;
 const id=opened.id;
 const rules=$("detailRules").value.trim();
 const b=$("saveExistingRules");b.disabled=true;
 try{
  const {error}=await db.from("js_tournaments").update({rules}).eq("id",id);
  if(error)throw error;
  await openTour(id);
  message("✓ Reglas guardadas. El enlace de inscripción ya mostrará los cambios.");
 }catch(e){message("No se pudieron guardar las reglas: "+e.message,true);}
 finally{b.disabled=false;}
};
$("savePrize").onclick=async()=>{
 if(!opened)return;
 let award;try{award=prizeInput("detailPrizeKind","detailPrizeQty","detailPrizeDetails")}catch(e){return message(e.message,true)}
 const {error}=await db.from("js_tournaments").update(award).eq("id",opened.id);
 if(error)return message("No se pudo guardar el premio: "+error.message,true);
 const id=opened.id;await openTour(id);await loadTours();message("✓ Premio actualizado.");
};
$("archiveTour").onclick=async()=>{
 if(!opened||opened.status==="finished")return;
 if(!await askConfirm("¿Archivar "+opened.name+"? Pasará al Historial. Si está abierto, se cerrarán sus inscripciones."))return;
 const id=opened.id,update={archived_at:new Date().toISOString()};
 if(opened.status==="open")update.status="closed";
 const {error}=await db.from("js_tournaments").update(update).eq("id",id);
 if(error)return message(error.message,true);
 await loadTours();await openTour(id);message("✓ Torneo archivado en Historial.");
};
$("restoreTour").onclick=async()=>{
 if(!opened||!opened.archived_at||opened.status==="finished")return;
 const {error}=await db.from("js_tournaments").update({archived_at:null}).eq("id",opened.id);
 if(error)return message(error.message,true);
 const id=opened.id;await loadTours();await openTour(id);message("✓ Torneo restaurado a activos.");
};
async function deleteTournament(t,button){
 if(!t||!user)return;
 if(!await confirmDeleteYesNo(t))return;
 if(button){button.disabled=true;button.textContent="Eliminando…";}
 try{
   const {data,error}=await db.from("js_tournaments").delete()
     .eq("id",t.id).eq("created_by",user.id).select("id");
   if(error)throw error;
   if(!data||data.length!==1)throw new Error("No se pudo confirmar el borrado. Revisá los permisos.");
   if(opened&&opened.id===t.id){
      opened=null;teamCache=[];matchCache=[];navigate("homeScreen");
   }
   await loadTours();
   message("✓ Torneo eliminado: "+t.name+". También se borraron sus inscripciones y enfrentamientos.");
 }catch(e){
   message("No se pudo eliminar el torneo: "+(e.message||String(e)),true);
 }finally{
   if(button){button.disabled=false;button.textContent="🗑️ Eliminar torneo";}
 }
}
$("deleteTour").onclick=async()=>{
 if(!opened)return;
 await deleteTournament(opened,$("deleteTour"));
};
$("startBracket").onclick=async()=>{
 if(!opened||opened.rounds>0)return;
 const count=teamCache.filter(t=>t.status==="registered").length;
 if(count<2)return message("Necesitás al menos dos equipos.",true);
 if(!await askConfirm("¿Sortear los cruces entre "+count+" equipos y cerrar las inscripciones? Una vez creadas las llaves no podrás volver a sortearlas."))return;
 const tid=opened.id;
 const button=$("startBracket");
 button.disabled=true;
 button.textContent="Generando…";
 try{
   // Una operación atómica: o guarda todos los cruces y cierra, o no modifica nada.
   const {data,error}=await db.rpc("js_generate_bracket",{p_tournament:tid});
   if(error)throw error;
   if(!data||!data.ok)throw new Error("El servidor no confirmó los cruces.");
   await openTour(tid);
   message("✓ Cruces creados: "+data.teams+" equipos, "+data.rounds+" rondas"+(data.automatic_passes?" y "+data.automatic_passes+" pases directos":"")+".");
   $("bracketOverview").scrollIntoView({behavior:"smooth",block:"start"});
 }catch(e){
   message("No se pudieron generar los cruces: "+(e.message||String(e)),true);
 }finally{
   button.textContent="Generar cruces";
   button.disabled=Boolean(opened&&opened.rounds>0);
 }
};
function drawMatches(){
 const area=$("matchList");area.replaceChildren();
 window.JSBracket.render($("bracketVisual"),{
   rounds:opened?.rounds||0,matches:matchCache,teams:teamCache,
   onMatchSelect:m=>{
     $("matchDetails").open=true;
     const target=document.getElementById("match-editor-"+m.id);
     if(target){
       target.scrollIntoView({behavior:"smooth",block:"center"});
       target.classList.add("champ-match-selected");
       setTimeout(()=>target.classList.remove("champ-match-selected"),2200);
     }
   }
 });
 if(!matchCache.length){area.textContent="Todavía no hay cruces.";return;}
 const names=Object.fromEntries(teamCache.map(t=>[t.id,t.name]));
 for(let round=1;round<=opened.rounds;round++){
  const isFinal=round===opened.rounds;
  const heading=document.createElement("h3");
  heading.textContent=isFinal?"🏆 Final — al mejor de 3":round===opened.rounds-1?"Semifinales":"Ronda "+round;
  heading.style.marginTop="18px";area.append(heading);
  if(isFinal){
   const help=document.createElement("p");help.className="small";
   help.textContent="Gana la final el primer equipo que consiga 2 victorias. Registrá quién ganó cada partida.";
   area.append(help);
  }
  for(const m of matchCache.filter(x=>x.round===round)){
   const el=document.createElement("div");
   el.id="match-editor-"+m.id;
   el.className=isFinal?"match final-series":"match";
   if(!isFinal){
    const p=document.createElement("div");p.className="small";
    p.textContent="Partida #"+m.slot+(m.winner?" · Resultado confirmado":"");el.append(p);
    for(const [key,label] of [["team_a","A"],["team_b","B"]]){
     const row=document.createElement("div");row.className="names";row.style.marginTop="9px";
     const name=document.createElement("span");
     name.textContent=label+" · "+(m[key]?names[m[key]]||"Equipo":"Pendiente");
     if(m.winner===m[key]&&m[key])name.classList.add("champion");
     row.append(name);
     if(m[key]&&m.team_a&&m.team_b&&!m.winner&&opened.status!=="finished"){
      const btn=document.createElement("button");btn.className="good";btn.textContent="Ganó";
      btn.onclick=()=>chooseWinner(m,m[key]);row.append(btn);
     }
     el.append(row);
    }
   }else{
    const scoreA=Number(m.final_wins_a)||0,scoreB=Number(m.final_wins_b)||0;
    const played=scoreA+scoreB;
    const legacy=Boolean(m.winner)&&played===0;
    const title=document.createElement("div");
    title.className="final-label";
    title.textContent=legacy?"🏆 Final histórica — resultado registrado":
       m.winner?"🏆 FINAL TERMINADA":
       m.team_a&&m.team_b?"🔥 Partida "+(played+1)+" de hasta 3":"Esperando finalistas";
    el.append(title);
    const score=document.createElement("div");score.className="final-scoreboard";
    for(const [key,label,wins] of [["team_a","A",scoreA],["team_b","B",scoreB]]){
      const col=document.createElement("div");col.className="final-side";
      const name=document.createElement("div");name.className="final-team";
      name.textContent=m[key]?names[m[key]]||"Equipo":"Pendiente";
      const number=document.createElement("div");number.className="final-score";
      number.textContent=legacy?(m.winner===m[key]?"🏆":"—"):String(wins);
      const tag=document.createElement("div");tag.className="small";tag.textContent="Equipo "+label;
      if(m.winner===m[key]&&m[key])col.classList.add("final-victor");
      col.append(tag,name,number);
      if(m[key]&&m.team_a&&m.team_b&&!m.winner&&opened.status!=="finished"){
        const btn=document.createElement("button");btn.className="good";
        btn.textContent="Ganó partida "+(played+1);
        btn.disabled=savingFinalGame;
        btn.onclick=()=>recordFinalGame(m,m[key]);
        col.append(btn);
      }
      score.append(col);
    }
    el.append(score);
    if(!legacy){
      const line=document.createElement("div");line.className="final-progress";
      line.textContent=m.winner?"✅ Campeón definido por 2 victorias":
       m.team_a&&m.team_b?"Marcador "+scoreA+" – "+scoreB+" · Primer equipo en llegar a 2 gana":"Los dos finalistas aparecerán al terminar las semifinales";
      el.append(line);
    }
    const history=finalGameCache.filter(g=>g.match_id===m.id);
    if(history.length){
      const hist=document.createElement("div");hist.className="final-game-history";
      const h=document.createElement("strong");h.textContent="Partidas registradas";hist.append(h);
      for(const g of history){
        const l=document.createElement("div");l.textContent="✓ Partida "+g.game_number+": ganó "+(names[g.winner]||"Equipo");
        hist.append(l);
      }
      el.append(hist);
    }
   }
   appendRoomEditor(m,el);
   area.append(el);
  }
 }
 const finalMatch=matchCache.find(x=>x.round===opened.rounds&&x.winner);
 const box=$("championBox");
 if(finalMatch&&finalMatch.winner){
  box.classList.remove("hidden");box.replaceChildren();
  const heading=document.createElement("div");heading.style.cssText="font-size:13px;letter-spacing:2px;color:#9fe9d2;font-weight:800";heading.textContent="🏆 CAMPEÓN DEL TORNEO";
  const name=document.createElement("div");name.style.cssText="font-size:29px;font-weight:900;margin:8px 0;overflow-wrap:anywhere";name.textContent=names[finalMatch.winner]||"Equipo ganador";
  const score=document.createElement("div");score.style.cssText="color:#d9e9fa;font-size:16px;font-weight:800;margin-bottom:7px";
  const hasScores=(Number(finalMatch.final_wins_a)||0)+(Number(finalMatch.final_wins_b)||0)>0;
  score.textContent=hasScores?"Ganó la final "+finalMatch.final_wins_a+" – "+finalMatch.final_wins_b+" (mejor de 3)":"Final registrada anteriormente";
  const prize=document.createElement("div");prize.style.cssText="color:#b3ddce;font-size:14px";prize.textContent=prizeText(opened);
  box.append(heading,name,score,prize);
 }else box.classList.add("hidden");
}
async function recordFinalGame(match,winner){
 if(savingFinalGame||!opened)return;
 savingFinalGame=true;
 const name=teamCache.find(t=>t.id===winner)?.name||"Equipo";
 const n=(Number(match.final_wins_a)||0)+(Number(match.final_wins_b)||0)+1;
 const tournamentId=opened.id;
 try{
  if(!await askConfirm("¿Confirmás que "+name+" ganó la PARTIDA "+n+" de la final?\nSe sumará 1 victoria. La final termina cuando alguien gana 2 partidas."))return;
  const {data,error}=await db.rpc("js_report_final_game",{p_match:match.id,p_winner:winner});
  if(error)throw error;
  if(!data?.ok)throw new Error("El servidor no confirmó la partida");
  await openTour(tournamentId);
  if(data.finished)await loadTours();
  message(data.finished?"🏆 ¡Tenemos campeón! "+name+" ganó la final "+data.wins_a+" – "+data.wins_b+".":"✓ Partida "+data.game_number+" registrada. Marcador: "+data.wins_a+" – "+data.wins_b+".");
 }catch(e){
  message("No se pudo registrar la partida: "+(e.message||String(e)),true);
 }finally{savingFinalGame=false;}
}
async function chooseWinner(match,winner){
 const name=teamCache.find(t=>t.id===winner)?.name||"este equipo";
 if(!await askConfirm("¿Confirmás que ganó "+name+"? No se puede modificar desde esta pantalla."))return;
 const {error}=await db.rpc("js_report_winner",{p_match:match.id,p_winner:winner});
 if(error)return message(error.message,true);await openTour(opened.id);await loadTours();
}
// Visor horizontal: avanzar ronda a ronda sin perder la pantalla del torneo.
function moveBracket(direction){
 const viewport=$("bracketVisual").querySelector(".champ-scroll");
 if(!viewport)return;
 viewport.scrollBy({left:direction*306,behavior:"smooth"});
}
$("bracketPrev").onclick=()=>moveBracket(-1);
$("bracketNext").onclick=()=>moveBracket(1);
$("bracketFinal").onclick=()=>{
 const viewport=$("bracketVisual").querySelector(".champ-scroll");
 if(viewport)viewport.scrollTo({left:viewport.scrollWidth,behavior:"smooth"});
};
$("copyBracketLink").onclick=()=>{
 if(!opened)return;
 if(!currentConfig.siteUrl&&location.protocol==="file:")
  return message("Configurá la URL pública antes de compartir las llaves.",true);
 copy(siteRoot()+"/llaves.html?codigo="+encodeURIComponent(opened.code));
};
function updateMaxTeamsHint(){
 const n=Number($("maxTeams").value);
 const hint={
   2:"2 equipos: final directa al mejor de 3.",
   4:"4 equipos: semifinales y final al mejor de 3.",
   6:"6 equipos: 4 juegan la ronda previa y 2 pasan directamente a semifinales. La final es al mejor de 3.",
   8:"8 equipos: cuartos de final, semifinales y final.",
   16:"16 equipos: octavos, cuartos, semifinales y final.",
   32:"32 equipos: eliminatorias de 5 rondas, con final al mejor de 3."
 };
 $("maxTeamsHint").textContent=hint[n]||"Formato eliminatorio";
}
$("maxTeams").onchange=updateMaxTeamsHint;
updateMaxTeamsHint();
resetNewTournamentRules();
initializeDayPicker();
launch();
