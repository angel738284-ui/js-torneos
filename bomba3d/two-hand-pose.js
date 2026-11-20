/**
 * The user-provided GLB has no skeleton. Build one GPU-friendly morph target
 * that pulls its existing rubber hands forward around the oversized bomb.
 * Shared geometry; independent morph weights for every player.
 */
import * as THREE from "./vendor/three.module.js";
const prepared=new WeakSet();
const clamp=(v)=>Math.max(0,Math.min(1,v));
const smooth=(low,high,n)=>{const t=clamp((n-low)/(high-low));return t*t*(3-2*t);};

/** Shift arm and hand vertices in game-local coordinates (height 2.55). */
export function gripOffset(x,y,z){
 const absX=Math.abs(x);
 const arm=smooth(.48,.72,absX);
 const lower=smooth(.46,.67,y);
 const upper=1-smooth(1.24,1.57,y);
 const weight=arm*lower*upper;
 const side=Math.sign(x)||1;
 return [
  -side*.33*weight,
  .45*weight,
  .70*weight
 ];
}
export function installTwoHandMorph(geometry,bounds,normalized=false){
 if(prepared.has(geometry))return geometry;
 const attr=geometry.getAttribute("position");
 const norm=geometry.getAttribute("normal");
 if(!attr||!norm||(!bounds&&!normalized))throw Error("Missing character geometry");
 const scale=normalized?1:2.55/(bounds.max.y-bounds.min.y);
 const centerX=normalized?0:(bounds.min.x+bounds.max.x)*.5;
 const centerZ=normalized?0:(bounds.min.z+bounds.max.z)*.5;
 const moved=new Float32Array(attr.array.length);
 const headMoved=new Float32Array(attr.array.length);
 let modified=0;
 for(let i=0;i<attr.count;i++){
  const ox=attr.getX(i),oy=attr.getY(i),oz=attr.getZ(i);
  const gameX=(ox-centerX)*scale;
  const gameY=normalized?oy:(oy-bounds.min.y)*scale;
  const gameZ=(oz-centerZ)*scale;
  const [dx,dy,dz]=gripOffset(gameX,gameY,gameZ);
  moved[i*3]=ox+dx/scale;
  moved[i*3+1]=oy+dy/scale;
  moved[i*3+2]=oz+dz/scale;
  // A separate soft head nod morph: never shift the eyes independently.
  // Weight fades at the neck, leaving the body stationary.
  const headWeight=smooth(1.76,2.12,gameY);
  headMoved[i*3]=ox;
  headMoved[i*3+1]=oy+(.022*headWeight)/scale;
  headMoved[i*3+2]=oz+(.035*headWeight)/scale;
  if(Math.abs(dx)+Math.abs(dy)+Math.abs(dz)>1e-5)modified++;
 }
 // A morph target maintains original UVs, material and geometry.
 // We use Three.js standard GPU morph targets instead of recomputing CPU meshes.
 const target=new THREE.Float32BufferAttribute(moved,3);
 geometry.morphAttributes.position=[target,new THREE.Float32BufferAttribute(headMoved,3)];
 geometry.morphTargetsRelative=false;
 geometry.computeBoundingSphere();
 prepared.add(geometry);
 geometry.userData.twoHandAffectedVertices=modified;
 return geometry;
}
export function setTwoHandPose(parent,influence){
 parent.traverse(item=>{
  if(item.isMesh&&item.morphTargetInfluences?.length){
   item.morphTargetInfluences[0]=clamp(influence);
  }
 });
}

export function setHeadNod(parent,influence){
 parent.traverse(item=>{
  if(item.isMesh&&item.morphTargetInfluences?.length>1){
   item.morphTargetInfluences[1]=clamp(influence);
  }
 });
}
