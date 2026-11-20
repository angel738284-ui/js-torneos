import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import {createHash} from "node:crypto";
import {GLTFLoader} from "./bomba3d/vendor/GLTFLoader.js";
import {createOriginalRubberActor,preloadOriginalModel} from "./bomba3d/imported.js";

const original=readFileSync(new URL("./bomba3d/models/js-rubber-original.glb",import.meta.url));
const mobile=readFileSync(new URL("./bomba3d/models/js-rubber-mobile.glb",import.meta.url));
const page=readFileSync(new URL("./bomba.html",import.meta.url),"utf8");
const game=readFileSync(new URL("./bomba3d/game.js",import.meta.url),"utf8");
const studio=readFileSync(new URL("./modelo-js.html",import.meta.url),"utf8");

function parseGLB(bytes){
 assert.equal(bytes.toString("ascii",0,4),"glTF");
 assert.equal(bytes.readUInt32LE(4),2);
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 const jsonSize=bytes.readUInt32LE(12);
 assert.equal(bytes.toString("ascii",16,20),"JSON");
 const json=JSON.parse(bytes.toString("utf8",20,20+jsonSize));
 const offset=20+jsonSize;
 assert.equal(bytes.toString("ascii",offset+4,offset+8),"BIN\0");
 const binSize=bytes.readUInt32LE(offset);
 const bin=bytes.subarray(offset+8,offset+8+binSize);
 assert.equal(offset+8+binSize,bytes.length);
 return {json,bin};
}

test("Uploaded source GLB exactly matches the user-provided Android download",()=>{
 const hash=createHash("sha256").update(original).digest("hex");
 assert.equal(hash,"1d87d5cb4eb498a9ff0f63461818d9c533974cff8c1058e1acc74ea54328c3e9");
 assert.equal(original.length,1109128);
});
test("Optimized GLB retains identical topology and animation limitations",()=>{
 const a=parseGLB(original),b=parseGLB(mobile);
 assert.equal(b.json.accessors.length,a.json.accessors.length);
 assert.equal(b.json.meshes.length,a.json.meshes.length);
 assert.equal(a.json.skins?.length||0,0);
 assert.equal(a.json.animations?.length||0,0);
 assert.ok(mobile.length<original.length);
 assert.equal(b.json.images.length,3);
 assert.equal(a.json.meshes[0].primitives[0].attributes.POSITION,b.json.meshes[0].primitives[0].attributes.POSITION);
 const posID=a.json.meshes[0].primitives[0].attributes.POSITION;
 assert.equal(a.json.accessors[posID].count,11383);
 for(let i=0;i<a.json.accessors.length;i++){
  const orig=a.json.accessors[i],tiny=b.json.accessors[i];
  assert.equal(orig.count,tiny.count);
  assert.deepEqual(orig.min,tiny.min);
  assert.deepEqual(orig.max,tiny.max);
  if(orig.bufferView!==undefined){
   const get=(source,viewNo)=>{
    const view=source.json.bufferViews[viewNo];
    return source.bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength);
   };
   assert.equal(createHash("sha256").update(get(a,orig.bufferView)).digest("hex"),
     createHash("sha256").update(get(b,tiny.bufferView)).digest("hex"),
     "non-texture buffer "+i+" must remain identical");
  }
 }
});
test("GLB has embedded original textures and no external download references",()=>{
 const {json,bin}=parseGLB(mobile);
 assert.equal(json.buffers.length,1);
 assert.ok(!json.buffers[0].uri);
 for(const image of json.images){
  assert.equal(image.mimeType,"image/jpeg");
  const view=json.bufferViews[image.bufferView];
  const imageData=bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength);
  assert.equal(imageData[0],0xff);
  assert.equal(imageData[1],0xd8);
  assert.equal(imageData.at(-2),0xff);
  assert.equal(imageData.at(-1),0xd9);
 }
});
test("Three.js GLTFLoader bundle and all local module dependencies import",()=>{
 assert.equal(typeof GLTFLoader,"function");
 assert.equal(typeof preloadOriginalModel,"function");
 assert.equal(typeof createOriginalRubberActor,"function");
 assert.ok(statSync(new URL("./bomba3d/utils/BufferGeometryUtils.js",import.meta.url)).size>10000);
});
test("Bomba Mortal game uses only the uploaded GLB with a 3D wardrobe",()=>{
 assert.match(page,/bomba3d\/game\.js\?v=17/);
 assert.match(game,/preloadOriginalModel\(\)/);
 assert.match(game,/createOriginalRubberActor\(avatar\)/);
 assert.match(game,/studio\.actor=createOriginalRubberActor\(avatar\)/);
 assert.doesNotMatch(game,/createJellyAvatar|ensureSeamless/);
 assert.match(page,/id="wear3d"/);
 assert.match(page,/p_action:"pasar",p_target:target\.id/);
 assert.match(page,/id="passBomb"/);
});
test("Public 3D viewer opens uploaded GLB instead of the former generated mesh",()=>{
 assert.match(studio,/preloadOriginalModel\(\)/);
 assert.match(studio,/createOriginalRubberActor\(\{bodyColor3d:color\}\)/);
 assert.doesNotMatch(studio,/fetch\("\.\/bomba3d\/seamless_body\.bin"/);
 assert.match(studio,/Girar solo/);
 assert.match(studio,/data-color="#f83e50"/);
});
