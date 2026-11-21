from pathlib import Path
p=Path("liga.js");s=p.read_text()
def one(old,new,label):
 global s
 count=s.count(old)
 if count!=1:raise RuntimeError(label+" expected once, got "+str(count))
 s=s.replace(old,new,1)
one('let live=null,me=null,view="inicio",busy=false,seenError="";',
'''let live=null,me=null,view="inicio",busy=false,seenError="";
let moreOpen=false;
const expandedPvps=new Set();''',"menu state")
start=s.index('function homeScreen(){')
end=s.index('\nfunction myTeamScreen(){',start)
if start<0 or end<0:raise RuntimeError("Missing home function")
home=r'''function homeScreen(){
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
}'''
s=s[:start]+home+s[end:]
# Match card: leave pending confirmations as-is; hide detailed extras by user toggle
one(''' acceptanceDetails(b)+
 '<div class="flex"><span class="muted">✅ '+b.confirmed+'/4 aceptaron · 📝 '+b.reported+'/4 resultados</span>'+''',
''' (b.state==="pending"?acceptanceDetails(b):"")+
 '<div class="flex"><span class="muted">✅ '+b.confirmed+'/4 aceptaron · 📝 '+b.reported+'/4 resultados</span>'+''',"hide redundant accept states in completed games")
one(''' roomCard(b)+extras.matchPanel(b)+
 (actions?'<div class="line"></div>'+actions:"")+''',
''' (b.started_at&&Number(b.confirmed)===4&&
   (isRealParticipant(b)||live?.admin)?
   '<div class="match-extra-toggle">'+
    btn(expandedPvps.has(b.id)?"⌃ Ocultar sala y detalles":"⌄ Sala, chat y detalles",
     "toggle_pvp_tools",'data-match="'+b.id+'"',"small block")+
   '</div>'+
   (expandedPvps.has(b.id)?
     acceptanceDetails(b)+roomCard(b)+extras.matchPanel(b):""):
   "")+
 (actions?'<div class="line"></div>'+actions:"")+''',"match details collapse")
# move match action buttons before tool panels so winner/result visible
# special match card content order: after status and winner, tools then actions; swap
old=''' (b.started_at&&Number(b.confirmed)===4&&
   (isRealParticipant(b)||live?.admin)?
   '<div class="match-extra-toggle">'+
    btn(expandedPvps.has(b.id)?"⌃ Ocultar sala y detalles":"⌄ Sala, chat y detalles",
     "toggle_pvp_tools",'data-match="'+b.id+'"',"small block")+
   '</div>'+
   (expandedPvps.has(b.id)?
     acceptanceDetails(b)+roomCard(b)+extras.matchPanel(b):""):
   "")+
 (actions?'<div class="line"></div>'+actions:"")+'''
new=''' (actions?'<div class="line"></div>'+actions:"")+
 (b.started_at&&Number(b.confirmed)===4&&
   (isRealParticipant(b)||live?.admin)?
   '<div class="match-extra-toggle">'+
    btn(expandedPvps.has(b.id)?"⌃ Ocultar sala y detalles":"⌄ Sala, chat y detalles",
     "toggle_pvp_tools",'data-match="'+b.id+'"',"small block")+
   '</div>'+
   (expandedPvps.has(b.id)?
     acceptanceDetails(b)+roomCard(b)+extras.matchPanel(b):""):
   "")+'''
one(old,new,"show action first")
# Avoid loading search screen atop Partidas (the other biggest duplicate)
one(''' return (mine?searchScreen():"")+
  (invites.length?''',
''' return (invites.length?''',"no duplicate matchmaking on Partidas")
# concise matches page explanation, keep process information in help
one('''   '<p class="muted">Este desafío todavía no es una partida. Todos deben aceptar antes de que venza; de lo contrario, desaparece sin puntos.</p>'+''',
'''   '<p class="muted">Los cuatro deben aceptar en dos minutos.</p>'+''',"pending brief explanation")
one('''   '<p class="muted">Acá solo se muestran encuentros aceptados por los cuatro jugadores. Las partidas no vencen después de comenzar; deben confirmar el resultado o JS decidirá el ganador.</p>'+''',
'''   '<p class="muted">Partidas aceptadas por los cuatro. Confirmá el resultado cuando terminen.</p>'+''',"games brief explanation")
# Avoid a second huge leaderboard by placing the team ranking in a disclosure.
start_rank=s.index('function rankingScreen(){')
end_rank=s.index('\nfunction historyScreen(){',start_rank)
new_rank=r'''function rankingScreen(){
 const list=teams();
 return extras.rankPanel()+
  '<details class="rank-duos-details"><summary>🛡️ Ver ranking de dúos</summary>'+
  card("🏆 Ranking 2VS2",
   '<p class="muted">La clasificación del equipo se conserva aunque cambie el suplente.</p>'+
   (list.length?list.map((t,i)=>'<div class="match"><div class="flex"><strong style="color:var(--gold)">#'+(i+1)+'</strong><div style="flex:1">'+roster(t)+'</div>'+
    '<div style="text-align:right"><div class="statnum">'+t.wins+'V</div><small class="muted">'+t.losses+'D</small></div></div></div>').join(""):
    '<div class="empty">Aún no hay equipos en esta temporada.</div>'))+
  '</details>';
}'''
s=s[:start_rank]+new_rank+s[end_rank:]
# controller menu
one(''' for(const tab of $("league-tabs").querySelectorAll("[data-tab]"))tab.classList.toggle("on",tab.dataset.tab===view);
 if(!live.admin&&view==="admin")view="inicio";''',
''' if(!live.admin&&view==="admin")view="inicio";
 for(const tab of document.querySelectorAll("#league-tabs [data-tab], #league-more [data-tab]"))
  tab.classList.toggle("on",tab.dataset.tab===view);
 const isMore=["ranking","mi-equipo","historial","admin"].includes(view);
 const moreButton=$("league-more-toggle");
 if(moreButton){
  moreButton.classList.toggle("on",isMore||moreOpen);
  moreButton.setAttribute("aria-expanded",String(moreOpen));
 }
 $("league-more").hidden=!moreOpen;''',"menu state in render")
# navigation
one('''$("league-tabs").addEventListener("click",e=>{
 const b=e.target.closest("button[data-tab]");if(!b)return;
 view=b.dataset.tab;render();window.scrollTo({top:280,behavior:"smooth"});
});''',
'''function switchLeagueTab(next){
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
});''',"menu navigation")
# user actions and dynamic form collapse
one(''' if(action==="go_admin"){view="admin";render();return;}
 if(action==="enable_notices"){''',
''' if(action==="go_admin"){view="admin";moreOpen=false;render();return;}
 if(action==="toggle_pvp_tools"){
   const number=Number(b.dataset.match);
   if(Number.isSafeInteger(number)){
    if(expandedPvps.has(number))expandedPvps.delete(number);
    else expandedPvps.add(number);
    render();
   }
   return;
 }
 if(action==="enable_notices"){''',"expand match tool")
one(''' if(action==="go_matches"){view="partidas";render();return;}
 if(action==="go_team"){view="mi-equipo";render();return;}
 if(action==="go_play"){view="rivales";render();return;}
 if(action==="go_rank"){view="ranking";render();return;}''',
''' if(action==="go_matches"){switchLeagueTab("partidas");return;}
 if(action==="go_team"){switchLeagueTab("mi-equipo");return;}
 if(action==="go_play"){switchLeagueTab("rivales");return;}
 if(action==="go_rank"){switchLeagueTab("ranking");return;}''',"go buttons consistent navigation")
# on logout clear expansion
one('''   live=null;me=null;unsubscribeLeagueRealtime();extras.reset();''',
'''   live=null;me=null;unsubscribeLeagueRealtime();extras.reset();
   expandedPvps.clear();moreOpen=false;''',"logout clean")
one('''   unsubscribeLeagueRealtime();extras.reset();
   privateRooms.clear();''',
'''   unsubscribeLeagueRealtime();extras.reset();
   expandedPvps.clear();moreOpen=false;
   privateRooms.clear();''',"switch account clean")
p.write_text(s)
print("UPDATED_JS: compact home; 4 primary tabs; fewer repeated panels; expandable match tools.")
