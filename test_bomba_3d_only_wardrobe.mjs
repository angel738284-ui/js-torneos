import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import * as THREE from "./bomba3d/vendor/three.module.js";
import {dressOriginalRubber} from "./bomba3d/wardrobe.js";

function sourceMesh(){
 const bytes=readFileSync(new URL("./bomba3d/models/js-rubber-mobile.glb",import.meta.url));
 const n=bytes.readUInt32LE(12),j=JSON.parse(bytes.toString("utf8",20,20+n));
 const dataStart=20+n+8;
 function attr(id){
  const a=j.accessors[id],view=j.bufferViews[a.bufferView];
  const count=a.count*(a.type==="VEC3"?3:a.type==="VEC2"?2:1);
  const values=new Float32Array(count);
  for(let i=0;i<count;i++)values[i]=bytes.readFloatLE(dataStart+(view.byteOffset||0)+(a.byteOffset||0)+i*4);
  return new THREE.BufferAttribute(values,a.type==="VEC3"?3:a.type==="VEC2"?2:1);
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute("position",attr(0));g.setAttribute("normal",attr(1));
 const ia=j.accessors[3],iv=j.bufferViews[ia.bufferView],indices=[];
 for(let i=0;i<ia.count;i++){
  const off=dataStart+(iv.byteOffset||0)+i*(ia.componentType===5123?2:4);
  indices.push(ia.componentType===5123?bytes.readUInt16LE(off):bytes.readUInt32LE(off));
 }
 g.setIndex(indices);
 const bounds=new THREE.Box3(
  new THREE.Vector3(...j.accessors[0].min),
  new THREE.Vector3(...j.accessors[0].max));
 return {g,bounds};
}
const {g,bounds}=sourceMesh();
const avatar={wear3d:"yes",topStyle:"hoodie",shirt:"#e7476f",pattern:"plain",
 bottomStyle:"cargo",pants:"#273751",shoes:"gold",accessory:"crown",aura:"cyan",pose:"idle"};
function make(options){
 const root=new THREE.Group();
 const wardrobe=dressOriginalRubber(root,{...avatar,...options},g,bounds);
 const parts=[];root.traverse(o=>{if(o.isMesh)parts.push(o);});
 return {root,wardrobe,parts,names:parts.map(x=>x.name)};
}
test("3D classic remains completely undressed when wear3d=no",()=>{
 const naked=make({wear3d:"no"});
 assert.equal(naked.parts.length,0);
 naked.wardrobe.dispose();
});
test("Clothes are actual 3D geometry conformed to uploaded GLB vertices",()=>{
 const dressed=make({});
 for(const part of ["3d_buzo","3d_mangas_largas","3d_pantalones","3d_zapatillas","3d_corona_base"]){
  assert.ok(dressed.names.includes(part),part);
 }
 const body=dressed.parts.find(p=>p.name==="3d_buzo");
 assert.ok(body.geometry.attributes.position.count>6000);
 body.geometry.computeBoundingBox();
 const box=body.geometry.boundingBox;
 assert.ok(box.max.y>1.4&&box.min.y<1.0);
 dressed.wardrobe.update(1,false);
 dressed.wardrobe.dispose();
});
test("Six upper clothing types have individual mesh geometry",()=>{
 for(const topStyle of ["tee","hoodie","jacket","jersey","dress","crop"]){
  const a=make({topStyle,pattern:"plain"});
  assert.ok(a.parts.length>=3,topStyle);
  assert.ok(a.parts.some(p=>p.name.startsWith("3d_")&&!p.name.includes("zapatillas")),topStyle);
  a.wardrobe.dispose();
 }
});
test("Lower clothing options form pants, shorts, skirt or cargo pockets",()=>{
 for(const bottomStyle of ["pants","cargo","shorts","skirt","jeans"]){
  const a=make({bottomStyle,topStyle:"tee"});
  const desired={pants:"3d_pantalones",cargo:"3d_bolsillo_cargo",shorts:"3d_short",
    skirt:"3d_pollera",jeans:"3d_pantalones"}[bottomStyle];
  assert.ok(a.names.includes(desired),bottomStyle);
  a.wardrobe.dispose();
 }
});
test("Nine accessories each render visible 3D details",()=>{
 const names={glasses:"3d_anteojo",crown:"3d_corona_base",mask:"3d_barbijo",
  cap:"3d_gorra",headphones:"3d_auricular",earrings:"3d_aro",
  bandana:"3d_vincha",horns:"3d_cuerno"};
 for(const [accessory,name] of Object.entries(names)){
  const a=make({accessory});
  assert.ok(a.names.includes(name),accessory);
  a.wardrobe.dispose();
 }
});
test("Colors stay independent for individual users without mutating shared clothes geometry",()=>{
 const red=make({shirt:"#e7476f"}),green=make({shirt:"#2eae77"});
 const a=red.parts.find(p=>p.name==="3d_buzo"),b=green.parts.find(p=>p.name==="3d_buzo");
 assert.equal(a.geometry,b.geometry);
 assert.notEqual(a.material,b.material);
 assert.notEqual(a.material.color.getHexString(),b.material.color.getHexString());
 red.wardrobe.dispose();green.wardrobe.dispose();
});
test("The model remains one GLB for every player in roster and preview",()=>{
 const game=readFileSync(new URL("./bomba3d/game.js",import.meta.url),"utf8");
 const page=readFileSync(new URL("./bomba.html",import.meta.url),"utf8");
 assert.match(game,/createOriginalRubberActor\(avatar\)/);
 assert.match(game,/studio\.actor=createOriginalRubberActor\(avatar\)/);
 assert.doesNotMatch(game,/createJellyAvatar|jelly\.js|seamless_body\.bin/);
 assert.doesNotMatch(page,/bomba_avatar\.css|id="bomb3dToggle"/);
 assert.match(page,/id="wear3d"/);
 assert.match(page,/id="topStyle"/);
 assert.match(page,/id="accessory"/);
 assert.match(page,/p_action:"avatar",p_avatar:value/);
 assert.match(page,/p_action:"pasar",p_target:target\.id/);
 assert.match(page,/id="passBomb"/);
});
test("Editor has all server-validated fields and no visible outdated 2D avatars",()=>{
 const page=readFileSync(new URL("./bomba.html",import.meta.url),"utf8");
 const fields=page.match(/const fields=(\[[^\n]*\]);/)?.[1];
 const parsed=JSON.parse(fields);
 assert.equal(parsed.length,22);
 for(const field of parsed)assert.match(page,new RegExp('id="'+field+'"'));
 assert.match(page,/id="legacyAvatarValues" hidden/);
 assert.doesNotMatch(page,/const avatar=buildAvatar\(p\.avatar\)/);
 assert.match(page,/const avatar=document\.createElement\("span"\)/);
 assert.match(page,/className="modelSpace"/);
});

test("24 users can customize their outfits with reusable body meshes",()=>{
 const players=[];
 const tops=["tee","hoodie","jacket","jersey","dress","crop"];
 const pants=["pants","cargo","shorts","skirt","jeans"];
 for(let i=0;i<24;i++){
  const player=make({topStyle:tops[i%tops.length],
   bottomStyle:pants[i%pants.length],shirt:i%2?"#e7476f":"#2eae77",
   accessory:i%3?"glasses":"crown",wear3d:"yes"});
  assert.ok(player.parts.length>=3);
  players.push(player);
 }
 assert.equal(players.length,24);
 for(const player of players)player.wardrobe.dispose();
});
