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
const teams=()=>live?.teams||[];
const games=()=>live?.matches||[];
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
const status=b=>({pending:"⏳ Esperando aceptación",playing:"🎮 En juego",review:"⚠️ Revisión de JS",complete:"✅ Finalizado",cancelled:"🚫 Anulado",expired:"⌛ Vencido"}[b.state]||b.state);
const theme=b=>b.state==="complete"?"good":b.state==="review"?"danger":"";
const isRealParticipant=b=>[...(b.lineup_a||[]),...(b.lineup_b||[])].includes(me);
const errorHtml=msg=>'<div class="error">'+esc(msg)+'</div>';
const card=(title,content)=>'<section class="panel"><h2>'+title+'</h2>'+content+'</section>';
const selectPlayers=(selector,label)=>{
 const candidates=players().filter(p=>p.id!==me&&["SAC","NA","US"].includes(p.region)&&p.region===playerOf(me)?.region&&
  !teams().some(t=>[t.captain,t.partner,t.substitute].includes(p.id)));
 return '<label for="'+selector+'">'+esc(label)+'</label><select id="'+selector+'">'+
  '<option value="">Elegí una persona verificada</option>'+
  candidates.map(p=>'<option value="'+id(p.id)+'">'+personal(p.id)+' · '+esc(p.region)+'</option>').join("")+'</select>';
};
const pageHint='<p class="muted">Las partidas de esta liga no modifican el historial de torneos existente ni el ranking anterior de JS Guardian.</p>';

function flash(message,fail=false){
 const node=$("league-toast");node.textContent=String(message);node.classList.toggle("fail",fail);node.hidden=false;
 clearTimeout(flash.timeout);flash.timeout=setTimeout(()=>node.hidden=true,7000);
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
 if(live?.admin&&["pending","playing","review"].includes(b.state)){
   actions+='<div class="line"></div><p class="muted">👑 Resolución de JS</p><div class="row">'+
    btn("Ganó azul","admin_resolve",'data-match="'+b.id+'" data-side="a"',"small")+
    btn("Ganó rojo","admin_resolve",'data-match="'+b.id+'" data-side="b"',"small")+
    btn("Anular","admin_cancel",'data-match="'+b.id+'"',"danger small")+'</div>';
 }
 return '<article class="match"><div class="flex"><b>⚔️ PVP #'+b.id+'</b><span class="badge">'+esc(status(b))+'</span></div>'+
 '<div class="vs"><span>'+lineupText(b,"a")+'<br><span class="vsmuted">🔵 EQUIPO AZUL</span></span><i>VS</i><span>'+lineupText(b,"b")+'<br><span class="vsmuted">🔴 EQUIPO ROJO</span></span></div>'+
 '<div class="flex"><span class="muted">✅ '+b.confirmed+'/4 aceptaron · 📝 '+b.reported+'/4 resultados</span>'+
 '<span class="muted">'+(b.state==="pending"?"Límite: "+date(b.accept_until):b.state==="playing"?"Hasta: "+date(b.result_until):date(b.created))+'</span></div>'+
 (b.state==="complete"?'<div class="line"></div><strong style="color:var(--gold)">🏆 Ganador: '+validWinner+'</strong>':"")+
 (b.state==="review"?'<p class="muted">No se otorgaron puntos. JS debe verificar y decidir.</p>':"")+
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
   return out+card("🔒 Verificá tu ID de Free Fire",
     '<p class="muted">Tenés que registrar y verificar tu ID con región SAC o NA en el perfil de JS Torneos antes de participar.</p>'+
     '<a class="btn hot" href="./index.html">👤 Ir a mi perfil</a>');
 }
 const t=teamOf(me);
 if(!t){
   out+=card("👥 Formá tu dúo fijo",
    '<p class="muted">Elegí una sola persona verificada. La invitación vence en 10 minutos y tu compañero debe aceptarla. La pareja no se puede cambiar libremente durante la temporada.</p>'+
    selectPlayers("choose-partner","Elegí tu compañero")+
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
       subOptions=selectPlayers("choose-sub","Suplente opcional")+
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
function rivalsScreen(){
 if(!live?.season)return card("⚔️ Desafíos",'<p>JS todavía no abrió una nueva temporada.</p>');
 const mine=teamOf(me);
 if(!mine)return card("⚔️ Desafíos",'<p>Primero tenés que formar tu dúo desde «Mi dúo».</p>');
 const eligible=(line(mine)||[]).includes(me);
 return card("⚔️ Encontrá un rival",
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
 const list=games().filter(g=>[g.a,g.b].includes(mine?.id)||live.admin);
 return card("📋 Partidas y confirmaciones",
  '<p class="muted">Los cuatro jugadores aceptan el reto y después informan si ganaron o perdieron. Si no coinciden, JS decide. Las partidas sin confirmar no dan puntos.</p>'+
  (list.length?list.map(matchCard).join(""):'<div class="empty">Todavía no tenés partidas registradas.</div>'));
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
function render(){
 if(!live)return;
 statusBanner();
 const meName=nameOf(me);
 $("league-auth").innerHTML='<div class="flex"><div><strong>✅ '+esc(meName)+'</strong><br><span class="muted">Cuenta conectada · '+(live.admin?"👑 Administrador":"Jugador")+'</span></div>'+btn("↻ Actualizar","refresh",'',"small")+'</div>';
 $("league-app").hidden=false;
 for(const tab of $("league-tabs").querySelectorAll("[data-tab]"))tab.classList.toggle("on",tab.dataset.tab===view);
 if(!live.admin&&view==="admin")view="mi-equipo";
 const fn=({"mi-equipo":myTeamScreen,rivales:rivalsScreen,partidas:matchesScreen,ranking:rankingScreen,historial:historyScreen,admin:adminScreen})[view]||myTeamScreen;
 $("league-content").innerHTML=fn();
}
async function load(silent=false){
 if(busy)return;
 try{
  const {data:{session},error}=await sb.auth.getSession();
  if(error)throw error;
  if(!session?.access_token){
   live=null;me=null;$("league-app").hidden=true;
   $("league-auth").innerHTML='<h2>🔐 Entrá con tu cuenta</h2><p class="muted">Usá la misma cuenta Google o correo que utilizás en JS Torneos. No necesitás una cuenta nueva.</p>'+
    '<a class="btn hot" href="./index.html">👤 Iniciar sesión en JS Torneos</a>';return;
  }
  const {data,error:rpcError}=await sb.rpc("js_liga_estado");
  if(rpcError)throw rpcError;
  if(!data?.ok)throw Error("El servidor no devolvió el estado de la liga");
  live=data;me=data.user;
  render();
 }catch(e){
  const message=e?.message||"No pudimos consultar la liga";
  if(!silent)$("league-auth").innerHTML=errorHtml(message)+'<button class="btn" id="retry-league">Reintentar</button>';
  if(silent&&message!==seenError)flash(message,true);
  seenError=message;
 }
}
async function operation(action,payload={}){
 if(busy)return;
 const dangerous=["end","admin_cancel","admin_resolve","remove_sub"];
 if(dangerous.includes(action)&&!confirm(action==="end"?
   "¿Finalizar y archivar esta temporada? No podrás volver a abrirla.":
   "¿Confirmás esta acción de administrador?"))return;
 busy=true;
 const disabled=[...document.querySelectorAll("button[data-action]")];
 disabled.forEach(b=>b.disabled=true);
 try{
  const {data,error}=await sb.rpc("js_liga_accion",{p_accion:action,p_datos:payload});
  if(error)throw error;
  if(!data?.ok)throw Error(data?.message||"La acción no se pudo realizar");
  flash(data.message||"Operación realizada");
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
 const p={};
 const fromSelect=id=>$(id)?.value||"";
 if(action==="invite_partner"||action==="invite_sub"){
  p.user_id=fromSelect(action==="invite_partner"?"choose-partner":"choose-sub");
  if(!p.user_id){flash("Primero seleccioná una persona",true);return;}
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
 }else if(action==="prize"){
  p.prize=fromSelect("prize-input").trim();
 }
 await operation(action.startsWith("result_")?"result":action,p);
});
load();
sb.auth.onAuthStateChange((event)=>{
 if(event==="SIGNED_IN"||event==="SIGNED_OUT")setTimeout(()=>load(true),50);
});
setInterval(()=>{if(!document.hidden&&!busy&&!(document.activeElement?.matches("input,select")))load(true);},30000);
