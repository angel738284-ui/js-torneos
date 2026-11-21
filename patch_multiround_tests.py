from pathlib import Path
p=Path("bomba3d/game.js");s=p.read_text()
a='''  const eliminated=demoEliminated.has(card.dataset.playerId);
  card.classList.toggle("demo-eliminated",eliminated);
  const badge=card.querySelector?.(".player-status");
  if(badge&&eliminated)badge.textContent="💥 ELIMINADO";
  else if(badge&&demoChampionId===card.dataset.playerId)badge.textContent="🏆 GANADOR";
  else if(badge&&demoRound)badge.textContent="🎮 EN JUEGO";
'''
b='''  const wasEliminated=card.classList.contains("demo-eliminated");
  const eliminated=demoEliminated.has(card.dataset.playerId);
  card.classList.toggle("demo-eliminated",eliminated);
  const badge=card.querySelector?.(".player-status");
  if(badge&&eliminated)badge.textContent="💥 ELIMINADO";
  else if(badge&&demoChampionId===card.dataset.playerId)badge.textContent="🏆 GANADOR";
  else if(badge&&demoRound)badge.textContent="🎮 EN JUEGO";
  else if(badge&&wasEliminated){
   const player=roomData?.jugadores?.find(p=>p.id===card.dataset.playerId);
   badge.textContent=!player?.vivo?"💥 Eliminado":
     player?.id===roomData?.bomba_de?"💣 TIENE BOMBA":"🎮 En juego";
  }
'''
assert s.count(a)==1;s=s.replace(a,b);p.write_text(s)
p=Path('test_bomba_demo_full_round.mjs');s=p.read_text()
a='const begin=game.indexOf("export function demoThrow(){");'
b='const begin=game.indexOf("function availableDemoPlayers(){");'
assert s.count(a)==1;s=s.replace(a,b)
a='''  demoExplodedAt:0,demoFinishedAt:0,serverClockOffset:0,
  DEMO_FULL_DURATION_MS:20000,DEMO_FALL_HOLD_MS:4600,'''
b='''  demoExplodedAt:0,demoFinishedAt:0,serverClockOffset:0,
  demoEliminated:new Set(),demoRound:0,demoChampionId:null,
  DEMO_FULL_DURATION_MS:20000,DEMO_FALL_HOLD_MS:4600,'''
assert s.count(a)==1;s=s.replace(a,b)
a=''' assert.equal(s.actors.get("p2").alive,true);
 assert.equal(s.actors.get("p2").action,"idle");
 assert.equal(s.ctx.demoHolder,null);
 assert.equal(s.ctx.demoFuseStartAt,0);
 assert.equal(s.room.bomba_de,null);
 assert.equal(s.people[2].vivo,true,"server data unchanged");
 assert.equal(s.api.demoThrow(),true,"demo can be replayed");'''
b=''' assert.equal(s.actors.get("p2").alive,false,"eliminated actor stays dead");
 assert.equal(s.actors.get("p2").root.visible,false,"removed from next round");
 assert.equal(s.ctx.demoRound,2,"new round starts automatically");
 assert.equal(s.ctx.demoHolder,"p1","next holder comes from survivors");
 assert.equal(s.ctx.demoEliminated.size,1);
 assert.equal(s.ctx.demoFuseStartAt,25602);
 assert.equal(s.ctx.demoFuseDeadlineAt-s.ctx.demoFuseStartAt,20000,"fresh fuse");
 assert.equal(s.room.bomba_de,null);
 assert.equal(s.people[2].vivo,true,"server data unchanged");
 assert.equal(s.api.demoThrow(),false,"a new manual demo cannot interrupt active round");'''
assert s.count(a)==1;s=s.replace(a,b)
a=''' assert.equal(s.actors.get("p0").alive,true);
 assert.equal(s.room.estado,"ready");'''
b=''' assert.equal(s.actors.get("p0").alive,false);
 assert.equal(s.actors.get("p0").root.visible,false);
 assert.equal(s.ctx.demoRound,2);
 assert.equal(s.ctx.demoEliminated.size,1);
 assert.notEqual(s.ctx.demoHolder,"p0");
 assert.equal(s.room.estado,"ready");'''
assert s.count(a)==1;s=s.replace(a,b)
s=s.replace('Probar ronda completa · 20 segundos','Jugar 8 bots · hasta un ganador')
s=s.replace(r'game\.js\?v=10',r'game\.js\?v=11')
p.write_text(s)
p=Path('test_bomba_demo_throw.mjs');s=p.read_text()
a='const start=game.indexOf("export function demoThrow(){")'
b='const start=game.indexOf("function availableDemoPlayers(){")'
assert s.count(a)==1;s=s.replace(a,b)
a='''  DEMO_FULL_DURATION_MS:20000,DEMO_FALL_HOLD_MS:4600,'''
b='''  DEMO_FULL_DURATION_MS:20000,DEMO_FALL_HOLD_MS:4600,
  demoEliminated:new Set(),demoRound:0,demoChampionId:null,'''
assert s.count(a)==1;s=s.replace(a,b)
a=''' t.functions.animateHeldAndFlyingBomb(13500,false);
 assert.equal(t.functions.getDemoHolder(),"b");
 assert.equal(t.context.projectile.root.visible,false);
 t.functions.animateHeldAndFlyingBomb(21000,false);
 assert.equal(t.functions.getDemoHolder(),null);
 assert.equal(t.actors.get("b").action,"death");
 assert.equal(t.context.lastExplosionId,"b");
 assert.equal(t.actors.get("b").bomb.root.visible,false);
 t.functions.animateHeldAndFlyingBomb(25700,false);
 assert.equal(t.actors.get("b").alive,true);
 assert.equal(t.actors.get("b").action,"idle");'''
b=''' t.functions.animateHeldAndFlyingBomb(13500,false);
 assert.equal(t.functions.getDemoHolder(),"a","second pass goes back to first player");
 assert.equal(t.context.projectile.root.visible,true);
 t.functions.animateHeldAndFlyingBomb(13700+t.functions.getFlight().duration,false);
 t.functions.animateHeldAndFlyingBomb(21000,false);
 assert.equal(t.functions.getDemoHolder(),null);
 assert.equal(t.actors.get("a").action,"death");
 assert.equal(t.context.lastExplosionId,"a");
 assert.equal(t.actors.get("a").bomb.root.visible,false);
 t.functions.animateHeldAndFlyingBomb(25700,false);
 assert.equal(t.actors.get("a").alive,false);
 assert.equal(t.actors.get("a").root.visible,false);
 assert.equal(t.context.demoChampionId,"b");'''
assert s.count(a)==1;s=s.replace(a,b)
s=s.replace('Probar ronda completa · 20 segundos','Jugar 8 bots · hasta un ganador')
p.write_text(s)
for name in ['test_bomba_3d_throw_catch.mjs','test_bomba_big_two_hands.mjs','test_bomba_burning_fuse.mjs','test_bomba_uploaded_glb.mjs']:
 p=Path(name);s=p.read_text()
 s=s.replace(r'game\.js\?v=10',r'game\.js\?v=11')
 s=s.replace('Probar ronda completa · 20 segundos','Jugar 8 bots · hasta un ganador')
 p.write_text(s)
print("MULTIROUND_TEST_HARNESSES_UPDATED")
