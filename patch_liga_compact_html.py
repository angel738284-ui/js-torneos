from pathlib import Path
p=Path('liga-plus.js')
s=p.read_text()
anchor=''' function myRank(){
  const self=rank.current?.my;'''
replacement=''' function myRankCompact(){
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
  const self=rank.current?.my;'''
assert s.count(anchor)==1,s.count(anchor)
s=s.replace(anchor,replacement,1)
old=''' return {matchPanel,myRank,rankPanel,adminPanel,refresh,reset,
  runAction,afterRender,changeFilter,filterAdmin};'''
new=''' return {matchPanel,myRank,myRankCompact,rankPanel,adminPanel,refresh,reset,
  runAction,afterRender,changeFilter,filterAdmin};'''
assert s.count(old)==1;s=s.replace(old,new,1)
p.write_text(s)
h=Path("liga.html")
html=h.read_text()
old='''  <nav class="tabs" id="league-tabs" aria-label="Apartados de liga">
   <button type="button" data-tab="inicio" class="on">🏠 Inicio</button>
   <button type="button" data-tab="rivales">⚔️ Jugar</button>
   <button type="button" data-tab="partidas">📋 Partidas</button>
   <button type="button" data-tab="ranking">🏆 Ranking</button>
   <button type="button" data-tab="mi-equipo">🛡️ Mi dúo</button>
   <button type="button" data-tab="historial">📚 Historial</button>
   <button type="button" data-tab="admin" id="league-admin-tab" hidden>👑 Admin</button>
  </nav>
  <div id="league-content" aria-live="polite"></div>
  <p class="muted">Los resultados se validan en Supabase con tu cuenta. Solo los cuatro jugadores reales pueden confirmar la partida. Si hay contradicción, JS decide.</p>'''
new='''  <nav class="tabs" id="league-tabs" aria-label="Navegación principal de la liga">
   <button type="button" data-tab="inicio" class="on">🏠 Inicio</button>
   <button type="button" data-tab="rivales">⚔️ Jugar</button>
   <button type="button" data-tab="partidas">📋 Partidas</button>
   <button type="button" id="league-more-toggle" data-more-toggle="true" aria-expanded="false" aria-controls="league-more">☰ Más</button>
  </nav>
  <div id="league-more" class="league-more" hidden aria-label="Otros apartados">
   <button type="button" data-tab="ranking">🏆 Rangos</button>
   <button type="button" data-tab="mi-equipo">🛡️ Mi dúo</button>
   <button type="button" data-tab="historial">📚 Historial</button>
   <button type="button" data-tab="admin" id="league-admin-tab" hidden>👑 Admin</button>
  </div>
  <div id="league-content" aria-live="polite"></div>
  <p class="muted league-footer-note">Los resultados se confirman con las cuentas de los jugadores. JS resuelve los conflictos.</p>'''
assert html.count(old)==1,html.count(old);html=html.replace(old,new,1)
# Hide the repetitive explanatory paragraph, preserve in semantic details on desktop if needed
old=''' <p class="muted" style="margin:-8px 2px 16px">🟢 Conectados: tienen abierta esta liga. 🎮 En curso: PvP aceptados por los cuatro, no confirma que estén dentro de Free Fire. Actualización aproximada cada 20 segundos.</p>'''
new=''' <p class="muted presence-explainer">🟢 Conectados: tienen abierta esta liga. 🎮 En curso: PvP aceptados por los cuatro, no confirma que estén dentro de Free Fire. Actualización aproximada cada 20 segundos.</p>'''
assert html.count(old)==1;html=html.replace(old,new,1)
# create compact styles with precise priority at end of CSS
anchor='''</style>'''
css=r'''
/* JS Family v2.1 — mobile-first simple navigation and quiet home */
.tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;overflow:visible;margin:12px 0 9px}
.tabs button{width:100%;min-width:0;white-space:nowrap;padding:11px 4px;border-radius:12px;font-size:12px}
.league-more{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:10px;background:#111d31;border:1px solid #36485e;border-radius:14px;margin-bottom:10px}
.league-more[hidden]{display:none}
.league-more button{background:#1b2a42;border:1px solid #38536e;color:#e4efff;border-radius:11px;min-height:45px;padding:9px;font-size:12px;font-weight:850}
.league-more button.on{border-color:#ec7996;background:#472b42}
.dashboard-home{padding:16px}
.dashboard-home .home-top{display:flex;justify-content:space-between;gap:12px;align-items:center}
.dashboard-home .home-top h2{font-size:22px;margin:1px 0 0}
.home-eyebrow{font-size:10px;letter-spacing:1px;font-weight:800;color:#a7bed8}
.home-season{color:#91f6cc;background:#214839;padding:5px 9px;border-radius:24px;font-size:11px;font-weight:800;white-space:nowrap}
.home-season.paused{color:#ffcfb5;background:#593a40}
.home-pause{display:grid;gap:2px;padding:11px 12px;border:1px solid #866067;background:#38272f;border-radius:10px;margin:12px 0}
.home-pause strong{font-size:13px}.home-pause span{font-size:11px;color:#e2c9d4}
.home-reward{display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid #384863;padding:12px 0;color:#e5eeff;font-size:12px}
.home-reward strong{font-size:13px;max-width:72%;text-align:right;overflow-wrap:anywhere;color:#ffda99}
.rank-mini{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 0;border-bottom:1px solid #384863}
.rank-mini-copy{min-width:0;display:grid;gap:2px}
.rank-mini-copy small{color:#aebfd8;font-weight:900;font-size:10px;letter-spacing:.6px}
.rank-mini-copy strong{font-size:19px;color:#ffddaa}
.rank-mini-copy span{font-size:12px;color:#b5c9e5}
.rank-mini button{flex:none}
.home-duo{display:flex;align-items:center;gap:10px;padding:14px 0;min-width:0}
.home-icon{display:grid;place-items:center;width:37px;height:37px;flex:0 0 37px;border-radius:11px;background:#263b58}
.home-duo-name{min-width:0;flex:1;display:grid;gap:1px}
.home-duo-name small{font-size:10px;color:#92aac6;font-weight:850}
.home-duo-name strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;font-size:13px;line-height:1.4}
.home-duo-name span{color:#a9bfd9;font-size:11px}
.home-main-action{margin:4px 0 12px}
.home-main-action .btn{min-height:54px;font-size:15px}
.home-disabled{text-align:center;padding:14px;border:1px solid #675262;background:#30283a;border-radius:12px;color:#e9bbcb;font-size:12px;font-weight:850}
.home-invites{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:8px 2px;color:#c7dcf9;font-size:11px}
.home-help{border-top:1px solid #34465b;margin-top:16px;padding-top:12px}
.home-help summary,.rank-duos-details summary{cursor:pointer;color:#bcd3ec;font-size:12px;font-weight:800;padding:7px 0}
.rank-duos-details{background:#101b2f;border:1px solid #34465f;border-radius:14px;padding:10px 14px;margin-top:12px}
.rank-duos-details .panel{box-shadow:none;border:none;padding:10px 0;margin:5px 0}
.match-extra-toggle{margin-top:10px}
.match-extra-toggle .btn{background:#192a42;border-color:#314963;color:#b9d8f7}
.match:has(.match-extra-toggle){overflow-wrap:anywhere}
.presence-explainer{margin:-8px 2px 16px}
@media(max-width:600px){
 .wrap{padding:9px 12px 75px}
 .head{margin:0 0 11px}
 .head .mark{width:36px;height:36px;border-radius:10px;font-size:15px}
 .head .brand{gap:9px}.head .brand strong{font-size:15px}.head .brand small{font-size:9px}
 .head .outline{font-size:11px;padding:8px}
 .hero{padding:12px 14px 10px;border-radius:15px;box-shadow:none}
 .hero:after{display:none}
 .hero .eyebrow{font-size:9px;letter-spacing:1px}
 .hero h1{font-size:20px;line-height:1.2;margin:2px 0 5px}
 .hero h1 br{display:none}.hero h1 em:before{content:" "}
 .hero p{display:none}
 .hero .meta{margin-top:7px;gap:5px}
 .hero .pill,.hero .badge{font-size:10px;padding:4px 7px}
 .metrics,.presence-explainer,.league-footer-note{display:none}
 #league-auth.panel{padding:11px 13px;margin:10px 0 11px;border-radius:13px}
 #league-auth .flex strong{font-size:12px;display:block;max-width:65vw;overflow-wrap:anywhere}
 #league-auth .muted{font-size:10px}
 .tabs{position:sticky;top:0;z-index:25;background:#090e1df0;border:1px solid #263956;border-radius:12px;padding:5px;backdrop-filter:blur(9px)}
 .tabs button{padding:10px 2px;font-size:11px;min-height:40px}
 .league-more{position:sticky;top:56px;z-index:24;box-shadow:0 12px 25px #0008}
 .dashboard-home{padding:15px}
 .dashboard-home h2{font-size:19px}
 .rank-mini-copy strong{font-size:18px}
 .rank-mini button,.home-duo .btn{padding:7px 8px;min-height:35px;font-size:11px}
}
'''
assert html.count(anchor)==1
html=html.replace(anchor,css+anchor,1)
assert html.count('liga.js?v=2.0.0')==1;html=html.replace('liga.js?v=2.0.0','liga.js?v=2.1.0')
h.write_text(html)
print('HTML COMPACT: 4 primary tabs + More submenu, mobile header collapsed, compact home rank/duo.')
