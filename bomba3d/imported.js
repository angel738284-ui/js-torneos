/**
 * Uploaded JS Family rubber GLB: original geometry, embedded textures and normals.
 * The file is unrigged (one mesh, zero animations); this adapter provides non-bone
 * idle/receive/death body motions while preserving the source model and its eyes.
 */
import * as THREE from "./vendor/three.module.js";
import {GLTFLoader} from "./vendor/GLTFLoader.js";
import {dressOriginalRubber} from "./wardrobe.js?v=4";
import {installTwoHandMorph,setTwoHandPose} from "./two-hand-pose.js";

let sourcePromise=null,loaded=null;
const tintedTextures=new Map();
const defaultRed="#f83e50";
const loader=new GLTFLoader();
const filename="./models/js-rubber-mobile.glb";

export function hasOriginalModel(){return Boolean(loaded);}
export function preloadOriginalModel(){
 if(!sourcePromise){
  const uri=new URL(filename,import.meta.url);
  sourcePromise=loader.loadAsync(uri.href).then(gltf=>{
   if(!gltf?.scene)throw Error("El modelo original está vacío");
   gltf.scene.updateMatrixWorld(true);
   const bounds=new THREE.Box3().setFromObject(gltf.scene);
   if(!Number.isFinite(bounds.min.y)||bounds.isEmpty())throw Error("Geometría 3D inválida");
   // Prepare a shared GPU morph target; each user's copy has its own pose.
   gltf.scene.traverse(o=>{
    if(o.isMesh){
     installTwoHandMorph(o.geometry,bounds);
     o.updateMorphTargets();
    }
   });
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
export function createOriginalRubberActor(options={}){
 if(!loaded)throw Error("El modelo original todavía no está cargado");
 const root=new THREE.Group();
 root.name="Uploaded-JS-Family-Rubber";
 const animatedRig=new THREE.Group();
 animatedRig.name="JS_3D_ANIMATED_BODY_AND_CLOTHING";
 root.add(animatedRig);
 const original=loaded.gltf.scene.clone(true);
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
 // Short, independent eyelid blinks; the original model has painted eyes.
 const eyelidMaterial=new THREE.MeshStandardMaterial({color:options.bodyColor3d||defaultRed,roughness:.49,metalness:.04,side:THREE.DoubleSide});
 const eyelidGeometry=new THREE.SphereGeometry(1,18,12);
 const eyelids=[];
 for(const side of [-1,1]){
  const lid=new THREE.Mesh(eyelidGeometry,eyelidMaterial);
  lid.name=side<0?'JS_LEFT_BLINK':'JS_RIGHT_BLINK';
  lid.position.set(side*.215,2.155,.493);
  lid.scale.set(.145,.01,.028);
  lid.visible=false;
  animatedRig.add(lid);eyelids.push(lid);
 }
 const blinkOffset=Math.random()*4.2;
 let gripPose=0;
 let elapsed=0,deadAmount=0;
 const update=(delta,action="idle",reduced=false)=>{
  elapsed+=Math.min(.10,delta||0);
  wardrobe.update(elapsed,reduced);
  // A blink lasts ~160 ms every 3–6 seconds; no permanent facial movement.
  const cycle=(elapsed+blinkOffset)%4.7;
  const blink=cycle<.18?Math.sin(Math.PI*cycle/.18):0;
  for(const lid of eyelids){lid.visible=blink>.035;lid.scale.y=Math.max(.01,.205*blink);}

  const gripping=action==="hold"||action==="catch";
  const target=gripping?1:action==="throw"?.02:0;
  gripPose+=(target-gripPose)*Math.min(1,Math.max(0,delta||0)*8);
  setTwoHandPose(animatedRig,gripPose);
  grippingHands.visible=gripPose>.14||gripping;
  if(action==="death"){
   deadAmount=Math.min(1,deadAmount+Math.max(.045,(delta||.03)*1.8));
   // Full tumble onto the floor, not just a slight lean.
   animatedRig.rotation.z=-Math.PI*.5*deadAmount;
   animatedRig.rotation.x=.12*deadAmount;
   animatedRig.position.y=-.12*deadAmount;
   return;
  }
  deadAmount=Math.max(0,deadAmount-.12);
  const dancing=action==="dance"||options.pose==="dance";
  const throwing=action==="throw",catching=action==="catch";
  const idleSway=0;
  // The GLB is unrigged, so throwing and catching use exaggerated
  // upper-body lean, not fabricated separate arm-bone animations.
  animatedRig.rotation.z=reduced?0:
   throwing?-.32+Math.sin(elapsed*10)*.07:
   catching?.19+Math.sin(elapsed*8)*.04:gripping?.045:idleSway;
  animatedRig.rotation.x=reduced?0:throwing?-.14:catching?.12:0;
  animatedRig.position.y=reduced?0:Math.sin(elapsed*(dancing?7:2.3))*(dancing?.09:.022);
  animatedRig.position.x=reduced?0:Math.sin(elapsed*1.35)*(dancing?.12:.035);
  animatedRig.rotation.y=reduced?0:Math.sin(elapsed*1.25)*(dancing?.14:.045);
 };
 const dispose=()=>{
  wardrobe.dispose();
  eyelidMaterial.dispose();eyelidGeometry.dispose();
  palmMat.dispose();
  // Palm geometry remains shared with this actor only.
  palmGeometry.dispose();
  for(const m of materials)m.dispose();
 };
 return {root,handAnchor:animatedRig,update,dispose,costume:"plain",kind:"uploaded",alive:true};
}
