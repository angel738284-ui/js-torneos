from pathlib import Path
p=Path(__file__).with_name("game.js")
s=p.read_text()
needle='function animateHeldAndFlyingBomb(time,reduced){'
assert needle in s
add='''// The demo never changes Supabase state. Show its locally simulated state
// on the shared arena HUD instead of "Sala lista / Esperando inicio".
let lastDemoHudUpdate=0;
function updateDemoHud(now){
 if(now-lastDemoHudUpdate<180)return;
 lastDemoHudUpdate=now;
 if(roomData?.estado!=="ready"||
   !String(roomData?.titulo||"").startsWith("DEMO")||
   !(demoRound||demoHolder||demoExplodedAt||demoChampionId))return;
 const total=roomData.jugadores?.length||0;
 const alive=Math.max(0,total-demoEliminated.size);
 const isChampion=Boolean(demoChampionId);
 const exploding=Boolean(demoExplodedAt);
 const remaining=demoHolder&&demoFuseDeadlineAt>0
   ?Math.max(0,Math.ceil((demoFuseDeadlineAt-now)/1000)):0;
 const name=roomData.jugadores?.find(p=>p.id===
   (isChampion?demoChampionId:exploding?demoVictimId:demoHolder))?.nombre;
 const center=el("tableCenterName"),sub=el("tableCenterTimer"),mark=el("centerMark");
 if(center)center.textContent=isChampion?("🏆 "+(name||"¡GANADOR!")):
   exploding?"¡BOOM!":flight?"💣 EN EL AIRE":(name||"💣 BOMBA");
 if(sub)sub.textContent=isChampion?"¡Fin de la DEMO!":
   exploding?((name||"Jugador")+" eliminado · siguiente ronda"):
   ("🔥 "+remaining+" s · ronda "+demoRound);
 if(mark)mark.textContent=isChampion?"🏆":exploding?"💥":"💣";
 const round=el("round"),count=el("alive"),timer=el("timer");
 if(round)round.textContent="🎮 DEMO · Bomba Mortal JS Family · Ronda "+demoRound;
 if(count)count.textContent=alive+" / "+total+" vivos";
 if(timer){timer.textContent=isChampion?"FIN":exploding?"💥":remaining+" s";
  timer.classList.toggle("urgent",!isChampion&&!exploding&&remaining<5);}
}
'''
s=s.replace(needle,add+needle,1)
# Called in animation loop after all other functions that can mutate demo state.
needle2='   animateHeldAndFlyingBomb(time,reduced);\n   arena.renderer.render(arena.scene,arena.camera);'
assert needle2 in s
s=s.replace(needle2,'   animateHeldAndFlyingBomb(time,reduced);\n   updateDemoHud(time);\n   arena.renderer.render(arena.scene,arena.camera);',1)
p.write_text(s)
page=Path(__file__).parents[1]/"bomba.html"
html=page.read_text()
assert './bomba3d/game.js?v=38' in html
page.write_text(html.replace('./bomba3d/game.js?v=38','./bomba3d/game.js?v=39',1))
print('Updated demo HUD and cache version')
