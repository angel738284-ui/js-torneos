from pathlib import Path
p=Path("bomba3d/game.js")
s=p.read_text()
def change(old,new,label):
 global s
 n=s.count(old)
 if n!=1:raise RuntimeError(f"{label}: expected 1, got {n}")
 s=s.replace(old,new,1)
change('import {preloadOriginalModel,hasOriginalModel,createOriginalRubberActor} from "./imported.js?v=2";',
'''import {preloadOriginalModel,hasOriginalModel,createOriginalRubberActor} from "./imported.js?v=3";
import {
 createBombProp,handWorldPosition,makePassAnimation,HAND_OFFSET
} from "./bomb-effects.js?v=1";''',"import props")
change('let ready=false,frameId=0,lastTime=0,failureLogged=false,loading=null;',
'''let ready=false,frameId=0,lastTime=0,failureLogged=false,loading=null;
let projectile=null,flight=null;''',"scene state")
change(' return {scene,camera,renderer,parent,actor:null,width:0,height:0};',
''' const stage={scene,camera,renderer,parent,actor:null,width:0,height:0};
 if(!preview){
  projectile=createBombProp();
  projectile.root.name="JS_3D_FLYING_BOMB";
  projectile.root.visible=false;
  scene.add(projectile.root);
 }
 return stage;''',"single flying bomb")
change(' studio=null;arena=null;ready=false;previewStamp="";',
''' studio=null;arena=null;ready=false;previewStamp="";
 projectile=null;flight=null;''',"cleanup animation")
change('''   actor=createOriginalRubberActor(avatar);
   actor.stamp=signature;actor.playerId=p.id;''',
'''   actor=createOriginalRubberActor(avatar);
   actor.bomb=createBombProp();
   actor.bomb.root.position.set(...HAND_OFFSET);
   (actor.handAnchor||actor.root).add(actor.bomb.root);
   actor.bomb.root.visible=false;
   actor.stamp=signature;actor.playerId=p.id;''',"bomb in player's hand")
start=s.index("export function onGameTransition(before,after){")
end=s.index("function animate(time){",start)
new_transition='''export function onGameTransition(before,after){
 if(!ready||!before||!after)return;
 const old=new Map((before.jugadores||[]).map(p=>[p.id,p]));
 const newDeaths=(after.jugadores||[]).filter(p=>old.get(p.id)?.vivo&&!p.vivo);
 for(const p of newDeaths){
  const actor=actors.get(p.id);
  if(actor){actor.alive=false;actor.action="death";}
 }
 // The game server is authoritative: ONLY a confirmed holder change starts
 // a flight. Clicking the button cannot launch a bomb on an API error.
 if(before.estado!=="playing"||after.estado!=="playing"||
    newDeaths.length||!before.bomba_de||!after.bomba_de||
    before.bomba_de===after.bomba_de){
  if(after.estado!=="playing"||newDeaths.length)flight=null;
  return;
 }
 const sender=actors.get(before.bomba_de);
 const receiver=actors.get(after.bomba_de);
 if(!sender||!receiver||!receiver.alive)return;
 const origin=handWorldPosition(sender),destination=handWorldPosition(receiver);
 if(!origin||!destination)return;
 const now=performance.now();
 flight=makePassAnimation({
  fromId:before.bomba_de,toId:after.bomba_de,
  start:origin,end:destination,startTime:now
 });
 sender.action="throw";sender.until=now+Math.min(450,flight.duration*.58);
 receiver.action="catch";receiver.until=now+flight.duration+450;
}
function animateHeldAndFlyingBomb(time,reduced){
 const current=roomData?.estado==="playing"?roomData.bomba_de:null;
 // A single holder is visible only while the projectile is not in flight.
 for(const [id,actor] of actors){
  if(actor.bomb){
   actor.bomb.root.visible=Boolean(current===id&&actor.alive&&!flight);
   if(actor.bomb.root.visible)actor.bomb.update(time,reduced);
  }
 }
 if(!projectile)return;
 if(!flight){
  projectile.root.visible=false;
  return;
 }
 if(reduced||flight.finished(time)){
  const recipient=actors.get(flight.toId);
  if(recipient?.alive){recipient.action="catch";recipient.until=time+350;}
  flight=null;
  projectile.root.visible=false;
  if(recipient?.bomb&&current===recipient.playerId)recipient.bomb.root.visible=true;
  return;
 }
 projectile.root.visible=true;
 projectile.root.position.copy(flight.point(time));
 projectile.root.rotation.set(time*.002,time*.003,time*.004);
 projectile.update(time,reduced);
}
'''
s=s[:start]+new_transition+s[end:]
change('''    if(a.action==="receive"&&time>a.until)a.action="idle";
    a.update(seconds,a.action,reduced);
   }
   arena.renderer.render(arena.scene,arena.camera);''',
'''    if(["throw","catch","receive"].includes(a.action)&&time>a.until)a.action="idle";
    a.update(seconds,a.action,reduced);
   }
   animateHeldAndFlyingBomb(time,reduced);
   arena.renderer.render(arena.scene,arena.camera);''',"animating all bombs")
p.write_text(s)
p=Path('bomba3d/imported.js')
s=p.read_text()
def ad(old,new,label):
 global s
 n=s.count(old)
 if n!=1:raise RuntimeError(f"{label}: expected 1, got {n}")
 s=s.replace(old,new,1)
ad('''  const dancing=action==="dance"||options.pose==="dance";
  const wave=action==="receive"||action==="wave"||options.pose==="wave";
  animatedRig.rotation.z=reduced?0:Math.sin(elapsed*(dancing?7.0:2.1))*(dancing?.16:wave?.10:.045);
  animatedRig.position.y=(reduced?0:Math.sin(elapsed*(dancing?7.0:2.5))*(dancing?.065:.035));
  animatedRig.rotation.y=reduced?0:Math.sin(elapsed*1.6)*.06;''',
'''  const dancing=action==="dance"||options.pose==="dance";
  const throwing=action==="throw",catching=action==="catch";
  const idleSway=Math.sin(elapsed*1.9)*(dancing?.18:.085);
  // The GLB is unrigged, so throwing and catching use exaggerated
  // upper-body lean, not fabricated separate arm-bone animations.
  animatedRig.rotation.z=reduced?0:
   throwing?-.25+Math.sin(elapsed*10)*.065:
   catching?.22+Math.sin(elapsed*8)*.045:idleSway;
  animatedRig.rotation.x=reduced?0:throwing?-.14:catching?.12:0;
  animatedRig.position.y=reduced?0:Math.sin(elapsed*(dancing?7:2.55))*(dancing?.07:.045);
  animatedRig.position.x=reduced?0:Math.sin(elapsed*1.55)*(dancing?.09:.055);
  animatedRig.rotation.y=reduced?0:Math.sin(elapsed*1.6)*.09;''',"visible waiting sway + release/catch gestures")
ad('return {root,update,dispose,costume:"plain",kind:"uploaded",alive:true};',
'return {root,handAnchor:animatedRig,update,dispose,costume:"plain",kind:"uploaded",alive:true};',"hand attachment")
p.write_text(s)
p=Path('bomba.html')
s=p.read_text()
tag='''  animateTransfer(before.bomba_de,after.bomba_de);'''
assert s.count(tag)==1
s=s.replace(tag,'''  if(!window.Bomb3D?.isEnabled())animateTransfer(before.bomba_de,after.bomba_de);''',1)
tag='./bomba3d/game.js?v=6'
assert s.count(tag)==1
s=s.replace(tag,'./bomba3d/game.js?v=7',1)
p.write_text(s)
print("3D_IDLE_HAND_BOMB_THROW_CATCH_INTEGRATION_DONE")
