/** Lightweight procedural skinning for the original single-mesh GLB.
 * Four deforming joints plus root: head, two arms, lower body.
 * Retains original geometry, materials, UVs and bomb-grip morph targets.
 */
import * as THREE from './vendor/three.module.js';
const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export function rigRubber(model,bounds){
 const height=bounds.max.y-bounds.min.y;
 if(!(height>0))return null;
 const centerX=(bounds.min.x+bounds.max.x)/2;
 const joints=[
  new THREE.Bone(),new THREE.Bone(),new THREE.Bone(),new THREE.Bone(),new THREE.Bone()
 ];
 joints.forEach((b,i)=>b.name=['JS_Root','JS_Head','JS_LeftArm','JS_RightArm','JS_Legs'][i]);
 const at=(x,y,z)=>new THREE.Vector3(centerX+x*height,y*height+bounds.min.y,z*height);
 joints[0].position.copy(at(0,0,0));
 const positions=[at(0,.77,0),at(-.25,.61,0),at(.25,.61,0),at(0,.34,0)];
 for(let i=1;i<5;i++){joints[0].add(joints[i]);joints[i].position.copy(positions[i-1]).sub(joints[0].position);}
 const skeleton=new THREE.Skeleton(joints);
 let count=0;
 model.traverse(o=>{
  if(!o.isMesh||o.isSkinnedMesh)return;
  const g=o.geometry.clone(),p=g.getAttribute('position');
  if(!p)return;
  const idx=new Uint16Array(p.count*4),weights=new Float32Array(p.count*4);
  for(let i=0;i<p.count;i++){
   const x=(p.getX(i)-centerX)/height,y=(p.getY(i)-bounds.min.y)/height;
   const head=smooth(.68,.79,y)*(1-smooth(.19,.31,Math.abs(x)));
   // Keep shoulder seam and upper torso anchored to the root.
   const armBase=smooth(.28,.43,Math.abs(x))*(1-smooth(.66,.76,y))*smooth(.34,.48,y)*.70;
   const left=x<0?armBase:0,right=x>=0?armBase:0;
   const legs=(1-smooth(.28,.45,y))*.85;
   const base=Math.max(.001,1-head-left-right-legs);
   const sum=base+head+left+right+legs;
   // Four influences maximum; root is the remainder of the three dominant limbs.
   const choices=[[0,base],[1,head],[2,left],[3,right],[4,legs]].sort((a,b)=>b[1]-a[1]).slice(0,4);
   const norm=choices.reduce((v,c)=>v+c[1],0);
   for(let j=0;j<4;j++){idx[i*4+j]=choices[j][0];weights[i*4+j]=choices[j][1]/norm;}
  }
  g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(idx,4));
  g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const skinned=new THREE.SkinnedMesh(g,o.material);
  skinned.name=o.name||'JS_Rigged_Rubber';
  skinned.position.copy(o.position);skinned.quaternion.copy(o.quaternion);skinned.scale.copy(o.scale);
  skinned.frustumCulled=false;
  if(o.morphTargetInfluences){skinned.updateMorphTargets();skinned.morphTargetInfluences=o.morphTargetInfluences.slice();}
  o.parent.add(skinned);o.parent.remove(o);
  skinned.add(joints[0]);
  skinned.bind(skeleton);
  count++;
 });
 if(!count)return null;
 return {joints,update(t,action,reduced){
  const idle=action==='idle'||action==='hold';
  const gentle=idle&&!reduced;
  joints[1].rotation.z=gentle?Math.sin(t*.7)*.025:0;
  joints[1].rotation.x=gentle?Math.sin(t*.9)*.018:0;
  joints[2].rotation.z=gentle?Math.sin(t*1.1)*.012:0;
  joints[3].rotation.z=gentle?-Math.sin(t*1.1+.6)*.012:0;
  joints[2].rotation.x=action==='throw'?.15:0;
  joints[3].rotation.x=action==='throw'?.15:0;
  joints[4].rotation.z=0;
 }};
}
