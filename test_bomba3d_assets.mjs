import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync,statSync} from "node:fs";
import {join} from "node:path";
const root=new URL("./bomba3d/",import.meta.url).pathname;
const html=readFileSync(new URL("./bomba.html",import.meta.url),"utf8");
const code=readFileSync(join(root,"game.js"),"utf8");
const css=readFileSync(join(root,"game.css"),"utf8");
const sql=readFileSync(join(root,"model_upgrade.sql"),"utf8");

function glb(path){
 const b=readFileSync(path);
 assert.equal(b.toString("utf8",0,4),"glTF",path);
 assert.equal(b.readUInt32LE(4),2);
 assert.equal(b.readUInt32LE(8),b.byteLength);
 const length=b.readUInt32LE(12);
 assert.equal(b.toString("utf8",16,20),"JSON");
 return {raw:b,json:JSON.parse(b.subarray(20,20+length).toString("utf8"))};
}
test("Twenty-one original Quaternius CC0 GLBs are present and self-contained",()=>{
 const males=readdirSync(join(root,"models/Male")).filter(x=>x.endsWith(".glb"));
 const females=readdirSync(join(root,"models/Female")).filter(x=>x.endsWith(".glb"));
 assert.equal(males.length,11);
 assert.equal(females.length,10);
 for(const type of ["Male","Female"])for(const file of readdirSync(join(root,"models",type)).filter(x=>x.endsWith(".glb"))){
  const {raw,json}=glb(join(root,"models",type,file));
  assert.ok(raw.length>20000&&raw.length<4000000);
  assert.ok(json.skins?.length>0,"rigged "+file);
  assert.ok(json.animations?.some(x=>x.name==="Idle"),"Idle animation in "+file);
  assert.ok(json.animations?.some(x=>x.name==="Death"),"Death animation in "+file);
  assert.ok(json.animations?.some(x=>x.name==="Wave"),"Wave animation in "+file);
 }
});
test("3D renderer uses one canvas per arena rather than 24 contexts",()=>{
 assert.match(code,/const world=null|let world=null/);
 assert.match(code,/const holders=new Map\(\)/);
 assert.match(code,/if\(!world\)world=createScene\(stage/);
 assert.match(code,/const downloaded=new Map\(\)/);
 assert.match(code,/function loadOutfit\(outfit\)/);
 assert.match(code,/const pending=new Map\(\)/);
 assert.match(css,/\.bomb3dWorldCanvas/);
 assert.match(css,/pointer-events:none/);
});
test("Both WebGL and original CSS fallback are reachable from the public page",()=>{
 assert.match(html,/type="importmap"/);
 assert.match(html,/bomba3d\/game\.js/);
 assert.match(html,/id="bomb3dToggle"/);
 assert.match(html,/id="bomb3dStatus"/);
 assert.match(css,/\.tableStage\.is3d \.player \.char/);
 assert.match(code,/function restore2D\(\)/);
 assert.match(code,/el\("tableStage"\)\?\.classList\.remove\("is3d"\)/);
 assert.match(code,/deviceMemory<=2/);
});
test("3D edit is linked to a secure, validated 21-model field",()=>{
 assert.match(html,/id="outfit3d"/);
 assert.match(html,/p_action:"avatar",p_avatar:value/);
 assert.match(sql,/outfit3d/);
 assert.match(sql,/Male\/Casual_Hoodie/);
 assert.match(sql,/Female\/Casual/);
 assert.match(sql,/El atuendo 3D no está disponible/);
 assert.match(code,/function idFor\(avatar\)/);
 assert.match(code,/OUTFITS\.has\(outfit\)/);
});
test("Animations react to the server result and gameplay remains unchanged",()=>{
 assert.match(html,/window\.Bomb3D\?\.syncRoom\(room\)/);
 assert.match(html,/window\.Bomb3D\?\.onGameTransition\(before,result\)/);
 assert.match(code,/actor\.play\("Death"\)/);
 assert.match(code,/\.play\("Wave"\)/);
 assert.match(html,/id="passBomb"/);
 assert.match(html,/p_action:"pasar",p_target:target\.id/);
 assert.match(html,/id="tableStage"/);
});
test("Third-party attributions and Three license are bundled",()=>{
 const credit=readFileSync(join(root,"ASSETS.md"),"utf8");
 const license=readFileSync(join(root,"vendor/THREE_LICENSE.txt"),"utf8");
 assert.match(credit,/Quaternius.*CC0/);
 assert.match(license,/MIT License/);
 assert.ok(statSync(join(root,"vendor/three.module.js")).size>100000);
 assert.ok(statSync(join(root,"vendor/GLTFLoader.js")).size>10000);
 assert.ok(statSync(join(root,"vendor/SkeletonUtils.js")).size>1000);
});
