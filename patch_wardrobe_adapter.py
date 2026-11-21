from pathlib import Path
p=Path("bomba3d/imported.js")
s=p.read_text()
def rep(old,new,label):
 global s
 count=s.count(old)
 assert count==1,(label,count)
 s=s.replace(old,new,1)
rep('import {GLTFLoader} from "./vendor/GLTFLoader.js";',
'normalize', 'noop') if False else None
rep('import {GLTFLoader} from "./vendor/GLTFLoader.js";',
'''import {GLTFLoader} from "./vendor/GLTFLoader.js";
import {dressOriginalRubber} from "./wardrobe.js?v=1";''',"import wardrobe")
rep(' root.add(original);\n let elapsed=0,deadAmount=0;',
''' root.add(original);
 let baseMesh=null;
 loaded.gltf.scene.traverse(o=>{if(o.isMesh&&!baseMesh)baseMesh=o;});
 if(!baseMesh)throw Error("El GLB no tiene una malla para diseñar ropa");
 const wardrobe=dressOriginalRubber(root,options,baseMesh.geometry,originalBounding);
 let elapsed=0,deadAmount=0;''',"mesh conforming outfits")
rep('  elapsed+=Math.min(.10,delta||0);\n  if(action==="death"){',
'''  elapsed+=Math.min(.10,delta||0);
  wardrobe.update(elapsed,reduced);
  if(action==="death"){''',"animate wardrobe")
rep(' const dispose=()=>{for(const m of materials)m.dispose();};',
''' const dispose=()=>{
  wardrobe.dispose();
  for(const m of materials)m.dispose();
 };''',"dispose 3d assets")
p.write_text(s)
print("GLB_WARDROBE_HOOK_COMPLETE")
