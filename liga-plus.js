/**
 * JS Family competitive add-ons:
 * individual rank (2v2 now, ready for official 1v1),
 * four-player ready room, private match chat, anti-absence reports,
 * screenshot evidence and admin case management.
 *
 * No service-role credential is used in the browser. Every mutation goes
 * through an auth.uid()-checked Supabase RPC or a Storage RLS policy.
 */
export function createLeagueExtras({
  sb,getLive,getMe,getView,refreshPage,render,flash,esc,btn,nameOf,personal
}){
 const rank={current:null};
 const ready=new Map(),chats=new Map(),chatOpen=new Set();
 const proofs=new Map(),proofOpen=new Set();
 const reports=new Map(),reportOpen=new Set();
 const admin={cases:[],filter:"",state:"all"};
 let loading=false,lastFetch=0;
 const $=id=>document.getElementById(id);
 const ids=match=>[...(match.lineup_a||[]),...(match.lineup_b||[])];
 const actorMatch=match=>ids(match).includes(getMe())||getLive()?.admin;
 const activeMatch=match=>match.started_at&&Number(match.confirmed)===4;
 const date=d=>d?new Date(d).toLocaleString("es-AR",{dateStyle:"short",timeStyle:"short"}):"—";
 const isOn=match=>activeMatch(match)&&["playing","review"].includes(match.state);
 const safeUUID=s=>/^[0-9a-f-]{36}$/i.test(String(s));
 const call=async(method,args)=>{
  const {data,error}=await sb.rpc(method,args);
  if(error)throw error;
  if(data?.ok===false)throw Error(data?.message||"No se pudo completar la acción.");
  return data;
 };
 async function updateRank(){
  const result=await call("js_liga_rangos",{});
  rank.current=result;
 }
 async function updateOne(matchId){
  const match=getLive()?.matches?.find(x=>x.id===matchId);
  if(!match||!actorMatch(match)||!activeMatch(match))return;
  const requests=[call("js_liga_espera",{p_action:"get",p_match_id:matchId})];
  if(chatOpen.has(matchId))requests.push(call("js_liga_chat_seguro",{p_action:"get",p_match_id:matchId}));
  if(reportOpen.has(matchId))requests.push(call("js_liga_incidencias",{p_action:"get",p_match_id:matchId}));
  const results=await Promise.allSettled(requests);
  if(results[0]?.status==="fulfilled")ready.set(matchId,results[0].value);
  let at=1;
  if(chatOpen.has(matchId)){
   if(results[at]?.status==="fulfilled")chats.set(matchId,results[at].value?.messages||[]);
   at++;
  }
  if(reportOpen.has(matchId)&&results[at]?.status==="fulfilled")
   reports.set(matchId,results[at].value?.reports||[]);
 }
 async function updateCases(){
  if(!getLive()?.admin)return;
  const data=await call("js_liga_incidencias",{p_action:"list"});
  admin.cases=data?.reports||[];
 }
 async function refresh({force=false}={}){
  if(!getMe()||loading)return;
  if(!force&&Date.now()-lastFetch<4500)return;
  loading=true;lastFetch=Date.now();
  try{
   const active=(getLive()?.matches||[]).filter(m=>activeMatch(m)&&actorMatch(m)&&
     ["playing","review"].includes(m.state)).slice(0,4);
   const jobs=[updateRank()];
   for(const m of active)jobs.push(updateOne(m.id));
   if(getLive()?.admin)jobs.push(updateCases());
   await Promise.allSettled(jobs);
   const element=document.activeElement;
   if(!element?.matches("input,textarea,select")&&getLive())render();
  }finally{loading=false;}
 }
 function reset(){
  rank.current=null;ready.clear();chats.clear();chatOpen.clear();
  proofs.clear();proofOpen.clear();reports.clear();reportOpen.clear();
  admin.cases=[];admin.filter="";admin.state="all";lastFetch=0;
 }
 const rankIcon=name=>({Bronce:"🥉",Plata:"🥈",Oro:"🥇",Diamante:"💎",Maestro:"👑"}[name]||"🥉");
 function rankLabel(player){
  if(!player)return "🥉 Bronce · 0 puntos";
  return rankIcon(player.rank)+" "+esc(player.rank||"Bronce")+" · "+Number(player.score||0)+" puntos";
 }
 function myRankCompact(){
  const self=rank.current?.my;
  if(!self)return '<div class="rank-mini"><span>🏅 Rango personal</span><strong>Consultando…</strong></div>';
  const rankName=esc(self.rank||"Bronce");
  return '<div class="rank-mini"><div class="rank-mini-copy">'+
    '<small>🏅 MI RANGO</small><strong>'+
    rankIcon(self.rank)+' '+rankName+'</strong>'+
    '<span>'+Number(self.score||0)+' puntos · '+Number(self.wins||0)+'V / '+Number(self.losses||0)+'D</span>'+
    '</div>'+
    btn("Ver rango","go_rank",'',"small")+
    '</div>';
 }
 function myRank(){
  const self=rank.current?.my;
  if(!self)return '<p class="muted">🏅 Consultando tu rango individual…</p>';
  const total=Number(self.wins||0)+Number(self.losses||0);
  const winrate=total?(100*Number(self.wins||0)/total).toFixed(0)+"%":"—";
  const remaining=self.next_rank_score===null?null:
   Math.max(0,Number(self.next_rank_score||0)-Number(self.score||0));
  const streak=rank.current?.streak||{type:"none",count:0};
  const last=(rank.current?.recent||[]).map(x=>
    (x.outcome==="win"?"🟢":"🔴")+(x.mode==="1v1"?"1VS1":"2VS2")).join(" · ");
  return '<div class="personal-rank"><strong>🏅 TU RANGO PERSONAL</strong>'+
   '<div class="personal-rank-name">'+rankLabel(self)+'</div>'+
   '<div class="rank-stats"><span>🏆 '+Number(self.wins||0)+' victorias</span>'+
   '<span>📉 '+Number(self.losses||0)+' derrotas</span>'+
   '<span>🎯 '+winrate+' victorias</span></div>'+
   '<p class="muted">🎮 2VS2: '+Number(self.duos||0)+
    ' · ⚔️ 1VS1: '+Number(self.solos||0)+
   (remaining===null?' · 👑 Rango máximo':' · Faltan '+remaining+' puntos para subir')+'</p>'+
   (Number(streak.count)>0?'<p class="muted">🔥 Racha actual: '+Number(streak.count)+
    (streak.type==="win"?" victoria(s)":" derrota(s)")+'</p>':"")+
   (last?'<p class="muted">Últimas partidas: '+last+'</p>':"")+
   '</div>';
 }
 function rankPanel(){
  const leaderboard=rank.current?.top||[];
  const rows=leaderboard.map(x=>{
   const user=x.display_name||x.nickname||"Jugador",isMe=x.user_id===getMe();
   return '<div class="rank-person'+(isMe?" mine":"")+'">'+
    '<strong>#'+Number(x.position||0)+'</strong>'+
    '<span class="rank-person-name">'+esc(user)+(isMe?' <small>(vos)</small>':"")+
    '<small>2VS2: '+Number(x.duos||0)+' · 1VS1: '+Number(x.solos||0)+'</small></span>'+
    '<span class="rank-medal">'+rankLabel(x)+'</span></div>';
  }).join("");
  return '<section class="panel"><h2>🏅 Rangos individuales</h2>'+
   '<p class="muted">Cada jugador tiene su propio rango, incluso si cambia de compañero o entra de suplente. Los resultados oficiales de 2VS2 se suman a su perfil; los futuros 1VS1 usarán el mismo historial personal, pero tendrán estadísticas separadas.</p>'+
    myRank()+
    '<div class="rank-rules"><b>🏆 Victoria +25</b><b>📉 Derrota −10</b><b>💎 Puntos nunca menores que 0</b></div>'+
    '<p class="muted">🥉 Bronce 0 · 🥈 Plata 100 · 🥇 Oro 250 · 💎 Diamante 450 · 👑 Maestro 700</p>'+
    '<h3>🏆 Clasificación personal</h3>'+
    (rows||'<p class="muted">Se mostrarán los jugadores con cuentas verificadas.</p>')+
   '</section>';
 }
 function resultDetails(match){
  if(!Array.isArray(match.result_details)||!activeMatch(match))return "";
  return '<div class="match-extra"><strong>📋 ¿Quién confirmó el resultado?</strong>'+
    '<div class="extra-result-grid">'+match.result_details.map(x=>{
      const status=x.result==="win"?"🏆 Gané":x.result==="loss"?"📉 Perdí":"⏳ Falta informar";
      return '<div class="result-person">'+personal(x.user_id)+'<small>'+status+'</small></div>';
    }).join("")+'</div>'+
    '<p class="muted">Cuando los cuatro coinciden, el resultado se acredita. Si se contradicen, JS decide.</p></div>';
 }
 function waitingRoom(match){
  if(!isOn(match))return "";
  const status=ready.get(match.id);
  const readyPlayers=new Map((status?.players||[]).map(x=>[x.user_id,x.ready===true]));
  const mine=readyPlayers.get(getMe())===true;
  const number=Number(status?.ready_count||0);
  const fully=status?.everyone_ready===true;
  const slots=ids(match).map(user=>{
   const accepted=readyPlayers.get(user)===true;
   return '<span class="ready-member">'+
    (accepted?"✅":"◷")+" "+personal(user)+'</span>';
  }).join("");
  return '<div class="match-extra wait-room">'+
   '<strong>🎮 Sala de espera · '+number+'/4 listos</strong>'+
   '<p class="muted">'+(fully?"✅ ¡Los cuatro están listos! Ya pueden jugar.":"Los cuatro deben tocar Estoy listo, cada uno desde su cuenta.")+'</p>'+
   '<div class="ready-list">'+slots+'</div>'+
   (ids(match).includes(getMe())?
    btn(mine?"↩️ Ya no estoy listo":"✅ ESTOY LISTO",mine?"unready":"ready",
     'data-match="'+match.id+'"',mine?"small":"good block"):"")+
   '</div>';
 }
 function chatPanel(match){
  if(!activeMatch(match))return "";
  const open=chatOpen.has(match.id);
  if(!open)return '<div class="match-extra"><strong>💬 Chat privado de este PvP</strong><p class="muted">Solo los cuatro jugadores y JS.</p>'+
   btn("Abrir chat","chat_open",'data-match="'+match.id+'"',"small")+'</div>';
  const list=chats.get(match.id)||[];
  const messages=list.slice(-20).map(m=>
   '<div class="chat-line'+(m.user_id===getMe()?" mine":"")+'">'+
   '<strong>'+personal(m.user_id)+'</strong>'+
   '<span>'+esc(m.body)+'</span><small>'+date(m.created_at)+'</small></div>').join("");
  return '<div class="match-extra"><strong>💬 Chat privado</strong>'+
   '<div class="chat-thread">'+(messages||'<p class="muted">Todavía no hay mensajes.</p>')+'</div>'+
   (isOn(match)?
    '<label for="chat-input-'+match.id+'">Mensaje (máximo 500 caracteres)</label>'+
    '<textarea id="chat-input-'+match.id+'" rows="2" maxlength="500" placeholder="Coordinemos la sala…"></textarea>'+
    '<div class="row">'+btn("Enviar mensaje","chat_send",'data-match="'+match.id+'"',"good")+
    btn("Actualizar","chat_refresh",'data-match="'+match.id+'"',"small")+'</div>':
    '<p class="muted">La partida terminó. El chat es de solo lectura.</p>')+
   '</div>';
 }
 function reportPanel(match){
  if(!isOn(match))return "";
  const open=reportOpen.has(match.id);
  if(!open)return '<div class="match-extra"><strong>🚩 Reportar ausencia o problema</strong>'+
    '<p class="muted">JS revisa cada caso. El reporte no otorga puntos automáticamente.</p>'+
    btn("Informar un problema","report_open",'data-match="'+match.id+'"',"small")+'</div>';
  const own=(reports.get(match.id)||[]).map(x=>
   '<p class="muted">'+(x.kind==="absence"?"🚩 Ausencia":"⚠️ Disputa")+
    ' · '+esc(x.state==="resolved"?"Resuelto":"Pendiente")+'</p>').join("");
  const others=ids(match).filter(x=>x!==getMe());
  return '<div class="match-extra"><strong>🚩 Informar problema a JS</strong>'+
   own+
   '<label for="report-target-'+match.id+'">¿Quién no se presentó?</label>'+
   '<select id="report-target-'+match.id+'">'+others.map(x=>'<option value="'+esc(x)+'">'+personal(x)+'</option>').join("")+'</select>'+
   '<label for="report-why-'+match.id+'">¿Qué pasó?</label>'+
   '<textarea id="report-why-'+match.id+'" maxlength="350" rows="3" placeholder="Ejemplo: aceptó el PvP, pero nunca entró a la sala."></textarea>'+
   '<div class="row">'+btn("🚩 No se presentó","report_absence",'data-match="'+match.id+'"',"danger")+
   btn("⚠️ Resultado en disputa","report_dispute",'data-match="'+match.id+'"',"small")+'</div></div>';
 }
 function evidencePanel(match){
  if(!activeMatch(match))return "";
  const open=proofOpen.has(match.id);
  if(!open)return '<div class="match-extra"><strong>📸 Capturas para JS</strong>'+
    '<p class="muted">Pruebas privadas del PvP para resolver resultados discutidos.</p>'+
    btn("Ver / subir capturas","proof_open",'data-match="'+match.id+'"',"small")+'</div>';
  const files=proofs.get(match.id)||[];
  const entries=files.map((f,i)=>'<div class="proof-item"><span>📸 Captura '+(i+1)+'</span>'+
    (f.url?'<a href="'+esc(f.url)+'" target="_blank" rel="noopener noreferrer">Abrir prueba</a>':"")+'</div>').join("");
  return '<div class="match-extra"><strong>📸 Pruebas privadas de este PvP</strong>'+
   '<p class="muted">Solo los cuatro participantes y JS pueden abrir las capturas. Máximo tres por jugador, 5 MB cada una.</p>'+
   (entries||'<p class="muted">Aún no hay capturas.</p>')+
   (isOn(match)&&ids(match).includes(getMe())?
    '<label for="proof-file-'+match.id+'">Seleccionar captura JPG, PNG o WEBP</label>'+
    '<input type="file" id="proof-file-'+match.id+'" accept="image/jpeg,image/png,image/webp">'+
    btn("📤 Subir captura","proof_upload",'data-match="'+match.id+'"',"good"):"")+
   '</div>';
 }
 function matchPanel(match){
  if(!activeMatch(match))return "";
  if(!actorMatch(match))return resultDetails(match);
  return resultDetails(match)+waitingRoom(match)+
   chatPanel(match)+evidencePanel(match)+reportPanel(match);
 }
 function adminPanel(){
  if(!getLive()?.admin)return "";
  const cases=admin.cases||[];
  const active=cases.filter(c=>c.state==="open");
  const rows=active.map(c=>{
   const culprit=c.target?personal(c.target):"Sin jugador específico";
   return '<div class="match report-item"><strong>'+
    (c.kind==="absence"?"🚩 Jugador ausente":"⚠️ Resultado discutido")+
    ' · PVP #'+Number(c.match_id)+'</strong>'+
    '<p class="muted">Reportó: '+personal(c.reporter)+
    ' · Señalado: '+culprit+'</p>'+
    '<p>'+esc(c.details||"")+'</p>'+
    '<p class="muted">Fecha: '+date(c.created_at)+'</p>'+
    '<div class="row">'+btn("📋 Ir a partida","admin_goto_match",'data-match="'+Number(c.match_id)+'"',"small")+
    btn("✅ Marcar revisado","report_resolve",'data-report="'+Number(c.id)+'"',"good")+
    '</div></div>';
  }).join("");
  return '<section class="panel"><h2>🚩 Casos pendientes para JS ('+active.length+')</h2>'+
   '<p class="muted">Reportes de jugadores ausentes y resultados discutidos. Revisá el chat, las capturas y los votos del PvP antes de asignar una victoria.</p>'+
   (rows||'<div class="empty">No hay reportes pendientes.</div>')+
   '</section>';
 }
 async function getProofs(matchId){
  const raw=await call("js_liga_pruebas",{p_match_id:matchId});
  const files=raw?.files||[];
  if(!files.length){proofs.set(matchId,[]);return;}
  const {data,error}=await sb.storage.from("js-liga-pruebas")
    .createSignedUrls(files.map(f=>f.path),300);
  if(error)throw error;
  proofs.set(matchId,files.map((f,i)=>({
    ...f,url:data?.[i]?.signedUrl||""
  })));
 }
 async function runAction(action,button){
  const matchId=Number(button.dataset.match);
  const match=getLive()?.matches?.find(m=>m.id===matchId);
  if(action==="admin_goto_match"){
    // The parent controller owns navigation. Just focus the selected PvP in Admin.
    const element=document.querySelector("#admin-match-list [data-match-id='"+matchId+"']");
    if(element)element.scrollIntoView({behavior:"smooth",block:"start"});
    else flash("El PvP #"+matchId+" está en la pestaña Partidas o su historial.");
    return true;
  }
  if(action==="report_resolve"){
   if(!getLive()?.admin)return true;
   if(!window.confirm("¿Marcás este reporte como revisado? Esto NO asigna un ganador."))return true;
   try{
    const raw=await call("js_liga_incidencias",{
     p_action:"resolve",p_report_id:Number(button.dataset.report),
     p_details:"Revisado desde el panel de JS"
    });
    admin.cases=raw?.reports||[];
    flash("✅ Reporte marcado como revisado.");
    render();
   }catch(e){flash(String(e?.message||e),true);}
   return true;
  }
  const known=[
   "ready","unready","chat_open","chat_refresh","chat_send",
   "report_open","report_absence","report_dispute",
   "proof_open","proof_upload"
  ];
  if(!known.includes(action))return false;
  if(!match||!activeMatch(match)||!actorMatch(match)){
   flash("Este PvP no está disponible para tu cuenta.",true);return true;
  }
  if(["chat_open","report_open","proof_open"].includes(action)){
   if(action==="chat_open")chatOpen.add(matchId);
   if(action==="report_open")reportOpen.add(matchId);
   if(action==="proof_open")proofOpen.add(matchId);
  }
  button.disabled=true;
  try{
   if(action==="ready"||action==="unready"){
    const raw=await call("js_liga_espera",{p_action:action,p_match_id:matchId});
    ready.set(matchId,raw);
    flash(raw.message);
   }else if(action.startsWith("chat_")){
    const raw=await call("js_liga_chat_seguro",{
     p_action:action==="chat_send"?"send":"get",
     p_match_id:matchId,
     p_message:action==="chat_send"?$("chat-input-"+matchId)?.value.trim():null
    });
    chats.set(matchId,raw.messages||[]);
    if(action==="chat_send")flash("✅ Mensaje enviado al chat privado.");
   }else if(action==="report_absence"||action==="report_dispute"){
    const raw=await call("js_liga_incidencias",{
     p_action:action==="report_absence"?"report_absence":"report_dispute",
     p_match_id:matchId,
     p_target:action==="report_absence"?$("report-target-"+matchId)?.value:null,
     p_details:$("report-why-"+matchId)?.value.trim()
    });
    reports.set(matchId,raw.reports||[]);
    flash(raw.message);
   }else if(action==="proof_open"){
    await getProofs(matchId);
   }else if(action==="proof_upload"){
    const file=$("proof-file-"+matchId)?.files?.[0];
    if(!file)throw Error("Elegí una captura antes de subir.");
    const ext={
     "image/jpeg":"jpg","image/png":"png","image/webp":"webp"
    }[file.type];
    if(!ext||file.size>5*1024*1024||file.size===0)
     throw Error("Solo JPG, PNG o WEBP de hasta 5 MB.");
    if(!globalThis.crypto?.randomUUID)throw Error("Este navegador no permite subir capturas seguras.");
    const {data:{user},error:userError}=await sb.auth.getUser();
    if(userError||!user?.id)throw Error("Iniciá sesión de nuevo para subir la captura.");
    const path=matchId+"/"+user.id+"/"+crypto.randomUUID()+"."+ext;
    const {error}=await sb.storage.from("js-liga-pruebas").upload(path,file,{
     contentType:file.type,cacheControl:"300",upsert:false
    });
    if(error)throw error;
    await getProofs(matchId);
    flash("✅ Captura subida de manera privada. JS ya puede revisarla.");
   }
   if(["chat_open","chat_refresh","report_open"].includes(action))await updateOne(matchId);
   render();
  }catch(e){flash(String(e?.message||e),true);}
  finally{button.disabled=false;}
  return true;
 }
 function afterRender(){
  if(getView()!=="admin")return;
  const input=$("admin-pvp-filter"),selector=$("admin-pvp-state");
  if(input)input.value=admin.filter;
  if(selector)selector.value=admin.state;
  filterAdmin();
 }
 function filterAdmin(){
  const items=document.querySelectorAll("#admin-match-list article.match");
  items.forEach(item=>{
   const text=item.textContent.toLowerCase();
   const state=item.dataset.matchState;
   item.hidden=!(text.includes(admin.filter)&&
    (admin.state==="all"||admin.state===state));
  });
  const remaining=[...items].filter(x=>!x.hidden).length;
  const badge=$("admin-pvp-found");
  if(badge)badge.textContent=remaining+" PvP encontrados";
 }
 function changeFilter(target){
  if(target?.id==="admin-pvp-filter"){admin.filter=target.value.trim().toLowerCase();filterAdmin();}
  if(target?.id==="admin-pvp-state"){admin.state=target.value;filterAdmin();}
 }
 return {matchPanel,myRank,myRankCompact,rankPanel,adminPanel,refresh,reset,
  runAction,afterRender,changeFilter,filterAdmin};
}
