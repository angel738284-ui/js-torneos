/**
 * JS Family Bomba Mortal · single GLB-only 3D game renderer.
 * Every user uses the same uploaded rubber model, with personalized wardrobe.
 * The Supabase multiplayer game and WhatsApp registration are unchanged.
 */
import * as THREE from "./vendor/three.module.js";
import {preloadOriginalModel,hasOriginalModel,createOriginalRubberActor} from "./imported.js?v=2";

const el=id=>document.getElementById(id);
const actors=new Map();
let arena=null,studio=null,roomData=null,previewData=null,previewStamp="";
let ready=false,frameId=0,lastTime=0,failureLogged=false,loading=null;
const reducedMotion=()=>Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
const status=text=>{const node=el("bomb3dStatus");if(node)node.textContent=text;};
const supported=()=>typeof window.WebGLRenderingContext!=="undefined";

function makeStage(parent,preview=false){
 const scene=new THREE.Scene();
 const renderer=new THREE.WebGLRenderer({
  alpha:true,antialias:preview,powerPreference:"low-power"
 });
 renderer.setPixelRatio(Math.min(1.25,window.devicePixelRatio||1));
 renderer.setClearColor(0,0);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.08;
 renderer.domElement.className=preview?"bomb3dStudioCanvas":"bomb3dWorldCanvas";
 renderer.domElement.setAttribute("aria-hidden","true");
 parent.append(renderer.domElement);
 const camera=new THREE.OrthographicCamera(-3,3,3,-3,.1,100);
 camera.position.set(0,0,35);
 camera.lookAt(0,0,0);
 scene.add(new THREE.HemisphereLight(0xf4f8ff,0x536d7b,1.6));
 const front=new THREE.DirectionalLight(0xffe6d1,2.0);
 front.position.set(-3,7,8);scene.add(front);
 const back=new THREE.DirectionalLight(0xbedaff,.72);
 back.position.set(4,3,-5);scene.add(back);
 return {scene,camera,renderer,parent,actor:null,width:0,height:0};
}
function resize(stage,width,height,zoom){
 const w=Math.max(1,Math.floor(width)),h=Math.max(1,Math.floor(height));
 if(stage.width!==w||stage.height!==h){
  stage.renderer.setSize(w,h,false);stage.width=w;stage.height=h;
 }
 stage.camera.left=-w/(2*zoom);stage.camera.right=w/(2*zoom);
 stage.camera.top=h/(2*zoom);stage.camera.bottom=-h/(2*zoom);
 stage.camera.updateProjectionMatrix();
}
function removeActor(actor,scene){
 if(!actor)return;
 scene?.remove(actor.root);
 actor.dispose();
}
function disposeStages(){
 if(frameId){cancelAnimationFrame(frameId);frameId=0;}
 for(const actor of actors.values())removeActor(actor,arena?.scene);
 actors.clear();
 if(studio?.actor)removeActor(studio.actor,studio.scene);
 for(const view of [studio,arena]){
  if(!view)continue;
  view.renderer.dispose();
  view.renderer.domElement.remove();
 }
 studio=null;arena=null;ready=false;previewStamp="";
}
function setPosition(actor,card,total,w,h){
 const x=parseFloat(card.style.left),y=parseFloat(card.style.top);
 if(!Number.isFinite(x)||!Number.isFinite(y))return;
 const small=w<500;
 const factor=small?(total>16?.47:total>10?.55:.69):(total>15?.64:.82);
 actor.root.scale.setScalar(factor);
 actor.root.position.set((x-w/2)/66,(h/2-y)/66-1.35*factor,0);
 actor.root.rotation.y=0;
}
function cardsByPlayer(){
 return new Map(Array.from(el("players")?.children||[]).map(card=>[card.dataset.playerId,card]));
}
export function syncRoom(data){
 roomData=data;
 if(!ready||!arena||!hasOriginalModel()||!data?.jugadores)return;
 const stage=el("tableStage");
 const w=stage?.clientWidth||360,h=stage?.clientHeight||630;
 const cards=cardsByPlayer(),ids=new Set(data.jugadores.map(p=>p.id));
 for(const [id,actor] of actors){
  if(!ids.has(id)){removeActor(actor,arena.scene);actors.delete(id);}
 }
 for(const p of data.jugadores){
  const card=cards.get(p.id);
  if(!card)continue;
  const avatar=p.avatar||{},signature=JSON.stringify(avatar);
  let actor=actors.get(p.id);
  if(!actor||actor.stamp!==signature){
   if(actor)removeActor(actor,arena.scene);
   actor=createOriginalRubberActor(avatar);
   actor.stamp=signature;actor.playerId=p.id;
   actor.action=p.vivo?"idle":"death";
   actor.alive=Boolean(p.vivo);actor.until=0;
   arena.scene.add(actor.root);actors.set(p.id,actor);
  }
  if(actor.alive&&!p.vivo){actor.alive=false;actor.action="death";}
  setPosition(actor,card,data.jugadores.length,w,h);
 }
 stage?.classList.add("is3d");
 status("🟢 "+actors.size+" muñequitos GLB con ropa 3D personalizada");
}
export function syncPreview(avatar){
 previewData=avatar;
 if(!ready||!studio||!hasOriginalModel()||!avatar)return;
 const stamp=JSON.stringify(avatar);
 if(stamp===previewStamp)return;
 previewStamp=stamp;
 removeActor(studio.actor,studio.scene);
 studio.actor=createOriginalRubberActor(avatar);
 studio.scene.add(studio.actor.root);
 studio.actor.root.scale.setScalar(.84);
 studio.actor.root.position.set(0,-1.42*.84,0);
 el("preview")?.classList.add("is3d");
}
export function onGameTransition(before,after){
 if(!ready||!before||!after)return;
 const old=new Map((before.jugadores||[]).map(p=>[p.id,p]));
 for(const p of after.jugadores||[]){
  const actor=actors.get(p.id);
  if(actor&&old.get(p.id)?.vivo&&!p.vivo){
   actor.alive=false;actor.action="death";
  }
 }
 if(before.bomba_de&&after.bomba_de&&before.bomba_de!==after.bomba_de){
  const now=performance.now();
  for(const id of [before.bomba_de,after.bomba_de]){
   const actor=actors.get(id);
   if(actor?.alive){actor.action="receive";actor.until=now+1300;}
  }
 }
}
function animate(time){
 frameId=requestAnimationFrame(animate);
 if(document.visibilityState==="hidden")return;
 const delta=time-lastTime;
 const ms=actors.size>16?65:actors.size>8?50:33;
 if(delta<ms)return;
 lastTime=time;
 const seconds=Math.min(.09,Math.max(0,delta/1000||.033));
 const reduced=reducedMotion();
 try{
  if(arena){
   const stage=el("tableStage");
   const w=stage?.clientWidth||360,h=stage?.clientHeight||630;
   resize(arena,w,h,66);
   const cards=cardsByPlayer();
   for(const [id,a] of actors){
    const card=cards.get(id);
    if(card)setPosition(a,card,actors.size,w,h);
    if(a.action==="receive"&&time>a.until)a.action="idle";
    a.update(seconds,a.action,reduced);
   }
   arena.renderer.render(arena.scene,arena.camera);
  }
  if(studio){
   const view=el("preview");
   resize(studio,view?.clientWidth||290,view?.clientHeight||230,80);
   if(studio.actor){
    studio.actor.update(seconds,previewData?.pose==="dance"?"dance":"idle",reduced);
    studio.actor.root.rotation.y=reduced?0:Math.sin(time*.00033)*.22;
   }
   studio.renderer.render(studio.scene,studio.camera);
  }
 }catch(error){
  if(!failureLogged)console.warn("Fallo de render 3D:",error);
  failureLogged=true;
  disposeStages();
  status("⚠️ El navegador no pudo mostrar 3D. Probá abrir la página en Chrome.");
 }
}
export function set3DEnabled(){
 if(ready)return true;
 if(!supported()){
  status("⚠️ Necesitás un navegador con gráficos 3D (WebGL). Abrí en Chrome.");
  return false;
 }
 if(loading)return false;
 try{
  arena=makeStage(el("tableStage"),false);
  studio=makeStage(el("preview"),true);
  loading=preloadOriginalModel().then(()=>{
   if(!arena||!studio)return;
   ready=true;
   syncRoom(roomData);
   previewStamp="";
   syncPreview(previewData);
   if(!frameId)frameId=requestAnimationFrame(animate);
   status("🟢 Modelo GLB listo · ropa y accesorios en 3D");
  }).catch(error=>{
   console.warn("No se pudo cargar el GLB original:",error);
   disposeStages();
   status("⚠️ No pude cargar el modelo 3D. Recargá o probá desde Chrome.");
  }).finally(()=>{loading=null;});
  status("⏳ Cargando modelo GLB y ropa 3D…");
  return true;
 }catch(error){
  console.warn("Sin WebGL:",error);
  disposeStages();
  status("⚠️ No fue posible activar gráficos 3D. Probá con Chrome.");
  return false;
 }
}
export function initBomb3D(){
 window.Bomb3D={syncRoom,syncPreview,onGameTransition,set3DEnabled,isEnabled:()=>ready};
 previewData=Object.fromEntries([...document.querySelectorAll(".avatarEditor select")].map(x=>[x.id,x.value]));
 set3DEnabled();
}
initBomb3D();
