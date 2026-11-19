import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import * as THREE from "./bomba3d/vendor/three.module.js";
import {createBombProp,flightPosition,flightDuration,makePassAnimation,handWorldPosition,HAND_OFFSET} from "./bomba3d/bomb-effects.js";
const game=fs.readFileSync(new URL("./bomba3d/game.js",import.meta.url),"utf8");
const imported=fs.readFileSync(new URL("./bomba3d/imported.js",import.meta.url),"utf8");
const page=fs.readFileSync(new URL("./bomba.html",import.meta.url),"utf8");

const makeActor=(id,x,y)=>{
 const root=new THREE.Group();
 root.position.set(x,y,0);
 const handAnchor=new THREE.Group();
 root.add(handAnchor);
 const bomb=createBombProp();
 bomb.root.position.set(...HAND_OFFSET);
 handAnchor.add(bomb.root);
 return {root,handAnchor,bomb,playerId:id,alive:true,action:"idle",until:0};
};
const actors=new Map([["p1",makeActor("p1",-3,0)],["p2",makeActor("p2",3,0)]]);
const projectile=createBombProp();
let clock=1000;
const ctx=vm.createContext({
 actors,projectile,ready:true,roomData:null,flight:null,demoHolder:null,demoPending:null,demoEndsAt:0,demoFuseStartAt:0,demoFuseDeadlineAt:0,serverClockOffset:0,roundFuseProgress:()=>1,Math,Map,
 performance:{now:()=>clock},
 handWorldPosition,makePassAnimation
});
const start=game.indexOf("export function onGameTransition(");
const stop=game.indexOf("function animate(time){",start);
assert.ok(start>0&&stop>start);
const logic=game.slice(start,stop).replace("export function onGameTransition(","function onGameTransition(");
vm.runInContext(logic+"\nthis.api={onGameTransition,animateHeldAndFlyingBomb,getFlight:()=>flight,setRoom:x=>roomData=x}",ctx);
const {onGameTransition,animateHeldAndFlyingBomb,getFlight,setRoom}=ctx.api;
const persons=[{id:"p1",vivo:true},{id:"p2",vivo:true}];
const state=(holder,round=1)=>({estado:"playing",bomba_de:holder,ronda:round,jugadores:persons});
const reset=()=>{clock=1000;for(const a of actors.values()){a.alive=true;a.action="idle";}vm.runInContext("flight=null",ctx);setRoom(state("p1"));onGameTransition(null,state("p1"));animateHeldAndFlyingBomb(1000,false);};

test("The waiting character swings from side to side, with a distinct throw and catch lean",()=>{
 assert.match(imported,/const idleSway=Math\.sin\(elapsed\*1\.9\)/);
 assert.match(imported,/throwing\?-\.(?:25|[0-9]+)/);
 assert.match(imported,/catching\?\.(?:22|[0-9]+)/);
 assert.match(imported,/animatedRig\.position\.x=/);
 assert.match(imported,/return \{root,handAnchor:animatedRig/);
});
test("One 3D bomb is held in the current player's hand during gameplay",()=>{
 reset();
 assert.equal(actors.get("p1").bomb.root.visible,true);
 assert.equal(actors.get("p2").bomb.root.visible,false);
 assert.equal(projectile.root.visible,false);
 assert.equal(createBombProp().root.children.some(c=>c.name==="bomb_body"),true);
 assert.equal(createBombProp().root.children.some(c=>c.name==="bomb_lit_fuse"),true);
});
test("No one holds the bomb before the game starts",()=>{
 reset();setRoom({estado:"ready",bomba_de:null,jugadores:persons});
 animateHeldAndFlyingBomb(1100,false);
 assert.equal(actors.get("p1").bomb.root.visible,false);
 assert.equal(actors.get("p2").bomb.root.visible,false);
 assert.equal(projectile.root.visible,false);
});
test("Server-confirmed pass launches from one hand in a parabolic arc and lands in the other hand",()=>{
 reset();const before=state("p1"),after=state("p2");
 setRoom(after);onGameTransition(before,after);
 const f=getFlight();
 assert.equal(f.fromId,"p1");assert.equal(f.toId,"p2");
 assert.ok(f.duration>=920&&f.duration<=1500);
 assert.ok(f.start.distanceTo(handWorldPosition(actors.get("p1")))<1e-6);
 assert.ok(f.end.distanceTo(handWorldPosition(actors.get("p2")))<1e-6);
 animateHeldAndFlyingBomb(1000,false);
 assert.equal(actors.get("p1").bomb.root.visible,false);
 assert.equal(actors.get("p2").bomb.root.visible,false);
 assert.equal(projectile.root.visible,true);
 const halfway=1000+f.duration/2;
 animateHeldAndFlyingBomb(halfway,false);
 assert.ok(projectile.root.position.y>Math.max(f.start.y,f.end.y)+.4);
 assert.equal(actors.get("p1").action,"throw");
 assert.equal(actors.get("p2").action,"catch");
 animateHeldAndFlyingBomb(1000+f.duration+5,false);
 assert.equal(getFlight(),null);
 assert.equal(projectile.root.visible,false);
 assert.equal(actors.get("p1").bomb.root.visible,false);
 assert.equal(actors.get("p2").bomb.root.visible,true);
});
test("No ghost throw on a rejected pass, unchanged holder, death or round change",()=>{
 reset();
 onGameTransition(state("p1"),state("p1"));assert.equal(getFlight(),null);
 onGameTransition(state("p1",1),state("p2",2));assert.equal(getFlight(),null);
 const after={...state("p2"),jugadores:[persons[0],{id:"p2",vivo:false}]};
 onGameTransition(state("p1"),after);assert.equal(getFlight(),null);
});
test("Reduced-motion mode transfers without a flying arc",()=>{
 reset();setRoom(state("p2"));onGameTransition(state("p1"),state("p2"));
 animateHeldAndFlyingBomb(1000,true);
 assert.equal(getFlight(),null);
 assert.equal(projectile.root.visible,false);
 assert.equal(actors.get("p2").bomb.root.visible,true);
});
test("The trajectory clamps and has correct start/end points",()=>{
 const a=new THREE.Vector3(-2,0,0),b=new THREE.Vector3(2,0,0);
 assert.ok(flightPosition(a,b,0).distanceTo(a)<1e-7);
 assert.ok(flightPosition(a,b,1).distanceTo(b)<1e-7);
 assert.ok(flightPosition(a,b,.5).y>.6);
 assert.ok(flightDuration(a,b)>700);
 assert.throws(()=>makePassAnimation({fromId:"p1",toId:"p1",start:a,end:b}),/Invalid/);
});
test("The old 2D projectile is suppressed while the GLB viewer is working",()=>{
 assert.match(page,/if\(!window\.Bomb3D\?\.isEnabled\(\)\)animateTransfer/);
 assert.match(page,/p_action:"pasar",p_target:target\.id/);
 assert.match(page,/id="passBomb"/);
 assert.match(page,/bomba3d\/game\.js\?v=9/);
 assert.match(game,/actor\.bomb=createBombProp\(\)/);
 assert.match(game,/animateHeldAndFlyingBomb\(time,reduced\)/);
});
test("24 original GLB participants can each have their own bomb instance with shared geometry",()=>{
 const props=Array.from({length:24},()=>createBombProp());
 assert.equal(props.length,24);
 const meshes=props.map(x=>x.root.children.find(c=>c.name==="bomb_body"));
 assert.equal(new Set(meshes.map(x=>x.geometry)).size,1);
 assert.equal(new Set(meshes.map(x=>x.material)).size,1);
});
