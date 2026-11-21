from pathlib import Path
p=Path('bomba3d/game.js');s=p.read_text()
a=''' if(data?.estado==="playing"){
  // A real round always takes precedence over a visual-only DEMO preview.
  if(demoHolder)flight=null;
  demoHolder=null;demoPending=null;demoEndsAt=0;'''
b=''' if(data?.estado==="playing"){
  // If the DEMO finished with a fake elimination, undo that pose before
  // using authoritative server state. The DEMO never touches Supabase.
  if(demoHolder||demoExplodedAt){
   flight=null;
   for(const p of data.jugadores||[]){
    const actor=actors.get(p.id);
    if(actor){
     actor.alive=Boolean(p.vivo);
     actor.action=actor.alive?"idle":"death";
    }
   }
  }
  demoHolder=null;demoPending=null;demoEndsAt=0;'''
assert s.count(a)==1;s=s.replace(a,b,1)
a=''' const demoStatus=el("bomb3dDemoStatus");
 if(demoStatus){'''
b=''' const demoExplodeButton=el("bomb3dDemoExplode");
 if(demoExplodeButton)demoExplodeButton.disabled=!(demoHolder&&demoFuseStartAt&&!demoExplodedAt);
 const demoStatus=el("bomb3dDemoStatus");
 if(demoStatus){'''
assert s.count(a)==1;s=s.replace(a,b,1)
p.write_text(s)
print('DEMO_CANCELS_IF_REAL_MATCH_BEGINS_AND_BUTTON_AUTODISABLES')
