/**
 * JS Family Bomba Mortal — a single 3D bomb shared between player hands.
 * Passes are VISUAL ONLY and never alter authoritative multiplayer game state.
 */
import * as THREE from "./vendor/three.module.js";

const coreGeometry=new THREE.SphereGeometry(.19,18,14);
const bandGeometry=new THREE.TorusGeometry(.13,.025,8,24);
const capGeometry=new THREE.CylinderGeometry(.063,.072,.055,12);
const fuseGeometry=new THREE.CylinderGeometry(.018,.023,.19,10);
const emberGeometry=new THREE.SphereGeometry(.047,10,8);
const metal=new THREE.MeshStandardMaterial({color:"#282d37",roughness:.33,metalness:.25});
const trim=new THREE.MeshStandardMaterial({color:"#69666a",roughness:.46,metalness:.47});
const fuseMaterial=new THREE.MeshStandardMaterial({color:"#b58e65",roughness:.8});
const fire=new THREE.MeshBasicMaterial({color:"#ffe18b"});
const vec=(x,y,z)=>new THREE.Vector3(x,y,z);
export const HAND_OFFSET=Object.freeze([.90,.86,.32]);
export const PASS_MIN_MS=700;
export const PASS_MAX_MS=1180;
const smoothstep=t=>t*t*(3-2*t);
export function flightDuration(start,end){
 const d=start.distanceTo(end);
 return Math.max(PASS_MIN_MS,Math.min(PASS_MAX_MS,650+d*85));
}
export function flightPosition(start,end,fraction,out=new THREE.Vector3()){
 const t=Math.max(0,Math.min(1,fraction));
 // Continuous arc starts and ends at the HAND, not at the seat center.
 out.copy(start).lerp(end,smoothstep(t));
 const distance=start.distanceTo(end);
 const lift=Math.min(2.4,Math.max(.62,.5+distance*.14));
 out.y+=Math.sin(Math.PI*t)*lift;
 out.z+=Math.sin(Math.PI*t)*Math.min(.70,distance*.09);
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
 root.name="JS_3D_HAND_BOMB";
 const body=new THREE.Mesh(coreGeometry,metal);
 body.name="bomb_body";root.add(body);
 const ring=new THREE.Mesh(bandGeometry,trim);
 ring.position.set(0,.13,.05);ring.rotation.x=Math.PI/2;
 root.add(ring);
 const cap=new THREE.Mesh(capGeometry,trim);cap.position.y=.195;root.add(cap);
 const wick=new THREE.Mesh(fuseGeometry,fuseMaterial);
 wick.position.set(.023,.305,0);wick.rotation.z=-.33;root.add(wick);
 const ember=new THREE.Mesh(emberGeometry,fire);
 ember.name="bomb_lit_fuse";ember.position.set(.066,.41,.012);root.add(ember);
 const sparkle=new THREE.PointLight(0xff9b3a,.30,1.35);
 sparkle.position.copy(ember.position);root.add(sparkle);
 // Tiny pink highlights in the hands while holding a hot potato.
 return {
  root,
  update(time,reduced=false){
   if(reduced){ember.scale.setScalar(1);sparkle.intensity=.19;return;}
   const beat=Math.sin(time*.011),twinkle=Math.sin(time*.038);
   ember.scale.setScalar(1.05+.23*beat);
   sparkle.intensity=.26+.16*Math.abs(twinkle);
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
