from pathlib import Path
p=Path('bomba3d/game.js')
s=p.read_text()
def rep(old,new,label):
 global s
 c=s.count(old)
 if c!=1:raise RuntimeError(f'{label}: matches={c}')
 s=s.replace(old,new,1)
rep('import {createJellyAvatar,normalizeJelly,setSeamlessGeometry,hasSeamlessGeometry} from "./jelly.js?v=3";',
'''import {createJellyAvatar,normalizeJelly,setSeamlessGeometry,hasSeamlessGeometry} from "./jelly.js?v=3";
import {preloadOriginalModel,hasOriginalModel,createOriginalRubberActor} from "./imported.js?v=1";''','import adapter')
rep('let warningIssued=false,loadingSeamless=null;',
'''let warningIssued=false,loadingSeamless=null,loadingUploaded=null;
async function ensureUploaded(){
 if(hasOriginalModel())return;
 if(loadingUploaded)return loadingUploaded;
 loadingUploaded=preloadOriginalModel().then(()=>{
  if(!active||!arena)return;
  // Swap the default/classic characters to the EXACT GLB supplied by JS.
  // Existing animal costumes stay unchanged, and game state is unaffected.
  for(const [id,actor] of actors){
   if(actor.costume==="plain"){removeActor(actor,arena.scene);actors.delete(id);}
  }
  syncRoom(roomData);
  previewStamp="";
  syncPreview(previewData);
  announce("✅ Muñeco original GLB cargado, con texturas y ojos reales");
 }).catch(err=>{
  console.warn("Modelo GLB no disponible, conservamos el anterior:",err);
  announce("No cargó el archivo original. Se mantiene el muñeco anterior.");
  void ensureSeamless();
 }).finally(()=>{loadingUploaded=null;});
 return loadingUploaded;
}''','model loader')
rep('  syncPreview(previewData);\n  void ensureSeamless();\n  if(!frameId)', '  syncPreview(previewData);\n  void ensureUploaded();\n  if(!frameId)', 'start source first')
rep('''  if(!actor||actor.stamp!==stamp){
   if(actor)removeActor(actor,arena.scene);
   actor=createJellyAvatar(p.avatar||{});''',
'''  const wantsUploaded=(p.avatar?.costume3d||"plain")==="plain"&&hasOriginalModel();
  if(!actor||actor.stamp!==stamp||(wantsUploaded&&actor.kind!=="uploaded")){
   if(actor)removeActor(actor,arena.scene);
   actor=wantsUploaded?createOriginalRubberActor(p.avatar||{}):createJellyAvatar(p.avatar||{});''','live actors')
rep(''' studio.actor=createJellyAvatar(avatar);
 studio.scene.add(studio.actor.root);''',
''' studio.actor=(avatar.costume3d||"plain")==="plain"&&hasOriginalModel()
  ?createOriginalRubberActor(avatar):createJellyAvatar(avatar);
 studio.scene.add(studio.actor.root);''','preview imported')
rep(' announce("💣 "+actors.size+" muñequitos 3D en la mesa · editables y animados");',
''' announce("💣 "+actors.size+" personajes en la mesa · "+
  [...actors.values()].filter(a=>a.kind==="uploaded").length+" con el modelo original GLB");''','UI label')
p.write_text(s)
print('ACTUAL_UPLOADED_GLB_INTEGRATED_IN_GAME',len(s),'chars')
