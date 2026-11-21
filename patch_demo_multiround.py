from pathlib import Path
p=Path("bomba3d/game.js")
s=p.read_text()
def swap(a,b,label):
 global s
 c=s.count(a)
 if c!=1:raise RuntimeError(f"{label}: {c}")
 s=s.replace(a,b,1)
swap("let demoSecondPass=null,demoVictimId=null,demoExplodedAt=0,demoFinishedAt=0;",
"""let demoSecondPass=null,demoVictimId=null,demoExplodedAt=0,demoFinishedAt=0;
const demoEliminated=new Set();
let demoRound=0,demoChampionId=null;""","new demo state")
swap(" demoSecondPass=null;demoVictimId=null;demoExplodedAt=0;demoFinishedAt=0;\n}",
""" demoSecondPass=null;demoVictimId=null;demoExplodedAt=0;demoFinishedAt=0;
 demoEliminated.clear();demoRound=0;demoChampionId=null;
}""","dispose demo state")
swap("if(demoHolder||demoExplodedAt){",
     "if(demoHolder||demoExplodedAt||demoEliminated.size||demoChampionId){",
     "authoritative state wins")
swap('''     actor.alive=Boolean(p.vivo);
     actor.action=actor.alive?"idle":"death";''',
'''     actor.alive=Boolean(p.vivo);
     actor.action=actor.alive?"idle":"death";
     actor.root.visible=true;''',"restore real game roots")
swap("  demoSecondPass=null;demoVictimId=null;demoExplodedAt=0;demoFinishedAt=0;\n }\n if(!ready",
"""  demoSecondPass=null;demoVictimId=null;demoExplodedAt=0;demoFinishedAt=0;
  demoEliminated.clear();demoRound=0;demoChampionId=null;
 }
 if(!ready""","reset when room turns live")
swap('''   actor.action=p.vivo?"idle":"death";
   actor.alive=Boolean(p.vivo);actor.until=0;''',
'''   actor.alive=Boolean(p.vivo)&&!demoEliminated.has(p.id);
   actor.action=actor.alive?"idle":"death";
   actor.until=0;
   actor.root.visible=!demoEliminated.has(p.id)||Boolean(demoExplodedAt&&demoVictimId===p.id);''',
   "keep death across re-created actors")
swap(''' stage?.classList.add("is3d");
 status("🟢 "''',
''' stage?.classList.add("is3d");
 syncDemoCards();
 status("🟢 "''',"cards after every refresh")
start=s.index("/**\n * Visual-only pass in the fictional demo room.")
end=s.index("export function onGameTransition(",start)
new='''/**
 * Only a visual demo. Real eliminations and scores remain server-owned.
 * Eight fictional players continue for multiple rounds until one wins.
 */
function availableDemoPlayers(){
 return (roomData?.jugadores||[]).filter(p=>
  p.vivo&&!demoEliminated.has(p.id)&&actors.has(p.id));
}
function syncDemoCards(){
 const cards=el("players")?.children||[];
 for(const card of cards){
  const eliminated=demoEliminated.has(card.dataset.playerId);
  card.classList.toggle("demo-eliminated",eliminated);
  const badge=card.querySelector?.(".player-status");
  if(badge&&eliminated)badge.textContent="💥 ELIMINADO";
  else if(badge&&demoChampionId===card.dataset.playerId)badge.textContent="🏆 GANADOR";
  else if(badge&&demoRound)badge.textContent="🎮 EN JUEGO";
 }
}
function resetDemoVisuals(){
 demoHolder=null;demoPending=null;demoSecondPass=null;demoVictimId=null;
 demoEndsAt=0;demoFuseStartAt=0;demoFuseDeadlineAt=0;
 demoExplodedAt=0;demoFinishedAt=0;demoRound=0;demoChampionId=null;
 demoEliminated.clear();flight=null;
 for(const p of roomData?.jugadores||[]){
  const actor=actors.get(p.id);
  if(!actor)continue;
  actor.alive=Boolean(p.vivo);
  actor.action=actor.alive?"idle":"death";
  actor.root.visible=true;
  actor.until=0;
 }
 syncDemoCards();
}
function startDemoRound(now){
 const living=availableDemoPlayers();
 if(living.length<=1){
  demoChampionId=living[0]?.id||null;
  demoHolder=null;demoPending=null;demoSecondPass=null;
  demoFuseStartAt=0;demoFuseDeadlineAt=0;demoEndsAt=0;
  syncDemoCards();
  return false;
 }
 demoRound++;
 const firstIndex=(demoRound-1)%living.length;
 const first=living[firstIndex];
 const second=living[(firstIndex+1)%living.length];
 const third=living[(firstIndex+2)%living.length];
 demoHolder=first.id;
 demoPending={fromId:first.id,toId:second.id,when:now+4600};
 demoSecondPass=third.id!==second.id
  ?{fromId:second.id,toId:third.id,when:now+12000}:null;
 demoVictimId=null;demoExplodedAt=0;demoFinishedAt=0;
 demoFuseStartAt=now;demoFuseDeadlineAt=now+DEMO_FULL_DURATION_MS;
 demoEndsAt=demoFuseDeadlineAt;
 syncDemoCards();
 return true;
}
export function demoThrow(){
 if(!ready||!roomData||roomData.estado!=="ready"||
    !String(roomData.titulo||"").startsWith("DEMO")||
    flight||demoPending||demoHolder||demoExplodedAt)return false;
 resetDemoVisuals();
 return startDemoRound(performance.now());
}
/** Speed up the CURRENT demo round, not the real multiplayer timer. */
export function demoExplodeNow(){
 if(!ready||roomData?.estado!=="ready"||!demoHolder||
    !demoFuseStartAt||demoExplodedAt)return false;
 demoFuseDeadlineAt=performance.now();
 demoEndsAt=demoFuseDeadlineAt;
 demoPending=null;demoSecondPass=null;flight=null;
 return true;
}
'''
s=s[:start]+new+s[end:]
s=s.replace(" // Fictional demo: 20 real seconds, two passes, one explosion and fall.",
" // Fictional demo: 20 seconds per round, two passes, one elimination.")
swap('''  if(victim){victim.alive=false;victim.action="death";}
  demoHolder=null;''',
'''  if(victim){victim.alive=false;victim.action="death";}
  demoEliminated.add(demoVictimId);
  syncDemoCards();
  demoHolder=null;''',"persist elimination")
start=s.index(" if(demoExplodedAt&&time>=demoFinishedAt){")
end=s.index(" const fuseProgress=",start)
s=s[:start]+''' if(demoExplodedAt&&time>=demoFinishedAt){
  const victim=actors.get(demoVictimId);
  if(victim)victim.root.visible=false;
  demoExplodedAt=0;demoFinishedAt=0;demoVictimId=null;
  startDemoRound(time);
 }
'''+s[end:]
start=s.index(' const demoStatus=el("bomb3dDemoStatus");')
end=s.index(" if(!projectile)return;",start)
s=s[:start]+''' const demoStartButton=el("bomb3dDemoThrow");
 if(demoStartButton){
  demoStartButton.disabled=Boolean(demoHolder||demoExplodedAt);
  demoStartButton.textContent=demoChampionId
   ?"🔄 Reiniciar DEMO desde 8 jugadores"
   :"🎬 Jugar 8 bots · hasta un ganador";
 }
 const demoStatus=el("bomb3dDemoStatus");
 if(demoStatus){
  const remaining=availableDemoPlayers().length;
  const champion=roomData?.jugadores?.find(p=>p.id===demoChampionId);
  demoStatus.textContent=demoChampionId
   ?"🏆 GANADOR: "+(champion?.nombre||"Jugador")+" · "+demoEliminated.size+
      " eliminados · podés volver a jugar"
   :demoExplodedAt
    ?"💥 Ronda "+demoRound+": ¡BOOM! Eliminado · "+remaining+
      " siguen · nueva bomba enseguida"
    :demoHolder&&demoFuseDeadlineAt>0
     ?"🎮 Ronda "+demoRound+" · "+remaining+" vivos · 🔥 "+
       Math.max(0,Math.ceil((demoFuseDeadlineAt-time)/1000))+
       " s · el eliminado no vuelve"
     :"🎬 8 bots · una bomba nueva por ronda · gana el último sobreviviente";
 }
'''+s[end:]
p.write_text(s)
p=Path("bomba.html");s=p.read_text()
a='<button type="button" id="bomb3dDemoThrow" hidden>🎬 Probar ronda completa · 20 segundos</button>'
b='<button type="button" id="bomb3dDemoThrow" hidden>🎬 Jugar 8 bots · hasta un ganador</button>'
assert s.count(a)==1;s=s.replace(a,b,1)
s=s.replace('</span>\\n <button type="button" id="bomb3dDemoThrow"','</span>\n <button type="button" id="bomb3dDemoThrow"')
a='./bomba3d/game.js?v=10';assert s.count(a)==1;s=s.replace(a,'./bomba3d/game.js?v=11')
p.write_text(s)
p=Path("bomba3d/game.css");s=p.read_text()
s+='''\n/* Fictional contestants knocked out in the DEMO stop playing permanently. */\n.tableStage.is3d .player.demo-eliminated{opacity:.38;filter:grayscale(.72)!important;\n border-color:#6b5866;background:#331e2b38!important;box-shadow:none}\n.tableStage.is3d .player.demo-eliminated .player-status{color:#ffc1bd}\n.bomb3dToolbar #bomb3dDemoThrow:disabled{opacity:.55;cursor:wait}\n'''
p.write_text(s)
print("MULTIROUND_DEMO_LAST_SURVIVOR_ADDED")
