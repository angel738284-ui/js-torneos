from pathlib import Path
p=Path("bomba3d/bomb-effects.js")
s=p.read_text()
def replace(old,new,label):
 global s
 n=s.count(old)
 if n!=1:raise RuntimeError(f"{label}: {n} matches")
 s=s.replace(old,new,1)
replace('const smoothstep=t=>t*t*(3-2*t);',
'''const smoothstep=t=>t*t*(3-2*t);
const clamp01=x=>Math.max(0,Math.min(1,x));
const FUSE_FULL=.30,FUSE_BASE_Y=.585,FUSE_MIN=.024;
/**
 * Ronda autoritativa de Supabase. Conserva la misma mecha durante cada pase,
 * y arranca una mecha nueva al cambiar ronda_inicio/vencimiento.
 */
export function roundFuseProgress(room,serverNowMs){
 if(room?.estado!=="playing")return 1;
 const begin=Date.parse(room.ronda_inicio);
 const end=Date.parse(room.vencimiento);
 if(!Number.isFinite(begin)||!Number.isFinite(end)||end<=begin||
    !Number.isFinite(serverNowMs))return 1;
 return clamp01((end-serverNowMs)/(end-begin));
}''',"round clock")
old=''' // Tiny pink highlights in the hands while holding a hot potato.
 return {
  root,
  update(time,reduced=false){
   if(reduced){ember.scale.setScalar(1);sparkle.intensity=.19;return;}
   const beat=Math.sin(time*.011),twinkle=Math.sin(time*.038);
   ember.scale.setScalar(1.05+.23*beat);
   sparkle.intensity=.26+.16*Math.abs(twinkle);
  }
 };'''
new=''' let fuseRatio=1;
 function setFuseProgress(value=1){
  fuseRatio=clamp01(Number.isFinite(value)?value:1);
  // Shrink from the TOP of the wick; its lower end stays in the cap.
  const length=Math.max(FUSE_MIN,FUSE_FULL*fuseRatio);
  wick.scale.y=length/FUSE_FULL;
  wick.position.set(.03,FUSE_BASE_Y+length/2,0);
  // Chase the burning tip as the wick becomes shorter (including its tilt).
  ember.position.set(.04+length*.165,FUSE_BASE_Y+length*.945+.045,.025);
  sparkle.position.copy(ember.position);
  return fuseRatio;
 }
 setFuseProgress(1);
 return {
  root,setFuseProgress,
  getFuseProgress:()=>fuseRatio,
  update(time,reduced=false,progress=1){
   const ratio=setFuseProgress(progress);
   const panic=1-ratio;
   if(reduced){
    ember.scale.setScalar(.92+panic*.30);
    sparkle.intensity=.20+panic*.40;
    return;
   }
   // Approaching zero: sparks flash faster and stronger, without faking
   // an explosion. The authoritative server still decides who is eliminated.
   const speed=.016+panic*panic*.082;
   const shimmer=Math.abs(Math.sin(time*speed));
   ember.scale.setScalar(.87+panic*.29+.18*shimmer);
   sparkle.intensity=.23+.24*shimmer+.46*panic;
  }
 };'''
replace(old,new,"fuse animation")
p.write_text(s)
p=Path("bomba3d/game.js");s=p.read_text()
def game(old,new,label):
 global s
 n=s.count(old)
 if n!=1:raise RuntimeError(f"{label}: {n} matches")
 s=s.replace(old,new,1)
game('createBombProp,handWorldPosition,makePassAnimation,HAND_OFFSET','createBombProp,handWorldPosition,makePassAnimation,HAND_OFFSET,roundFuseProgress',"import function")
game('} from "./bomb-effects.js?v=2";','} from "./bomb-effects.js?v=3";',"bomb cache bust")
game('let demoHolder=null,demoPending=null,demoEndsAt=0;',
'''let demoHolder=null,demoPending=null,demoEndsAt=0;
let demoFuseStartAt=0,demoFuseDeadlineAt=0,serverClockOffset=0;''',"state")
game('projectile=null;flight=null;demoHolder=null;demoPending=null;demoEndsAt=0;',
'''projectile=null;flight=null;demoHolder=null;demoPending=null;demoEndsAt=0;
 demoFuseStartAt=0;demoFuseDeadlineAt=0;''',"cleanup")
game('export function syncRoom(data){\n roomData=data;',
'''export function syncRoom(data,clockOffsetMs){
 roomData=data;
 // Reuse the same synchronized server clock used by the HUD countdown.
 if(Number.isFinite(clockOffsetMs))serverClockOffset=clockOffsetMs;
 else if(data?.servidor_ahora){
  const remote=Date.parse(data.servidor_ahora);
  if(Number.isFinite(remote))serverClockOffset=remote-Date.now();
 }''',"use authoritative timer")
game('demoHolder=null;demoPending=null;demoEndsAt=0;\n }\n if(!ready',
'''demoHolder=null;demoPending=null;demoEndsAt=0;
  demoFuseStartAt=0;demoFuseDeadlineAt=0;
 }
 if(!ready''',"real game precedence")
game('demoEndsAt=now+4300;\n return true;',
'''demoEndsAt=now+4300;
 demoFuseStartAt=now;demoFuseDeadlineAt=demoEndsAt;
 return true;''',"demo start clock")
game('demoEndsAt=time+flight.duration+1250;\n   sender.action="throw";',
'''demoEndsAt=time+flight.duration+1250;
   demoFuseDeadlineAt=demoEndsAt;
   sender.action="throw";''',"demo end fuse")
game('if(!flight&&!demoPending&&demoHolder&&time>=demoEndsAt)demoHolder=null;\n const current=',
'''if(!flight&&!demoPending&&demoHolder&&time>=demoEndsAt){
  demoHolder=null;demoFuseStartAt=0;demoFuseDeadlineAt=0;
 }
 const fuseProgress=demoFuseStartAt&&demoFuseDeadlineAt>demoFuseStartAt
  ?Math.max(0,Math.min(1,(demoFuseDeadlineAt-time)/(demoFuseDeadlineAt-demoFuseStartAt)))
  :roundFuseProgress(roomData,Date.now()+serverClockOffset);
 const current=''', "derive continuous fuse clock")
game('if(actor.bomb.root.visible)actor.bomb.update(time,reduced);',
     'if(actor.bomb.root.visible)actor.bomb.update(time,reduced,fuseProgress);',"held fuse")
game('projectile.update(time,reduced);','projectile.update(time,reduced,fuseProgress);',"flying fuse")
p.write_text(s)
p=Path("bomba.html");s=p.read_text()
assert s.count('window.Bomb3D?.syncRoom(room);')==1
s=s.replace('window.Bomb3D?.syncRoom(room);','window.Bomb3D?.syncRoom(room,offset);')
assert s.count('./bomba3d/game.js?v=8')==1
s=s.replace('./bomba3d/game.js?v=8','./bomba3d/game.js?v=9')
p.write_text(s)
print("SERVER_SYNCED_3D_BURNING_WICK_IMPLEMENTED")
