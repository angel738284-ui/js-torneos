import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import * as THREE from "./bomba3d/vendor/three.module.js";
import {createBombProp,HAND_OFFSET,flightDuration,flightPosition} from "./bomba3d/bomb-effects.js";
import {installTwoHandMorph,setTwoHandPose,gripOffset} from "./bomba3d/two-hand-pose.js";
const page=readFileSync(new URL("./bomba.html",import.meta.url),"utf8");
const game=readFileSync(new URL("./bomba3d/game.js",import.meta.url),"utf8");
const imported=readFileSync(new URL("./bomba3d/imported.js",import.meta.url),"utf8");
const outfit=readFileSync(new URL("./bomba3d/wardrobe.js",import.meta.url),"utf8");

function glbMesh(){
 const buffer=readFileSync(new URL("./bomba3d/models/js-rubber-mobile.glb",import.meta.url));
 const size=buffer.readUInt32LE(12),j=JSON.parse(buffer.toString("utf8",20,20+size));
 const start=20+size+8;
 function accessor(n){
  const a=j.accessors[n],bv=j.bufferViews[a.bufferView],components=a.type==="VEC3"?3:1;
  const v=new Float32Array(a.count*components);
  for(let i=0;i<v.length;i++)v[i]=buffer.readFloatLE(start+(bv.byteOffset||0)+(a.byteOffset||0)+4*i);
  return new THREE.BufferAttribute(v,components);
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute("position",accessor(0));g.setAttribute("normal",accessor(1));
 const min=j.accessors[0].min,max=j.accessors[0].max;
 const bounds=new THREE.Box3(new THREE.Vector3(...min),new THREE.Vector3(...max));
 return {g,bounds};
}

test("Bomb body is giant: at least 2.6x the original diameter and torso-scale",()=>{
 const bomb=createBombProp();
 const body=bomb.root.children.find(o=>o.name==="bomb_body");
 const r=body.geometry.parameters.radius;
 assert.ok(r>=.50,"radius "+r);
 assert.ok(r/.19>=2.6,"at least 2.6x the previous size");
 assert.ok(r*2>=.90,"giant compared with the character torso");
 assert.ok(bomb.root.children.some(o=>o.name==="bomb_lit_fuse"));
 assert.ok(HAND_OFFSET[0]===0,"both hands hold a centered bomb");
 assert.ok(HAND_OFFSET[1]>=.9&&HAND_OFFSET[1]<=1.35,"in front of chest");
});
test("Both original arms genuinely bend forward with a shared morph target",()=>{
 const {g,bounds}=glbMesh();
 installTwoHandMorph(g,bounds);
 assert.equal(g.morphAttributes.position.length,1);
 assert.ok(g.userData.twoHandAffectedVertices>100,"real arms moved");
 const original=g.getAttribute("position"),target=g.morphAttributes.position[0];
 const minY=bounds.min.y,scale=2.55/(bounds.max.y-minY);
 let left=0,right=0,faceMoved=0,forward=0;
 for(let i=0;i<original.count;i++){
  const x=original.getX(i),y=original.getY(i),z=original.getZ(i);
  const diff=Math.abs(target.getX(i)-x)+Math.abs(target.getY(i)-y)+Math.abs(target.getZ(i)-z);
  if(diff>.0001){
   if(x<-.45)left++;
   if(x>.45)right++;
   if(target.getZ(i)>z+.1)forward++;
   if((y-minY)*scale>1.9)faceMoved++;
  }
 }
 assert.ok(left>40&&right>40,"both arms should move");
 assert.ok(forward>100,"hands should come toward the camera");
 assert.equal(faceMoved,0,"face and eyes must not distort");
 const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial());
 mesh.updateMorphTargets();
 assert.equal(mesh.morphTargetInfluences.length,1);
 const clone=mesh.clone();
 setTwoHandPose(mesh,.95);
 assert.equal(mesh.morphTargetInfluences[0],.95);
 assert.equal(clone.morphTargetInfluences[0],0,"one user's pose does not change another user's");
});
test("Every user has exactly two colored grip palms and clothes follow the arms",()=>{
 assert.match(imported,/left_hand_gripping_bomb/);
 assert.match(imported,/right_hand_gripping_bomb/);
 assert.match(imported,/grippingHands\.visible/);
 assert.match(imported,/gripPose\+=/);
 assert.match(imported,/setTwoHandPose\(animatedRig,gripPose\)/);
 assert.match(outfit,/installTwoHandMorph\(g,null,true\)/);
 assert.match(imported,/installTwoHandMorph\(o\.geometry,bounds\)/);
});
test("Giant bomb stays in both hands before launch, then flies in a bigger arc",()=>{
 const start=new THREE.Vector3(-2,1.12,0),end=new THREE.Vector3(2,1.12,0);
 const f=flightDuration(start,end);
 assert.ok(f>=920&&f<=1500);
 assert.ok(flightPosition(start,end,.5).y>start.y+1.1);
 assert.match(game,/playingAction=isHolder&&a\.action==="idle"\?"hold":a\.action/);
 assert.match(game,/actor\.bomb\.root\.position\.set\(\.\.\.HAND_OFFSET\)/);
 assert.match(game,/projectile\.root\.position\.copy\(flight\.point\(time\)\)/);
 assert.match(page,/Jugar 8 bots · hasta un ganador/);
 assert.match(page,/bomba3d\/game\.js\?v=17/);
});
