from pathlib import Path
p=Path("bomba3d/game.js");s=p.read_text()
def rep(a,b,label):
 global s
 n=s.count(a)
 if n!=1:raise Exception(f"{label}: expected 1 found {n}")
 s=s.replace(a,b,1)
rep('let demoFuseStartAt=0,demoFuseDeadlineAt=0,serverClockOffset=0;',
'''let demoFuseStartAt=0,demoFuseDeadlineAt=0,serverClockOffset=0;
let demoSecondPass=null,demoVictimId=null,demoExplodedAt=0,demoFinishedAt=0;
const DEMO_FULL_DURATION_MS=20000,DEMO_FALL_HOLD_MS=4600;''',"additional demo state")
rep(' demoFuseStartAt=0;demoFuseDeadlineAt=0;\n}',
''' demoFuseStartAt=0;demoFuseDeadlineAt=0;
 demoSecondPass=null;demoVictimId=null;demoExplodedAt=0;demoFinishedAt=0;
}''',"cleanup")
rep('''  demoFuseStartAt=0;demoFuseDeadlineAt=0;
 }
 if(!ready''',
'''  demoFuseStartAt=0;demoFuseDeadlineAt=0;
  demoSecondPass=null;demoVictimId=null;demoExplodedAt=0;demoFinishedAt=0;
 }
 if(!ready''',"real game cancels demo")
start=s.index("export function demoThrow(){")
end=s.index("export function onGameTransition(",start)
s=s[:start]+'''export function demoThrow(){
 if(!ready||!roomData||roomData.estado!=="ready"||
    !String(roomData.titulo||"").startsWith("DEMO")||
    flight||demoPending||demoHolder||demoExplodedAt)return false;
 const living=(roomData.jugadores||[]).filter(p=>p.vivo&&actors.has(p.id));
 if(living.length<2)return false;
 const now=performance.now();
 const first=living[0],second=living[1],third=living[2]||second;
 demoHolder=first.id;
 demoPending={fromId:first.id,toId:second.id,when:now+4600};
 demoSecondPass=third.id!==second.id
  ?{fromId:second.id,toId:third.id,when:now+12000}:null;
 demoVictimId=third.id;
 demoFuseStartAt=now;
 demoFuseDeadlineAt=now+DEMO_FULL_DURATION_MS;
 demoEndsAt=demoFuseDeadlineAt;
 demoExplodedAt=0;demoFinishedAt=0;
 return true;
}
/** Manual explosion in the DEMO only. Never changes the server's player data. */
export function demoExplodeNow(){
 if(!ready||roomData?.estado!=="ready"||!demoHolder||
    !demoFuseStartAt||demoExplodedAt)return false;
 demoFuseDeadlineAt=performance.now();
 demoEndsAt=demoFuseDeadlineAt;
 demoPending=null;demoSecondPass=null;flight=null;
 return true;
}
'''+s[end:]
start=s.index("function animateHeldAndFlyingBomb(time,reduced){")
end=s.index("function animate(time){",start)
s=s[:start]+'''function animateHeldAndFlyingBomb(time,reduced){
 // Fictional demo: 20 real seconds, two passes, one explosion and fall.
 if(demoSecondPass&&time>=demoSecondPass.when&&!flight&&!demoPending&&!demoExplodedAt){
  demoPending=demoSecondPass;demoSecondPass=null;
 }
 if(demoPending&&time>=demoPending.when&&!demoExplodedAt){
  const sender=actors.get(demoPending.fromId),recipient=actors.get(demoPending.toId);
  if(sender?.alive&&recipient?.alive){
   flight=makePassAnimation({
    fromId:demoPending.fromId,toId:demoPending.toId,
    start:handWorldPosition(sender),end:handWorldPosition(recipient),
    startTime:time
   });
   demoHolder=recipient.playerId;
   sender.action="throw";sender.until=time+420;
   recipient.action="catch";recipient.until=time+flight.duration+450;
  }
  demoPending=null;
 }
 if(demoHolder&&demoFuseStartAt&&!demoExplodedAt&&time>=demoFuseDeadlineAt){
  // End of the fake round. Do not send a single RPC to Supabase.
  flight=null;demoPending=null;demoSecondPass=null;
  demoVictimId=demoHolder;
  const victim=actors.get(demoVictimId);
  if(victim){victim.alive=false;victim.action="death";}
  demoHolder=null;
  demoExplodedAt=time;
  demoFinishedAt=time+DEMO_FALL_HOLD_MS;
  window.JSBombDemoExplosion?.(demoVictimId);
 }
 if(demoExplodedAt&&time>=demoFinishedAt){
  const victim=actors.get(demoVictimId);
  if(victim){
   victim.alive=Boolean(roomData?.jugadores?.find(p=>p.id===demoVictimId)?.vivo);
   victim.action=victim.alive?"idle":"death";
  }
  demoExplodedAt=0;demoFinishedAt=0;demoVictimId=null;
  demoFuseStartAt=0;demoFuseDeadlineAt=0;demoEndsAt=0;
 }
 const fuseProgress=demoFuseStartAt&&demoFuseDeadlineAt>demoFuseStartAt
  ?Math.max(0,Math.min(1,(demoFuseDeadlineAt-time)/(demoFuseDeadlineAt-demoFuseStartAt)))
  :roundFuseProgress(roomData,Date.now()+serverClockOffset);
 const current=demoHolder||(roomData?.estado==="playing"?roomData.bomba_de:null);
 for(const [id,actor] of actors){
  if(actor.bomb){
   actor.bomb.root.visible=Boolean(current===id&&actor.alive&&!flight);
   if(actor.bomb.root.visible)actor.bomb.update(time,reduced,fuseProgress);
  }
 }
 const demoStatus=el("bomb3dDemoStatus");
 if(demoStatus){
  demoStatus.textContent=demoExplodedAt
   ?"💥 ¡BOOM! El muñeco se cayó. Se recuperará en unos segundos."
   :demoHolder&&demoFuseDeadlineAt>0
    ?"🔥 Prueba completa · quedan "+Math.max(0,Math.ceil((demoFuseDeadlineAt-time)/1000))+
      " segundos · mecha consumiéndose"
    :"🎮 Probá una secuencia de 20 segundos con lanzamientos, explosión y caída.";
 }
 if(!projectile)return;
 if(!flight){projectile.root.visible=false;return;}
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
 projectile.update(time,reduced,fuseProgress);
}
'''+s[end:]
rep('window.Bomb3D={syncRoom,syncPreview,onGameTransition,demoThrow,set3DEnabled,isEnabled:()=>ready};',
    'window.Bomb3D={syncRoom,syncPreview,onGameTransition,demoThrow,demoExplodeNow,set3DEnabled,isEnabled:()=>ready};',"host demo controls")
p.write_text(s)
p=Path("bomba3d/imported.js");s=p.read_text()
rep2=lambda *args:None
a='''   animatedRig.rotation.z=-1.20*deadAmount;
   animatedRig.position.y=-.35*deadAmount;
   return;'''
b='''   // Full tumble onto the floor, not just a slight lean.
   animatedRig.rotation.z=-Math.PI*.5*deadAmount;
   animatedRig.rotation.x=.12*deadAmount;
   animatedRig.position.y=-.12*deadAmount;
   return;'''
assert s.count(a)==1;s=s.replace(a,b,1)
p.write_text(s)
p=Path("bomba.html");s=p.read_text()
a=''' <button type="button" id="bomb3dDemoThrow" hidden>🎬 Ver bomba gigante · Agarrar y lanzar</button>'''
b=''' <button type="button" id="bomb3dDemoThrow" hidden>🎬 Probar ronda completa · 20 segundos</button>
 <button type="button" id="bomb3dDemoExplode" hidden disabled>💥 Explotar ahora</button>
 <small id="bomb3dDemoStatus" class="demoStatus" aria-live="polite"></small>'''
assert s.count(a)==1;s=s.replace(a,b,1)
# Remove an accidental escaped newline that had been printed on the page.
s=s.replace('</span>\\\\n <button type="button" id="bomb3dDemoThrow"', '</span>\\n <button type="button" id="bomb3dDemoThrow"')
a=''' const ok=window.Bomb3D?.demoThrow?.();
 if(!ok)el("bomb3dStatus").textContent="⏳ Esperá que cargue el 3D para probar el lanzamiento.";
});'''
b=''' const ok=window.Bomb3D?.demoThrow?.();
 if(ok)el("bomb3dDemoExplode").disabled=false;
 else el("bomb3dStatus").textContent="⏳ Esperá a que termine la prueba actual para empezar otra.";
});
el("bomb3dDemoExplode").addEventListener("click",()=>{
 const ok=window.Bomb3D?.demoExplodeNow?.();
 if(ok)el("bomb3dDemoExplode").disabled=true;
});'''
assert s.count(a)==1;s=s.replace(a,b,1)
a=''' const demoThrowButton=el("bomb3dDemoThrow");
 if(demoThrowButton)demoThrowButton.hidden=!(
  code==="BE5BBA5D2FA4"&&room.estado==="ready"
 );'''
b=''' const isDemo=code==="BE5BBA5D2FA4"&&room.estado==="ready";
 el("bomb3dDemoThrow").hidden=!isDemo;
 el("bomb3dDemoExplode").hidden=!isDemo;
 el("bomb3dDemoStatus").hidden=!isDemo;'''
assert s.count(a)==1;s=s.replace(a,b,1)
a='''function animateGameChanges(before,after){'''
assert s.count(a)==1;s=s.replace(a,'''// Same visual blast used by real eliminations, but local to the demo.
window.JSBombDemoExplosion=animateExplosion;
function animateGameChanges(before,after){''',1)
a='./bomba3d/game.js?v=9'
assert s.count(a)==1;s=s.replace(a,'./bomba3d/game.js?v=10',1)
p.write_text(s)
p=Path('bomba3d/game.css');s=p.read_text()
s+='''\n/* Safe, opt-in visual demonstration; no multiplayer actions. */\n.bomb3dToolbar #bomb3dDemoExplode{width:100%;min-height:38px;\n background:linear-gradient(120deg,#8e3045,#c54336);\n border:1px solid #f19b75;color:#fff7f4;border-radius:10px;font-weight:900}\n.bomb3dToolbar #bomb3dDemoExplode:disabled{opacity:.5}\n.bomb3dToolbar .demoStatus{display:block;width:100%;text-align:center;\n color:#dbeef5;font-size:12px;line-height:1.6}\n'''
p.write_text(s)
print("20_S_DEMO_PLUS_EXPLOSION_AND_FALL_BUILT")
