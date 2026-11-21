from pathlib import Path
root=Path(__file__).resolve().parent
imp=root/'bomba3d/imported.js'
game=root/'bomba3d/game.js'
html=root/'bomba.html'
a=imp.read_text()
assert ' const palmMat=new THREE.MeshStandardMaterial({' in a
start=a.index(' const palmMat=new THREE.MeshStandardMaterial({')
end=a.index(' let elapsed=0,deadAmount=0;',start)
a=a[:start]+''' // Don't add palm-helper geometry: the animated GLB already contains two
 // real arms/hands. Extra palm spheres looked like a second pair of arms.
'''+a[end:]
a=a.replace('  const holding=action==="hold"||action==="catch"||action==="receive";\n  grippingHands.visible=holding;\n','')
a=a.replace('  palmMat.dispose();\n  // Palm geometry remains shared with this actor only.\n  palmGeometry.dispose();\n','')
assert 'grippingHands' not in a and 'palmMat' not in a
imp.write_text(a)
b=game.read_text()
old='export function initBomb3D(){\n window.Bomb3D={syncRoom,syncPreview,onGameTransition,demoThrow,demoExplodeNow,set3DEnabled,isEnabled:()=>ready};'
assert old in b
new='''export function getDemoState(){
 const active=ready&&roomData?.estado==="ready"&&
  String(roomData?.titulo||"").startsWith("DEMO")&&
  Boolean(demoRound||demoHolder||demoExplodedAt||demoChampionId);
 if(!active)return {active:false};
 return {
  active:true,round:demoRound,holderId:demoHolder,victimId:demoVictimId,
  winnerId:demoChampionId,exploding:Boolean(demoExplodedAt),
  inFlight:Boolean(flight),
  remainingMs:demoHolder&&demoFuseDeadlineAt>0
   ?Math.max(0,demoFuseDeadlineAt-performance.now()):0,
  total:roomData.jugadores?.length||0,alive:Math.max(0,(roomData.jugadores?.length||0)-demoEliminated.size)
 };
}
export function initBomb3D(){
 window.Bomb3D={syncRoom,syncPreview,onGameTransition,demoThrow,demoExplodeNow,
  getDemoState,set3DEnabled,isEnabled:()=>ready};'''
b=b.replace(old,new)
game.write_text(b)
h=html.read_text()
needle=' const centerTimer=el("tableCenterTimer");\n if(room.estado==="playing"){'
assert needle in h
replace=''' const centerTimer=el("tableCenterTimer");
 // DEMO remains server-side "ready": its timer/holder/winner are local.
 // Override the server waiting UI using the same state as the 3D animation.
 const demo=room.estado==="ready"?window.Bomb3D?.getDemoState?.():null;
 if(demo?.active){
  const player=id=>room.jugadores?.find(p=>p.id===id)?.nombre||"Jugador";
  const name=demo.winnerId?player(demo.winnerId):
    demo.exploding?player(demo.victimId):demo.holderId?player(demo.holderId):"";
  const seconds=Math.ceil(demo.remainingMs/1000);
  el("round").textContent="🎮 DEMO · Bomba Mortal JS Family · Ronda "+demo.round;
  el("alive").textContent=demo.alive+" / "+demo.total+" vivos";
  timer.textContent=demo.winnerId?"FIN":demo.exploding?"💥":seconds+" s";
  timer.classList.toggle("urgent",!demo.winnerId&&!demo.exploding&&seconds<=4);
  el("tableCenterName").textContent=demo.winnerId?"🏆 "+name:
    demo.exploding?"¡BOOM!":demo.inFlight?"💣 EN EL AIRE":name;
  if(centerTimer)centerTimer.textContent=demo.winnerId?"¡Fin de la DEMO!":
    demo.exploding?name+" eliminado · próxima ronda":
    "🔥 "+seconds+" s · ronda "+demo.round;
  el("centerMark").textContent=demo.winnerId?"🏆":demo.exploding?"💥":"💣";
  hint.textContent=demo.winnerId?"🏆 ¡Tenemos ganador en la DEMO!":
    demo.exploding?"💥 Eliminado: "+name:
    "🎬 Prueba con bots · no afecta una partida real.";
 }else if(room.estado==="playing"){'''
h=h.replace(needle,replace)
assert h.count('const demo=room.estado==="ready"?window.Bomb3D?.getDemoState?.():null;')==1
h=h.replace('./bomba3d/game.js?v=39','./bomba3d/game.js?v=40',1)
b=game.read_text().replace('./imported.js?v=20','./imported.js?v=21')
game.write_text(b)
html.write_text(h)
print("Parches aplicados: sin manos duplicadas; HUD de DEMO integrado; version 40")
