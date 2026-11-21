from pathlib import Path
p=Path("bomba3d/jelly.js")
s=p.read_text()
def rep(a,b,label):
 global s
 assert s.count(a)==1,(label,s.count(a))
 s=s.replace(a,b)
rep('const sph=new THREE.SphereGeometry(1,16,12);',
'''let seamlessGeometry=null;
export function setSeamlessGeometry(geometry){
 seamlessGeometry=geometry;
}
export function hasSeamlessGeometry(){return Boolean(seamlessGeometry);}
const sph=new THREE.SphereGeometry(1,16,12);''','provide shared mesh')
rep(' oval(inner,accent,"frontSheen",[-.10,1.10,.334],[.21,.4,.015]);',
' const frontSheen=oval(inner,accent,"frontSheen",[-.10,1.10,.334],[.21,.4,.015]);','store sheen')
rep(' // Optional accessories from the previous edit screen become genuine 3D objects.',
''' // This higher-quality version is one continuous watertight body surface.
 // Reuse a single BufferGeometry for all player avatars: color/eyes stay editable.
 if(c.costume3d==="plain" && seamlessGeometry){
  const seamless=mesh(inner,seamlessGeometry,base,"JS_Seamless_Rubber_Body",[0,0,0],[1,1,1]);
  parts.seamless=seamless;
  for(const oldPart of [torso,frontSheen,legL,legR,mainHead,face])oldPart.visible=false;
  leftArm.visible=false;rightArm.visible=false;
  eyeL.position.set(-.205,2.205,.538);eyeR.position.set(.205,2.205,.538);
  eyeL.scale.set(.107,.125,.064);eyeR.scale.set(.107,.125,.064);
 }

 // Optional accessories from the previous edit screen become genuine 3D objects.''','new continuous plain core')
rep('  inner.rotation.z=reduced?0:Math.sin(t*(dance?7:2.0))*(dance?.13:.045);',
'''  inner.rotation.z=reduced?0:Math.sin(t*(dance?7:2.0))*(dance?.13:.045) +
   (parts.seamless&&action==="receive"?.15*Math.sin(t*11):0);''','deform via body sway')
p.write_text(s)
print("SEAMLESS_CORE_HOOK_READY",s.count("seamlessGeometry"))
