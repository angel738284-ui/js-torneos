/**
 * JS Family Bomba Mortal — a single 3D bomb shared between player hands.
 * Passes are VISUAL ONLY and never alter authoritative multiplayer game state.
 */
import * as THREE from "./vendor/three.module.js";

const coreGeometry=new THREE.SphereGeometry(.54,24,18);
const bandGeometry=new THREE.TorusGeometry(.385,.046,10,32);
const capGeometry=new THREE.CylinderGeometry(.145,.16,.11,14);
const fuseGeometry=new THREE.CylinderGeometry(.032,.040,.30,10);
const emberGeometry=new THREE.SphereGeometry(.084,12,10);
const metal=new THREE.MeshStandardMaterial({color:"#282d37",roughness:.33,metalness:.25});
const trim=new THREE.MeshStandardMaterial({color:"#69666a",roughness:.46,metalness:.47});
const fuseMaterial=new THREE.MeshStandardMaterial({color:"#b58e65",roughness:.8});
const fire=new THREE.MeshBasicMaterial({color:"#ffe18b"});
const vec=(x,y,z)=>new THREE.Vector3(x,y,z);
export const HAND_OFFSET=Object.freeze([0,1.12,.70]);
export const PASS_MIN_MS=920;
export const PASS_MAX_MS=1500;
const smoothstep=t=>t*t*(3-2*t);
const clamp01=x=>Math.max(0,Math.min(1,x));
const FUSE_FULL=.30,FUSE_BASE_Y=.585,FUSE_MIN=.024;
/**
 * Ronda autoritativa de Supabase. Conserva la misma mecha durante cada pase,
 * y arranca una mecha nueva al cambiar ronda_inicio/vencimiento.
 */
export function roundFuseProgress(room,serverNowMs){
 if(room?.estado!=="playing")return 1;
 const begin=Date.parse(room.ronda_inicio);
 const end=Date.parse(room.vencimiento);
 if(!Number.isFinite(begin)||!Number.isFinite(end)||end<=begin||
    !Number.isFinite(serverNowMs))return 1;
 return clamp01((end-serverNowMs)/(end-begin));
}
export function flightDuration(start,end){
 const d=start.distanceTo(end);
 return Math.max(PASS_MIN_MS,Math.min(PASS_MAX_MS,780+d*110));
}
export function flightPosition(start,end,fraction,out=new THREE.Vector3()){
 const t=Math.max(0,Math.min(1,fraction));
 // Continuous arc starts and ends at the HAND, not at the seat center.
 out.copy(start).lerp(end,smoothstep(t));
 const distance=start.distanceTo(end);
 const lift=Math.min(3.0,Math.max(1.25,1.05+distance*.17));
 out.y+=Math.sin(Math.PI*t)*lift;
 out.z+=Math.sin(Math.PI*t)*Math.min(.90,distance*.10);
 return out;
}
export function handWorldPosition(actor){
 const hand=actor?.handAnchor||actor?.root;
 if(!hand)return null;
 hand.updateWorldMatrix(true,false);
 return hand.localToWorld(vec(...HAND_OFFSET));
}
export function createBombProp(){
 const root=new THREE.Group();
 root.name="JS_3D_HUGE_BOMB_TWO_HANDS";
 const body=new THREE.Mesh(coreGeometry,metal);
 body.name="bomb_body";root.add(body);
 const ring=new THREE.Mesh(bandGeometry,trim);
 ring.position.set(0,.385,.05);ring.rotation.x=Math.PI/2;
 root.add(ring);
 const cap=new THREE.Mesh(capGeometry,trim);cap.position.y=.54;root.add(cap);
 const wick=new THREE.Mesh(fuseGeometry,fuseMaterial);
 wick.position.set(.03,.735,0);wick.rotation.z=-.33;root.add(wick);
 const ember=new THREE.Mesh(emberGeometry,fire);
 ember.name="bomb_lit_fuse";ember.position.set(.090,.918,.025);root.add(ember);
 const sparkle=new THREE.PointLight(0xff9b3a,.45,2.4);
 sparkle.position.copy(ember.position);root.add(sparkle);
 let fuseRatio=1;
 function setFuseProgress(value=1){
  fuseRatio=clamp01(Number.isFinite(value)?value:1);
  // Shrink from the TOP of the wick; its lower end stays in the cap.
  const length=Math.max(FUSE_MIN,FUSE_FULL*fuseRatio);
  wick.scale.y=length/FUSE_FULL;
  wick.position.set(.03,FUSE_BASE_Y+length/2,0);
  // Chase the burning tip as the wick becomes shorter (including its tilt).
  ember.position.set(.04+length*.165,FUSE_BASE_Y+length*.945+.045,.025);
  sparkle.position.copy(ember.position);
  return fuseRatio;
 }
 setFuseProgress(1);
 return {
  root,setFuseProgress,
  getFuseProgress:()=>fuseRatio,
  update(time,reduced=false,progress=1){
   const ratio=setFuseProgress(progress);
   const panic=1-ratio;
   if(reduced){
    ember.scale.setScalar(.92+panic*.30);
    sparkle.intensity=.20+panic*.40;
    return;
   }
   // Approaching zero: sparks flash faster and stronger, without faking
   // an explosion. The authoritative server still decides who is eliminated.
   const speed=.016+panic*panic*.082;
   const shimmer=Math.abs(Math.sin(time*speed));
   ember.scale.setScalar(.87+panic*.29+.18*shimmer);
   sparkle.intensity=.23+.24*shimmer+.46*panic;
  }
 };
}
export function makePassAnimation({fromId,toId,start,end,startTime=0}){
 if(!fromId||!toId||fromId===toId)throw Error("Invalid bomb pass");
 const startPos=start.clone(),endPos=end.clone(),duration=flightDuration(startPos,endPos);
 return {
  fromId,toId,start:startPos,end:endPos,startTime,duration,
  at(time){return Math.max(0,Math.min(1,(time-startTime)/duration));},
  point(time){return flightPosition(startPos,endPos,this.at(time));},
  finished(time){return time>=startTime+duration}
 };
}
