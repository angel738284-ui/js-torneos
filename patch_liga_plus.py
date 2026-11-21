from pathlib import Path
p=Path('liga.js')
s=p.read_text()
def rep(a,b,tag):
 global s
 count=s.count(a)
 if count!=1:raise RuntimeError(f"{tag}: expected 1, got {count}. {a[:80]}")
 s=s.replace(a,b,1)
rep('import {createClient} from "https://esm.sh/@supabase/supabase-js@2.45.6";',
'''import {createClient} from "https://esm.sh/@supabase/supabase-js@2.45.6";
import {createLeagueExtras} from "./liga-plus.js?v=1.0.0";''',"module import")
rep('''const pageHint='<p class="muted">Las partidas de esta liga no modifican el historial de torneos existente ni el ranking anterior de JS Guardian.</p>';''',
'''const pageHint='<p class="muted">Las partidas de esta liga no modifican el historial de torneos existente ni el ranking anterior de JS Guardian.</p>';
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
}''',"initialization")
rep(''' roomCard(b)+
 (actions?''',''' roomCard(b)+extras.matchPanel(b)+
 (actions?''',"extra PvP panels")
rep('''  teamBox+'<div style="margin-top:16px">'+action+'</div>'+''',
'''  extras.myRank()+
  teamBox+'<div style="margin-top:16px">'+action+'</div>'+''',"home personal rank")
rep('''function rankingScreen(){
 const list=teams();
 return card("🏆 Ranking 2VS2",''',
'''function rankingScreen(){
 const list=teams();
 return extras.rankPanel()+card("🏆 Ranking 2VS2",''',"individual rank leaderboard")
old=''' const matches=card("⚖️ Resolver / corregir partidas aceptadas (4/4)",
  '<p class="muted">Solo los PvP que empezaron con cuatro aceptaciones pueden recibir victorias o derrotas. Podés corregir resultados finalizados y en revisión sin duplicar puntos.</p>'+
  (played.length?played.map(matchCard).join(""):'<div class="empty">Todavía no hay PvP completos para resolver.</div>'));'''
new=''' const matches=card("⚖️ Resolver / corregir partidas aceptadas (4/4)",
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
   '<div class="empty">Todavía no hay PvP completos para resolver.</div>'));'''
rep(old,new,"admin filters")
rep(''' return matches+correction+history;''',
''' return matches+extras.adminPanel()+correction+history;''',"admin case management")
rep(''' $( "league-content" ).innerHTML=''', ''' $( "league-content" ).innerHTML=''', "noop") if False else None
rep(''' $("league-content").innerHTML=fn()+(live.admin&&view==="admin"?adminExtras():"");
 refreshAcceptCountdowns();''',
''' $("league-content").innerHTML=fn()+(live.admin&&view==="admin"?adminExtras():"");
 refreshAcceptCountdowns();
 extras.afterRender();''',"filter after render")
rep('''   live=null;me=null;privateRooms.clear();shownPasswords.clear();editingRooms.clear();''',
'''   live=null;me=null;unsubscribeLeagueRealtime();extras.reset();
   privateRooms.clear();shownPasswords.clear();editingRooms.clear();''',"signout reset")
rep('''  if(me!==null&&me!==data.user){
   privateRooms.clear();''',
'''  if(me!==null&&me!==data.user){
   unsubscribeLeagueRealtime();extras.reset();
   privateRooms.clear();''',"switch user")
rep('''  render();
  void refreshPresence();
  void refreshPrivateRooms();''',
'''  render();
  subscribeLeagueRealtime();
  void extras.refresh();
  void refreshPresence();
  void refreshPrivateRooms();''',"load integration")
rep(''' const action=b.dataset.action;
 if(action==="refresh"){await load();return;}''',
''' const action=b.dataset.action;
 if(await extras.runAction(action,b))return;
 if(action==="refresh"){await load();return;}''',"extra event actions")
rep('''load();
sb.auth.onAuthStateChange((event)=>{''',
'''document.addEventListener("input",event=>extras.changeFilter(event.target));
document.addEventListener("change",event=>extras.changeFilter(event.target));
load();
sb.auth.onAuthStateChange((event)=>{''',"filter listening")
p.write_text(s)
html=Path("liga.html")
h=html.read_text()
assert h.count('liga.js?v=1.8.0')==1
h=h.replace('liga.js?v=1.8.0','liga.js?v=2.0.0',1)
css='''
/* JS Family individual ranks, match waitroom, private chat, evidence and cases */
.personal-rank{border:1px solid #aa8847;background:linear-gradient(140deg,#3a2b34,#18263a);border-radius:13px;padding:13px;margin:12px 0}
.personal-rank>strong{font-size:11px;letter-spacing:1px;color:#ffda9d}
.personal-rank-name{font-size:22px;font-weight:950;margin-top:7px;color:#ffe3ab}
.rank-stats{display:flex;flex-wrap:wrap;gap:6px;margin:9px 0}.rank-stats span{background:#12253a;border-radius:8px;padding:6px;font-size:11px;color:#c7dcfa}
.rank-rules{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}
.rank-rules b{font-size:10px;padding:7px 9px;background:#23354a;border-radius:9px}
.rank-person{display:flex;align-items:center;gap:10px;padding:10px 8px;border-bottom:1px solid #ffffff18}
.rank-person.mine{border:1px solid #ddbb7399;border-radius:10px;background:#4a383c55}
.rank-person-name{min-width:0;flex:1;overflow-wrap:anywhere;font-weight:800;font-size:12px}
.rank-person-name small{display:block;color:#b0c3dc;font-size:10px;font-weight:500}
.rank-medal{text-align:right;font-size:11px;font-weight:900;color:#ffda98}
.match-extra{border:1px solid #405774;border-radius:13px;background:#111c30;margin:12px 0;padding:12px}
.match-extra>strong{display:block;font-size:13px;margin-bottom:8px;color:#daedff}
.extra-result-grid,.ready-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:9px 0}
.result-person,.ready-member{padding:9px 8px;background:#1b2a41;border-radius:9px;font-size:11px;overflow-wrap:anywhere}
.result-person small{display:block;color:#c0cfe3;margin-top:4px}
.chat-thread{max-height:230px;overflow:auto;background:#0d1728;padding:10px;border-radius:10px}
.chat-line{padding:8px;border-bottom:1px solid #26374e;display:grid;gap:3px;font-size:12px;overflow-wrap:anywhere}
.chat-line.mine{background:#173347}.chat-line strong{color:#81d9f4}.chat-line small{color:#9db3d3;font-size:10px}
textarea{width:100%;background:#101a2c;color:#fff;border:1px solid #415a77;border-radius:10px;padding:10px;font:inherit;resize:vertical}
.proof-item{display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid #34465e;padding:9px}
.proof-item a{color:#9be2ff;font-weight:800;text-decoration:underline;font-size:12px}
.report-item{border-color:#8e6171}.report-item p{overflow-wrap:anywhere}
#admin-match-list article[hidden]{display:none!important}
@media(max-width:400px){.rank-person{flex-wrap:wrap}.rank-medal{text-align:left}.extra-result-grid{grid-template-columns:1fr 1fr}}
'''
anchor='''.room-card{margin:15px 0;'''
assert h.count(anchor)==1
h=h.replace(anchor,css+anchor,1)
html.write_text(h)
print("NEW_LEAGUE_UI v2.0.0 integrated with personal rank, ready/chat/captures, no-shows, admin cases and realtime.")
