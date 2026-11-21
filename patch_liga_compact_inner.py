from pathlib import Path
p=Path("liga.js");s=p.read_text()
def one(a,b,k):
 global s
 count=s.count(a)
 if count!=1:raise RuntimeError(k+" expected once, got "+str(count))
 s=s.replace(a,b,1)
one('const expandedPvps=new Set();',
'''const expandedPvps=new Set(),expandedAdminPanels=new Set();''',"admin folds state")
# Group manual challenges behind details, and reduce repeated instruction
one(''' return searchScreen()+card("⚔️ Desafío manual (opcional)",
   '<p class="muted">Desafiá a cualquier equipo disponible de la misma región. El servidor bloquea los encuentros repetidos hasta que ambos dúos enfrenten otros dos equipos distintos.</p>'+''',
''' return searchScreen()+
  '<details class="rival-manual"><summary>🎯 Desafiar a un dúo específico</summary>'+
  card("⚔️ Desafío manual",
   '<p class="muted">Elegí un dúo de tu misma región.</p>'+''',"manual challenge fold")
one('''   (!eligible?'<p class="muted">⚠️ Tu titular está reemplazado por un suplente. Solo los dos jugadores activos pueden desafiar.</p>':""));
}
function matchesScreen(){''',
'''   (!eligible?'<p class="muted">⚠️ El suplente está activo. Solo los titulares de la alineación actual pueden desafiar.</p>':""))+
  '</details>';
}
function matchesScreen(){''',"manual fold close")
# Separate concluded results from current games
one(''' const matches=games().filter(g=>Number(g.confirmed)===4&&g.started_at&&
   (inTeam(g)||live.admin));
 return (invites.length?''',
''' const matches=games().filter(g=>Number(g.confirmed)===4&&g.started_at&&
   (inTeam(g)||live.admin));
 const playing=matches.filter(g=>["playing","review"].includes(g.state));
 const history=matches.filter(g=>!["playing","review"].includes(g.state));
 return (invites.length?''',"matches history split")
one('''  card("📋 Partidas confirmadas (4/4)",
   '<p class="muted">Partidas aceptadas por los cuatro. Confirmá el resultado cuando terminen.</p>'+
   (matches.length?matches.map(matchCard).join(""):'<div class="empty">Todavía no hay partidas aceptadas por los cuatro.</div>'));
}''',
'''  card("🎮 Partidas en curso",
   '<p class="muted">Confirmá el resultado cuando terminen.</p>'+
   (playing.length?playing.map(matchCard).join(""):'<div class="empty">No tenés PvP pendientes de resultado.</div>'))+
  (history.length?'<details class="history-match-list"><summary>📚 Partidas finalizadas ('+history.length+')</summary>'+
    history.map(matchCard).join("")+'</details>':"");
}''',"final results hidden")
# reorganize admin sections by folding lower-priority admin results
one(''' return matches+extras.adminPanel()+correction+history;
}''',
''' return extras.adminPanel()+
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
}''',"admin fold setup")
# Clear expanded admin sections for both logout and account changes.
if s.count('expandedPvps.clear();moreOpen=false;')!=2:
 raise RuntimeError('Expected logout and account switch reset')
s=s.replace('expandedPvps.clear();moreOpen=false;',
 'expandedPvps.clear();expandedAdminPanels.clear();moreOpen=false;')
one(''' if(action==="toggle_pvp_tools"){
   const number=Number(b.dataset.match);''',
''' if(action==="toggle_admin_panel"){
   const panel=b.dataset.panel;
   if(["matches","points","history"].includes(panel)){
    if(expandedAdminPanels.has(panel))expandedAdminPanels.delete(panel);
    else expandedAdminPanels.add(panel);
    render();
   }
   return;
 }
 if(action==="toggle_pvp_tools"){
   const number=Number(b.dataset.match);''',"admin fold interaction")
p.write_text(s)
h=Path('liga.html');html=h.read_text()
anchor='''/* JS Family v2.1 — mobile-first simple navigation and quiet home */'''
css='''.admin-fold{margin-top:11px}
.admin-fold>.btn{background:#172a42;border-color:#344e69;color:#c9def2}
.admin-fold .panel{margin:8px 0 15px}
.history-match-list,.rival-manual{margin:12px 0;padding:12px 15px;border:1px solid #344a64;border-radius:13px;background:#101b30}
.history-match-list summary,.rival-manual summary{cursor:pointer;font-weight:850;color:#bcd6f2}
.history-match-list .match{margin:10px 0}.rival-manual .panel{border:0;padding:9px 0 0;box-shadow:none}
'''
assert html.count(anchor)==1;html=html.replace(anchor,css+anchor,1)
h.write_text(html)
print('INNER_PAGES_COMPACT: manual rivals, historic matches, admin corrections on demand.')
