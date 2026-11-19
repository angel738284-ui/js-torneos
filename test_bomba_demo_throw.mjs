import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import * as THREE from "./bomba3d/vendor/three.module.js";
import {createBombProp,makePassAnimation,handWorldPosition,HAND_OFFSET} from "./bomba3d/bomb-effects.js";

const game=readFileSync(new URL("./bomba3d/game.js",import.meta.url),"utf8");
const page=readFileSync(new URL("./bomba.html",import.meta.url),"utf8");
const start=game.indexOf("function availableDemoPlayers(){"),end=game.indexOf("function animate(time){",start);
assert.ok(start>0&&end>start);
const logic=game.slice(start,end).replaceAll("export function ","function ");
function simulate(title="DEMO · Bomba Mortal JS Family",estado="ready"){
 let now=1000;
 const players=[{id:"a",vivo:true},{id:"b",vivo:true}];
 const room={estado,titulo: title,jugadores:players,bomba_de:null};
 const actors=new Map();
 for(let index=0;index<2;index++){
  const id=players[index].id,root=new THREE.Group(),anchor=new THREE.Group();
  root.position.set(index===0?-2.5:2.5,0,0);root.add(anchor);
  const bomb=createBombProp();
  anchor.add(bomb.root);bomb.root.position.set(...HAND_OFFSET);
  actors.set(id,{playerId:id,root,handAnchor:anchor,bomb,alive:true,action:"idle",until:0});
 }
 const context=vm.createContext({
  ready:true,roomData:room,actors,flight:null,
  demoHolder:null,demoPending:null,demoEndsAt:0,demoFuseStartAt:0,demoFuseDeadlineAt:0,serverClockOffset:0,roundFuseProgress:()=>1,
  demoSecondPass:null,demoVictimId:null,demoExplodedAt:0,demoFinishedAt:0,
  DEMO_FULL_DURATION_MS:20000,DEMO_FALL_HOLD_MS:4600,
  demoEliminated:new Set(),demoRound:0,demoChampionId:null,
  el:()=>null,window:{JSBombDemoExplosion:(id)=>{context.lastExplosionId=id}},
  projectile:createBombProp(),performance:{now:()=>now},
  handWorldPosition,makePassAnimation,Map,Math,String
 });
 vm.runInContext(logic+"\nthis.api={demoThrow,animateHeldAndFlyingBomb,getFlight:()=>flight,getDemoHolder:()=>demoHolder,getPending:()=>demoPending}",context);
 return {room,actors,context,functions:context.api,setClock:v=>{now=v}};
}
test("Demo preview shows bomb in first hand, throws it and catches in second hand",()=>{
 const t=simulate();
 assert.equal(t.functions.demoThrow(),true);
 assert.equal(t.functions.getDemoHolder(),"a");
 t.functions.animateHeldAndFlyingBomb(1000,false);
 assert.equal(t.actors.get("a").bomb.root.visible,true);
 assert.equal(t.actors.get("b").bomb.root.visible,false);
 assert.equal(t.context.projectile.root.visible,false);
 t.functions.animateHeldAndFlyingBomb(5600,false);
 assert.equal(t.functions.getDemoHolder(),"b");
 assert.ok(t.functions.getFlight());
 assert.equal(t.context.projectile.root.visible,true);
 assert.equal(t.actors.get("a").bomb.root.visible,false);
 assert.equal(t.actors.get("b").bomb.root.visible,false);
 t.functions.animateHeldAndFlyingBomb(5750+t.functions.getFlight().duration,false);
 assert.equal(t.context.projectile.root.visible,false);
 assert.equal(t.actors.get("b").bomb.root.visible,true);
 t.functions.animateHeldAndFlyingBomb(13500,false);
 assert.equal(t.functions.getDemoHolder(),"a");
 assert.equal(t.context.projectile.root.visible,true);
 t.functions.animateHeldAndFlyingBomb(13700+t.functions.getFlight().duration,false);
 t.functions.animateHeldAndFlyingBomb(21000,false);
 assert.equal(t.functions.getDemoHolder(),null);
 assert.equal(t.actors.get("a").action,"death");
 assert.equal(t.context.lastExplosionId,"a");
 assert.equal(t.actors.get("a").bomb.root.visible,false);
 t.functions.animateHeldAndFlyingBomb(25700,false);
 assert.equal(t.actors.get("a").alive,false);
 assert.equal(t.actors.get("a").root.visible,false);
 assert.equal(t.context.demoChampionId,"b");
 assert.equal(t.room.bomba_de,null,"demo must not modify authoritative room holder");
});
test("Demo preview refuses to run during an actual match",()=>{
 const t=simulate("DEMO · Bomba Mortal JS Family","playing");
 assert.equal(t.functions.demoThrow(),false);
 assert.equal(t.functions.getFlight(),null);
});
test("Demo is only for the identified fictional room, never private player rooms",()=>{
 const t=simulate("Partida real de 8 personas","ready");
 assert.equal(t.functions.demoThrow(),false);
});
test("The demo button is visibly labeled and only shown for the specific waiting demo",()=>{
 assert.match(page,/id="bomb3dDemoThrow" hidden/);
 assert.match(page,/Jugar 8 bots · hasta un ganador/);
 assert.match(page,/id="bomb3dDemoExplode" hidden disabled/);
 assert.match(page,/Explotar ahora/);
 assert.match(game,/window.Bomb3D=\{syncRoom,syncPreview,onGameTransition,demoThrow,demoExplodeNow,/);
 assert.match(page,/code==="BE5BBA5D2FA4"&&room.estado==="ready"/);
 assert.match(page,/window.Bomb3D\?\.demoThrow\?\.\(\)/);
 assert.match(game,/if\(demoHolder\|\|demoExplodedAt\|\|demoEliminated\.size\|\|demoChampionId\)/);
 assert.match(game,/DEMO_FULL_DURATION_MS=20000/);
});
