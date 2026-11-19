import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const code=readFileSync(new URL("./bomba3d/game.js",import.meta.url),"utf8");
const page=readFileSync(new URL("./bomba.html",import.meta.url),"utf8");
const ensureCode=code.slice(code.indexOf("async function ensureUploaded(){"),code.indexOf("async function ensureSeamless(){"));
const rosterCode=code.slice(code.indexOf("export function syncRoom(data){"),code.indexOf("export function onGameTransition(")).replace(/^export /gm,"");
assert.ok(ensureCode.startsWith("async function ensureUploaded()"));
assert.ok(rosterCode.startsWith("function syncRoom(data)"));
let loaded=false;
const messages=[];
const colors=["#f83e50","#27b9e8","#4acb75","#ffcf45","#ff84b6","#8970e8","#ef8f43","#54d7ca"];
const costumes=["plain","chicken","dino","frog","cat","bunny","hero","robot"];
const users=Array.from({length:8},(_,i)=>({
 id:"player-"+i, nombre:"Personaje "+(i+1), vivo:true,
 avatar:{costume3d:costumes[i],bodyColor3d:colors[i]}
}));
const cards=users.map(p=>({dataset:{playerId:p.id},style:{left:"0px",top:"0px"}}));
const added=[];
const scene={add:actor=>added.push(actor),remove:()=>{}};
const stage={clientWidth:340,clientHeight:625,classList:{add(){}}};
const preview={classList:{add(){}}};
const view={players:{children:cards},tableStage:stage,preview};
const toActor=(kind,avatar)=>({
 kind,costume:avatar.costume3d||"plain",color:avatar.bodyColor3d,stamp:"",
 root:{scale:{setScalar(){}},position:{set(){}}},
 dispose(){}
});
const context={
 actors:new Map(),active:true,
 arena:{scene},studio:{scene,actor:null},
 roomData:null,previewData:null,previewStamp:"",loadingUploaded:null,
 hasOriginalModel:()=>loaded,
 preloadOriginalModel:async()=>{loaded=true;return {scene:"GLB"}},
 createJellyAvatar:avatar=>toActor("jelly",avatar),
 createOriginalRubberActor:avatar=>toActor("uploaded",avatar),
 removeActor:()=>{},
 setPosition:()=>{},
 el:id=>view[id],
 announce:message=>messages.push(message),
 ensureSeamless:async()=>{},
 console,
};
vm.runInNewContext(ensureCode+"\n"+rosterCode+"\nthis.entry={ensureUploaded,syncRoom,syncPreview}",context);
const {ensureUploaded,syncRoom,syncPreview}=context.entry;

test("Before loading, fallback still preserves every individual costume and color",()=>{
 syncRoom({jugadores:users,estado:"ready"});
 assert.equal(context.actors.size,8);
 for(const [i,p] of users.entries()){
  const actor=context.actors.get(p.id);
  assert.equal(actor.kind,"jelly");
  assert.equal(actor.costume,costumes[i]);
  assert.equal(actor.color,colors[i]);
 }
});
test("After original GLB arrives, ALL eight seats change to it and keep their colors",async()=>{
 syncPreview(users[1].avatar);
 assert.equal(context.studio.actor.kind,"jelly");
 await ensureUploaded();
 assert.equal(context.actors.size,8);
 for(const [i,p] of users.entries()){
  const actor=context.actors.get(p.id);
  assert.equal(actor.kind,"uploaded",p.id);
  assert.equal(actor.color,colors[i],p.id+" color");
 }
 assert.equal(context.studio.actor.kind,"uploaded");
 assert.equal(context.studio.actor.color,colors[1]);
 assert.match(messages.at(-1),/original GLB/);
});
test("Refreshing roster does not recreate loaded GLBs or lose colors",()=>{
 const before=Array.from(context.actors.values());
 syncRoom({jugadores:users,estado:"ready"});
 const after=Array.from(context.actors.values());
 for(let i=0;i<8;i++)assert.equal(after[i],before[i]);
});
test("Changing the saved player color only updates that player",()=>{
 const updated=users.map((p,i)=>i===1?{...p,avatar:{...p.avatar,bodyColor3d:"#f83e50"}}:p);
 const previous=new Map(context.actors);
 syncRoom({jugadores:updated,estado:"ready"});
 assert.equal(context.actors.size,8);
 assert.notEqual(context.actors.get("player-1"),previous.get("player-1"));
 assert.equal(context.actors.get("player-1").color,"#f83e50");
 for(let i=0;i<8;i++)if(i!==1)assert.equal(context.actors.get("player-"+i),previous.get("player-"+i));
});
test("3D selection is standardized but no costumes are erased from saved data",()=>{
 assert.match(code,/const wantsUploaded=hasOriginalModel\(\);/);
 assert.doesNotMatch(code,/const wantsUploaded=.*costume3d/);
 assert.match(page,/bomba3d\/game\.js\?v=5/);
 assert.match(page,/id="costume3d"/);
 assert.match(page,/Disfraz anterior \(guardado\)/);
 assert.match(page,/Color de capucha anterior \(guardado\)/);
 assert.match(page,/p_action:"pasar",p_target:target\.id/);
 assert.match(page,/id="passBomb"/);
 assert.deepEqual(users.map(p=>p.avatar.costume3d),costumes);
});
