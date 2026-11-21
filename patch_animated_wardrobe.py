from pathlib import Path
p=Path("bomba3d/imported.js")
s=p.read_text()
def rep(a,b,tag):
 global s
 n=s.count(a)
 assert n==1,(tag,n)
 s=s.replace(a,b,1)
rep(' const original=loaded.gltf.scene.clone(true);',
''' const animatedRig=new THREE.Group();
 animatedRig.name="JS_3D_ANIMATED_BODY_AND_CLOTHING";
 root.add(animatedRig);
 const original=loaded.gltf.scene.clone(true);''',"rig init")
rep(' root.add(original);\n let baseMesh=null;',
' animatedRig.add(original);\n let baseMesh=null;',"rig owns original")
rep(' const wardrobe=dressOriginalRubber(root,options,baseMesh.geometry,originalBounding);',
' const wardrobe=dressOriginalRubber(animatedRig,options,baseMesh.geometry,originalBounding);',"rig owns clothes")
rep('''   original.rotation.z=-1.20*deadAmount;
   original.position.y=-originalBounding.min.y*scale-.35*deadAmount;''',
'''   animatedRig.rotation.z=-1.20*deadAmount;
   animatedRig.position.y=-.35*deadAmount;''',"death moves rig")
rep('''  original.rotation.z=reduced?0:Math.sin(elapsed*(dancing?7.0:2.1))*(dancing?.16:wave?.10:.045);
  original.position.y=-originalBounding.min.y*scale+(reduced?0:Math.sin(elapsed*(dancing?7.0:2.5))*(dancing?.065:.035));
  original.rotation.y=reduced?0:Math.sin(elapsed*1.6)*.06;''',
'''  animatedRig.rotation.z=reduced?0:Math.sin(elapsed*(dancing?7.0:2.1))*(dancing?.16:wave?.10:.045);
  animatedRig.position.y=(reduced?0:Math.sin(elapsed*(dancing?7.0:2.5))*(dancing?.065:.035));
  animatedRig.rotation.y=reduced?0:Math.sin(elapsed*1.6)*.06;''',"motion with wardrobe")
p.write_text(s)
print("WARDROBE_ATTACHED_TO_ANIMATED_BODY")
p=Path('bomba3d/game.css')
css=p.read_text()
css+='''
/* 3D-only Bomba Mortal: no old 2D character slots or model switcher. */
.bomb3dToolbar{justify-content:center;min-height:44px}
.bomb3dToolbar span{width:100%;text-align:center;font-size:12px;font-weight:800}
.tableStage .player .char{display:none!important}
.tableStage .player .modelSpace{display:block;flex:1;min-height:87px;min-width:40px;pointer-events:none}
.tableStage.is3d .player .modelSpace{visibility:visible}
.avatarEditor .preview{min-height:265px;overflow:hidden}
.avatarEditor .preview .previewWaiting{position:absolute;inset:0;display:flex;align-items:center;
 justify-content:center;text-align:center;color:#b9e9dd;font-size:13px;pointer-events:none}
.avatarEditor .preview.is3d .previewWaiting{display:none}
.avatarEditor .customSections .options{grid-template-columns:repeat(2,minmax(0,1fr))}
.avatarEditor .customSections label{min-width:0}
.avatarEditor .customSections label:has(#topStyle),
.avatarEditor .customSections label:has(#bottomStyle),
.avatarEditor .customSections label:has(#bodyColor3d){grid-column:1/-1}
.avatarEditor .saveStatus{margin:2px 0 5px}
.avatarEditor .preview:before{content:"VISTA PREVIA 3D";}
@media(max-width:440px){.avatarEditor .customSections .options{grid-template-columns:1fr}}
'''
p.write_text(css)
print("3D_ONLY_STYLES_WRITTEN",len(css))
