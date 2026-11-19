/**
 * Bomba Mortal JS Family — original animated jelly characters.
 * One low-cost WebGL canvas for the entire table and one editor preview.
 * No copied game character models, no GLB downloads.
 */
import * as THREE from "./vendor/three.module.js";
import {createJellyAvatar,normalizeJelly,setSeamlessGeometry,hasSeamlessGeometry} from "./jelly.js?v=3";

const el=id=>document.getElementById(id);
const actors=new Map();
let active=false,arena=null,studio=null,roomData=null,previewData=null;
let previewStamp="",frameId=0,lastTime=0,reduced=false;
let warningIssued=false,loadingSeamless=null;
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
}
const supported=()=>typeof window.WebGLRenderingContext!=="undefined";
function announce(s){const e=el("bomb3dStatus");if(e)e.textContent=s;}
function lowMotion(){return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);}
function storageGet(){try{return localStorage.getItem("js-bomba-modelos-3d")!=="off";}catch{return true;}}
function storageSet(v){try{localStorage.setItem("js-bomba-modelos-3d",v?"on":"off");}catch{}}

function createStage(parent,preview=false){
 const scene=new THREE.Scene();
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:preview,powerPreference:"low-power"});
 renderer.setPixelRatio(Math.min(1.25,window.devicePixelRatio||1));
 renderer.setClearColor(0,0);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.domElement.className=preview?"bomb3dStudioCanvas":"bomb3dWorldCanvas";
 renderer.domElement.setAttribute("aria-hidden","true");
 parent.append(renderer.domElement);
 const camera=new THREE.OrthographicCamera(-3,3,3,-3,.1,100);
 camera.position.set(0,0,35);camera.lookAt(0,0,0);
 scene.add(new THREE.HemisphereLight(0xfaf9ff,0x436a8a,2.45));
 const sunlight=new THREE.DirectionalLight(0xffe5cd,2.25);
 sunlight.position.set(-3,8,8);scene.add(sunlight);
 const blue=new THREE.DirectionalLight(0x9fdcff,1.2);blue.position.set(5,2,-3);scene.add(blue);
 return {parent,scene,renderer,camera,preview,actor:null,lastW:0,lastH:0};
}
function resize(o,width,height,zoom){
 width=Math.max(1,Math.round(width));height=Math.max(1,Math.round(height));
 if(width!==o.lastW||height!==o.lastH){
  o.renderer.setSize(width,height,false);
  o.lastW=width;o.lastH=height;
 }
 o.camera.left=-width/(2*zoom);
 o.camera.right=width/(2*zoom);
 o.camera.top=height/(2*zoom);
 o.camera.bottom=-height/(2*zoom);
 o.camera.updateProjectionMatrix();
}
function removeActor(actor,scene){
 if(!actor)return;
 scene.remove(actor.root);
 actor.dispose();
}
function closeStage(o){
 if(!o)return;
 o.renderer.dispose();
 o.renderer.domElement.remove();
}
function hide3D(){
 el("tableStage")?.classList.remove("is3d");
 el("preview")?.classList.remove("is3d");
}
function stop(){
 if(frameId){cancelAnimationFrame(frameId);frameId=0;}
 for(const actor of actors.values())removeActor(actor,arena?.scene);
 actors.clear();
 if(studio){removeActor(studio.actor,studio.scene);closeStage(studio);studio=null;}
 if(arena){closeStage(arena);arena=null;}
 previewStamp="";hide3D();
}
function refreshButton(){
 const b=el("bomb3dToggle");if(!b)return;
 b.textContent=active?"🟢 Muñequitos 3D activados · Cambiar a 2D":"🟠 Activar muñequitos 3D";
 b.setAttribute("aria-pressed",String(active));
}
export function set3DEnabled(value){
 if(!value||!supported()){
  active=false;stop();refreshButton();storageSet(false);
  announce("Modo 2D ligero activado.");
  return false;
 }
 if(active)return true;
 try{
  const stage=el("tableStage"),preview=el("preview");
  if(!stage||!preview)throw Error("No se encontró la arena o el editor");
  arena=createStage(stage,false);
  studio=createStage(preview,true);
  active=true;previewStamp="";
  refreshButton();storageSet(true);
  announce("Cargando muñequitos 3D originales…");
  syncRoom(roomData);
  syncPreview(previewData);
  void ensureSeamless();
  if(!frameId)frameId=requestAnimationFrame(animate);
  return true;
 }catch(err){
  console.warn("3D desactivado:",err);
  active=false;stop();refreshButton();storageSet(false);
  announce("WebGL no disponible. El modo 2D sigue funcionando.");
  return false;
 }
}
function setPosition(actor,card,total,stageW,stageH){
 const x=parseFloat(card.style.left),y=parseFloat(card.style.top);
 if(!Number.isFinite(x)||!Number.isFinite(y))return;
 const small=stageW<500;
 const factor=small?(total>16?.47:total>10?.55:.69):(total>15?.64:.82);
 actor.root.scale.setScalar(factor);
 // The local avatar has its feet at y≈0 and head at y≈2.5.
 actor.root.position.set((x-stageW/2)/66,(stageH/2-y)/66-1.35*factor,0);
 actor.root.rotation.y=0;
}
export function syncRoom(data){
 roomData=data;
 if(!active||!arena||!data?.jugadores)return;
 const cardRoot=el("players"),stage=el("tableStage");
 const cards=Array.from(cardRoot?.children||[]);
 const width=stage?.clientWidth||360,height=stage?.clientHeight||630;
 const aliveIds=new Set(data.jugadores.map(p=>p.id));
 for(const [id,actor] of actors){
  if(!aliveIds.has(id)){removeActor(actor,arena.scene);actors.delete(id);}
 }
 for(const p of data.jugadores){
  const card=cards.find(c=>c.dataset.playerId===p.id);
  if(!card)continue;
  const stamp=JSON.stringify(p.avatar||{});
  let actor=actors.get(p.id);
  if(!actor||actor.stamp!==stamp){
   if(actor)removeActor(actor,arena.scene);
   actor=createJellyAvatar(p.avatar||{});
   actor.stamp=stamp;actor.playerId=p.id;actor.alive=Boolean(p.vivo);
   actor.action=p.vivo?"idle":"death";actor.until=0;
   arena.scene.add(actor.root);actors.set(p.id,actor);
  }
  if(actor.alive&&!p.vivo){
   actor.alive=false;actor.action="death";
  }
  setPosition(actor,card,data.jugadores.length,width,height);
 }
 el("tableStage")?.classList.add("is3d");
 announce("💣 "+actors.size+" muñequitos 3D en la mesa · editables y animados");
}
export function syncPreview(avatar){
 previewData=avatar;
 if(!active||!studio||!avatar)return;
 const stamp=JSON.stringify(avatar);
 if(previewStamp===stamp)return;
 previewStamp=stamp;
 removeActor(studio.actor,studio.scene);
 studio.actor=createJellyAvatar(avatar);
 studio.scene.add(studio.actor.root);
 studio.actor.root.scale.setScalar(.84);
 studio.actor.root.position.set(0,-1.42*.84,0);
 el("preview")?.classList.add("is3d");
}
export function onGameTransition(before,after){
 if(!active||!before||!after)return;
 const old=new Map((before.jugadores||[]).map(p=>[p.id,p]));
 for(const p of after.jugadores||[]){
  const a=actors.get(p.id);
  if(a&&old.get(p.id)?.vivo&&!p.vivo){a.alive=false;a.action="death";}
 }
 if(before.bomba_de&&after.bomba_de&&before.bomba_de!==after.bomba_de){
  const receiver=actors.get(after.bomba_de),sender=actors.get(before.bomba_de);
  const until=performance.now()+1300;
  for(const actor of [receiver,sender])if(actor?.alive){actor.action="receive";actor.until=until;}
 }
}
function animate(time){
 frameId=active?requestAnimationFrame(animate):0;
 if(!active)return;
 if(document.visibilityState==="hidden")return;
 const interval=actors.size>16?65:actors.size>8?50:33;
 if(time-lastTime<interval)return;
 const delta=Math.min(.09,Math.max(0,(time-lastTime)/1000||.033));
 lastTime=time;
 const still=lowMotion();
 try{
  if(arena){
   const stage=el("tableStage");
   const width=stage?.clientWidth||360,height=stage?.clientHeight||630;
   resize(arena,width,height,66);
   const cards=Array.from(el("players")?.children||[]);
   for(const [id,a] of actors){
    const card=cards.find(c=>c.dataset.playerId===id);
    if(card)setPosition(a,card,actors.size,width,height);
    if(a.action==="receive"&&time>a.until)a.action="idle";
    a.update(delta,a.action,still);
   }
   arena.renderer.render(arena.scene,arena.camera);
  }
  if(studio){
   const w=el("preview")?.clientWidth||290,h=el("preview")?.clientHeight||240;
   resize(studio,w,h,80);
   if(studio.actor){
    studio.actor.update(delta,previewData?.pose==="dance"?"dance":"idle",still);
    studio.actor.root.rotation.y=still?0:Math.sin(time*.00033)*.24;
   }
   studio.renderer.render(studio.scene,studio.camera);
  }
 }catch(err){
  if(!warningIssued)console.warn("Error 3D de Bomba Mortal:",err);
  warningIssued=true;set3DEnabled(false);
 }
}
export function initBomb3D(){
 const button=el("bomb3dToggle");
 if(!button)return;
 window.Bomb3D={syncRoom,syncPreview,onGameTransition,set3DEnabled,isEnabled:()=>active};
 button.addEventListener("click",()=>set3DEnabled(!active));
 previewData=Object.fromEntries([...document.querySelectorAll(".avatarEditor select")].map(x=>[x.id,x.value]));
 if(storageGet()&&!lowMotion()&&!(navigator?.deviceMemory<=2))set3DEnabled(true);
 else{refreshButton();announce("Modo 2D ligero. Tocá el botón para probar los muñequitos 3D.");}
}
initBomb3D();
