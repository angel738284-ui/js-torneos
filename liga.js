import {createClient} from "https://esm.sh/@supabase/supabase-js@2.45.6";
import {createLeagueExtras} from "./liga-plus.js?v=1.0.0";

const conf=window.JS_CONFIG||{};
const sb=createClient(conf.supabaseUrl,conf.publishableKey,{
 auth:{flowType:"pkce",detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}
});
const $=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const date=value=>value?new Intl.DateTimeFormat("es-AR",{timeZone:"America/Argentina/Buenos_Aires",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)):"—";
const id=value=>esc(value??"");
const btn=(text,action,extra="",color="")=>'<button type="button" class="btn '+color+'" data-action="'+esc(action)+'" '+extra+'>'+esc(text)+'</button>';
let live=null,me=null,view="inicio",busy=false,seenError="";
let moreOpen=false;
const expandedPvps=new Set(),expandedAdminPanels=new Set();
const privateRooms=new Map(),shownPasswords=new Set(),editingRooms=new Set();
const previousMatchStates=new Map();
let notificationPrimed=false,roomSyncing=false;
let presenceBusy=false;
const teams=()=>live?.teams||[];
const games=()=>live?.matches||[];
const search=()=>live?.search||{};
const myActiveGame=()=>{
 const t=teamOf(me);
 return games().find(g=>t&&[g.a,g.b].includes(t.id)&&running(g));
};
const players=()=>live?.players||[];
const teamOf=uid=>teams().find(t=>[t.captain,t.partner,t.substitute].includes(uid));
const playerOf=uid=>players().find(p=>p.id===uid);
const nameOf=uid=>playerOf(uid)?.name||"Jugador";
const personal=uid=>esc(nameOf(uid));
const teamName=t=>t?personal(t.captain)+" + "+personal(t.partner):"Dúo no encontrado";
const line=t=>{
 if(!t)return[];
 return [t.replaced===t.captain?t.substitute:t.captain,t.replaced===t.partner?t.substitute:t.partner];
};
const running=b=>["pending","playing","review"].includes(b.state);
const status=b=>({pending:"⏳ Esperando aceptación",playing:"🎮 En juego · sin vencimiento",review:"⚠️ Revisión de JS",complete:"✅ Finalizado",cancelled:"🚫 Anulado",expired:"⚠️ Revisión de JS"}[b.state]||b.state);
const theme=b=>b.state==="complete"?"good":b.state==="review"?"danger":"";
const isRealParticipant=b=>[...(b.lineup_a||[]),...(b.lineup_b||[])].includes(me);
const errorHtml=msg=>'<div class="error">'+esc(msg)+'</div>';
const card=(title,content)=>'<section class="panel"><h2>'+title+'</h2>'+content+'</section>';
const playerIdField=(selector,label)=>{
 return '<label for="'+selector+'">'+esc(label)+'</label>'+
  '<input id="'+selector+'" type="text" inputmode="numeric" autocomplete="off" maxlength="16" '+
  'pattern="[0-9]{5,16}" placeholder="Ej. 123456789" aria-label="'+esc(label)+'">'+
  '<p class="muted">Escribí el ID de Free Fire de tu compañero. El servidor buscará su cuenta verificada. '+
  'Si todavía no se registró, tiene que entrar a <a href="./index.html" style="color:var(--mint);text-decoration:underline">JS Torneos</a> '+
  'con Google y verificar su ID desde Perfil. Después podrás invitarlo.</p>';
};
const pageHint='<p class="muted">Las partidas de esta liga no modifican el historial de torneos existente ni el ranking anterior de JS Guardian.</p>';
const extras=createLeagueExtras({
 sb,getLive:()=>live,getMe:()=>me,getView:()=>view,refreshPage:()=>load(true),
 render:()=>render(),flash:(msg,fail)=>flash(msg,fail),esc,btn,nameOf,personal
});
let tickChannel=null,tickTimer=null;
function subscribeLeagueRealtime(){
 if(tickChannel||!me)return;
 tickChannel=sb.channel("js-liga-refrescos-v1")
  .on("postgres_changes",{
   event:"UPDATE",schema:"public",table:"js_liga_refresh_ticks"
  },()=>{
   if(document.hidden||busy)return;
   clearTimeout(tickTimer);
   tickTimer=setTimeout(()=>void load(true),750);
  }).subscribe();
}
function unsubscribeLeagueRealtime(){
 clearTimeout(tickTimer);
 if(tickChannel){void sb.removeChannel(tickChannel);tickChannel=null;}
}

/**
 * Each signed-in account counts once while this page is visible. The server
 * expires missing heartbeats after 70 seconds. Game state is separate:
 * "En curso" is a web PvP accepted by the four players, not FF telemetry.
 */
function showPresence(data){
 const online=$("league-online-pill"),playing=$("league-playing-pill");
 if(!online||!playing)return;
 const valid=Number.isSafeInteger(data?.online_count)&&data.online_count>=0&&
  Number.isSafeInteger(data?.active_matches)&&data.active_matches>=0;
 online.textContent=valid?"🟢 "+data.online_count+" conectado"+(data.online_count===1?"":"s"):"🟢 — conectados";
 online.classList.toggle("off",!valid);
 playing.textContent=valid?"🎮 "+data.active_matches+" PvP en curso":"🎮 — PvP en curso";
}
async function refreshPresence(){
 if(presenceBusy||document.hidden||!me)return;
 presenceBusy=true;
 try{
  const {data,error}=await sb.rpc("js_liga_presencia",{p_active:true});
  if(error)throw error;
  showPresence(data);
 }catch(e){
  showPresence(null);
  console.warn("No se pudo actualizar el contador de conectados",e?.code||"");
 }finally{presenceBusy=false;}
}

function flash(message,fail=false){
 const node=$("league-toast");node.textContent=String(message);node.classList.toggle("fail",fail);node.hidden=false;
 clearTimeout(flash.timeout);flash.timeout=setTimeout(()=>node.hidden=true,18000);
}
function statusBanner(){
 const active=Boolean(live?.season),pill=$("state-pill");
 pill.textContent=active?(live.paused?"⏸ TEMPORADA "+live.season.id+" · PAUSADA":"● TEMPORADA "+live.season.id+" · ABIERTA"):"● LIGA AÚN NO ABIERTA";
 pill.classList.toggle("off",!active||live?.paused===true);
 $("metric-teams").textContent=String(teams().length);
 $("metric-games").textContent=String(games().filter(x=>x.state==="complete").length);
 $("metric-reward").textContent=active?"TOP 1":"—";
 $("league-admin-tab").hidden=!live?.admin;
}
function roster(t,showSub=true){
 if(!t)return"";
 return '<div class="team"><div class="emblem">🛡️</div><div class="team-txt"><strong>'+teamName(t)+'</strong>'+
 '<small>🆔 Dúo · '+t.wins+' victorias / '+t.losses+' derrotas</small>'+
 (showSub&&t.substitute?'<small style="display:block">🛡️ Suplente: '+personal(t.substitute)+(t.replaced?' · en juego por '+personal(t.replaced):' · reserva')+'</small>':'')+
 '</div></div>';
}
function lineupText(b,side){
 const list=(side==="a"?b.lineup_a:b.lineup_b)||[];
 return list.map(personal).join(" + ");
}
/**
 * The server provides a status for each of the four actual match players.
 * Do not infer an individual acceptance from the 2/4 aggregate.
 */
function acceptanceDetails(b){
 const votes=new Map((Array.isArray(b.acceptances)?b.acceptances:[])
  .map(v=>[v.user_id,v.status]));
 const sides=[
  {ids:b.lineup_a||[],label:"🔵 EQUIPO AZUL"},
  {ids:b.lineup_b||[],label:"🔴 EQUIPO ROJO"}
 ];
 const waiting=[];
 const cards=sides.map(side=>{
  const people=side.ids.map(uid=>{
   const status=votes.get(uid)||"pending";
   if(status==="pending")waiting.push(nameOf(uid));
   const ready=status==="accepted",declined=status==="rejected";
   const icon=ready?"✓":declined?"✕":"◷";
   const label=ready?"Confirmó":declined?"Rechazó":"Sin confirmar";
   const css=ready?"accepted":declined?"rejected":"waiting";
   return '<div class="accept-player">'+
    '<span class="accept-symbol '+css+'" aria-label="'+label+'" title="'+label+'">'+icon+'</span>'+
    '<span class="accept-person">'+personal(uid)+(uid===me?' <small class="muted">(vos)</small>':"")+'</span>'+
    '</div>';
  }).join("");
  return '<div class="accept-team"><strong>'+side.label+'</strong>'+people+'</div>';
 }).join("");
 const timer=b.state==="pending"&&b.accept_until?
  '<div class="accept-timer">⏳ Tiempo para aceptar: <strong class="accept-countdown" data-accept-deadline="'+
   esc(b.accept_until)+'">—</strong></div>':"";
 const missing=b.state==="pending"&&waiting.length?
  '<p class="accept-missing">Faltan por aceptar: '+esc(waiting.join(", "))+'</p>':"";
 return '<div class="acceptance-panel" aria-label="Confirmaciones individuales de los cuatro jugadores">'+
  '<div class="acceptance-title">✔ ¿Quién confirmó? <span class="muted">'+Number(b.confirmed||0)+'/4</span></div>'+
  '<div class="acceptance-grid">'+cards+'</div>'+missing+timer+'</div>';
}
function refreshAcceptCountdowns(){
 document.querySelectorAll("[data-accept-deadline]").forEach(node=>{
  const time=Date.parse(node.dataset.acceptDeadline||"");
  if(!Number.isFinite(time)){node.textContent="—";return;}
  const seconds=Math.max(0,Math.ceil((time-Date.now())/1000));
  const minutes=Math.floor(seconds/60);
  const rest=String(seconds%60).padStart(2,"0");
  node.textContent=minutes+":"+rest+(seconds===0?" · tiempo agotado":"");
  node.classList.toggle("expired",seconds===0);
 });
}
function roomCard(b){
 if(Number(b.confirmed)!==4)return "";
 if(!b.started_at||!["playing","review"].includes(b.state))return "";
 if(!isRealParticipant(b)&&!live?.admin)return "";
 const cached=privateRooms.get(b.id),editing=editingRooms.has(b.id);
 const controls='<div class="row" style="margin-top:10px">'+
  btn("🔄 Actualizar sala","room_get",'data-match="'+b.id+'"',"small")+'</div>';
 if(editing){
  return '<div class="room-card">'+
   '<strong>🔐 '+(cached?.found?"Editar sala privada":"Crear sala privada")+'</strong>'+
   '<p class="muted">Solo podrán ver estos datos los cuatro jugadores y JS. La sala la crean ustedes en Free Fire.</p>'+
   '<label for="room-id-'+b.id+'">ID de sala de Free Fire</label>'+
   '<input id="room-id-'+b.id+'" type="text" inputmode="numeric" maxlength="18" autocomplete="off" placeholder="Número de sala" value="'+esc(cached?.room_id||"")+'">'+
   '<label for="room-pass-'+b.id+'">Contraseña</label>'+
   '<input id="room-pass-'+b.id+'" type="text" maxlength="32" autocomplete="off" placeholder="Contraseña de la sala" value="'+esc(cached?.room_password||"")+'">'+
   '<div class="row" style="margin-top:12px">'+
    btn("🔐 Guardar sala","room_save",'data-match="'+b.id+'"',"good")+
    btn("Cancelar edición","room_edit_cancel",'data-match="'+b.id+'"',"small")+'</div>'+
   '</div>';
 }
 if(cached?.found){
  return '<div class="room-card"><strong>🔐 Sala privada del PVP #'+b.id+'</strong>'+
   '<p class="muted">Visible solamente para los cuatro jugadores de este PvP y JS.</p>'+
   '<div class="room-code"><div><small>ID de sala</small><strong>'+esc(cached.room_id)+'</strong></div>'+
    btn("Copiar ID","room_copy_id",'data-match="'+b.id+'"',"small")+'</div>'+
   '<div class="room-code"><div><small>Contraseña</small><strong>'+
    (shownPasswords.has(b.id)?esc(cached.room_password):"••••••••")+'</strong></div>'+
    btn(shownPasswords.has(b.id)?"Ocultar":"Mostrar","room_toggle",'data-match="'+b.id+'"',"small")+
    btn("Copiar clave","room_copy_pass",'data-match="'+b.id+'"',"small")+'</div>'+
   (cached.can_edit?
    '<div class="row">'+btn("✏️ Corregir sala","room_edit",'data-match="'+b.id+'"',"small")+
    btn("Quitar sala","room_clear",'data-match="'+b.id+'"',"danger small")+'</div>':
    '<p class="muted">Si los datos están equivocados, pedile a quien creó la sala que los corrija.</p>')+
    controls+'</div>';
 }
 return '<div class="room-card"><strong>🔐 Sala privada</strong>'+
  '<p class="muted">ID y contraseña solo para participantes del enfrentamiento. No se publican en el grupo de WhatsApp.</p>'+
  (cached?.found===false?btn("➕ Crear sala","room_edit",'data-match="'+b.id+'"',"hot"):
    btn("🔑 Ver ID y contraseña","room_get",'data-match="'+b.id+'"',"good"))+
  '</div>';
}
function browserNotice(message,tag){
 flash(message);
 if(typeof Notification!=="undefined"&&Notification.permission==="granted"){
  try{new Notification("JS FAMILY · LIGA 2VS2",{body:message,tag:"js-liga-"+tag});}
  catch(_){ /* In-page alerts remain available when browser notifications aren't supported. */ }
 }
}
function checkLeagueNotices(data){
 const uid=data.user,team=data.teams?.find(t=>[t.captain,t.partner,t.substitute].includes(uid));
 const matches=data.matches||[];
 if(notificationPrimed){
  for(const match of matches){
   if(![match.a,match.b].includes(team?.id))continue;
   const previous=previousMatchStates.get(match.id);
   if(previous===undefined&&match.state==="pending"&&isPlayerInLineup(match,uid)){
    browserNotice("⚔️ Nuevo desafío 2VS2 #"+match.id+". Entrá a Partidas para aceptar.",match.id+"-invite");
   }else if(previous&&previous!==match.state){
    if(match.state==="playing")browserNotice("🎮 ¡PVP #"+match.id+" confirmado por los cuatro! Ya pueden jugar.",match.id+"-start");
    if(match.state==="review")browserNotice("⚠️ PVP #"+match.id+" en revisión. JS decidirá.",match.id+"-review");
    if(match.state==="complete")browserNotice("🏆 PVP #"+match.id+" finalizado. Revisá el ranking.",match.id+"-done");
   }
  }
 }
 previousMatchStates.clear();
 for(const m of matches)previousMatchStates.set(m.id,m.state);
 notificationPrimed=true;
}
const isPlayerInLineup=(b,uid)=>[...(b.lineup_a||[]),...(b.lineup_b||[])].includes(uid);
/**
 * Optional on-page notification that a match's private room is ready.
 * Queries use the same authenticated 4-participant-only RPC as the buttons;
 * never reveal passwords through general league state or notifications.
 */
async function refreshPrivateRooms(){
 if(roomSyncing||!live?.season||!me)return;
 const target=games().filter(g=>g.started_at&&Number(g.confirmed)===4&&
  ["playing","review"].includes(g.state)&&
  (isPlayerInLineup(g,me)||live.admin)).slice(0,2);
 if(!target.length)return;
 roomSyncing=true;
 try{
  let update=false;
  for(const match of target){
   const before=privateRooms.get(match.id);
   const {data,error}=await sb.rpc("js_liga_sala",{p_action:"get",p_match_id:match.id});
   if(error||!data?.ok)continue;
   privateRooms.set(match.id,data);
   if(before&&!before.found&&data.found){
    browserNotice("🔐 La sala del PvP #"+match.id+" ya está lista. Entrá a Partidas para copiar el ID y contraseña.",match.id+"-room");
   }
   if(before?.found!==data.found||before?.changed_at!==data.changed_at)update=true;
  }
  if(update&&!busy&&live)render();
 }finally{roomSyncing=false;}
}


function matchCard(b){
 const a=teams().find(t=>t.id===b.a),z=teams().find(t=>t.id===b.b);
 const mine=teamOf(me);
 const participant=isRealParticipant(b);
 const accepted=b.my_vote?.accepted===true;
 const pending=b.state==="pending"&&participant&&!accepted;
 const canReport=b.state==="playing"&&participant&&accepted&&!b.my_vote?.result;
 const validWinner=b.winner===b.a?"🔵 "+teamName(a):b.winner===b.b?"🔴 "+teamName(z):"";
 let actions="";
 if(pending)actions='<div class="row">'+btn("✅ Aceptar","accept_match",'data-match="'+b.id+'"',"good")+
 btn("❌ Rechazar","reject_match",'data-match="'+b.id+'"',"danger")+'</div>';
 if(canReport)actions='<div class="row">'+btn("🏆 Gané","result_win",'data-match="'+b.id+'"',"good")+
 btn("📋 Perdí","result_loss",'data-match="'+b.id+'"',"danger")+'</div>';
 if(b.state==="playing"&&participant&&b.my_vote?.result)actions='<p class="muted">✅ Ya informaste: '+(b.my_vote.result==="win"?"Gané":"Perdí")+'. Esperando al resto.</p>';
 if(live?.admin&&Number(b.confirmed)===4&&b.started_at){
   actions+='<div class="line"></div><p class="muted">👑 Resolución de JS · solo PvP con 4/4 aceptaciones</p><div class="row">'+
    btn("🏆 Ganó azul","admin_resolve",'data-match="'+b.id+'" data-side="a"',"small")+
    btn("🏆 Ganó rojo","admin_resolve",'data-match="'+b.id+'" data-side="b"',"small")+
    (b.state==="cancelled"?"":btn("🚫 Anular","admin_cancel",'data-match="'+b.id+'"',"danger small"))+'</div>';
 }
 return '<article class="match"><div class="flex"><b>⚔️ PVP #'+b.id+'</b><span class="badge">'+esc(status(b))+'</span></div>'+
 '<div class="vs"><span>'+lineupText(b,"a")+'<br><span class="vsmuted">🔵 EQUIPO AZUL</span></span><i>VS</i><span>'+lineupText(b,"b")+'<br><span class="vsmuted">🔴 EQUIPO ROJO</span></span></div>'+
 (b.state==="pending"?acceptanceDetails(b):"")+
 '<div class="flex"><span class="muted">✅ '+b.confirmed+'/4 aceptaron · 📝 '+b.reported+'/4 resultados</span>'+
 '<span class="muted">'+(b.state==="pending"?"Límite: "+date(b.accept_until):b.state==="playing"?"Sin vencimiento · inicio: "+date(b.started_at||b.created):date(b.created))+'</span></div>'+
 (b.state==="complete"?'<div class="line"></div><strong style="color:var(--gold)">🏆 Ganador: '+validWinner+'</strong>':"")+
 (b.state==="review"?'<p class="muted">No se otorgaron puntos. JS debe verificar y decidir.</p>':"")+
 (b.state==="expired"?'<p class="muted">Este PvP ya había comenzado con 4/4 aceptaciones y espera resolución de JS.</p>':"")+
 (actions?'<div class="line"></div>'+actions:"")+
 (b.started_at&&Number(b.confirmed)===4&&
   (isRealParticipant(b)||live?.admin)?
   '<div class="match-extra-toggle">'+
    btn(expandedPvps.has(b.id)?"⌃ Ocultar sala y detalles":"⌄ Sala, chat y detalles",
     "toggle_pvp_tools",'data-match="'+b.id+'"',"small block")+
   '</div>'+
   (expandedPvps.has(b.id)?
     acceptanceDetails(b)+roomCard(b)+extras.matchPanel(b):""):
   "")+
 '</article>';
}
function incomingInvites(){
 const rows=(live?.invites||[]).filter(i=>i.to_user===me);
 if(!rows.length)return"";
 return card("📩 Invitaciones pendientes",rows.map(i=>'<div class="match"><strong>'+
  (i.kind==="partner"?"👥 Te invitan a formar un dúo fijo":"🛡️ Te invitan como suplente")+'</strong>'+
  '<p class="muted">De: '+personal(i.from_user)+' · Vence '+date(i.expires_at)+'</p>'+
  '<div class="row">'+btn("✅ Aceptar","accept_invite",'data-invite="'+id(i.id)+'"',"good")+
  btn("❌ Rechazar","decline_invite",'data-invite="'+id(i.id)+'"',"danger")+'</div></div>').join(""));
}
function homeScreen(){
 if(!live?.season)return card("🎮 JS Family",
  '<p class="muted">La temporada todavía no está abierta.</p>'+
  btn("Mi perfil y dúo","go_team",'',"hot block"));
 const t=teamOf(me),active=myActiveGame();
 const invitations=(live.invites||[]).filter(i=>i.to_user===me);
 const prize=live.season.prize||"A confirmar";
 const status=live.paused?
  '<div class="home-pause"><strong>⏸ Liga pausada</strong><span>JS reanudará las búsquedas. Los PvP iniciados pueden finalizar.</span></div>':"";
 const teamBox=t?
  '<div class="home-duo"><span class="home-icon">🛡️</span><div class="home-duo-name">'+
  '<small>MI DÚO</small><strong>'+teamName(t)+'</strong>'+
  '<span>'+Number(t.wins)+' victorias · '+Number(t.losses)+' derrotas</span></div>'+
  btn("Editar","go_team",'',"small")+'</div>':
  '<div class="home-duo home-no-team"><span class="home-icon">👥</span>'+
  '<div class="home-duo-name"><strong>Sin dúo todavía</strong><span>Verificá tu ID y elegí compañero.</span></div>'+
  btn("Crear","go_team",'',"small")+'</div>';
 const play=active?
  btn("📋 VER PVP #"+active.id,"go_matches",'',"hot block"):
  !t?btn("👥 CREAR MI DÚO","go_team",'',"hot block"):
  live.paused?
   (live.admin?btn("▶ REANUDAR LIGA","go_admin",'',"good block"):
    '<div class="home-disabled">⏸ Búsquedas temporalmente pausadas</div>'):
   btn("⚔️ JUGAR AHORA","go_play",'',"hot block");
 return '<section class="panel dashboard-home">'+
  '<div class="home-top"><div><span class="home-eyebrow">JS FAMILY · TEMPORADA #'+Number(live.season.id)+'</span>'+
  '<h2>Arena 2VS2</h2></div><span class="home-season '+(live.paused?"paused":"")+'">'+
  (live.paused?"⏸ Pausada":"● Activa")+'</span></div>'+
  status+
  '<div class="home-reward"><span>🎁 Premio</span><strong>'+esc(prize)+'</strong></div>'+
  extras.myRankCompact()+
  teamBox+
  '<div class="home-main-action">'+play+'</div>'+
  (invitations.length?'<div class="home-invites">📨 Tenés '+invitations.length+
   ' invitación(es) de dúo pendiente(s). '+btn("Ver","go_team",'',"small")+'</div>':"")+
  '<details class="home-help"><summary>⚙️ Avisos y ayuda</summary>'+
  '<p class="muted">El compañero confirma desde su cuenta. Solo se juegan partidas con 4/4 aceptaciones; los desafíos sin aceptar vencen a los dos minutos.</p>'+
  btn("🔔 Activar notificaciones","enable_notices",'',"small")+
  '<p class="muted">Los avisos fuera del navegador todavía necesitan notificaciones push.</p>'+
  '</details>'+
  '</section>';
}
function myTeamScreen(){
 if(live?.paused)return card("⏸ Inscripciones pausadas",
  '<p class="muted">JS pausó temporalmente la Liga. No se pueden registrar nuevos dúos ni cambiar suplentes hasta reanudar. Tus equipos, victorias y partidas anteriores siguen guardados.</p>'+
  (teamOf(me)?roster(teamOf(me)):""));
 if(!live?.season){
   return card("🕹️ Próximamente","<p>La nueva temporada 2VS2 todavía no fue abierta por JS. Tus torneos anteriores siguen funcionando normalmente.</p>"+pageHint);
 }
 const self=playerOf(me);
 let out=incomingInvites();
 if(!self||!["SAC","NA","US"].includes(self.region)){
   const known=self&&self.region==="PENDIENTE"
    ?'<div class="error">Tu apodo '+personal(me)+' ya está guardado, pero el verificador anterior no pudo determinar la región. Volvé a ingresar tu ID para comprobarlo con JS Guardian.</div>'
    :'';
   return out+card("🆔 Registrá tu ID de Free Fire",
     '<p class="muted">Ya no necesitás salir de la liga para registrarte. Ingresá TU ID, tocá Verificar y el bot del Samsung buscará el nombre y la región real. Quedará guardado en tu cuenta JS Torneos.</p>'+
     known+
     '<label for="league-my-game-id">Tu ID de Free Fire</label>'+
     '<input id="league-my-game-id" type="text" inputmode="numeric" pattern="[0-9]{5,16}" maxlength="16" autocomplete="off" placeholder="Ej. 123456789" aria-label="Tu ID de Free Fire">'+
     '<div style="margin-top:12px">'+btn("🔎 Verificar ID y nombre","verify_own_id",'',"hot block")+'</div>'+
     '<p class="muted">Se aceptan IDs de 5 a 16 números. El nombre se consulta en Free Fire; verificar el ID no prueba que seas propietario de la cuenta. Para registrarte necesitás haber iniciado sesión con Google o correo confirmado.</p>');
 }
 const t=teamOf(me);
 if(!t){
   out+=card("👥 Formá tu dúo fijo",
    '<p class="muted">Ingresá el ID de Free Fire de tu compañero. Si ya verificó ese ID en JS Torneos, recibirá la invitación para aceptarla desde su cuenta. Vence en 10 minutos y la pareja queda fija durante la temporada.</p>'+
    playerIdField("choose-partner","ID de Free Fire de tu compañero")+
    '<div style="margin-top:12px">'+btn("Enviar invitación de dúo","invite_partner",'',"hot block")+'</div>');
 }else{
   const isStarter=[t.captain,t.partner].includes(me);
   out+=card("🛡️ Mi equipo",roster(t)+
     '<div class="grid" style="margin-top:16px"><div class="metric"><b>'+t.wins+'</b><small>VICTORIAS</small></div>'+
     '<div class="metric"><b>'+t.losses+'</b><small>DERROTAS</small></div></div>'+
     (t.replaced?'<p class="muted">🔄 Alineación activa: '+line(t).map(personal).join(' + ')+'</p>':"")+
     '<p class="muted">Un dúo fijo durante toda la temporada. Los puntos pertenecen al equipo, incluso si juega el suplente.</p>');
   if(isStarter){
     const active=games().some(g=>running(g)&&[g.a,g.b].includes(t.id));
     let subOptions="";
     if(!t.substitute){
       subOptions=playerIdField("choose-sub","ID de Free Fire del suplente")+
         '<div style="margin-top:12px">'+btn("🛡️ Invitar suplente","invite_sub",'',"hot block")+'</div>';
     }else{
       subOptions='<div class="match"><p class="muted">🛡️ Suplente fijo: '+personal(t.substitute)+'</p>'+
        '<label for="replace-starter">¿A quién reemplazará en los próximos PvP?</label>'+
        '<select id="replace-starter"><option value="'+id(t.captain)+'">'+personal(t.captain)+'</option>'+
        '<option value="'+id(t.partner)+'">'+personal(t.partner)+'</option></select>'+
        '<div class="row" style="margin-top:12px">'+btn("🔄 Activar suplente","activate_sub",'',"good")+
        btn("↩️ Volver a titulares","deactivate_sub",'',"")+'</div></div>';
     }
     out+=card("🔄 Gestionar suplente",subOptions+
      (active?'<p class="muted">⚠️ Hay una partida pendiente. No se puede modificar la alineación hasta finalizarla.</p>':''));
   }else if(t.substitute===me){
     out+=card("🛡️ Soy suplente",'<p class="muted">Estás vinculado al dúo '+teamName(t)+'. '+(t.replaced?"Fuiste activado y podrás confirmar sus próximos partidos.":"Estás en reserva. Los titulares deben activarte antes de empezar un PvP.")+'</p>');
   }
 }
 return out+card("📋 Mis partidas",
  games().filter(g=>t&&[g.a,g.b].includes(t.id)&&running(g)).slice(0,8).map(matchCard).join("")||
  '<div class="empty">No hay enfrentamientos pendientes para tu equipo.</div>');
}
function searchScreen(){
 if(!live?.season)return "";
 if(live.paused)return card("⏸ Búsquedas pausadas",
  '<p class="muted">JS pausó la Liga 2VS2. No se pueden buscar rivales hasta que la reanude. Las partidas ya iniciadas siguen disponibles en Partidas.</p>'+
  btn("📋 Ver mis partidas","go_matches",'',"small"));
 const mine=teamOf(me);
 if(!mine)return card("🎲 Búsqueda aleatoria",
   '<p class="muted">Primero formá tu dúo desde «Mi dúo». Después los dos podrán confirmar la búsqueda.</p>'+
   btn("🛡️ Ir a mi dúo","go_team",'',"hot"));
 const active=myActiveGame();
 if(active)return card("🎮 ¡Tu dúo tiene un PvP!",'<p class="muted">Ya hay una partida en curso o pendiente para tu equipo. No se puede buscar otra hasta terminarla.</p>'+
  '<strong>⚔️ PVP #'+active.id+' · '+esc(status(active))+'</strong>'+
  '<div style="margin-top:14px">'+btn("📋 Ver mi partida","go_matches",'',"hot block")+'</div>');
 const eligible=line(mine).includes(me);
 if(!eligible)return card("🎲 Búsqueda aleatoria",
   '<p class="muted">En este momento te reemplaza un suplente. Solo los dos integrantes de la alineación activa pueden buscar rivales.</p>');
 const state=search();
 const ownReady=state.my_ready===true;
 const partnerReady=state.partner_ready===true;
 const waiting=Number.isInteger(state.waiting_teams)?Math.max(0,state.waiting_teams):0;
 const count=(ownReady?1:0)+(partnerReady?1:0);
 const label=ownReady&&partnerReady?
  '🔄 Los dos confirmaron. Buscando otro dúo listo…':
  ownReady?'✅ Confirmaste. Esperando a tu compañero…':
  partnerReady?'🟢 Tu compañero ya confirmó. Falta tu aceptación.':
   '⚪ Tu dúo todavía no está buscando.';
 const commands=ownReady?
   btn("✕ Cancelar búsqueda","search_leave",'',"danger block"):
   btn("🎲 Confirmar y buscar rival","search_join",'',"hot block");
 return card("🎲 Buscar rival aleatorio",
  '<p class="muted">Los dos jugadores activos del dúo tienen que confirmar por separado. Cuando otro dúo de la misma región haga lo mismo, el sistema los empareja automáticamente y crea el PvP.</p>'+
  '<div class="grid"><div class="metric"><b>'+count+'/2</b><small>TU DÚO CONFIRMADO</small></div>'+
  '<div class="metric"><b>'+waiting+'</b><small>DÚOS BUSCANDO</small></div></div>'+
  '<div class="match"><strong>'+label+'</strong><p class="muted">'+
  (ownReady&&partnerReady?'Mantené esta página abierta. La búsqueda se actualiza automáticamente.':
   'Cada jugador confirma desde su propia cuenta JS Torneos.')+'</p></div>'+
  commands+
  '<p class="muted">⏳ La confirmación vence si un jugador deja de estar activo durante unos 90 segundos. Si cualquiera cancela, sale el dúo completo. Nunca emparejamos contra una región diferente.</p>');
}
function rivalsScreen(){
 if(live?.paused)return searchScreen();
 if(!live?.season)return card("⚔️ Desafíos",'<p>JS todavía no abrió una nueva temporada.</p>');
 const mine=teamOf(me);
 if(!mine)return searchScreen();
 const eligible=(line(mine)||[]).includes(me);
 return searchScreen()+
  '<details class="rival-manual"><summary>🎯 Desafiar a un dúo específico</summary>'+
  card("⚔️ Desafío manual",
   '<p class="muted">Elegí un dúo de tu misma región.</p>'+
   (teams().filter(t=>t.id!==mine.id).length?
     teams().filter(t=>t.id!==mine.id).map(t=>'<div class="match"><div class="flex">'+
      '<div>'+roster(t)+'</div>'+btn("⚔️ Desafiar","challenge",'data-team="'+id(t.id)+'"'+(!eligible?' disabled':''),"hot small")+
      '</div></div>').join(""):'<div class="empty">Todavía no hay otros dúos inscritos.</div>')+
   (!eligible?'<p class="muted">⚠️ El suplente está activo. Solo los titulares de la alineación actual pueden desafiar.</p>':""))+
  '</details>';
}
function matchesScreen(){
 if(!live?.season)return card("📋 Partidas","La temporada todavía no fue abierta.");
 const mine=teamOf(me);
 const inTeam=g=>[g.a,g.b].includes(mine?.id);
 // An invitation is NOT a PvP. During the 2-minute window, members of
 // the involved duos can accept it here; after that it disappears.
 const invites=games().filter(g=>g.state==="pending"&&inTeam(g)&&
   new Date(g.accept_until).getTime()>Date.now());
 const matches=games().filter(g=>Number(g.confirmed)===4&&g.started_at&&
   (inTeam(g)||live.admin));
 const playing=matches.filter(g=>["playing","review"].includes(g.state));
 const history=matches.filter(g=>!["playing","review"].includes(g.state));
 return (invites.length?card("⏳ Invitaciones pendientes (máximo 2 minutos)",
   '<p class="muted">Los cuatro deben aceptar en dos minutos.</p>'+
   invites.map(matchCard).join("")):"")+
  card("🎮 Partidas en curso",
   '<p class="muted">Confirmá el resultado cuando terminen.</p>'+
   (playing.length?playing.map(matchCard).join(""):'<div class="empty">No tenés PvP pendientes de resultado.</div>'))+
  (history.length?'<details class="history-match-list"><summary>📚 Partidas finalizadas ('+history.length+')</summary>'+
    history.map(matchCard).join("")+'</details>':"");
}
function rankingScreen(){
 const list=teams();
 return extras.rankPanel()+
  '<details class="rank-duos-details"><summary>🛡️ Ver ranking de dúos</summary>'+
  card("🏆 Ranking 2VS2",
   '<p class="muted">La clasificación del equipo se conserva aunque cambie el suplente.</p>'+
   (list.length?list.map((t,i)=>'<div class="match"><div class="flex"><strong style="color:var(--gold)">#'+(i+1)+'</strong><div style="flex:1">'+roster(t)+'</div>'+
    '<div style="text-align:right"><div class="statnum">'+t.wins+'V</div><small class="muted">'+t.losses+'D</small></div></div></div>').join(""):
    '<div class="empty">Aún no hay equipos en esta temporada.</div>'))+
  '</details>';
}
function historyScreen(){
 const items=live?.history||[];
 return card("📚 Temporadas anteriores",
   (items.length?items.map(h=>'<div class="match"><div class="flex"><strong>Temporada #'+h.id+'</strong><span class="muted">'+date(h.finished_at)+'</span></div>'+
    '<p class="muted">🏆 Campeón: '+(h.champion?"Equipo campeón registrado":"Sin campeón confirmado")+'</p>'+
    '<p class="muted">🎁 '+esc(h.prize)+'</p></div>').join(""):'<div class="empty">El historial empezará al finalizar la primera temporada.</div>'));
}
function adminScreen(){
 if(!live?.admin)return errorHtml("Solo el administrador puede gestionar esta pantalla.");
 if(!live.season){
   return card("👑 Panel JS · Liga 2VS2",
    '<p class="muted">Abrí la temporada desde acá. Se crearán equipos nuevos, separados de los torneos y de la liga de WhatsApp.</p>'+
    btn("🏁 Abrir Liga 2VS2","start",'',"hot block"));
 }
 return card("👑 Panel JS · Temporada #"+live.season.id,
  (live.paused?
    '<div class="league-paused"><strong>⏸ Liga pausada</strong><p>Las nuevas inscripciones, invitaciones y búsquedas están detenidas. Los PvP iniciados pueden finalizar.</p></div>'+
    btn("▶️ REANUDAR LIGA","admin_resume",'',"good block"):
    '<div class="league-active"><strong>✅ Liga abierta y activa</strong><p>Los dúos pueden anotarse, desafiar y buscar rivales.</p></div>'+
    btn("⏸ PAUSAR LIGA","admin_pause",'',"danger block"))+
  '<div class="line"></div><label for="prize-input">Premio de la temporada</label><input id="prize-input" maxlength="100" value="'+esc(live.season.prize)+'">'+
  '<div style="margin-top:12px">'+btn("Guardar premio","prize",'',"good")+'</div>'+
  '<div class="line"></div><p class="muted">Para finalizar la temporada, primero resolvé o anulá todos los PvP pendientes. No se borran los resultados históricos.</p>'+
  btn("🏁 Finalizar y archivar","end",'',"danger")+
  '<div class="line"></div><h3>Suplentes de los equipos</h3>'+
  (teams().filter(t=>t.substitute).map(t=>'<div class="flex match"><span>'+teamName(t)+'<br><small class="muted">Suplente: '+personal(t.substitute)+'</small></span>'+
  btn("Retirar suplente","remove_sub",'data-team="'+id(t.id)+'"',"danger small")+'</div>').join("")||
   '<p class="muted">Todavía no hay suplentes registrados.</p>'));
}
function adminExtras(){
 if(!live?.admin||!live?.season)return "";
 const played=games().filter(g=>Number(g.confirmed)===4&&g.started_at);
 const matches=card("⚖️ Resolver / corregir partidas aceptadas (4/4)",
  '<p class="muted">Solo los PvP que empezaron con cuatro aceptaciones pueden recibir victorias o derrotas. Podés corregir resultados finalizados y en revisión sin duplicar puntos.</p>'+
  '<label for="admin-pvp-filter">🔎 Buscar PvP por número o jugador</label>'+
  '<input id="admin-pvp-filter" type="search" autocomplete="off" placeholder="Ej. 44, nombre, dúo…">'+
  '<label for="admin-pvp-state">Filtrar por estado</label>'+
  '<select id="admin-pvp-state">'+
   '<option value="all">Todos</option>'+
   '<option value="playing">En juego</option>'+
   '<option value="review">En revisión</option>'+
   '<option value="complete">Finalizados</option>'+
   '<option value="cancelled">Anulados</option></select>'+
  '<p id="admin-pvp-found" class="muted"></p>'+
  (played.length?'<div id="admin-match-list">'+played.map(g=>
   matchCard(g).replace('<article class="match"',
   '<article class="match" data-match-id="'+Number(g.id)+
   '" data-match-state="'+esc(g.state)+'"')).join("")+'</div>':
   '<div class="empty">Todavía no hay PvP completos para resolver.</div>'));
 const correction=card("🧮 Dar o quitar victorias y derrotas",
  '<p class="muted">Ajustes manuales del <b>dúo completo</b>. Para corregir una partida elegí primero el ganador arriba. Estas correcciones se guardan en el historial administrativo.</p>'+
  (teams().length?teams().map(t=>
   '<div class="match"><strong>'+teamName(t)+'</strong>'+
   '<p class="muted">🏆 '+t.wins+' victorias · 📉 '+t.losses+' derrotas</p>'+
   '<div class="row">'+
   btn("🏆 +1 victoria","admin_adjust",'data-team="'+id(t.id)+'" data-stat="wins" data-delta="1"',"good small")+
   btn("−1 victoria","admin_adjust",'data-team="'+id(t.id)+'" data-stat="wins" data-delta="-1"',"danger small")+
   btn("📉 +1 derrota","admin_adjust",'data-team="'+id(t.id)+'" data-stat="losses" data-delta="1"',"small")+
   btn("−1 derrota","admin_adjust",'data-team="'+id(t.id)+'" data-stat="losses" data-delta="-1"',"danger small")+
   '</div></div>').join(""):'<p class="muted">Todavía no hay dúos.</p>'));
 const logs=Array.isArray(live.audit)?live.audit:[];
 const history=card("🧾 Últimas correcciones realizadas por JS",
  (logs.length?logs.map(x=>{
   const t=teams().find(t=>t.id===x.team_id);
   const d=x.details||{};
   const label=x.action==="adjust"?
    (d.stat==="wins"?"Victorias ":"Derrotas ")+(d.delta===1?"+1":"−1")+" · "+(t?teamName(t):"Dúo"):
    x.action==="resolve"?"Ganador corregido · PVP #"+x.match_id:"Partida anulada · PVP #"+x.match_id;
   return '<div class="match"><strong>'+label+'</strong><p class="muted">'+date(x.created_at)+'</p></div>';
  }).join(""):'<div class="empty">No hay correcciones administrativas.</div>'));
 return extras.adminPanel()+
  '<div class="admin-fold">'+
   btn((expandedAdminPanels.has("matches")?"⌃ Ocultar":"⌄ Ver")+" partidas y buscar PvP",
    "toggle_admin_panel",'data-panel="matches"',"small block")+
   (expandedAdminPanels.has("matches")?matches:"")+
  '</div>'+
  '<div class="admin-fold">'+
   btn((expandedAdminPanels.has("points")?"⌃ Ocultar":"⌄ Abrir")+" corrección de puntos",
    "toggle_admin_panel",'data-panel="points"',"small block")+
   (expandedAdminPanels.has("points")?correction:"")+
  '</div>'+
  '<div class="admin-fold">'+
   btn((expandedAdminPanels.has("history")?"⌃ Ocultar":"⌄ Ver")+" historial administrativo",
    "toggle_admin_panel",'data-panel="history"',"small block")+
   (expandedAdminPanels.has("history")?history:"")+
  '</div>';
}
function render(){
 if(!live)return;
 statusBanner();
 const meName=nameOf(me);
 $("league-auth").innerHTML='<div class="flex"><div><strong>✅ '+esc(meName)+'</strong><br><span class="muted">Cuenta conectada · '+(live.admin?"👑 Administrador":"Jugador")+'</span></div>'+btn("↻ Actualizar","refresh",'',"small")+'</div>';
 $("league-app").hidden=false;
 if(!live.admin&&view==="admin")view="inicio";
 for(const tab of document.querySelectorAll("#league-tabs [data-tab], #league-more [data-tab]"))
  tab.classList.toggle("on",tab.dataset.tab===view);
 const isMore=["ranking","mi-equipo","historial","admin"].includes(view);
 const moreButton=$("league-more-toggle");
 if(moreButton){
  moreButton.classList.toggle("on",isMore||moreOpen);
  moreButton.setAttribute("aria-expanded",String(moreOpen));
 }
 $("league-more").hidden=!moreOpen;
 const fn=({inicio:homeScreen,"mi-equipo":myTeamScreen,rivales:rivalsScreen,partidas:matchesScreen,ranking:rankingScreen,historial:historyScreen,admin:adminScreen})[view]||homeScreen;
 $("league-content").innerHTML=fn()+(live.admin&&view==="admin"?adminExtras():"");
 refreshAcceptCountdowns();
 extras.afterRender();
}
async function load(silent=false){
 if(busy)return;
 try{
  const {data:{session},error}=await sb.auth.getSession();
  if(error)throw error;
  if(!session?.access_token){
   live=null;me=null;unsubscribeLeagueRealtime();extras.reset();
   expandedPvps.clear();expandedAdminPanels.clear();moreOpen=false;
   privateRooms.clear();shownPasswords.clear();editingRooms.clear();
   previousMatchStates.clear();notificationPrimed=false;$("league-app").hidden=true;
   showPresence(null);
   $("league-auth").innerHTML='<h2>🔐 Entrá con tu cuenta</h2><p class="muted">Usá la misma cuenta Google o correo que utilizás en JS Torneos. No necesitás una cuenta nueva.</p>'+
    '<a class="btn hot" href="./index.html">👤 Iniciar sesión en JS Torneos</a>';return;
  }
  const [stateResult,searchResult]=await Promise.all([
   sb.rpc("js_liga_estado"),
   sb.rpc("js_liga_busqueda",{p_action:"status"})
  ]);
  const {data,error:rpcError}=stateResult;
  if(rpcError)throw rpcError;
  if(!data?.ok)throw Error("El servidor no devolvió el estado de la liga");
  const previousSearch=live?.search?.my_ready===true;
  const previousGameId=myActiveGame()?.id;
  data.search=searchResult.error?null:searchResult.data;
  if(data.admin){
   const {data:audit,error:auditError}=await sb.rpc("js_liga_admin_historial");
   data.audit=!auditError&&Array.isArray(audit)?audit:[];
  }
  if(me!==null&&me!==data.user){
   unsubscribeLeagueRealtime();extras.reset();
   expandedPvps.clear();expandedAdminPanels.clear();moreOpen=false;
   privateRooms.clear();shownPasswords.clear();editingRooms.clear();
   previousMatchStates.clear();notificationPrimed=false;
  }
  live=data;me=data.user;
  checkLeagueNotices(data);
  if(previousSearch&&!data.search?.my_ready){
   const newActive=myActiveGame();
   if(newActive?.state==="playing"&&newActive.id!==previousGameId){
    view="partidas";
    flash("🎮 ¡Encontramos rival! El PvP #"+newActive.id+" está listo para jugar.");
   }
  }
  render();
  subscribeLeagueRealtime();
  void extras.refresh();
  void refreshPresence();
  void refreshPrivateRooms();
 }catch(e){
  const message=e?.message||"No pudimos consultar la liga";
  if(!silent)$("league-auth").innerHTML=errorHtml(message)+'<button class="btn" id="retry-league">Reintentar</button>';
  if(silent&&message!==seenError)flash(message,true);
  seenError=message;
 }
}
async function verifyOwnId(){
 if(busy)return;
 const myId=$("league-my-game-id")?.value.trim()||"";
 if(!/^[0-9]{5,16}$/.test(myId)){
  flash("Escribí un ID numérico de Free Fire de 5 a 16 cifras.",true);return;
 }
 busy=true;
 const button=document.querySelector('button[data-action="verify_own_id"]');
 if(button){button.disabled=true;button.textContent="🔎 Comprobando apodo y región…";}
 try{
  const {data:{session},error}=await sb.auth.getSession();
  if(error||!session?.access_token)throw Error("Ingresá con Google o correo primero.");
  const response=await fetch(conf.supabaseUrl+"/functions/v1/js-jugadores-cuenta",{
   method:"POST",cache:"no-store",
   headers:{"content-type":"application/json","authorization":"Bearer "+session.access_token,
    "apikey":conf.publishableKey},
   body:JSON.stringify({action:"verify_id",game_id:myId})
  });
  let result;
  try{result=await response.json();}catch{throw Error("El servidor no devolvió una respuesta válida.");}
  if(!response.ok||result?.ok!==true)throw Error(result?.error||"No pudimos verificar ese ID.");
  const nick=result?.profile?.nickname||"Jugador";
  const region=result?.profile?.region||"PENDIENTE";
  if(!["SAC","NA","US"].includes(region)){
   flash("✅ Nombre verificado: "+nick+". ⚠️ Región "+region+
     ": todavía no se permite jugar hasta confirmar un servidor compatible. Probá de nuevo cuando el verificador esté disponible.",true);
  }else{
   flash("✅ ¡ID guardado! "+nick+" · Región "+region+". Ya podés formar tu dúo.");
  }
 }catch(e){flash(e?.message||"Error de verificación",true);}
 finally{busy=false;await load(true);}
}
async function operation(action,payload={}){
 if(busy)return;
 const dangerous=["end","admin_cancel","admin_resolve","admin_adjust","remove_sub","admin_pause","admin_resume"];
 if(dangerous.includes(action)&&!confirm(action==="end"?
   "¿Finalizar y archivar esta temporada? No podrás volver a abrirla.":
   action==="admin_pause"?"¿Pausar la Liga 2VS2? Se detendrán nuevas inscripciones, búsquedas y desafíos, pero no las partidas iniciadas.":
   action==="admin_resume"?"¿Reanudar la Liga 2VS2 para que los jugadores puedan volver a inscribirse y jugar?":
   action==="admin_resolve"?"¿Confirmás el ganador elegido? Se sumará una victoria al dúo ganador y una derrota al rival. Si ya había un ganador, se revertirán los puntos anteriores.":
   action==="admin_cancel"?"¿Anular este PvP? Se quitarán sus puntos anteriores si los tenía.":
   action==="admin_adjust"?"¿Aplicar "+(payload.delta===1?"+1":"−1")+" "+(payload.stat==="wins"?"victoria":"derrota")+" al dúo seleccionado?":
   "¿Confirmás esta acción de administrador?"))return;
 busy=true;
 const disabled=[...document.querySelectorAll("button[data-action]")];
 disabled.forEach(b=>b.disabled=true);
 try{
  const isIdInvite=action==="invite_partner"||action==="invite_sub";
  const isSearch=action==="search_join"||action==="search_leave";
  let result;
  if(isIdInvite)result=await sb.rpc("js_liga_invitar_por_id",{
    p_kind:action==="invite_partner"?"partner":"substitute",p_game_id:payload.game_id
   });
  else if(isSearch)result=await sb.rpc("js_liga_busqueda",{
    p_action:action==="search_join"?"join":"leave"
   });
  else if(["admin_pause","admin_resume"].includes(action))
   result=await sb.rpc("js_liga_control_admin",{
    p_action:action==="admin_pause"?"pause":"resume"
   });
  else if(["admin_resolve","admin_cancel","admin_adjust"].includes(action))
   result=await sb.rpc("js_liga_admin_arbitrar",{
    p_action:action==="admin_resolve"?"resolve":action==="admin_cancel"?"cancel":"adjust",
    p_match_id:payload.match_id??null,p_side:payload.side??null,
    p_team_id:payload.team_id??null,p_stat:payload.stat??null,
    p_delta:payload.delta??null,p_request_id:crypto.randomUUID(),
    p_reason:"Corrección desde el panel JS"
   });
  else result=await sb.rpc("js_liga_accion",{p_accion:action,p_datos:payload});
  const {data,error}=result;
  if(error)throw error;
  if(!isSearch&&!data?.ok)throw Error(data?.message||"La acción no se pudo realizar");
  if(isSearch&&data?.matched===true){
   view="partidas";
   flash("🎮 ¡Rival encontrado! PvP #"+data.match_id+". Los cuatro confirmaron: creá la sala y jugá.");
  }else flash(data?.message||"Operación realizada");
 }catch(e){flash(e?.message||"Error desconocido",true);}
 finally{busy=false;await load(true);}
}
function switchLeagueTab(next){
 view=next;moreOpen=false;render();
 const top=$("league-tabs").getBoundingClientRect().top+window.scrollY-10;
 window.scrollTo({top:Math.max(0,top),behavior:"smooth"});
}
$("league-tabs").addEventListener("click",e=>{
 const toggle=e.target.closest("button[data-more-toggle]");
 if(toggle){moreOpen=!moreOpen;render();return;}
 const b=e.target.closest("button[data-tab]");
 if(b)switchLeagueTab(b.dataset.tab);
});
$("league-more").addEventListener("click",e=>{
 const b=e.target.closest("button[data-tab]");
 if(b)switchLeagueTab(b.dataset.tab);
});
document.addEventListener("click",async e=>{
 const b=e.target.closest("button[data-action]");
 if(!b)return;
 const action=b.dataset.action;
 if(await extras.runAction(action,b))return;
 if(action==="refresh"){await load();return;}
 if(action==="go_matches"){switchLeagueTab("partidas");return;}
 if(action==="go_team"){switchLeagueTab("mi-equipo");return;}
 if(action==="go_play"){switchLeagueTab("rivales");return;}
 if(action==="go_rank"){switchLeagueTab("ranking");return;}
 if(action==="go_admin"){view="admin";moreOpen=false;render();return;}
 if(action==="toggle_admin_panel"){
   const panel=b.dataset.panel;
   if(["matches","points","history"].includes(panel)){
    if(expandedAdminPanels.has(panel))expandedAdminPanels.delete(panel);
    else expandedAdminPanels.add(panel);
    render();
   }
   return;
 }
 if(action==="toggle_pvp_tools"){
   const number=Number(b.dataset.match);
   if(Number.isSafeInteger(number)){
    if(expandedPvps.has(number))expandedPvps.delete(number);
    else expandedPvps.add(number);
    render();
   }
   return;
 }
 if(action==="enable_notices"){
  if(typeof Notification==="undefined"){
    flash("Tu navegador no permite mostrar notificaciones del sistema. Los avisos dentro de JS Torneos seguirán funcionando.",true);
    return;
  }
  try{
   const permission=await Notification.requestPermission();
   flash(permission==="granted"?"🔔 Avisos del navegador activados mientras tengas la página abierta.":"El navegador no autorizó las notificaciones.",permission!=="granted");
  }catch(e){flash("No fue posible habilitar notificaciones en este navegador.",true);}
  return;
 }
 if(action.startsWith("room_")){
  const game=Number(b.dataset.match);
  if(!Number.isSafeInteger(game))return;
  if(action==="room_toggle"){
   if(shownPasswords.has(game))shownPasswords.delete(game);else shownPasswords.add(game);
   render();return;
  }
  if(action==="room_edit"){editingRooms.add(game);render();return;}
  if(action==="room_edit_cancel"){editingRooms.delete(game);render();return;}
  if(action==="room_copy_id"||action==="room_copy_pass"){
   const room=privateRooms.get(game);
   const value=action==="room_copy_id"?room?.room_id:room?.room_password;
   if(!value){flash("Consultá primero la sala privada.",true);return;}
   try{await navigator.clipboard.writeText(value);flash("✅ Copiado al portapapeles.");}
   catch(_){window.prompt("Copiá el dato:",value);}
   return;
  }
  if(action==="room_clear"&&!confirm("¿Quitar los datos de sala de este PvP?"))return;
  if(busy)return;
  busy=true;
  try{
   const args={p_action:action==="room_save"?"save":action==="room_clear"?"clear":"get",p_match_id:game};
   if(action==="room_save"){
    args.p_room_id=$("room-id-"+game)?.value.trim()||"";
    args.p_password=$("room-pass-"+game)?.value||"";
   }
   const {data,error}=await sb.rpc("js_liga_sala",args);
   if(error)throw error;
   if(!data?.ok)throw Error(data?.message||"No se pudo consultar la sala.");
   if(action!=="room_get"){
    editingRooms.delete(game);shownPasswords.delete(game);
    const latest=await sb.rpc("js_liga_sala",{p_action:"get",p_match_id:game});
    if(latest.error)throw latest.error;
    privateRooms.set(game,latest.data);
   }else privateRooms.set(game,data);
   if(action!=="room_get")flash(data.message||"Sala actualizada.");
   render();
  }catch(err){flash(err?.message||"No se pudo consultar la sala",true);}
  finally{busy=false;}
  return;
 }
 if(action==="verify_own_id"){await verifyOwnId();return;}
 const p={};
 const fromSelect=id=>$(id)?.value||"";
 if(action==="invite_partner"||action==="invite_sub"){
  p.game_id=fromSelect(action==="invite_partner"?"choose-partner":"choose-sub").trim();
  if(!/^[0-9]{5,16}$/.test(p.game_id)){
   flash("Escribí un ID de Free Fire válido de 5 a 16 números.",true);return;
  }
 }else if(["accept_invite","decline_invite"].includes(action)){
  p.invite_id=b.dataset.invite;
 }else if(action==="activate_sub"){
  p.user_id=fromSelect("replace-starter");
 }else if(["challenge","remove_sub"].includes(action)){
  p.team_id=b.dataset.team;
 }else if(["accept_match","reject_match","result_win","result_loss","admin_cancel","admin_resolve"].includes(action)){
  p.match_id=Number(b.dataset.match);
  if(action==="result_win"||action==="result_loss")p.result=action==="result_win"?"win":"loss";
  if(action==="admin_resolve")p.side=b.dataset.side;
 }else if(action==="admin_adjust"){
  p.team_id=b.dataset.team;p.stat=b.dataset.stat;p.delta=Number(b.dataset.delta);
 }else if(action==="prize"){
  p.prize=fromSelect("prize-input").trim();
 }
 await operation(action.startsWith("result_")?"result":action,p);
});
document.addEventListener("input",event=>extras.changeFilter(event.target));
document.addEventListener("change",event=>extras.changeFilter(event.target));
load();
sb.auth.onAuthStateChange((event)=>{
 if(event==="SIGNED_IN"||event==="SIGNED_OUT")setTimeout(()=>load(true),50);
});
setInterval(()=>{if(!document.hidden&&!busy&&!(document.activeElement?.matches("input,select")))load(true);},15000);
// A heartbeat requires each participant to remain present. It does NOT
// auto-enroll teammates or silently consent on their behalf.
setInterval(async()=>{
 if(document.hidden||busy||!live?.search?.my_ready||!me)return;
 const {error}=await sb.rpc("js_liga_busqueda",{p_action:"pulse"});
 if(error)void load(true);
},25000);
setInterval(()=>{if(!document.hidden)void refreshPresence();},20000);
// Smooth local countdown; actual acceptance data are refreshed from Supabase.
setInterval(()=>{if(!document.hidden)refreshAcceptCountdowns();},1000);
document.addEventListener("visibilitychange",()=>{
 if(!document.hidden){void load(true);void refreshPresence();}
});