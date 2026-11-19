import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import * as THREE from "./bomba3d/vendor/three.module.js";
import {createJellyAvatar,setSeamlessGeometry,hasSeamlessGeometry} from "./bomba3d/jelly.js";
const bytes=readFileSync(new URL("./bomba3d/seamless_body.bin",import.meta.url));
const page=readFileSync(new URL("./bomba.html",import.meta.url),"utf8");
const controller=readFileSync(new URL("./bomba3d/game.js",import.meta.url),"utf8");
function readModel(){
 assert.equal(bytes.toString("ascii",0,4),"JSJB");
 assert.equal(bytes.readUInt32LE(4),1);
 const n=bytes.readUInt32LE(8),c=bytes.readUInt32LE(12),length=16+n*24+c*4;
 assert.equal(length,bytes.byteLength);
 const positions=new Float32Array(n*3),normals=new Float32Array(n*3),indices=new Uint32Array(c);
 for(let i=0;i<n*3;i++)positions[i]=bytes.readFloatLE(16+i*4);
 for(let i=0;i<n*3;i++)normals[i]=bytes.readFloatLE(16+n*12+i*4);
 for(let i=0;i<c;i++)indices[i]=bytes.readUInt32LE(16+n*24+i*4);
 const g=new THREE.BufferGeometry();
 g.setAttribute("position",new THREE.BufferAttribute(positions,3));
 g.setAttribute("normal",new THREE.BufferAttribute(normals,3));
 g.setIndex(new THREE.BufferAttribute(indices,1));
 g.computeBoundingBox();
 return {g,n,c,indices};
}
test("Merged red rubber body is one optimized, indexed manifold geometry",()=>{
 const {g,n,c,indices}=readModel();
 assert.ok(n>4000&&n<35000);
 assert.ok(c/3>9000&&c/3<70000);
 assert.ok(bytes.byteLength<1024*1024,"avoid high mobile download cost");
 const edges=new Map();
 for(let i=0;i<c;i+=3){
  for(let j=0;j<3;j++){
   const u=indices[i+j],v=indices[i+(j+1)%3];
   assert.ok(u<n&&v<n);
   const k=u<v?u*n+v:v*n+u;
   edges.set(k,(edges.get(k)||0)+1);
  }
 }
 for(const degree of edges.values())assert.equal(degree,2,"No seam, open edge or non-manifold surface");
 const box=g.boundingBox;assert.ok(box.min.y<0&&box.max.y>2.6);
 assert.ok(box.max.x>1&&box.min.x< -1);
});
test("3D classic avatar uses the merged body but keeps custom eye colors and other costumes",()=>{
 const {g}=readModel();setSeamlessGeometry(g);
 assert.equal(hasSeamlessGeometry(),true);
 const classic=createJellyAvatar({costume3d:"plain",bodyColor3d:"#f83e50"});
 let seamless,oldVisible=[],eyePositions=[];
 classic.root.traverse(o=>{
  if(o.name==="JS_Seamless_Rubber_Body")seamless=o;
  if(["torso","thickLeftLeg","thickRightLeg","bigRoundHead"].includes(o.name))oldVisible.push(o.visible);
  if(o.name.startsWith("glowyEye"))eyePositions.push(o.position.z);
 });
 assert.equal(seamless?.geometry,g);
 assert.ok(oldVisible.length===4&&oldVisible.every(visible=>visible===false));
 assert.equal(eyePositions.length,2);
 assert.ok(eyePositions.every(z=>z>.52));
 classic.update(.05,"receive");
 classic.dispose();
 const dino=createJellyAvatar({costume3d:"dino"});
 let dinoHasMerged=false;
 dino.root.traverse(o=>{if(o.name==="JS_Seamless_Rubber_Body")dinoHasMerged=true;});
 assert.equal(dinoHasMerged,false,"Original animal hoods remain unchanged");
 dino.dispose();
});
test("Website asynchronously loads seamless geometry and keeps WhatsApp controls untouched",()=>{
 assert.match(page,/bomba3d\/game\.js\?v=5/);
 assert.match(controller,/seamless_body\.bin/);
 assert.match(controller,/setSeamlessGeometry\(geometry\)/);
 assert.match(controller,/catch\(err=>\{/);
 assert.match(page,/p_action:"pasar",p_target:target\.id/);
 assert.match(page,/id="passBomb"/);
 assert.match(page,/id="tableStage"/);
});
