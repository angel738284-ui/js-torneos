/**
 * Uploaded JS Family rubber GLB: original geometry, embedded textures and normals.
 * Skinned mobile GLB: preserves the original eyes/texture and adds six bone animations.
 * Each player gets an independent skeleton and animation mixer.
 */
import * as THREE from "./vendor/three.module.js";
import {GLTFLoader} from "./vendor/GLTFLoader.js";
import {dressOriginalRubber} from "./wardrobe.js?v=7";

let sourcePromise=null,loaded=null;
const tintedTextures=new Map();
const defaultRed="#f83e50";
const loader=new GLTFLoader();
const filename="./models/js-rubber-animated.glb";

export function hasOriginalModel(){return Boolean(loaded);}
export function preloadOriginalModel(){
 if(!sourcePromise){
  const uri=new URL(filename,import.meta.url);
  sourcePromise=loader.loadAsync(uri.href).then(gltf=>{
   if(!gltf?.scene)throw Error("El modelo original está vacío");
   gltf.scene.updateMatrixWorld(true);
   const bounds=new THREE.Box3().setFromObject(gltf.scene);
   if(!Number.isFinite(bounds.min.y)||bounds.isEmpty())throw Error("Geometría 3D inválida");
   if(!gltf.animations?.length||!gltf.scene.getObjectByName("Hips"))
    throw Error("El GLB no tiene articulaciones y clips");
   loaded={gltf,bounds};
   return loaded;
  }).catch(error=>{sourcePromise=null;throw error;});
 }
 return sourcePromise;
}
// The supplied diffuse map paints red rubber + WHITE eyes in one JPG.
// Repaint *only* red pixels, preserving white eye highlights, texture gradients,
// the exact mesh silhouette, normal maps and roughness maps.
function recolorMap(original,color){
 if(!original||color===defaultRed)return original;
 const key=String(color).toLowerCase();
 if(tintedTextures.has(key))return tintedTextures.get(key);
 const src=original.image;
 if(!src||!src.width||!src.height)return original;
 const canvas=document.createElement("canvas"),size=512;
 canvas.width=size;canvas.height=size;
 const ctx=canvas.getContext("2d",{willReadFrequently:true});
 if(!ctx)return original;
 ctx.drawImage(src,0,0,size,size);
 const pixels=ctx.getImageData(0,0,size,size);
 const target=new THREE.Color(key);
 const trg=[Math.round(target.clone().convertLinearToSRGB().r*255),
  Math.round(target.clone().convertLinearToSRGB().g*255),
  Math.round(target.clone().convertLinearToSRGB().b*255)];
 // Keep the image's subtle lighting gradients. White eyes remain white.
 for(let i=0;i<pixels.data.length;i+=4){
  const r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2];
  if(r>54&&r>g*1.32&&r>b*1.23){
   const intensity=Math.max(.24,Math.min(1.30,(r*.78+g*.16+b*.06)/186));
   pixels.data[i]=Math.min(255,trg[0]*intensity);
   pixels.data[i+1]=Math.min(255,trg[1]*intensity);
   pixels.data[i+2]=Math.min(255,trg[2]*intensity);
  }
 }
 ctx.putImageData(pixels,0,0);
 const recolored=new THREE.CanvasTexture(canvas);
 recolored.name="JS-Rubber-"+key;
 recolored.colorSpace=original.colorSpace;
 recolored.flipY=original.flipY;
 recolored.wrapS=original.wrapS;
 recolored.wrapT=original.wrapT;
 recolored.magFilter=original.magFilter;
 recolored.minFilter=THREE.LinearMipmapLinearFilter;
 recolored.anisotropy=1;
 recolored.needsUpdate=true;
 tintedTextures.set(key,recolored);
 return recolored;
}
/** Standard clone(true) keeps skeleton references to the SOURCE bones.
 * Rebind each player's skinned copy to its own cloned bones, otherwise all
 * players animate as one (and can deform in unexpected ways).
 */
function cloneIndependentSkeleton(source){
 const copy=source.clone(true);
 const src=[],dst=[];
 source.traverse(o=>{if(o.isSkinnedMesh)src.push(o);});
 copy.traverse(o=>{if(o.isSkinnedMesh)dst.push(o);});
 if(!src.length||src.length!==dst.length)throw Error("Rig skinned inválido");
 for(let i=0;i<src.length;i++){
  const original=src[i],clone=dst[i];
  const bones=original.skeleton.bones.map(b=>copy.getObjectByName(b.name));
  if(bones.some(b=>!b))throw Error("Faltan huesos del rig");
  clone.bind(new THREE.Skeleton(bones,original.skeleton.boneInverses.map(m=>m.clone())),original.bindMatrix.clone());
  clone.frustumCulled=false;
 }
 return copy;
}

export function createOriginalRubberActor(options={}){
 if(!loaded)throw Error("El modelo original todavía no está cargado");
 const root=new THREE.Group();
 root.name="Uploaded-JS-Family-Rubber";
 const animatedRig=new THREE.Group();
 animatedRig.name="JS_3D_ANIMATED_BODY_AND_CLOTHING";
 root.add(animatedRig);
 const original=cloneIndependentSkeleton(loaded.gltf.scene);
 const originalBounding=loaded.bounds;
 const size=originalBounding.max.y-originalBounding.min.y;
 // Match the height of our original JS Jelly game characters.
 const scale=2.55/size;
 original.scale.setScalar(scale);
 original.position.set(
  -(originalBounding.max.x+originalBounding.min.x)*.5*scale,
  -originalBounding.min.y*scale,
  -(originalBounding.max.z+originalBounding.min.z)*.5*scale
 );
 const materials=[];
 original.traverse(o=>{
  if(!o.isMesh)return;
  o.frustumCulled=false;
  const customize=m=>{
   const copy=m.clone();
   copy.name="JS original rubber texture";
   copy.map=recolorMap(m.map,options.bodyColor3d||defaultRed);
   // Metallic=1 was embedded by the image-to-3D converter; soften it for rubber.
   copy.metalness=.04;
   copy.roughness=.49;
   copy.needsUpdate=true;
   materials.push(copy);
   return copy;
  };
  o.material=Array.isArray(o.material)?o.material.map(customize):customize(o.material);
 });
 animatedRig.add(original);
 const mixer=new THREE.AnimationMixer(original);
 const clipMap=new Map(loaded.gltf.animations.map(c=>[c.name,c]));
 const actionNames={idle:"Esperando",hold:"Sostener_Bomba",throw:"Lanzar_Bomba",
   catch:"Recibir_Bomba",receive:"Recibir_Bomba",death:"Explotar_Caer",
   walk:"Caminar",wave:"Esperando",dance:"Caminar",confident:"Esperando"};
 const loops=new Set(["Esperando","Sostener_Bomba","Caminar"]);
 let current=null,currentName="",time=0;
 function play(name){
  if(currentName===name)return;
  const clip=clipMap.get(name)||clipMap.get("Esperando");
  if(!clip)return;
  const next=mixer.clipAction(clip);
  next.reset();next.enabled=true;
  next.setLoop(loops.has(name)?THREE.LoopRepeat:THREE.LoopOnce,loops.has(name)?Infinity:1);
  next.clampWhenFinished=!loops.has(name);
  next.timeScale=name==="Lanzar_Bomba"?1.65:1;
  if(current&&current!==next)current.fadeOut(.12);
  next.fadeIn(.12).play();
  current=next;currentName=name;
 }
 play("Esperando");
 let baseMesh=null;
 loaded.gltf.scene.traverse(o=>{if(o.isMesh&&!baseMesh)baseMesh=o;});
 if(!baseMesh)throw Error("El GLB no tiene una malla para diseñar ropa");
 const wardrobe=dressOriginalRubber(animatedRig,options,baseMesh.geometry,originalBounding);
 const palmMat=new THREE.MeshStandardMaterial({
  color:options.bodyColor3d||defaultRed,roughness:.4,metalness:.02
 });
 const palmGeometry=new THREE.SphereGeometry(1,14,10);
 const grippingHands=new THREE.Group();
 grippingHands.name="JS_BOTH_HANDS_GRIPPING_HUGE_BOMB";
 // The source GLB arms are morphed forward, and the small rounded
 // fingertip/mitten tips make contact with both sides of the bomb.
 for(const side of [-1,1]){
  const palm=new THREE.Mesh(palmGeometry,palmMat);
  palm.name=side<0?"left_hand_gripping_bomb":"right_hand_gripping_bomb";
  palm.position.set(side*.51,1.12,.91);
  palm.scale.set(.14,.17,.14);
  grippingHands.add(palm);
 }
 grippingHands.visible=false;
 animatedRig.add(grippingHands);
 let elapsed=0,deadAmount=0;
 const update=(delta,action="idle",reduced=false)=>{
  const dt=Math.min(.10,Math.max(0,delta||0));
  elapsed+=dt;
  wardrobe.update(elapsed,reduced);
  const name=actionNames[action]||"Esperando";
  play(name);
  mixer.update(reduced?0:dt);
  const holding=action==="hold"||action==="catch"||action==="receive";
  grippingHands.visible=holding;
  // All spine bending is weighted in the source GLB, not a whole-torso morph.
  // One-shot defeat is held at the end so eliminated players stay down.
  if(name==="Explotar_Caer"){
   deadAmount=Math.min(1,deadAmount+dt/1.6);
   animatedRig.rotation.z=-.55*deadAmount;
   animatedRig.position.y=-.10*deadAmount;
  }else{
   deadAmount=0;
   animatedRig.rotation.set(0,0,0);
   animatedRig.position.set(0,0,0);
  }
  animatedRig.scale.set(1,1,1);
 };
 const dispose=()=>{
  mixer.stopAllAction();mixer.uncacheRoot(original);
  wardrobe.dispose();
  palmMat.dispose();
  // Palm geometry remains shared with this actor only.
  palmGeometry.dispose();
  for(const m of materials)m.dispose();
 };
 return {root,handAnchor:animatedRig,update,dispose,costume:"plain",kind:"uploaded",alive:true,mixer};
}
