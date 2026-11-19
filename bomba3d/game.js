/**
 * JS Family Bomba Mortal · single GLB-only 3D game renderer.
 * Every user uses the same uploaded rubber model, with personalized wardrobe.
 * The Supabase multiplayer game and WhatsApp registration are unchanged.
 */
import * as THREE from "./vendor/three.module.js";
import {preloadOriginalModel,hasOriginalModel,createOriginalRubberActor} from "./imported.js?v=5";
import {
 createBombProp,handWorldPosition,makePassAnimation,HAND_OFFSET,roundFuseProgress
} from "./bomb-effects.js?v=3";

const el=id=>document.getElementById(id);
const actors=new Map();
let arena=null,studio=null,roomData=null,previewData=null,previewStamp="";
let ready=false,frameId=0,lastTime=0,failureLogged=false,loading=null;
let projectile=null,flight=null;
let demoHolder=null,demoPending=null,demoEndsAt=0;
let demoFuseStartAt=0,demoFuseDeadlineAt=0,serverClockOffset=0;
let demoSecondPass=null,demoVictimId=null,demoExplodedAt=0,demoFinishedAt=0;
const DEMO_FULL_DURATION_MS=20000,DEMO_FALL_HOLD_MS=4600;
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
 const stage={scene,camera,renderer,parent,actor:null,width:0,height:0};
 if(!preview){
  projectile=createBombProp();
  projectile.root.name="JS_3D_FLYING_BOMB";
  projectile.root.visible=false;
  scene.add(projectile.root);
 }
 return stage;
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
 projectile=null;flight=null;demoHolder=null;demoPending=null;demoEndsAt=0;
 demoFuseStartAt=0;demoFuseDeadlineAt=0;
 demoSecondPass=null;demoVictimId=null;demoExplodedAt=0;demoFinishedAt=0;
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
export function syncRoom(data,clockOffsetMs){
 roomData=data;
 // Reuse the same synchronized server clock used by the HUD countdown.
 if(Number.isFinite(clockOffsetMs))serverClockOffset=clockOffsetMs;
 else if(data?.servidor_ahora){
  const remote=Date.parse(data.servidor_ahora);
  if(Number.isFinite(remote))serverClockOffset=remote-Date.now();
 }
 if(data?.estado==="playing"){
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
  demoHolder=null;demoPending=null;demoEndsAt=0;
  demoFuseStartAt=0;demoFuseDeadlineAt=0;
  demoSecondPass=null;demoVictimId=null;demoExplodedAt=0;demoFinishedAt=0;
 }
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
   actor.bomb=createBombProp();
   actor.bomb.root.position.set(...HAND_OFFSET);
   (actor.handAnchor||actor.root).add(actor.bomb.root);
   actor.bomb.root.visible=false;
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
/**
 * Visual-only pass in the fictional demo room. No RPC calls, no scores,
 * and never available during an actual game.
 */
export function demoThrow(){
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
export function onGameTransition(before,after){
 if(!ready||!before||!after)return;
 const old=new Map((before.jugadores||[]).map(p=>[p.id,p]));
 const newDeaths=(after.jugadores||[]).filter(p=>old.get(p.id)?.vivo&&!p.vivo);
 for(const p of newDeaths){
  const actor=actors.get(p.id);
  if(actor){actor.alive=false;actor.action="death";}
 }
 // The game server is authoritative: ONLY a confirmed holder change starts
 // a flight. Clicking the button cannot launch a bomb on an API error.
 if(before.estado!=="playing"||after.estado!=="playing"||
    newDeaths.length||!before.bomba_de||!after.bomba_de||
    before.bomba_de===after.bomba_de||before.ronda!==after.ronda){
  if(after.estado!=="playing"||newDeaths.length)flight=null;
  return;
 }
 const sender=actors.get(before.bomba_de);
 const receiver=actors.get(after.bomba_de);
 if(!sender||!receiver||!receiver.alive)return;
 const origin=handWorldPosition(sender),destination=handWorldPosition(receiver);
 if(!origin||!destination)return;
 const now=performance.now();
 flight=makePassAnimation({
  fromId:before.bomba_de,toId:after.bomba_de,
  start:origin,end:destination,startTime:now
 });
 sender.action="throw";sender.until=now+Math.min(450,flight.duration*.58);
 receiver.action="catch";receiver.until=now+flight.duration+450;
}
function animateHeldAndFlyingBomb(time,reduced){
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
 const demoExplodeButton=el("bomb3dDemoExplode");
 if(demoExplodeButton)demoExplodeButton.disabled=!(demoHolder&&demoFuseStartAt&&!demoExplodedAt);
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
  if(recipient?.bomb&&current===recipient.playerId){
   recipient.bomb.root.visible=true;
   // Keep the same consumed length on the exact frame of the catch.
   recipient.bomb.update(time,reduced,fuseProgress);
  }
  return;
 }
 projectile.root.visible=true;
 projectile.root.position.copy(flight.point(time));
 projectile.root.rotation.set(time*.002,time*.003,time*.004);
 projectile.update(time,reduced,fuseProgress);
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
    if(["throw","catch","receive"].includes(a.action)&&time>a.until)a.action="idle";
    const holderId=demoHolder||(roomData?.estado==="playing"?roomData.bomba_de:null);
    const isHolder=holderId===id&&a.alive&&!flight;
    const playingAction=isHolder&&a.action==="idle"?"hold":a.action;
    a.update(seconds,playingAction,reduced);
   }
   animateHeldAndFlyingBomb(time,reduced);
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
 window.Bomb3D={syncRoom,syncPreview,onGameTransition,demoThrow,demoExplodeNow,set3DEnabled,isEnabled:()=>ready};
 previewData=Object.fromEntries([...document.querySelectorAll(".avatarEditor select")].map(x=>[x.id,x.value]));
 set3DEnabled();
}
initBomb3D();
