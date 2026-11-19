/**
 * Uploaded JS Family rubber GLB: original geometry, embedded textures and normals.
 * The file is unrigged (one mesh, zero animations); this adapter provides non-bone
 * idle/receive/death body motions while preserving the source model and its eyes.
 */
import * as THREE from "./vendor/three.module.js";
import {GLTFLoader} from "./vendor/GLTFLoader.js";
import {dressOriginalRubber} from "./wardrobe.js?v=1";

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
 let elapsed=0,deadAmount=0;
 const update=(delta,action="idle",reduced=false)=>{
  elapsed+=Math.min(.10,delta||0);
  wardrobe.update(elapsed,reduced);
  if(action==="death"){
   deadAmount=Math.min(1,deadAmount+Math.max(.045,(delta||.03)*1.8));
   animatedRig.rotation.z=-1.20*deadAmount;
   animatedRig.position.y=-.35*deadAmount;
   return;
  }
  deadAmount=Math.max(0,deadAmount-.12);
  const dancing=action==="dance"||options.pose==="dance";
  const wave=action==="receive"||action==="wave"||options.pose==="wave";
  animatedRig.rotation.z=reduced?0:Math.sin(elapsed*(dancing?7.0:2.1))*(dancing?.16:wave?.10:.045);
  animatedRig.position.y=(reduced?0:Math.sin(elapsed*(dancing?7.0:2.5))*(dancing?.065:.035));
  animatedRig.rotation.y=reduced?0:Math.sin(elapsed*1.6)*.06;
 };
 const dispose=()=>{
  wardrobe.dispose();
  for(const m of materials)m.dispose();
 };
 return {root,update,dispose,costume:"plain",kind:"uploaded",alive:true};
}
