/**
 * JS Family original Jelly characters — procedural 3D meshes, no external models.
 * Inspired by the overall toy-like / rounded style, NOT copied branded assets.
 * Designed to render 2–24 characters in a single Three.js canvas on Android.
 */
import * as THREE from "./vendor/three.module.js";

export const COSTUMES=["plain","dino","cat","frog","chicken","bear","bunny","hero","office","ninja","robot","astronaut"];
export const BODY_COLORS=["#f83e50","#27b9e8","#4acb75","#ffcf45","#ff84b6","#8970e8","#ef8f43","#2c344e","#eff0e8","#54d7ca"];
export const HOOD_COLORS=["#f6c843","#f83e50","#27b9e8","#4acb75","#ff84b6","#8970e8","#ef8f43","#2c344e","#eff0e8","#54d7ca"];
export const DEFAULT_JELLY={costume3d:"plain",bodyColor3d:"#f83e50",hoodColor3d:"#f6c843"};
export function normalizeJelly(a={}){
 return {
  costume3d:COSTUMES.includes(a.costume3d)?a.costume3d:DEFAULT_JELLY.costume3d,
  bodyColor3d:BODY_COLORS.includes(a.bodyColor3d)?a.bodyColor3d:DEFAULT_JELLY.bodyColor3d,
  hoodColor3d:HOOD_COLORS.includes(a.hoodColor3d)?a.hoodColor3d:DEFAULT_JELLY.hoodColor3d
 };
}

const sph=new THREE.SphereGeometry(1,16,12);
const cone=new THREE.ConeGeometry(1,1,8);
const box=new THREE.BoxGeometry(1,1,1);
const torus=new THREE.TorusGeometry(1,.1,8,28);
function material(color,options={}){
 return new THREE.MeshStandardMaterial({color,roughness:.38,metalness:0, ...options});
}
function lighter(hex,amount=.3){return new THREE.Color(hex).lerp(new THREE.Color("#ffffff"),amount);}
export function createJellyAvatar(config={}){
 const c=normalizeJelly(config);
 const root=new THREE.Group();root.name="JS_FAMILY_JELLY_"+c.costume3d;
 const metals=[];
 const base=material(c.bodyColor3d),hood=material(c.hoodColor3d),
 faceMat=material(c.bodyColor3d),dark=material("#182031"),
 white=material("#fffef8",{roughness:.18,emissive:0xffffff,emissiveIntensity:.27}),
 accent=material(lighter(c.bodyColor3d,.34)),
 shade=material("#532937"),black=material("#1b2538");
 metals.push(base,hood,faceMat,dark,white,accent,shade,black);
 const custom=(hex,options)=>{const m=material(hex,options);metals.push(m);return m;};
 const parts={};
 const mesh=(parent,geometry,mat,name,position,scale,rotation)=>{
  const thing=new THREE.Mesh(geometry,mat);
  thing.name=name;thing.position.set(...position);
  thing.scale.set(...scale);
  if(rotation)thing.rotation.set(...rotation);
  parent.add(thing);return thing;
 };
 const oval=(parent,mat,name,pos,scale,rot)=>mesh(parent,sph,mat,name,pos,scale,rot);
 const rod=(parent,mat,name,pos,scale,rot)=>mesh(parent,box,mat,name,pos,scale,rot);
 const point=(parent,mat,name,pos,radius,height,rot)=>{
  const thing=mesh(parent,cone,mat,name,pos,[radius,height,radius],rot);
  return thing;
 };
 const ring=(parent,mat,name,pos,radius,thickness=1)=>{
  const obj=mesh(parent,torus,mat,name,pos,[radius,radius,thickness]);
  return obj;
 };

 // Round jelly body — simplified silhouette with no visible knees, toes or fingers.
 const inner=new THREE.Group();inner.name="jellyBody";root.add(inner);
 const torso=oval(inner,base,"torso",[0,.99,0],[.47,.64,.345]);
 parts.torso=torso;
 oval(inner,accent,"frontSheen",[-.10,1.10,.334],[.21,.4,.015]);
 const legL=oval(inner,base,"thickLeftLeg",[-.23,.31,.015],[.205,.365,.225]);
 const legR=oval(inner,base,"thickRightLeg",[.23,.31,.015],[.205,.365,.225]);
 parts.legs=[legL,legR];

 // Independent shoulder bones allow a real waving / passing gesture.
 const leftArm=new THREE.Group();leftArm.name="leftShoulder";
 leftArm.position.set(-.49,1.24,0);inner.add(leftArm);
 oval(leftArm,base,"leftJellyArm",[-.17,-.28,.02],[.18,.42,.19],[0,0,-.16]);
 oval(leftArm,base,"leftMitten",[-.22,-.56,.11],[.19,.18,.2]);
 const rightArm=new THREE.Group();rightArm.name="rightShoulder";
 rightArm.position.set(.49,1.24,0);inner.add(rightArm);
 oval(rightArm,base,"rightJellyArm",[.17,-.28,.02],[.18,.42,.19],[0,0,.16]);
 oval(rightArm,base,"rightMitten",[.22,-.56,.11],[.19,.18,.2]);
 parts.leftArm=leftArm;parts.rightArm=rightArm;

 // Oversized sphere head. In a costume, the surrounding shell is the hood.
 const headRig=new THREE.Group();headRig.name="headRig";inner.add(headRig);
 const hasHood=c.costume3d!=="plain"&&c.costume3d!=="office";
 const mainHead=oval(headRig,hasHood?hood:base,"bigRoundHead",[0,1.96,.04],
   [.505,.505,.425]);
 const face=oval(headRig,faceMat,"insetFace",[0,1.95,.34],
   hasHood?[.386,.395,.15]:[.425,.43,.125]);
 const belly=hasHood?oval(inner,hood,"costumeBelly",[0,1.02,.338],[.31,.41,.045]):null;
 if(belly){belly.material=material(lighter(c.hoodColor3d,.25));metals.push(belly.material);}
 parts.headRig=headRig;
 // Pearly white cartoony eyes. Deliberately exaggerated in every outfit.
 const expression=config.expression||"smile";
 const eyeY=expression==="happy"?2.02:2.035;
 const eyeL=oval(headRig,white,"glowyEyeLeft",[-.175,eyeY,.459],[.082,.105,.052]);
 const eyeR=oval(headRig,white,"glowyEyeRight",[.175,eyeY,.459],[.082,.105,.052]);
 if(expression==="wink")eyeR.scale.y=.025;
 if(expression==="serious"){eyeL.scale.y=.065;eyeR.scale.y=.065;}
 // Just a tiny optional mouth; eyes remain visually dominant.
 if(expression==="happy"||expression==="confident"){
  oval(headRig,shade,"smile",[0,1.79,.492],[.07,.017,.009]);
 }

 // Animal hats and playful costumes.
 const hoodFeatures=()=>{
  switch(c.costume3d){
  case "dino":{
   const spikes=custom("#f6e58b");
   for(let i=0;i<4;i++)point(headRig,spikes,"spike"+i,[0,2.5-i*.08,-.11-i*.08],
     .17-i*.025,.30-i*.025,[0,0,0]);
   for(let i=0;i<3;i++)point(inner,spikes,"backSpine"+i,[0,1.52-i*.32,-.29],
     .14,.27,[.20,0,0]);
   const tail=point(inner,hood,"dinoTail",[0,.56,-.48],.22,.55,[Math.PI/2.6,0,0]);
   oval(headRig,custom("#faffec"),"dinoToothLeft",[-.32,1.67,.37],[.075,.11,.055]);
   oval(headRig,custom("#faffec"),"dinoToothRight",[.32,1.67,.37],[.075,.11,.055]);
   break;
  }
  case "cat":{
   const innerEar=custom("#f9a6b9");
   for(const side of [-1,1]){
    point(headRig,hood,side===1?"catEarR":"catEarL",[side*.35,2.40,-.02],
      .18,.40,[0,0,-side*.16]);
    point(headRig,innerEar,"catPinkEar",[side*.35,2.43,.12],.095,.24,[0,0,-side*.16]);
   }
   const whisker=custom("#ffe9f0");
   for(const side of [-1,1])for(let n=0;n<2;n++){
    const stroke=oval(headRig,whisker,"whisker",[side*.39,1.88-n*.07,.47],
      [.105,.012,.012],[0,0,side*(n?-.16:.16)]);
   }
   break;
  }
  case "frog":{
   const accentEye=custom("#fffaf0");
   for(const side of [-1,1]){
    oval(headRig,hood,"frogEyeBump",[side*.34,2.42,-.02],[.20,.19,.20]);
    oval(headRig,accentEye,"frogEyeBubble",[side*.34,2.43,.15],[.095,.11,.05]);
   }
   break;
  }
  case "chicken":{
   const comb=custom("#f65452"),beak=custom("#f5a23d");
   for(let i=0;i<3;i++)oval(headRig,comb,"comb"+i,[0,2.48+i*.11,-.11+i*.04],
    [.11-i*.017,.18-i*.012,.13]);
   const beakTop=point(headRig,beak,"chickenBeak",[0,1.91,.54],.125,.25,[Math.PI/2,0,0]);
   for(const side of [-1,1])oval(inner,hood,"chickenWing",[side*.43,1.08,.23],[.22,.22,.105]);
   break;
  }
  case "bear":{
   for(const side of [-1,1]){
    oval(headRig,hood,"bearEar",[side*.37,2.38,-.06],[.20,.20,.17]);
    oval(headRig,custom("#f0b0a7"),"bearInner",[side*.37,2.38,.055],[.105,.11,.027]);
   }
   oval(headRig,custom("#f2dfb1"),"bearNoseArea",[0,1.84,.50],[.17,.12,.045]);
   oval(headRig,dark,"bearNose",[0,1.90,.548],[.055,.046,.022]);
   break;
  }
  case "bunny":{
   const pale=custom("#ffb8c9");
   for(const side of [-1,1]){
    oval(headRig,hood,"bunnyEar",[side*.30,2.56,-.06],[.17,.41,.13],
      [0,0,side*-.12]);
    oval(headRig,pale,"bunnyInner",[side*.30,2.59,.055],[.08,.30,.028],
      [0,0,side*-.12]);
   }
   oval(headRig,pale,"bunnyNose",[0,1.89,.513],[.052,.04,.028]);
   break;
  }
  case "hero":{
   const cape=custom("#ef5b6f");
   const shape=new THREE.Shape();shape.moveTo(-.32,0);shape.lineTo(.32,0);
   shape.lineTo(.55,-1.05);shape.lineTo(-.55,-1.05);shape.closePath();
   const cloth=new THREE.Mesh(new THREE.ShapeGeometry(shape),cape);
   cloth.name="heroCape";cloth.position.set(0,1.45,-.29);inner.add(cloth);
   point(inner,custom("#ffdc64"),"heroChestStar",[0,1.18,.39],.16,.26,[0,0,Math.PI]);
   break;
  }
  case "office":{
   const suit=custom("#f9faf5"),tie=custom("#19233b");
   oval(inner,suit,"officeShirt",[0,1.06,.324],[.33,.45,.068]);
   point(inner,tie,"officeTie",[0,1.22,.399],.105,.32,[0,0,Math.PI]);
   // Spectacles use simple thin rings.
   for(const side of [-1,1]){
    const lens=ring(headRig,dark,"officeGlasses",[side*.17,eyeY,.515],.105);
    lens.scale.set(.115,.105,.025);
   }
   break;
  }
  case "ninja":{
   const belt=custom("#24243a"),ribbon=custom("#fc6d71");
   oval(headRig,belt,"ninjaMask",[0,1.86,.488],[.33,.095,.024]);
   oval(headRig,ribbon,"ninjaBandana",[0,2.18,.33],[.47,.055,.06]);
   break;
  }
  case "robot":{
   const steel=custom("#8ec5d3",{metalness:.32,roughness:.29});
   oval(headRig,steel,"robotHelmet",[0,2.04,-.08],[.52,.53,.37]);
   // Eyes remain visible in front of the helmet.
   oval(headRig,custom("#212f49"),"robotVisor",[0,2.02,.34],[.32,.15,.065]);
   oval(headRig,white,"robotLeftEye",[-.145,2.02,.40],[.095,.07,.034]);
   oval(headRig,white,"robotRightEye",[.145,2.02,.40],[.095,.07,.034]);
   const stem=rod(headRig,steel,"robotAntenna",[0,2.55,0],[.045,.20,.045]);
   oval(headRig,custom("#f85e68"),"robotLight",[0,2.69,0],[.095,.095,.095]);
   break;
  }
  case "astronaut":{
   const steel=custom("#eff3ef"),glass=custom("#95dff3",{metalness:.08,roughness:.18,transparent:true,opacity:.30});
   oval(headRig,steel,"astronautHelmetBack",[0,2.0,-.04],[.56,.55,.42]);
   oval(headRig,glass,"astronautVisor",[0,1.98,.43],[.40,.36,.10]);
   oval(inner,steel,"astronautChest",[0,1.03,.34],[.30,.34,.05]);
   oval(inner,custom("#f76b65"),"oxygenButton",[0,1.06,.40],[.06,.06,.025]);
   break;
  }
  default:break;
  }
 };
 hoodFeatures();

 // Optional accessories from the previous edit screen become genuine 3D objects.
 const accessory=config.accessory||"none";
 if(accessory==="glasses"||accessory==="headphones"){
  for(const side of [-1,1]){
   if(accessory==="glasses"){
    const lens=mesh(headRig,torus,dark,"glasses",[side*.175,2.03,.53],[.103,.103,.12]);
   }else{
    oval(headRig,dark,"headphoneCup",[side*.5,2.00,.06],[.10,.22,.14]);
   }
  }
 }else if(accessory==="crown"){
  const gold=custom("#fce37a");
  for(const side of [-1,0,1])point(headRig,gold,"crownSpike",[side*.2,2.50,0],.16,.34);
 }else if(accessory==="mask"){
  oval(headRig,dark,"darkFaceMask",[0,1.85,.52],[.35,.105,.025]);
 }else if(accessory==="cap"){
  oval(headRig,custom("#1b304c"),"cap",[0,2.40,.08],[.46,.16,.39]);
  oval(headRig,custom("#1b304c"),"capBrim",[0,2.29,.40],[.30,.06,.24]);
 }else if(accessory==="bandana"){
  oval(headRig,custom("#f7e37e"),"headband",[0,2.29,.30],[.45,.06,.07]);
 }else if(accessory==="horns"){
  for(const side of [-1,1])point(headRig,custom("#f55d75"),"horns",[side*.32,2.44,-.02],.17,.34);
 }else if(accessory==="earrings"){
  const gold=custom("#f8dc5c");for(const side of [-1,1])oval(headRig,gold,"earring",[side*.49,1.77,.05],[.07,.11,.07]);
 }
 if(config.aura&&config.aura!=="none"){
  const auraColor={cyan:"#64ffff",purple:"#bda0ff",gold:"#ffed8e",fire:"#ff9962",pink:"#ffc1dc"}[config.aura];
  if(auraColor){
   const glow=custom(auraColor,{emissive:auraColor,emissiveIntensity:.4,transparent:true,opacity:.65});
   const halo=mesh(root,torus,glow,"auraHalo",[0,1.12,-.18],[.78,1.32,.10]);
   parts.halo=halo;
  }
 }

 const characterScale=config.body==="slim"?.93:config.body==="athletic"?1.085:1;
 inner.scale.x=characterScale;
 let elapsed=0,burst=0,isDead=false;
 const motion=(delta,action="idle",reduced=false)=>{
  elapsed+=Math.min(.08,delta||0);
  const t=elapsed;
  const dance=action==="dance"||config.pose==="dance";
  const wave=action==="wave"||config.pose==="wave";
  const dead=action==="death";
  isDead=dead;
  if(dead){
   burst=Math.min(1,burst+Math.max(.035,delta*1.5));
   inner.rotation.z=-Math.PI*.44*burst;
   inner.position.y=-.20*burst;
   leftArm.rotation.z=-.7*burst;rightArm.rotation.z=.7*burst;
   return;
  }
  burst=Math.max(0,burst-.06);
  inner.position.y=reduced?0:Math.sin(t*(dance?8:2.5))*(dance?.07:.035);
  inner.rotation.z=reduced?0:Math.sin(t*(dance?7:2.0))*(dance?.13:.045);
  headRig.rotation.z=reduced?0:Math.sin(t*1.9)*.05;
  leftArm.rotation.z=reduced?0:Math.sin(t*2.8)*.08;
  rightArm.rotation.z=wave?(reduced?-.55:-.7+Math.sin(t*11)*.24):
   action==="receive"?-.67+(reduced?0:Math.sin(t*8)*.16):
   reduced?0:-Math.sin(t*2.6)*.09;
  legL.rotation.x=reduced?0:Math.sin(t*2.9)*.025;
  legR.rotation.x=reduced?0:-Math.sin(t*2.9)*.025;
 };
 const dispose=()=>{
  for(const m of metals)m.dispose();
  // shared geometry intentionally persists across instances
 };
 return {root,update:motion,dispose,costume:c.costume3d};
}
