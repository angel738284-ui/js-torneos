from pathlib import Path
p=Path("bomba3d/game.js");s=p.read_text()
def rep(a,b,label):
 global s
 n=s.count(a);assert n==1,(label,n)
 s=s.replace(a,b,1)
rep('import {createJellyAvatar,normalizeJelly} from "./jelly.js";',
'import {createJellyAvatar,normalizeJelly,setSeamlessGeometry,hasSeamlessGeometry} from "./jelly.js";','import')
rep('let warningIssued=false;',
'''let warningIssued=false,loadingSeamless=null;
async function ensureSeamless(){
 if(hasSeamlessGeometry())return;
 if(loadingSeamless)return loadingSeamless;
 loadingSeamless=(async()=>{
  const url=new URL("./seamless_body.bin",import.meta.url);
  const response=await fetch(url.href,{cache:"force-cache"});
  if(!response.ok)throw Error("El modelo 3D no está disponible");
  const bytes=await response.arrayBuffer(),view=new DataView(bytes);
  if(bytes.byteLength<28||String.fromCharCode(...new Uint8Array(bytes,0,4))!=="JSJB"||
   view.getUint32(4,true)!==1)throw Error("Modelo 3D inválido");
  const count=view.getUint32(8,true),indices=view.getUint32(12,true);
  const expected=16+count*24+indices*4;
  if(count<100||count>120000||indices<300||indices>1000000||expected!==bytes.byteLength)
   throw Error("Modelo 3D incompleto");
  // Copy slices into properly aligned little-endian typed buffers.
  const positions=new Float32Array(bytes.slice(16,16+count*12));
  const normals=new Float32Array(bytes.slice(16+count*12,16+count*24));
  const faces=new Uint32Array(bytes.slice(16+count*24));
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
  geometry.setAttribute("normal",new THREE.BufferAttribute(normals,3));
  geometry.setIndex(new THREE.BufferAttribute(faces,1));
  geometry.computeBoundingSphere();
  setSeamlessGeometry(geometry);
  // Replace only classic dolls; keep animals, game state and editor settings.
  if(active&&arena){
   for(const [id,actor] of actors){
    if(actor.costume==="plain"){removeActor(actor,arena.scene);actors.delete(id);}
   }
   syncRoom(roomData);
   previewStamp="";
   syncPreview(previewData);
  }
  announce("✅ Modelo clásico sin uniones disponible · personajes 3D activos");
 })().catch(err=>{
  console.warn("Se mantiene el modelo anterior:",err);
  announce("El muñeco clásico mejorado no cargó; seguimos usando los anteriores.");
 }).finally(()=>{loadingSeamless=null;});
 return loadingSeamless;
}''','loader')
rep('  syncPreview(previewData);\n  if(!frameId)',
'  syncPreview(previewData);\n  void ensureSeamless();\n  if(!frameId)','trigger model download')
p.write_text(s)
print("SEAMLESS_MODEL_LOADER_INSTALLED",len(s))
