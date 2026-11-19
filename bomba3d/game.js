/**
 * JS Family Bomba Mortal: one lightweight Three.js scene for every table character.
 * Models: Quaternius CC0 GLB packs; original controller, no Ducz app code copied.
 * Logic and WhatsApp authorization remain in the existing Bomba Mortal page.
 */
import * as THREE from "three";
import {GLTFLoader} from "./vendor/GLTFLoader.js";
import {clone as cloneSkeleton} from "./vendor/SkeletonUtils.js";

const PACKS={
 Male:["Adventurer","Beach","Casual_2","Casual_Hoodie","Farmer","King","Punk","Spacesuit","Suit","Swat","Worker"],
 Female:["Adventurer","Casual","Formal","Medieval","Punk","SciFi","Soldier","Suit","Witch","Worker"]
};
const OUTFITS=new Set(Object.entries(PACKS).flatMap(([gender,names])=>names.map(name=>gender+"/"+name)));
const DEFAULTS={man:"Male/Casual_Hoodie",woman:"Female/Casual"};
const SKIN_HEX=/^#[0-9a-fA-F]{6}$/;
const COLOR_AREAS={skin:["skin"],hair:["hair"],shirt:["purple","pink","orange","blue","green","suit","shirt","cloth","fabric","red","yellow","jacket","hoodie","lightblue","darkblue"],pants:["trousers","pants","jeans"],shoes:["shoe","boots","foot"]};
const SHOES={white:"#f5f5ff",black:"#252b3f",red:"#ff6275",gold:"#f4d57a",neon:"#75f8d5",pink:"#ffa6db"};
const HAIR_KEYS=["hair","hair_brown","hair_blond","hair_black"];

const loader=new GLTFLoader();
const downloaded=new Map();
let failedAssets=0;
const maxPixelRatio=1.35;
let enable3D=false;
let world=null,studio=null;
let roomState=null;
let previewAvatar=null;
let currentStudioKey="";
let frame=0,lastFrame=0,roomVersion=0,previewVersion=0;
const holders=new Map();
const pending=new Map();
const el=id=>document.getElementById(id);
const supported=()=>typeof window.WebGLRenderingContext!=="undefined";
const reducedMotion=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches??false;

export function defaultOutfit(gender){return gender==="woman"?DEFAULTS.woman:DEFAULTS.man;}
export function validOutfit(gender,outfit){
 return OUTFITS.has(outfit) && outfit.startsWith(gender==="woman"?"Female/":"Male/");
}
function idFor(avatar){
 const gender=avatar?.gender==="woman"?"woman":"man";
 return validOutfit(gender,avatar?.outfit3d)?avatar.outfit3d:defaultOutfit(gender);
}
function loadOutfit(outfit){
 if(!OUTFITS.has(outfit))return Promise.reject(new Error("Atuendo 3D no permitido"));
 if(!downloaded.has(outfit)){
  const url=new URL("./models/"+outfit+".glb",import.meta.url);
  downloaded.set(outfit,loader.loadAsync(url.href).catch(err=>{
   downloaded.delete(outfit);
   throw err;
  }));
 }
 return downloaded.get(outfit);
}
function createScene(canvasParent,options={}){
 const scene=new THREE.Scene();
 const camera=new THREE.OrthographicCamera(-3,3,3,-3,.01,150);
 camera.position.set(0,0,50);camera.lookAt(0,0,0);
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:options.preview!==false,powerPreference:"low-power"});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,maxPixelRatio));
 renderer.setClearColor(0x000000,0);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.NoToneMapping;
 renderer.domElement.className=options.preview?"bomb3dStudioCanvas":"bomb3dWorldCanvas";
 renderer.domElement.setAttribute("aria-hidden","true");
 canvasParent.append(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xe5f6ff,0x506078,2.1));
 const lamp=new THREE.DirectionalLight(0xffe6bd,2.0);
 lamp.position.set(1.5,6,9);scene.add(lamp);
 const fill=new THREE.DirectionalLight(0xa4d8ff,.65);
 fill.position.set(-4,2,-1);scene.add(fill);
 return {scene,camera,renderer,canvasParent,actor:null,priorW:0,priorH:0};
}
function resize(sceneObj,w,h,scale){
 const width=Math.max(1,Math.floor(w)),height=Math.max(1,Math.floor(h));
 if(width!==sceneObj.priorW||height!==sceneObj.priorH){
  sceneObj.renderer.setSize(width,height,false);
  sceneObj.priorW=width;sceneObj.priorH=height;
 }
 sceneObj.camera.left=-width/(2*scale);
 sceneObj.camera.right=width/(2*scale);
 sceneObj.camera.top=height/(2*scale);
 sceneObj.camera.bottom=-height/(2*scale);
 sceneObj.camera.updateProjectionMatrix();
}
function materialsFor(avatar,obj){
 const skin=SKIN_HEX.test(avatar?.skin||"")?avatar.skin:"#eac49b";
 const hair=SKIN_HEX.test(avatar?.hairColor||"")?avatar.hairColor:"#262333";
 const shirt=SKIN_HEX.test(avatar?.shirt||"")?avatar.shirt:"#775de6";
 const pants=SKIN_HEX.test(avatar?.pants||"")?avatar.pants:"#273751";
 const shoes=SHOES[avatar?.shoes]||SHOES.white;
 const parentName=(obj.parent?.name||"").toLowerCase();
 const meshName=(obj.name||"").toLowerCase();
 const slot=parentName.includes("head")?"head":parentName.includes("body")?"body":
   parentName.includes("legs")||meshName.includes("legs")?"legs":
   parentName.includes("feet")||meshName.includes("feet")?"feet":"other";
 const updateMaterial=(mat)=>{
  const key=(mat.name||"").toLowerCase(),target=(
   key==="skin"?skin:
   key.startsWith("hair")?hair:
   slot==="head"?null:
   slot==="feet"&&!["skin","white","black","eyebrows","eye"].includes(key)?shoes:
   slot==="legs"&&!["skin","white","black","eyebrows","eye"].includes(key)?pants:
   slot==="body"&&COLOR_AREAS.shirt.some(m=>key.includes(m))?shirt:
   null
  );
  if(target)mat.color.set(target);
  mat.roughness=0.85;
 };
 if(Array.isArray(obj.material))obj.material.forEach(updateMaterial);
 else if(obj.material)updateMaterial(obj.material);
}
function createActor(gltf,avatar){
 const group=cloneSkeleton(gltf.scene);
 const owned=new Map();
 group.traverse(obj=>{
  if(!obj.isMesh)return;
  obj.frustumCulled=false;
  const cloneMat=old=>{
   if(!owned.has(old))owned.set(old,old.clone());
   return owned.get(old);
  };
  if(Array.isArray(obj.material))obj.material=obj.material.map(cloneMat);
  else if(obj.material)obj.material=cloneMat(obj.material);
  materialsFor(avatar,obj);
 });
 const mixer=new THREE.AnimationMixer(group);
 const anims=new Map(gltf.animations.map(clip=>[clip.name,clip]));
 let current=null;
 const play=(name)=>{
  const clip=anims.get(name)||anims.get("Idle")||gltf.animations[0];
  if(!clip)return;
  const action=mixer.clipAction(clip);
  if(current===action)return;
  action.reset().fadeIn(.2).play();
  if(current)current.fadeOut(.2);
  current=action;
 };
 play("Idle");
 return {group,mixer,play,materials:[...owned.values()],alive:true,gender:avatar?.gender,stamp:JSON.stringify(avatar)};
}
function disposeActor(actor,scene){
 if(!actor)return;
 actor.mixer.stopAllAction();
 actor.group.traverse(obj=>{if(obj.isMesh)obj.material=null;});
 for(const material of actor.materials)material.dispose();
 scene.remove(actor.group);
}
function message(text){const n=el("bomb3dStatus");if(n)n.textContent=text;}
function restore2D(){
 el("tableStage")?.classList.remove("is3d");
 el("preview")?.classList.remove("is3d");
}
function disposeWorld(){
 if(world){
  for(const v of holders.values())disposeActor(v,world.scene);
  holders.clear();pending.clear();
  world.renderer.dispose();
  world.renderer.domElement.remove();
  world=null;
 }
 if(studio){
  disposeActor(studio.actor,studio.scene);
  studio.renderer.dispose();studio.renderer.domElement.remove();
  studio=null;
 }
 restore2D();
}
function setButton(){
 const btn=el("bomb3dToggle");if(!btn)return;
 btn.textContent=enable3D?"🎮 3D activado · tocar para 2D":"🧍 Activar personajes 3D";
 btn.setAttribute("aria-pressed",String(enable3D));
}
function readPreference(){
 try{return localStorage.getItem("js-bomba-modelos-3d")!=="off";}catch{return true;}
}
function rememberPreference(val){
 try{localStorage.setItem("js-bomba-modelos-3d",val?"on":"off");}catch{}
}
export async function set3DEnabled(value){
 enable3D=Boolean(value)&&supported();roomVersion++;previewVersion++;
 setButton();
 if(!enable3D){
  disposeWorld();message("Modo 2D ligero. Podés volver al 3D cuando quieras.");
  rememberPreference(false);return;
 }
 rememberPreference(true);
 try{
  const stage=el("tableStage"),preview=el("preview");
  if(!stage||!preview)throw Error("No se encontró el editor o la mesa");
  if(!world)world=createScene(stage,{preview:false});
  if(!studio)studio=createScene(preview,{preview:true});
  message("Cargando modelos 3D…");
  syncRoom(roomState);
  syncPreview(previewAvatar);
  if(!frame)frame=requestAnimationFrame(animate);
 }catch(err){console.warn("Bomba 3D no disponible:",err);enable3D=false;disposeWorld();setButton();message("No pude activar 3D en este equipo. El modo 2D sigue funcionando.")}
}
function positionActor(actor,card,scale,stageWidth,stageHeight){
 const x=parseFloat(card.style.left),y=parseFloat(card.style.top);
 if(!Number.isFinite(x)||!Number.isFinite(y))return;
 const scaleFactor=stageWidth<500?.84:1.04;
 actor.group.scale.setScalar(scaleFactor);
 actor.group.position.set((x-stageWidth/2)/scale,(stageHeight/2-y)/scale-.9*scaleFactor,0);
 actor.group.rotation.y=0.02;
}
export function syncRoom(data){
 roomState=data;
 if(!enable3D||!world||!data?.jugadores)return;
 roomVersion++;
 const cards=Array.from(el("players")?.children||[]);
 const width=el("tableStage")?.clientWidth||360,height=el("tableStage")?.clientHeight||630;
 resize(world,width,height,66);
 const targetIds=new Set(data.jugadores.map(p=>p.id));
 for(const [id,a] of holders){
  if(!targetIds.has(id)){disposeActor(a,world.scene);holders.delete(id);pending.delete(id);}
 }
 for(const p of data.jugadores){
  const id=p.id,avatar=p.avatar||{},stamp=JSON.stringify(avatar),outfit=idFor(avatar);
  const card=cards.find(c=>c.dataset.playerId===id);
  if(!card)continue;
  let actor=holders.get(id);
  if(actor&&actor.stamp===stamp){
   positionActor(actor,card,66,width,height);
   if(actor.alive&&!p.vivo){actor.alive=false;actor.play("Death");}
   continue;
  }
  if(actor){disposeActor(actor,world.scene);holders.delete(id);}
  if(pending.get(id)===stamp)continue;
  pending.set(id,stamp);
  loadOutfit(outfit).then(gltf=>{
   if(!enable3D||!world||pending.get(id)!==stamp)return;
   const actual=roomState?.jugadores?.find(t=>t.id===id);
   if(!actual||JSON.stringify(actual.avatar||{})!==stamp)return;
   const instance=createActor(gltf,avatar);
   instance.alive=Boolean(p.vivo);
   instance.stamp=stamp;
   positionActor(instance,card,66,width,height);
   world.scene.add(instance.group);
   holders.set(id,instance);
   if(!p.vivo)instance.play("Death");
   if(holders.size>=roomState.jugadores.length){
    el("tableStage")?.classList.add("is3d");
    message("🟢 Personajes 3D en vivo · "+holders.size+" jugadores");
   }
  }).catch(err=>{
   failedAssets++;
   console.warn("No se pudo cargar el atuendo "+outfit,err);
   // Do not hide the working CSS roster if any GLB is unavailable.
   el("tableStage")?.classList.remove("is3d");
   message("No se pudo cargar un modelo. La mesa conserva su vista 2D.");
  }).finally(()=>{if(pending.get(id)===stamp)pending.delete(id);});
 }
}
export function syncPreview(avatar){
 previewAvatar=avatar;
 if(!enable3D||!studio||!avatar)return;
 const stamp=JSON.stringify(avatar),revision=++previewVersion;
 if(studio.actor&&currentStudioKey===stamp)return;
 const outfit=idFor(avatar);
 loadOutfit(outfit).then(gltf=>{
  if(!enable3D||!studio||revision!==previewVersion)return;
  disposeActor(studio.actor,studio.scene);
  const actor=createActor(gltf,avatar);
  actor.group.scale.setScalar(1.25);
  actor.group.position.set(0,-1.1,0);
  studio.scene.add(actor.group);
  studio.actor=actor;currentStudioKey=stamp;
  el("preview")?.classList.add("is3d");
 }).catch(err=>{
  console.warn("Error en vista previa 3D:",err);
  el("preview")?.classList.remove("is3d");
 });
}
export function onGameTransition(before,after){
 if(!before||!after||!enable3D)return;
 const survivors=new Set((after.jugadores||[]).filter(p=>p.vivo).map(p=>p.id));
 const lost=(before.jugadores||[]).filter(p=>p.vivo&&!survivors.has(p.id));
 if(lost.length){
  for(const p of lost){
   const actor=holders.get(p.id);
   if(actor){actor.alive=false;actor.play("Death");}
  }
 }else if(before.bomba_de!==after.bomba_de&&after.bomba_de){
  holders.get(after.bomba_de)?.play("Wave");
  setTimeout(()=>{
   const a=holders.get(after.bomba_de);
   if(a&&a.alive)a.play("Idle");
  },1200);
 }
}
function animate(timestamp){
 if(!enable3D){frame=0;return;}
 frame=requestAnimationFrame(animate);
 const minimumFrameGap=Math.max(35,(holders.size>13?65:40));
 if(timestamp-lastFrame<minimumFrameGap)return;
 const delta=Math.min(.07,(timestamp-lastFrame)/1000||.04);
 lastFrame=timestamp;
 if(document.visibilityState==="hidden")return;
 if(world){
  const stage=el("tableStage");const width=stage?.clientWidth||360,height=stage?.clientHeight||630;
  resize(world,width,height,66);
  const cards=Array.from(el("players")?.children||[]);
  for(const [id,actor] of holders){
   const card=cards.find(p=>p.dataset.playerId===id);
   if(card)positionActor(actor,card,66,width,height);
   actor.mixer.update(reducedMotion()?0:delta);
  }
  if(world.scene&&world.renderer)world.renderer.render(world.scene,world.camera);
 }
 if(studio){
  const preview=el("preview");
  resize(studio,preview?.clientWidth||270,preview?.clientHeight||230,88);
  if(studio.actor){
   studio.actor.mixer.update(reducedMotion()?0:delta);
   studio.actor.group.rotation.y=reducedMotion()?0:Math.sin(timestamp*.00035)*.23;
  }
  studio.renderer.render(studio.scene,studio.camera);
 }
}
export function initBomb3D(){
 const toggle=el("bomb3dToggle");
 if(!toggle)return;
 window.Bomb3D={syncRoom,syncPreview,onGameTransition,set3DEnabled,isEnabled:()=>enable3D};
 toggle.addEventListener("click",()=>void set3DEnabled(!enable3D));
 const initial=readPreference()&&!reducedMotion()&&!(navigator?.deviceMemory<=2);
 previewAvatar=Object.fromEntries(Array.from(document.querySelectorAll(".avatarEditor select"))
   .map(input=>[input.id,input.value]));
 if(initial)void set3DEnabled(true);
 else{enable3D=false;setButton();message("Modo ligero 2D activo");}
}
initBomb3D();
