/**
 * JS Family Bomba Mortal — wardrobe for the single uploaded GLB.
 * Surface-conforming clothing overlays follow the exact source mesh.
 * Wardrobe is independent from the gameplay state and requires no new RPCs.
 * Models remain unrigged; accessories/garments move with the body.
 */
import * as THREE from "./vendor/three.module.js";
import {installTwoHandMorph} from "./two-hand-pose.js";

const shellCache=new WeakMap();
const iconTextures=new Map();
const shoeColors={white:"#f5f5ff",black:"#252b3f",red:"#ff6275",gold:"#f4d57a",neon:"#75f8d5",pink:"#ffa6db"};
const auraColors={cyan:"#64ffff",purple:"#bda0ff",gold:"#ffe28b",fire:"#ff895c",pink:"#ffacd5"};
const color=/^#[0-9a-f]{6}$/i;
const safeColor=(value,fallback)=>color.test(value||"")?value:fallback;
const ringGeometry=new THREE.TorusGeometry(1,.07,8,36);
const sphereGeometry=new THREE.SphereGeometry(1,16,12);
const coneGeometry=new THREE.ConeGeometry(1,1,12);
const boxGeometry=new THREE.BoxGeometry(1,1,1);
const cylinderGeometry=new THREE.CylinderGeometry(1,1,1,28);
// Shared procedural woven texture: tiny GPU footprint even with 20 players.
let fabricTexture=null;
function clothTexture(){
 if(fabricTexture)return fabricTexture;
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
 const ctx=canvas.getContext('2d'),img=ctx.createImageData(128,128);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  const i=(y*128+x)*4,grain=((x*17+y*29+x*y*3)%13)-6;
  const v=Math.max(205,Math.min(255,239+(x%4===0?-13:x%4===2?8:0)+(y%4===0?-12:y%4===2?8:0)+grain));
  img.data[i]=img.data[i+1]=img.data[i+2]=v;img.data[i+3]=255;
 }
 ctx.putImageData(img,0,0);
 fabricTexture=new THREE.CanvasTexture(canvas);fabricTexture.colorSpace=THREE.SRGBColorSpace;
 fabricTexture.wrapS=fabricTexture.wrapT=THREE.RepeatWrapping;fabricTexture.anisotropy=2;
 return fabricTexture;
}
const mat=(c,opts={})=>new THREE.MeshStandardMaterial({color:c,roughness:.83,metalness:0,...opts});
const cloth=c=>mat(c,{map:clothTexture(),roughness:.92});
function mesh(parent,geometry,material,name,pos=[0,0,0],scale=[1,1,1],rot=[0,0,0]){
 const object=new THREE.Mesh(geometry,material);
 object.name=name;
 object.position.set(...pos);object.scale.set(...scale);
 object.rotation.set(...rot);
 parent.add(object);
 return object;
}
function oval(parent,material,name,pos,scale,rot){
 return mesh(parent,sphereGeometry,material,name,pos,scale,rot);
}
function makeShellGeometry(source,kind,bounds){
 let shapes=shellCache.get(source);
 if(!shapes){shapes=new Map();shellCache.set(source,shapes);}
 if(shapes.has(kind))return shapes.get(kind);
 const position=source.attributes.position,normal=source.attributes.normal,idx=source.index;
 const baseMin=bounds.min,baseMax=bounds.max,factor=2.55/(baseMax.y-baseMin.y);
 const centerX=(baseMin.x+baseMax.x)*.5,centerZ=(baseMin.z+baseMax.z)*.5;
 const coords=[];
 const norm=[];
 const uv=[];
 const count=idx?idx.count:position.count;
 const p=(i)=>[ (position.getX(i)-centerX)*factor,
                  (position.getY(i)-baseMin.y)*factor,
                  (position.getZ(i)-centerZ)*factor ];
 const selected=(x,y,z)=>{
  const ab=Math.abs(x);
  switch(kind){
   case "shirt":return y>.76&&y<1.53&&ab<.51;
   case "crop":return y>1.12&&y<1.52&&ab<.51;
   case "sleeves":return y>.59&&y<1.52&&ab>=.45;
   case "shortSleeves":return y>1.12&&y<1.54&&ab>=.45;
   case "pants":return y>.22&&y<.82&&ab<.63;
   case "shorts":return y>.51&&y<.87&&ab<.63;
   case "shoes":return y<.25&&ab<.65;
   default:return false;
  }
 };
 for(let n=0;n<count;n+=3){
  const indices=[idx?idx.getX(n):n,idx?idx.getX(n+1):n+1,idx?idx.getX(n+2):n+2];
  const xyz=indices.map(p);
  const mx=xyz.reduce((a,p)=>a+p[0],0)/3,my=xyz.reduce((a,p)=>a+p[1],0)/3,
    mz=xyz.reduce((a,p)=>a+p[2],0)/3;
  if(!selected(mx,my,mz))continue;
  for(let v=0;v<3;v++){
   const [x,y,z]=xyz[v],i=indices[v];
   const nx=normal.getX(i),ny=normal.getY(i),nz=normal.getZ(i);
   // Offset at least 2 cm to avoid Z-fighting with the real textured body.
   const shift=kind==="shoes"?.025:.023;
   coords.push(x+nx*shift,y+ny*shift,z+nz*shift);
   norm.push(nx,ny,nz);
   uv.push(x*6+3,y*6);
  }
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute("position",new THREE.Float32BufferAttribute(coords,3));
 g.setAttribute("normal",new THREE.Float32BufferAttribute(norm,3));
 g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
 g.computeBoundingSphere();
 // Sleeves deform with the original GLB arms, avoiding stiff clothing.
 if(kind==="sleeves"||kind==="shortSleeves")installTwoHandMorph(g,null,true);
 shapes.set(kind,g);
 return g;
}
function decalMaterial(mark){
 if(iconTextures.has(mark))return iconTextures.get(mark);
 if(typeof document==="undefined")return null;
 const canvas=document.createElement("canvas");
 canvas.width=256;canvas.height=256;
 const ctx=canvas.getContext("2d");
 if(!ctx)return null;
 ctx.clearRect(0,0,256,256);
 ctx.fillStyle="#fffdfa";
 ctx.textAlign="center";ctx.textBaseline="middle";
 ctx.shadowColor="#111827";ctx.shadowBlur=7;
 ctx.font=mark==="456"?"900 104px Arial":"900 165px Arial";
 ctx.fillText(mark,128,125);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide});
 iconTextures.set(mark,material);
 return material;
}
/** Build custom clothes from existing vetted avatar fields. */
export function dressOriginalRubber(root,rawAvatar,sourceGeometry,sourceBounds){
 const a=rawAvatar||{},materials=[],accessories=[],group=new THREE.Group();
 group.name="JS_WARDROBE_3D";
 root.add(group);
 const own=(c,opts)=>{const m=mat(c,opts);materials.push(m);return m;};
 const main=cloth(safeColor(a.shirt,"#775de6"));materials.push(main);
 const pant=cloth(safeColor(a.pants,"#273751"));materials.push(pant);
 const shoes=own(shoeColors[a.shoes]||shoeColors.white);
 const accent=own("#fff7e3");
 const dark=own("#243047");
 const gold=own("#f2c75f");
 const soft=own("#f6b2ca");
 const draw=(kind,material,name)=>{
  const geometry=makeShellGeometry(sourceGeometry,kind,sourceBounds);
  if(!geometry.attributes.position.count)return null;
  return mesh(group,geometry,material,name);
 };
 let aura=null;
 if(a.wear3d==="yes"){
 const style=a.topStyle||"tee";
 const lower=a.bottomStyle||"pants";
 if(style==="tee"||style==="jersey") {
  draw("shirt",main,"3d_remera");
  draw("shortSleeves",main,"3d_mangas_cortas");
 }else if(style==="hoodie"||style==="jacket"){
  draw("shirt",main,style==="hoodie"?"3d_buzo":"3d_campera");
  draw("sleeves",main,"3d_mangas_largas");
  if(style==="jacket"){
   mesh(group,boxGeometry,accent,"3d_cierre_campera",[0,1.16,.52],[.026,.52,.013]);
   for(const x of [-.23,.23])mesh(group,boxGeometry,dark,"3d_bolsillo",[x,.91,.42],[.13,.048,.02]);
  }else{
   const loop=mesh(group,ringGeometry,main,"3d_capucha_cuello",[0,1.51,-.05],[.36,.26,.24],[Math.PI/2,0,0]);
   for(const x of [-.065,.065])oval(group,accent,"cordon_buzo",[x,1.36,.47],[.016,.14,.013]);
  }
 }else if(style==="crop"){
  draw("crop",main,"3d_top_corto");
  draw("shortSleeves",main,"3d_mangas_cortas");
 }else if(style==="dress"){
  draw("shirt",main,"3d_vestido_torso");
  draw("shortSleeves",main,"3d_mangas");
  const skirt=new THREE.CylinderGeometry(.43,.64,.48,32,1,true);
  mesh(group,skirt,main,"3d_vestido_falda",[0,.69,0],[1,1,.84]);
  accessories.push(skirt);
 }
 if(style!=="none"&&style!=="dress"){
  const marker={star:"★",number:"456",bolt:"⚡",heart:"♥"}[a.pattern];
  if(marker){
   const material=decalMaterial(marker);
   if(material){
    const g=new THREE.PlaneGeometry(.32,.26);
    mesh(group,g,material,"3d_estampado",[0,1.17,.56]);
    accessories.push(g);
   }
  }else if(a.pattern==="stripes"){
   const stripeMaterial=own(new THREE.Color(main.color).lerp(new THREE.Color("#ffffff"),.52));
   for(const x of [-.12,.12])mesh(group,boxGeometry,stripeMaterial,"3d_rayas",[x,1.18,.55],[.047,.39,.014]);
  }
 }
 if(lower==="shorts"){
  draw("shorts",pant,"3d_short");
 }else if(lower==="skirt"&&style!=="dress"){
  const skirt=new THREE.CylinderGeometry(.4,.60,.44,32,1,true);
  mesh(group,skirt,pant,"3d_pollera",[0,.70,0],[1,1,.87]);
  accessories.push(skirt);
 }else if(lower==="pants"||lower==="jeans"||lower==="cargo"){
  draw("pants",pant,"3d_pantalones");
  if(lower==="cargo"){
   for(const side of [-1,1])mesh(group,boxGeometry,pant,"3d_bolsillo_cargo",[side*.37,.52,.16],[.18,.16,.085],[0,0,side*.09]);
  }
 }
 draw("shoes",shoes,"3d_zapatillas");
 } // Clothing ends here: accessories never turn on a full outfit.
 const acc=a.accessory||"none";
 switch(acc){
  case "glasses":{
   const lens=new THREE.TorusGeometry(.135,.023,8,24);
   for(const x of [-.20,.20])mesh(group,lens,dark,"3d_anteojo",[x,2.07,.55],[1,1,1]);
   mesh(group,boxGeometry,dark,"3d_puente",[0,2.07,.55],[.12,.023,.025]);
   accessories.push(lens);break;
  }
  case "crown":{
   const base=new THREE.CylinderGeometry(.36,.44,.16,16);
   mesh(group,base,gold,"3d_corona_base",[0,2.53,0]);
   accessories.push(base);
   for(let i=0;i<7;i++){
    const angle=i*Math.PI*2/7;
    mesh(group,coneGeometry,gold,"3d_corona_punta",
     [Math.sin(angle)*.34,2.68,Math.cos(angle)*.34],[.10,.32,.10]);
   }break;
  }
  case "mask":{
   oval(group,dark,"3d_barbijo",[0,1.86,.53],[.31,.14,.075]);break;
  }
  case "cap":{
   oval(group,main,"3d_gorra",[0,2.48,0],[.48,.21,.46]);
   oval(group,main,"3d_visera",[0,2.38,.40],[.35,.050,.24]);break;
  }
  case "headphones":{
   const g=new THREE.TorusGeometry(.47,.062,8,32,Math.PI);
   mesh(group,g,dark,"3d_auriculares_arco",[0,2.09,0]);
   accessories.push(g);
   for(const x of [-.50,.50])
    oval(group,main,"3d_auricular",[x,2.08,0],[.11,.24,.18]);
   break;
  }
  case "earrings":{
   const g=new THREE.TorusGeometry(.07,.019,6,20);
   for(const x of [-.51,.51])mesh(group,g,gold,"3d_aro",[x,1.88,.12]);
   accessories.push(g);break;
  }
  case "bandana":{
   const g=new THREE.TorusGeometry(.49,.055,8,36);
   mesh(group,g,main,"3d_vincha",[0,2.31,0],[1,1,1],[Math.PI/2,0,0]);
   accessories.push(g);break;
  }
  case "horns":{
   for(const x of [-.30,.30])
    mesh(group,coneGeometry,soft,"3d_cuerno",[x,2.59,0],[.15,.34,.15]);
   break;
  }
 }

 return {
  group,
  update:(elapsed,reduced)=>{
   if(aura&&!reduced){aura.rotation.z=elapsed*.6;}
  },
  dispose:()=>{
   for(const owned of materials)owned.dispose();
   for(const g of accessories)g.dispose();
   root.remove(group);
  }
 };
}
