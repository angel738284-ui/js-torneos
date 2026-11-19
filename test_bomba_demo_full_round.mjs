import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import * as THREE from "./bomba3d/vendor/three.module.js";
import {createBombProp,makePassAnimation,handWorldPosition,HAND_OFFSET} from "./bomba3d/bomb-effects.js";

const game=readFileSync(new URL("./bomba3d/game.js",import.meta.url),"utf8");
const page=readFileSync(new URL("./bomba.html",import.meta.url),"utf8");
const begin=game.indexOf("function availableDemoPlayers(){");
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
  demoEliminated:new Set(),demoRound:0,demoChampionId:null,
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
 assert.equal(s.actors.get("p2").alive,false,"eliminated actor stays dead");
 assert.equal(s.actors.get("p2").root.visible,false,"removed from next round");
 assert.equal(s.ctx.demoRound,2,"new round starts automatically");
 assert.equal(s.ctx.demoHolder,"p1","next holder comes from survivors");
 assert.equal(s.ctx.demoEliminated.size,1);
 assert.equal(s.ctx.demoFuseStartAt,25602);
 assert.equal(s.ctx.demoFuseDeadlineAt-s.ctx.demoFuseStartAt,20000,"fresh fuse");
 assert.equal(s.room.bomba_de,null);
 assert.equal(s.people[2].vivo,true,"server data unchanged");
 assert.equal(s.api.demoThrow(),false,"a new manual demo cannot interrupt active round");
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
 assert.equal(s.actors.get("p0").alive,false);
 assert.equal(s.actors.get("p0").root.visible,false);
 assert.equal(s.ctx.demoRound,2);
 assert.equal(s.ctx.demoEliminated.size,1);
 assert.notEqual(s.ctx.demoHolder,"p0");
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
 assert.match(page,/id="bomb3dDemoWinner"/);
 assert.match(game,/championBanner\.textContent="🏆 ¡GANADOR:/);
 assert.match(page,/Jugar 8 bots · hasta un ganador/);
 assert.match(page,/Explotar ahora/);
 assert.match(page,/window\.JSBombDemoExplosion=animateExplosion/);
 assert.match(page,/code==="BE5BBA5D2FA4"&&room.estado==="ready"/);
 assert.match(game,/DEMO_FALL_HOLD_MS=4600/);
 assert.match(game,/demoExplodedAt=time/);
 assert.match(game,/actor\.action="death"/);
 assert.match(game,/demoFuseDeadlineAt=now\+DEMO_FULL_DURATION_MS/);
 assert.match(page,/bomba3d\/game\.js\?v=12/);
 assert.match(page,/p_action:"pasar",p_target:target\.id/);
});

test("Eight fictional players complete seven rounds, eliminated models never return, last survivor wins",()=>{
 const s=makeScene();
 assert.equal(s.api.demoThrow(),true);
 let now=1000;
 const eliminated=[];
 for(let round=1;round<=7;round++){
  assert.equal(s.ctx.demoRound,round);
  assert.equal(s.ctx.demoEliminated.size,round-1);
  const live=s.people.filter(p=>!s.ctx.demoEliminated.has(p.id));
  assert.equal(live.length,9-round);
  const holder=s.ctx.demoHolder;
  assert.ok(holder&&live.some(p=>p.id===holder));
  s.tick(now);
  assert.equal(s.actors.get(holder).bomb.getFuseProgress(),1,"new fuse must be full");
  now+=400;
  s.setTime(now);
  assert.equal(s.api.demoExplodeNow(),true);
  s.tick(now+40);
  assert.equal(s.ctx.demoExplodedAt,now+40);
  assert.equal(s.ctx.demoEliminated.has(holder),true,"holder is permanently eliminated");
  assert.equal(s.actors.get(holder).alive,false);
  assert.equal(s.actors.get(holder).root.visible,true,"fall animation remains visible");
  eliminated.push(holder);
  assert.equal(s.events.at(-1),holder);
  now+=40+4601;
  s.tick(now);
  assert.equal(s.actors.get(holder).root.visible,false,"dead player is absent next round");
  for(const id of eliminated){
   assert.equal(s.actors.get(id).alive,false);
   assert.equal(s.actors.get(id).root.visible,false);
  }
  assert.equal(s.ctx.demoEliminated.size,round);
  if(round<7){
   assert.equal(s.ctx.demoRound,round+1);
   assert.ok(!s.ctx.demoEliminated.has(s.ctx.demoHolder),"new bomb given only to survivors");
   assert.equal(s.ctx.demoFuseDeadlineAt-s.ctx.demoFuseStartAt,20000);
  }
 }
 assert.equal(new Set(eliminated).size,7,"7 distinct eliminations");
 assert.ok(s.ctx.demoChampionId,"one winner was declared");
 assert.equal(s.ctx.demoHolder,null);
 assert.equal(s.ctx.demoEliminated.size,7);
 const winningActor=s.actors.get(s.ctx.demoChampionId);
 assert.equal(winningActor.alive,true);
 assert.equal(winningActor.root.visible,true);
 assert.equal(s.room.estado,"ready","real Supabase match remains untouched");
 assert.ok(s.people.every(p=>p.vivo),"real players remain alive");
 assert.equal(s.api.demoThrow(),true,"play again resets fictional elimination list");
 assert.equal(s.ctx.demoEliminated.size,0);
 assert.equal(s.ctx.demoRound,1);
 for(const a of s.actors.values()){assert.equal(a.alive,true);assert.equal(a.root.visible,true);}
});
