from pathlib import Path
p=Path('test_bomba_demo_throw.mjs');s=p.read_text()
def change(old,new,label):
 global s
 n=s.count(old)
 if n!=1:raise Exception(f"{label}: {n}")
 s=s.replace(old,new,1)
change('''  demoHolder:null,demoPending:null,demoEndsAt:0,demoFuseStartAt:0,demoFuseDeadlineAt:0,serverClockOffset:0,roundFuseProgress:()=>1,''',
'''  demoHolder:null,demoPending:null,demoEndsAt:0,demoFuseStartAt:0,demoFuseDeadlineAt:0,serverClockOffset:0,roundFuseProgress:()=>1,
  demoSecondPass:null,demoVictimId:null,demoExplodedAt:0,demoFinishedAt:0,
  DEMO_FULL_DURATION_MS:20000,DEMO_FALL_HOLD_MS:4600,
  el:()=>null,window:{JSBombDemoExplosion:(id)=>{context.lastExplosionId=id}},''',"demo context")
change('t.functions.animateHeldAndFlyingBomb(2150,false);','t.functions.animateHeldAndFlyingBomb(5600,false);',"first pass begins")
change('t.functions.animateHeldAndFlyingBomb(2200+t.functions.getFlight().duration,false);','t.functions.animateHeldAndFlyingBomb(5750+t.functions.getFlight().duration,false);',"first pass ends")
change(''' t.functions.animateHeldAndFlyingBomb(5600,false);
 assert.equal(t.functions.getDemoHolder(),null);
 assert.equal(t.actors.get("b").bomb.root.visible,false);
 assert.equal(t.room.bomba_de,null,"demo must not modify authoritative room holder");''',
''' t.functions.animateHeldAndFlyingBomb(13500,false);
 assert.equal(t.functions.getDemoHolder(),"b");
 assert.equal(t.context.projectile.root.visible,false);
 t.functions.animateHeldAndFlyingBomb(21000,false);
 assert.equal(t.functions.getDemoHolder(),null);
 assert.equal(t.actors.get("b").action,"death");
 assert.equal(t.context.lastExplosionId,"b");
 assert.equal(t.actors.get("b").bomb.root.visible,false);
 t.functions.animateHeldAndFlyingBomb(25700,false);
 assert.equal(t.actors.get("b").alive,true);
 assert.equal(t.actors.get("b").action,"idle");
 assert.equal(t.room.bomba_de,null,"demo must not modify authoritative room holder");''',"explode & recover")
change('assert.match(page,/Ver bomba gigante · Agarrar y lanzar/);',
'''assert.match(page,/Probar ronda completa · 20 segundos/);
 assert.match(page,/id="bomb3dDemoExplode" hidden disabled/);
 assert.match(page,/Explotar ahora/);
 assert.match(game,/window.Bomb3D=\\{syncRoom,syncPreview,onGameTransition,demoThrow,demoExplodeNow,/);''',"test controls")
change('assert.match(game,/window.Bomb3D=\\{syncRoom,syncPreview,onGameTransition,demoThrow,/);',
'''assert.match(game,/DEMO_FULL_DURATION_MS=20000/);''',"timer 20 sec")
p.write_text(s)
p=Path("test_bomba_3d_throw_catch.mjs");s=p.read_text()
change_fn=lambda x:x
a='''actors,projectile,ready:true,roomData:null,flight:null,demoHolder:null,demoPending:null,demoEndsAt:0,demoFuseStartAt:0,demoFuseDeadlineAt:0,serverClockOffset:0,roundFuseProgress:()=>1,Math,Map,'''
b='''actors,projectile,ready:true,roomData:null,flight:null,demoHolder:null,demoPending:null,demoEndsAt:0,demoFuseStartAt:0,demoFuseDeadlineAt:0,serverClockOffset:0,roundFuseProgress:()=>1,Math,Map,
 demoSecondPass:null,demoVictimId:null,demoExplodedAt:0,demoFinishedAt:0,DEMO_FALL_HOLD_MS:4600,el:()=>null,window:{},'''
assert s.count(a)==1;s=s.replace(a,b,1);p.write_text(s)
p=Path("test_bomba_burning_fuse.mjs");s=p.read_text()
a='''  demoEndsAt:0,demoFuseStartAt:0,demoFuseDeadlineAt:0,serverClockOffset:0,
  roundFuseProgress,Math,Date'''
b='''  demoEndsAt:0,demoFuseStartAt:0,demoFuseDeadlineAt:0,serverClockOffset:0,
  demoSecondPass:null,demoVictimId:null,demoExplodedAt:0,demoFinishedAt:0,DEMO_FALL_HOLD_MS:4600,
  roundFuseProgress,Math,Date,el:()=>null,window:{}'''
assert s.count(a)==1;s=s.replace(a,b,1)
a='assert.match(game,/demoFuseDeadlineAt=demoEndsAt/);'
b='assert.match(game,/demoFuseDeadlineAt=now\\+DEMO_FULL_DURATION_MS/);'
assert s.count(a)==1;s=s.replace(a,b,1)
p.write_text(s)
for name in ['test_bomba_3d_only_wardrobe.mjs','test_bomba_3d_throw_catch.mjs','test_bomba_big_two_hands.mjs','test_bomba_uploaded_glb.mjs','test_bomba_burning_fuse.mjs']:
 p=Path(name);s=p.read_text().replace(r'game\.js\?v=9',r'game\.js\?v=10').replace(r'game\.js\?v=8',r'game\.js\?v=10');p.write_text(s)
print("TEST_HARNESSES_UPDATED_FOR_20_SECOND_EXPLOSION")
