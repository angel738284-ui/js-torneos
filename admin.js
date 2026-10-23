"use strict";
const $=id=>document.getElementById(id);
const show=(id,on)=>$(id).classList.toggle("hidden",!on);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
let db=null,user=null,opened=null,teamCache=[],matchCache=[],currentConfig=null;
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
 show("login",false);show("app",true);show("logout",true);await loadTours();
}
$("tourMode").onchange=()=>{const custom=$("tourMode").value==="OTRA";$("customLabel").classList.toggle("hidden",!custom);$("customMode").classList.toggle("hidden",!custom);};
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
 const start=$("startAt").value;
 const row={name,team_size:Number($("teamSize").value),max_teams:Number($("maxTeams").value),mode:$("tourMode").value==="OTRA"?$("customMode").value.trim().slice(0,60):$("tourMode").value,starts_at:start?new Date(start).toISOString():null,rules:$("rules").value.trim().slice(0,1500),created_by:user.id};
 $("create").disabled=true;
 try{const {data,error}=await db.from("js_tournaments").insert(row).select().single();if(error)throw error;
  $("tourName").value="";message("Torneo creado. Código: "+data.code);await loadTours();await openTour(data.id);
 }catch(e){message("No se pudo crear: "+e.message,true);}finally{$("create").disabled=false}
};
async function loadTours(){
 const {data,error}=await db.from("js_tournaments").select("*").eq("created_by",user.id).order("created_at",{ascending:false});
 if(error)return message(error.message,true);
 $("tours").replaceChildren();if(!data.length){$("tours").textContent="Todavía no creaste torneos.";return;}
 for(const t of data){const el=document.createElement("div");el.className="item";
 el.innerHTML=`<div class="row"><div><strong>${esc(t.name)}</strong><div class="code">${esc(t.code)}</div><span class="small">${t.team_size} vs ${t.team_size} · ${t.max_teams} equipos · ${esc(t.mode||"PVP")}</span></div><span class="tag ${t.status!=="open"?"closed":""}">${esc(t.status)}</span></div>`;
 const btn=document.createElement("button");btn.className="secondary full";btn.style.marginTop="11px";btn.textContent="Ver inscripciones →";btn.onclick=()=>openTour(t.id);el.append(btn);$("tours").append(el);
 }
}
async function openTour(id){
 const {data:t,error}=await db.from("js_tournaments").select("*").eq("id",id).single();if(error)return message(error.message,true);
 opened=t;show("detail",true);$("detailName").textContent=t.name;$("detailCode").textContent=t.code;
 $("detailStatus").textContent={open:"Inscripción abierta",closed:"Inscripción cerrada",finished:"Torneo finalizado"}[t.status];
 $("detailStatus").className="tag"+(t.status!=="open"?" closed":"");
 $("detailMeta").textContent=`${t.team_size}vs${t.team_size} · máximo ${t.max_teams} equipos`+(t.starts_at?" · "+new Date(t.starts_at).toLocaleString("es-AR"):"");
 $("toggleOpen").textContent=t.status==="open"?"Cerrar inscripciones":"Abrir inscripciones";
 $("toggleOpen").disabled=t.rounds>0||t.status==="finished";
 $("startBracket").disabled=t.rounds>0||t.status==="finished";
 await loadTeamsMatches();$("detail").scrollIntoView({behavior:"smooth",block:"start"});
}
async function loadTeamsMatches(){if(!opened)return;
 const [a,b,c]=await Promise.all([
  db.from("js_teams").select("*").eq("tournament_id",opened.id).order("created_at"),
  db.from("js_players").select("*").eq("tournament_id",opened.id),
  db.from("js_matches").select("*").eq("tournament_id",opened.id).order("round").order("slot")
 ]);
 if(a.error||b.error||c.error)return message("No se pudieron cargar datos: "+(a.error||b.error||c.error).message,true);
 teamCache=a.data;matchCache=c.data;
 const playerByTeam={};for(const p of b.data)(playerByTeam[p.team_id]??=[]).push(p);
 const approved=a.data.filter(t=>t.status==="registered");$("teamCount").textContent=approved.length+" / "+opened.max_teams;
 $("teamList").replaceChildren();
 if(!a.data.length)$("teamList").textContent="Ningún equipo inscrito todavía.";
 for(const t of a.data){const el=document.createElement("div");el.className="item";
 const roster=(playerByTeam[t.id]||[]).map(p=>`<li><strong>${esc(p.nickname)}</strong> <span class="idcell">${esc(p.game_id)}</span> <span class="small">${esc(p.region)}</span></li>`).join("");
 el.innerHTML=`<div class="row"><strong>${esc(t.name)}</strong><span class="tag ${t.status!=="registered"?"closed":""}">${esc(t.status)}</span></div><ul class="checks">${roster}</ul>`;
 if(opened.rounds===0){const del=document.createElement("button");del.className="ghost";del.textContent=t.status==="registered"?"Descalificar equipo":"Restablecer equipo";
 del.onclick=()=>updateTeam(t.id,t.status==="registered"?"disqualified":"registered");el.append(del);}
 $("teamList").append(el);
 }
 drawMatches();
}
async function updateTeam(teamId,status){if(!await askConfirm("¿Cambiar el estado de este equipo?"))return;
 const {error}=await db.from("js_teams").update({status}).eq("id",teamId);if(error)return message(error.message,true);await loadTeamsMatches();}
$("refresh").onclick=async()=>{await loadTours();if(opened)await openTour(opened.id);message("Inscripciones actualizadas.")};
$("closeDetail").onclick=()=>show("detail",false);
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
   $("matchList").scrollIntoView({behavior:"smooth",block:"start"});
 }catch(e){
   message("No se pudieron generar los cruces: "+(e.message||String(e)),true);
 }finally{
   button.textContent="Generar cruces";
   button.disabled=Boolean(opened&&opened.rounds>0);
 }
};
function drawMatches(){
 const area=$("matchList");area.replaceChildren();if(!matchCache.length){area.textContent="Todavía no hay cruces.";return;}
 const names=Object.fromEntries(teamCache.map(t=>[t.id,t.name]));
 for(let round=1;round<=opened.rounds;round++){
  const heading=document.createElement("h3");heading.textContent=round===opened.rounds?"Final":round===opened.rounds-1?"Semifinales":"Ronda "+round;heading.style.marginTop="18px";area.append(heading);
  for(const m of matchCache.filter(x=>x.round===round)){
   const el=document.createElement("div");el.className="match";
   const p=document.createElement("div");p.className="small";p.textContent="Partida #"+m.slot+(m.winner?" · Resultado confirmado":"");el.append(p);
   for(const [key,label] of [["team_a","A"],["team_b","B"]]){
    const row=document.createElement("div");row.className="names";row.style.marginTop="9px";
    const name=document.createElement("span");name.textContent=(label+" · ")+(m[key]?names[m[key]]||"Equipo":"Pendiente");
    if(m.winner===m[key]&&m[key])name.classList.add("champion");row.append(name);
    if(m[key]&&m.team_a&&m.team_b&&!m.winner&&opened.status!=="finished"){
     const btn=document.createElement("button");btn.className="good";btn.textContent="Ganó";btn.onclick=()=>chooseWinner(m,m[key]);row.append(btn);
    }
    el.append(row);
   }area.append(el);
  }
 }
 if(opened.status==="finished")message("🏆 El torneo ya tiene campeón. Se completaron todas las rondas.");
}
async function chooseWinner(match,winner){
 const name=teamCache.find(t=>t.id===winner)?.name||"este equipo";
 if(!await askConfirm("¿Confirmás que ganó "+name+"? No se puede modificar desde esta pantalla."))return;
 const {error}=await db.rpc("js_report_winner",{p_match:match.id,p_winner:winner});
 if(error)return message(error.message,true);await openTour(opened.id);
}
launch();
