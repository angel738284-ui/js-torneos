from pathlib import Path
p=Path('bomba3d/game.js')
s=p.read_text()
def rep(old,new,label):
 global s
 n=s.count(old)
 if n!=1:raise RuntimeError(f"{label}: {n}")
 s=s.replace(old,new,1)
rep('let projectile=null,flight=null;',
'''let projectile=null,flight=null;
let demoHolder=null,demoPending=null,demoEndsAt=0;''',"demo state")
rep(' projectile=null;flight=null;',
''' projectile=null;flight=null;demoHolder=null;demoPending=null;demoEndsAt=0;''',"demo cleanup")
rep(' roomData=data;\n if(!ready||!arena',
''' roomData=data;
 if(data?.estado==="playing"){demoHolder=null;demoPending=null;demoEndsAt=0;}
 if(!ready||!arena''',"clear demo on real gameplay")
needle='export function onGameTransition(before,after){'
assert s.count(needle)==1
code='''/**
 * Visual-only pass in the fictional demo room. No RPC calls, no scores,
 * and never available during an actual game.
 */
export function demoThrow(){
 if(!ready||!roomData||roomData.estado==="playing"||
    !String(roomData.titulo||"").startsWith("DEMO")||
    flight||demoPending)return false;
 const living=(roomData.jugadores||[]).filter(p=>p.vivo&&actors.has(p.id));
 if(living.length<2)return false;
 const now=performance.now();
 const from=living[0],to=living[1];
 demoHolder=from.id;
 demoPending={fromId:from.id,toId:to.id,when:now+650};
 demoEndsAt=now+3000;
 return true;
}
'''
s=s.replace(needle,code+needle,1)
rep(''' const current=roomData?.estado==="playing"?roomData.bomba_de:null;
 // A single holder''',
''' if(demoPending&&time>=demoPending.when){
  const sender=actors.get(demoPending.fromId),recipient=actors.get(demoPending.toId);
  if(sender&&recipient){
   flight=makePassAnimation({
    fromId:demoPending.fromId,toId:demoPending.toId,
    start:handWorldPosition(sender),end:handWorldPosition(recipient),
    startTime:time
   });
   demoHolder=recipient.playerId;
   demoEndsAt=time+flight.duration+1250;
   sender.action="throw";sender.until=time+420;
   recipient.action="catch";recipient.until=demoEndsAt;
  }
  demoPending=null;
 }
 if(!flight&&!demoPending&&demoHolder&&time>=demoEndsAt)demoHolder=null;
 const current=demoHolder||(roomData?.estado==="playing"?roomData.bomba_de:null);
 // A single holder''',"demo preview animated")
rep('window.Bomb3D={syncRoom,syncPreview,onGameTransition,set3DEnabled,isEnabled:()=>ready};',
'window.Bomb3D={syncRoom,syncPreview,onGameTransition,demoThrow,set3DEnabled,isEnabled:()=>ready};',"expose to demo button")
p.write_text(s)
p=Path("bomba.html");s=p.read_text()
rep2=lambda a,b,tag:None
a='<span id="bomb3dStatus" role="status" aria-live="polite">⏳ Cargando personajes GLB y ropa 3D…</span>'
b=a+'\\n <button type="button" id="bomb3dDemoThrow" hidden>🎬 Ver pase de prueba · Solo animación</button>'
assert s.count(a)==1;s=s.replace(a,b,1)
a='el("passBomb").addEventListener("click",()=>void passSelected());'
b=a+'''
el("bomb3dDemoThrow").addEventListener("click",()=>{
 const ok=window.Bomb3D?.demoThrow?.();
 if(!ok)el("bomb3dStatus").textContent="⏳ Esperá que cargue el 3D para probar el lanzamiento.";
});'''
assert s.count(a)==1;s=s.replace(a,b,1)
a=' const total=room.jugadores?.length||0;'
b=a+'''
 const demoThrowButton=el("bomb3dDemoThrow");
 if(demoThrowButton)demoThrowButton.hidden=!(
  code==="BE5BBA5D2FA4"&&room.estado!=="playing"&&room.estado!=="finished"
 );'''
assert s.count(a)==1;s=s.replace(a,b,1)
p.write_text(s)
p=Path('bomba3d/game.css');s=p.read_text()
s+='''\n/* Demo flight previews never touch multiplayer RPC. */\n.bomb3dToolbar{flex-wrap:wrap;gap:8px}\n.bomb3dToolbar #bomb3dDemoThrow{width:100%;min-height:38px;\n background:linear-gradient(120deg,#304e66,#276f73);border:1px solid #58a9a1;\n color:#dffdf7;border-radius:10px;font-size:12px;font-weight:800}\n'''
p.write_text(s)
print('VIEWABLE_NON_INTERACTIVE_DEMO_THROW_ADDED')
