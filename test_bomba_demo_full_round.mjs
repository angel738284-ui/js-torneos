import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import * as THREE from "./bomba3d/vendor/three.module.js";
import {createBombProp,makePassAnimation,handWorldPosition,HAND_OFFSET} from "./bomba3d/bomb-effects.js";

const game=readFileSync(new URL("./bomba3d/game.js",import.meta.url),"utf8");
const page=readFileSync(new URL("./bomba.html",import.meta.url),"utf8");
const begin=game.indexOf("export function demoThrow(){");
const end=game.indexOf("function animate(time){",begin);
const logic=game.slice(begin,end).replaceAll("export function ","function ");
assert.ok(begin>0&&end>begin);
function makeScene(){
 let now=1000;
 const people=Array.from({length:8},(_,i)=>({id:"p"+i,vivo:true,nombre:"Bot "+i}));
 const actors=new Map();
 for(let i=0;i<8;i++){
  const p=people[i],root=new THREE.Group(),handAnchor=new THREE.Group();
  root.position.set(i*1.4-4.9,0,0);root.add(handAnchor);
  const bomb=createBombProp();
  handAnchor.add(bomb.root);bomb.root.position.set(...HAND_OFFSET);
  actors.set(p.id,{root,handAnchor,bomb,alive:true,action:"idle",until:0,playerId:p.id});
 }
 const events=[];
 const room={estado:"ready",titulo:"DEMO · Bomba Mortal JS Family",bomba_de:null,jugadores:people};
 const ctx=vm.createContext({
  roomData:room,actors,ready:true,flight:null,projectile:createBombProp(),
  demoHolder:null,demoPending:null,demoEndsAt:0,demoFuseStartAt:0,
  demoFuseDeadlineAt:0,demoSecondPass:null,demoVictimId:null,
  demoExplodedAt:0,demoFinishedAt:0,serverClockOffset:0,
  DEMO_FULL_DURATION_MS:20000,DEMO_FALL_HOLD_MS:4600,
  performance:{now:()=>now},window:{JSBombDemoExplosion:id=>events.push(id)},
  el:()=>null,roundFuseProgress:()=>1,handWorldPosition,makePassAnimation,
  Math,Map,Date,String
 });
 vm.runInContext(logic+"\nthis.functions={demoThrow,demoExplodeNow,onGameTransition,animateHeldAndFlyingBomb};",ctx);
 const tick=t=>{now=t;ctx.functions.animateHeldAndFlyingBomb(t,false);};
 return {ctx,room,people,actors,events,tick,setTime:t=>now=t,api:ctx.functions};
}
test("20-second demo makes two passes then one explosion and a visible fall",()=>{
 const s=makeScene();
 assert.equal(s.api.demoThrow(),true);
 assert.equal(s.ctx.demoFuseDeadlineAt-s.ctx.demoFuseStartAt,20000);
 assert.equal(s.ctx.demoHolder,"p0");
 assert.equal(s.api.demoThrow(),false,"no duplicate demo while running");
 s.tick(1000);
 assert.equal(s.actors.get("p0").bomb.root.visible,true);
 assert.equal(s.actors.get("p0").bomb.getFuseProgress(),1);
 s.tick(5500);
 assert.equal(s.ctx.demoHolder,"p0");
 s.tick(5600);
 assert.equal(s.ctx.demoHolder,"p1");
 assert.equal(s.ctx.projectile.root.visible,true);
 const firstDuration=s.ctx.flight.duration;
 s.tick(5650+firstDuration);
 assert.equal(s.ctx.flight,null);
 assert.equal(s.actors.get("p1").bomb.root.visible,true);
 const afterFirstBurn=s.actors.get("p1").bomb.getFuseProgress();
 assert.ok(afterFirstBurn<.9&&afterFirstBurn>.5);
 s.tick(13000);
 assert.equal(s.ctx.demoHolder,"p2");
 assert.equal(s.ctx.projectile.root.visible,true);
 const secondDuration=s.ctx.flight.duration;
 s.tick(13050+secondDuration);
 assert.equal(s.ctx.flight,null);
 assert.equal(s.actors.get("p2").bomb.root.visible,true);
 assert.ok(s.actors.get("p2").bomb.getFuseProgress()<afterFirstBurn);
 s.tick(20500);
 assert.equal(s.ctx.demoHolder,"p2");
 assert.equal(s.events.length,0,"no early explosion");
 s.tick(21001);
 assert.equal(s.ctx.demoHolder,null);
 assert.equal(s.events.length,1);
 assert.equal(s.events[0],"p2");
 assert.equal(s.actors.get("p2").action,"death");
 assert.equal(s.actors.get("p2").alive,false);
 assert.equal(s.ctx.projectile.root.visible,false);
 s.tick(22500);
 assert.equal(s.actors.get("p2").action,"death");
 assert.equal(s.events.length,1,"explosion must not replay");
 s.tick(25602);
 assert.equal(s.actors.get("p2").alive,true);
 assert.equal(s.actors.get("p2").action,"idle");
 assert.equal(s.ctx.demoHolder,null);
 assert.equal(s.ctx.demoFuseStartAt,0);
 assert.equal(s.room.bomba_de,null);
 assert.equal(s.people[2].vivo,true,"server data unchanged");
 assert.equal(s.api.demoThrow(),true,"demo can be replayed");
});
test("Explode-now button immediately eliminates the holder but never updates Supabase",()=>{
 const s=makeScene();
 assert.equal(s.api.demoExplodeNow(),false,"requires a started demo");
 assert.equal(s.api.demoThrow(),true);
 s.tick(1000);
 s.setTime(2400);
 assert.equal(s.api.demoExplodeNow(),true);
 s.tick(2500);
 assert.equal(s.events.length,1);
 assert.equal(s.events[0],"p0");
 assert.equal(s.actors.get("p0").alive,false);
 assert.equal(s.ctx.demoPending,null);
 assert.equal(s.ctx.demoSecondPass,null);
 assert.equal(s.api.demoExplodeNow(),false,"cannot explode twice");
 s.tick(7200);
 assert.equal(s.actors.get("p0").alive,true);
 assert.equal(s.room.estado,"ready");
 assert.ok(s.people.every(p=>p.vivo));
});
test("DEMO cannot run in actual match, or in a different room",()=>{
 for(const [title,estado] of [
  ["DEMO · Bomba Mortal JS Family","playing"],
  ["Torneo real de 8 personas","ready"],
  ["DEMO · Bomba Mortal JS Family","finished"]
 ]){
  const s=makeScene();s.room.titulo=title;s.room.estado=estado;
  assert.equal(s.api.demoThrow(),false);
  assert.equal(s.api.demoExplodeNow(),false);
  assert.equal(s.events.length,0);
 }
});
test("Real round activation cancels demo, restores fake-dead actors and authoritative state",()=>{
 const s=makeScene();s.api.demoThrow();
 s.setTime(2500);s.api.demoExplodeNow();s.tick(2550);
 assert.equal(s.actors.get("p0").alive,false);
 const original=s.ctx.roomData;
 const newRoom={...original,estado:"playing",bomba_de:"p1"};
 const start=game.indexOf("export function syncRoom(data,clockOffsetMs){");
 const end=game.indexOf("export function syncPreview(",start);
 const source=game.slice(start,end).replace("export function syncRoom","function syncRoom");
 assert.ok(start>0&&end>start);
 s.ctx.ready=false;
 vm.runInContext(source+"\nthis.sync=syncRoom;",s.ctx);
 s.ctx.sync(newRoom,0);
 assert.equal(s.ctx.demoHolder,null);
 assert.equal(s.ctx.demoExplodedAt,0);
 assert.equal(s.ctx.demoFuseStartAt,0);
 assert.equal(s.ctx.demoSecondPass,null);
 assert.equal(s.actors.get("p0").alive,true);
 assert.equal(s.actors.get("p0").action,"idle");
 assert.equal(s.ctx.roomData.estado,"playing");
});
test("HTML provides separate 20s test and manual explosion controls with existing blast",()=>{
 assert.match(page,/id="bomb3dDemoThrow" hidden/);
 assert.match(page,/id="bomb3dDemoExplode" hidden disabled/);
 assert.match(page,/Probar ronda completa · 20 segundos/);
 assert.match(page,/Explotar ahora/);
 assert.match(page,/window\.JSBombDemoExplosion=animateExplosion/);
 assert.match(page,/code==="BE5BBA5D2FA4"&&room.estado==="ready"/);
 assert.match(game,/DEMO_FALL_HOLD_MS=4600/);
 assert.match(game,/demoExplodedAt=time/);
 assert.match(game,/actor\.action="death"/);
 assert.match(game,/demoFuseDeadlineAt=now\+DEMO_FULL_DURATION_MS/);
 assert.match(page,/bomba3d\/game\.js\?v=10/);
 assert.match(page,/p_action:"pasar",p_target:target\.id/);
});
