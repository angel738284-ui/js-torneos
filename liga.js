import {createClient} from "https://esm.sh/@supabase/supabase-js@2.45.6";

const conf=window.JS_CONFIG||{};
const sb=createClient(conf.supabaseUrl,conf.publishableKey,{
 auth:{flowType:"pkce",detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}
});
const $=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const date=value=>value?new Intl.DateTimeFormat("es-AR",{timeZone:"America/Argentina/Buenos_Aires",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)):"—";
const id=value=>esc(value??"");
const btn=(text,action,extra="",color="")=>'<button type="button" class="btn '+color+'" data-action="'+esc(action)+'" '+extra+'>'+esc(text)+'</button>';
let live=null,me=null,view="mi-equipo",busy=false,seenError="";
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
 pill.textContent=active?"● TEMPORADA "+live.season.id+" · ABIERTA":"● LIGA AÚN NO ABIERTA";
 pill.classList.toggle("off",!active);
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
 acceptanceDetails(b)+
 '<div class="flex"><span class="muted">✅ '+b.confirmed+'/4 aceptaron · 📝 '+b.reported+'/4 resultados</span>'+
 '<span class="muted">'+(b.state==="pending"?"Límite: "+date(b.accept_until):b.state==="playing"?"Sin vencimiento · inicio: "+date(b.started_at||b.created):date(b.created))+'</span></div>'+
 (b.state==="complete"?'<div class="line"></div><strong style="color:var(--gold)">🏆 Ganador: '+validWinner+'</strong>':"")+
 (b.state==="review"?'<p class="muted">No se otorgaron puntos. JS debe verificar y decidir.</p>':"")+
 (b.state==="expired"?'<p class="muted">Este PvP ya había comenzado con 4/4 aceptaciones y espera resolución de JS.</p>':"")+
 (actions?'<div class="line"></div>'+actions:"")+
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
function myTeamScreen(){
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
 if(!live?.season)return card("⚔️ Desafíos",'<p>JS todavía no abrió una nueva temporada.</p>');
 const mine=teamOf(me);
 if(!mine)return searchScreen();
 const eligible=(line(mine)||[]).includes(me);
 return searchScreen()+card("⚔️ Desafío manual (opcional)",
   '<p class="muted">Desafiá a cualquier equipo disponible de la misma región. El servidor bloquea los encuentros repetidos hasta que ambos dúos enfrenten otros dos equipos distintos.</p>'+
   (teams().filter(t=>t.id!==mine.id).length?
     teams().filter(t=>t.id!==mine.id).map(t=>'<div class="match"><div class="flex">'+
      '<div>'+roster(t)+'</div>'+btn("⚔️ Desafiar","challenge",'data-team="'+id(t.id)+'"'+(!eligible?' disabled':''),"hot small")+
      '</div></div>').join(""):'<div class="empty">Todavía no hay otros dúos inscritos.</div>')+
   (!eligible?'<p class="muted">⚠️ Tu titular está reemplazado por un suplente. Solo los dos jugadores activos pueden desafiar.</p>':""));
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
 return (mine?searchScreen():"")+
  (invites.length?card("⏳ Invitaciones pendientes (máximo 2 minutos)",
   '<p class="muted">Este desafío todavía no es una partida. Todos deben aceptar antes de que venza; de lo contrario, desaparece sin puntos.</p>'+
   invites.map(matchCard).join("")):"")+
  card("📋 Partidas confirmadas (4/4)",
   '<p class="muted">Acá solo se muestran encuentros aceptados por los cuatro jugadores. Las partidas no vencen después de comenzar; deben confirmar el resultado o JS decidirá el ganador.</p>'+
   (matches.length?matches.map(matchCard).join(""):'<div class="empty">Todavía no hay partidas aceptadas por los cuatro.</div>'));
}
function rankingScreen(){
 const list=teams();
 return card("🏆 Ranking 2VS2",
  '<p class="muted">Las parejas conservan sus puntos aunque juegue un suplente. La tabla se actualiza solo con resultados validados.</p>'+
  (list.length?list.map((t,i)=>'<div class="match"><div class="flex"><strong style="color:var(--gold)">#'+(i+1)+'</strong><div style="flex:1">'+roster(t)+'</div>'+
   '<div style="text-align:right"><div class="statnum">'+t.wins+'V</div><small class="muted">'+t.losses+'D</small></div></div></div>').join(""):
   '<div class="empty">Aún no hay equipos en esta temporada.</div>'));
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
  '<label for="prize-input">Premio de la temporada</label><input id="prize-input" maxlength="100" value="'+esc(live.season.prize)+'">'+
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
  (played.length?played.map(matchCard).join(""):'<div class="empty">Todavía no hay PvP completos para resolver.</div>'));
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
 return matches+correction+history;
}
function render(){
 if(!live)return;
 statusBanner();
 const meName=nameOf(me);
 $("league-auth").innerHTML='<div class="flex"><div><strong>✅ '+esc(meName)+'</strong><br><span class="muted">Cuenta conectada · '+(live.admin?"👑 Administrador":"Jugador")+'</span></div>'+btn("↻ Actualizar","refresh",'',"small")+'</div>';
 $("league-app").hidden=false;
 for(const tab of $("league-tabs").querySelectorAll("[data-tab]"))tab.classList.toggle("on",tab.dataset.tab===view);
 if(!live.admin&&view==="admin")view="mi-equipo";
 const fn=({"mi-equipo":myTeamScreen,rivales:rivalsScreen,partidas:matchesScreen,ranking:rankingScreen,historial:historyScreen,admin:adminScreen})[view]||myTeamScreen;
 $("league-content").innerHTML=fn()+(live.admin&&view==="admin"?adminExtras():"");
 refreshAcceptCountdowns();
}
async function load(silent=false){
 if(busy)return;
 try{
  const {data:{session},error}=await sb.auth.getSession();
  if(error)throw error;
  if(!session?.access_token){
   live=null;me=null;$("league-app").hidden=true;
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
  live=data;me=data.user;
  if(previousSearch&&!data.search?.my_ready){
   const newActive=myActiveGame();
   if(newActive?.state==="playing"&&newActive.id!==previousGameId){
    view="partidas";
    flash("🎮 ¡Encontramos rival! El PvP #"+newActive.id+" está listo para jugar.");
   }
  }
  render();
  void refreshPresence();
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
 const dangerous=["end","admin_cancel","admin_resolve","admin_adjust","remove_sub"];
 if(dangerous.includes(action)&&!confirm(action==="end"?
   "¿Finalizar y archivar esta temporada? No podrás volver a abrirla.":
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
$("league-tabs").addEventListener("click",e=>{
 const b=e.target.closest("button[data-tab]");if(!b)return;
 view=b.dataset.tab;render();window.scrollTo({top:280,behavior:"smooth"});
});
document.addEventListener("click",async e=>{
 const b=e.target.closest("button[data-action]");
 if(!b)return;
 const action=b.dataset.action;
 if(action==="refresh"){await load();return;}
 if(action==="go_matches"){view="partidas";render();return;}
 if(action==="go_team"){view="mi-equipo";render();return;}
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