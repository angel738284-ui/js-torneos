import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import {Box3,Vector3} from "./bomba3d/vendor/three.module.js";
import {COSTUMES,BODY_COLORS,HOOD_COLORS,DEFAULT_JELLY,normalizeJelly,createJellyAvatar} from "./bomba3d/jelly.js";

const html=readFileSync(new URL("./bomba.html",import.meta.url),"utf8");
const controller=readFileSync(new URL("./bomba3d/game.js",import.meta.url),"utf8");
const css=readFileSync(new URL("./bomba3d/game.css",import.meta.url),"utf8");
const migration=readFileSync(new URL("./bomba3d/jelly_avatar_upgrade.sql",import.meta.url),"utf8");

test("Twelve original jelly costumes are generated as real 3D geometry",()=>{
 assert.equal(COSTUMES.length,12);
 for(const costume3d of COSTUMES){
  const a=createJellyAvatar({costume3d,bodyColor3d:"#4acb75",hoodColor3d:"#f6c843"});
  let count=0,white=0;
  a.root.traverse(child=>{
   if(child.isMesh){count++;if(child.name.startsWith("glowyEye"))white++;}
  });
  assert.ok(count>=12,"3D model missing geometry: "+costume3d);
  assert.equal(white,2,"Each character has two glowing eyes");
  const bounds=new Box3().setFromObject(a.root),dim=new Vector3();
  bounds.getSize(dim);
  assert.ok(dim.y>=2&&dim.y<=3.3,"Model should fit the table: "+costume3d);
  a.update(.033,"idle");a.update(.033,"receive");a.update(.033,"death");
  a.dispose();
 }
});
test("Costumes are visually distinct, including animals, hero, robot and astronaut",()=>{
 const specific={
  dino:["spike","dinoTail"],cat:["catEar"],frog:["frogEyeBump"],
  chicken:["comb","chickenBeak"],bear:["bearEar"],bunny:["bunnyEar"],
  hero:["heroCape"],office:["officeShirt"],ninja:["ninjaMask"],
  robot:["robotHelmet"],astronaut:["astronautHelmet"]
 };
 for(const [costume,expected] of Object.entries(specific)){
  const a=createJellyAvatar({costume3d:costume});
  const names=[];a.root.traverse(x=>names.push(x.name));
  for(const feature of expected)assert.ok(names.some(x=>x.includes(feature)),costume+" "+feature);
  a.dispose();
 }
});
test("The core 3D characters do not require network calls or GLBs",()=>{
 assert.doesNotMatch(controller,/GLTFLoader|\\.glb|loadAsync/);
 assert.match(controller,/fetch\(url.href/);
 assert.match(controller,/seamless_body\.bin/);
 assert.match(controller,/createJellyAvatar/);
 assert.match(controller,/one low-cost WebGL canvas|one low-cost WebGL canvas/i);
 assert.match(html,/bomba3d\/game\.js\?v=3/);
 assert.match(html,/bomba3d\/game\.css\?v=2/);
 assert.ok(statSync(new URL("./bomba3d/vendor/three.module.js",import.meta.url)).size>100000);
});
test("Editable costumes and colors match client and database allowlists",()=>{
 const options=html.match(/<select id="costume3d">([\s\S]*?)<\/select>/)?.[1]||"";
 const costumes=[...options.matchAll(/<option value="([a-z]+)">/g)].map(x=>x[1]);
 assert.deepEqual(costumes,COSTUMES);
 assert.equal(BODY_COLORS.length,10);
 assert.equal(HOOD_COLORS.length,10);
 for(const c of COSTUMES)assert.match(migration,new RegExp("'"+c+"'"));
 for(const field of ["costume3d","bodyColor3d","hoodColor3d"]){
  assert.match(html,new RegExp('id="'+field+'"'));
  assert.match(migration,new RegExp("'"+field+"'"));
 }
 assert.match(html,/p_action:"avatar",p_avatar:value/);
 assert.match(html,/bodyColor3d:"#f83e50"/);
});
test("Invalid inputs cannot inject colors or unknown costumes",()=>{
 const c=normalizeJelly({costume3d:"unexpected",bodyColor3d:"javascript:alert(1)",hoodColor3d:"#abc"});
 assert.deepEqual(c,DEFAULT_JELLY);
 assert.equal(createJellyAvatar(c).costume,"plain");
});
test("The original Bomba Mortal game is still the authority for passes and eliminations",()=>{
 assert.match(html,/p_action:"pasar",p_target:target\.id/);
 assert.match(html,/canChooseTarget\(target\)/);
 assert.match(html,/if\(!target\|\|!canChooseTarget\(target\)\|\|!canPass\(\)\|\|busy\)return/);
 assert.match(controller,/onGameTransition\(before,after\)/);
 assert.match(controller,/actor\.action="death"/);
 assert.match(controller,/syncRoom\(data\)/);
 assert.match(html,/id="passBomb"/);
});
test("Mobile performance fallbacks still work with the new original models",()=>{
 assert.match(controller,/deviceMemory<=2/);
 assert.match(controller,/lowMotion\(\)/);
 assert.match(controller,/const interval=actors.size>16\?65/);
 assert.match(controller,/set3DEnabled\(false\)/);
 assert.match(css,/\.tableStage\.is3d \.player \.char/);
 assert.match(controller,/navigator\?\.deviceMemory/);
});
test("24 3D avatars can be generated and animated without external assets",()=>{
 const a=[];
 for(let i=0;i<24;i++){
  const char=createJellyAvatar({
   costume3d:COSTUMES[i%COSTUMES.length],
   bodyColor3d:BODY_COLORS[i%BODY_COLORS.length],
   hoodColor3d:HOOD_COLORS[i%HOOD_COLORS.length]
  });
  char.update(.033,i%2?"dance":"idle");
  a.push(char);
 }
 assert.equal(a.length,24);
 for(const character of a)character.dispose();
});
