import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import * as THREE from "./bomba3d/vendor/three.module.js";
import {createBombProp,roundFuseProgress,makePassAnimation,HAND_OFFSET} from "./bomba3d/bomb-effects.js";
const game=fs.readFileSync(new URL("./bomba3d/game.js",import.meta.url),"utf8");
const page=fs.readFileSync(new URL("./bomba.html",import.meta.url),"utf8");
const now=Date.now();
const start=new Date(now-5000).toISOString();
const end=new Date(now+5000).toISOString();
const room=(holder="p1",startTime=start,deadline=end)=>({
 estado:"playing",ronda:1,ronda_inicio:startTime,vencimiento:deadline,
 bomba_de:holder,jugadores:[{id:"p1",vivo:true},{id:"p2",vivo:true}]
});
const close=(actual,expected,delta=.05)=>assert.ok(
 Math.abs(actual-expected)<=delta,"Expected "+expected+" ±"+delta+", got "+actual);
test("Fuse countdown uses actual Supabase deadline and round start, not fixed seconds",()=>{
 const r=room(),begin=Date.parse(start),finish=Date.parse(end),duration=finish-begin;
 close(roundFuseProgress(r,begin-1500),1,1e-7);
 close(roundFuseProgress(r,begin),1,1e-7);
 close(roundFuseProgress(r,begin+duration*.25),.75,1e-7);
 close(roundFuseProgress(r,begin+duration*.5),.5,1e-7);
 close(roundFuseProgress(r,begin+duration*.75),.25,1e-7);
 close(roundFuseProgress(r,finish),0,1e-7);
 close(roundFuseProgress(r,finish+5000),0,1e-7);
 assert.equal(roundFuseProgress({estado:"ready"},now),1);
 assert.equal(roundFuseProgress({estado:"playing",vencimiento:"not a time"},now),1);
});
test("Passing bomb does not reset fuse; a fresh round does",()=>{
 const before=room("p1"),after=room("p2");
 close(roundFuseProgress(before,now),roundFuseProgress(after,now),1e-7);
 const newRound=room("p2",new Date(now+3000).toISOString(),new Date(now+25000).toISOString());
 close(roundFuseProgress(newRound,now+100),1,1e-7);
 close(roundFuseProgress(newRound,now+14000),.5,.0001);
});
test("Wick retracts toward cap and ember follows down",()=>{
 const prop=createBombProp();
 const wick=prop.root.children.find(o=>o.type==="Mesh"&&o.geometry.type==="CylinderGeometry"&&o.position.y>.6);
 const ember=prop.root.children.find(o=>o.name==="bomb_lit_fuse");
 const point=prop.root.children.find(o=>o.type==="PointLight");
 assert.ok(wick&&ember&&point);
 prop.update(1000,false,1);
 const fullY=ember.position.y,fullLength=wick.scale.y;
 close(prop.getFuseProgress(),1,1e-7);
 prop.update(1500,false,.75);
 const y75=ember.position.y;
 close(wick.scale.y,fullLength*.75,.01);
 prop.update(2000,false,.5);
 const yHalf=ember.position.y;
 close(wick.scale.y,fullLength*.5,.01);
 prop.update(2500,false,.1);
 const nearY=ember.position.y;
 assert.ok(fullY>y75&&y75>yHalf&&yHalf>nearY);
 assert.ok(Math.abs(wick.position.y-(.585+.30*.1/2))<.01,"Wick base remains fixed");
 assert.ok(point.position.distanceTo(ember.position)<1e-7,"Light follows ember");
 prop.update(3000,false,0);
 close(prop.getFuseProgress(),0,1e-7);
 assert.ok(wick.scale.y<.1,"a short burned stump remains");
 assert.ok(ember.position.y>.59&&ember.position.y<.7,"spark near cap until server explosion");
 assert.ok(point.intensity>.45,"more urgent sparks near deadline");
});
test("Reduced-motion accessibility burns wick without flicker",()=>{
 const prop=createBombProp();
 prop.update(1000,true,1);
 const before=prop.root.children.find(o=>o.name==="bomb_lit_fuse").position.y;
 const point=prop.root.children.find(o=>o.type==="PointLight");
 const light=point.intensity;
 prop.update(4000,true,.1);
 const after=prop.root.children.find(o=>o.name==="bomb_lit_fuse").position.y;
 assert.ok(after<before);
 assert.ok(point.intensity>light);
});
test("24 held bombs share geometry but have independent wick lengths",()=>{
 const props=Array.from({length:24},()=>createBombProp());
 const geometry=props[0].root.children.find(x=>x.name==="bomb_body").geometry;
 for(let i=0;i<props.length;i++){
  props[i].update(1234,false,1-i/24);
  close(props[i].getFuseProgress(),1-i/24,1e-7);
  assert.equal(props[i].root.children.find(x=>x.name==="bomb_body").geometry,geometry);
 }
 close(props[0].getFuseProgress(),1,1e-7);
});
test("Held and flying bomb use the same synchronized percentage",()=>{
 const actors=new Map();
 for(const [id,x] of [["p1",-2],["p2",2]]){
  const root=new THREE.Group(),bomb=createBombProp();
  root.position.set(x,0,0);bomb.root.position.set(...HAND_OFFSET);root.add(bomb.root);
  actors.set(id,{playerId:id,root,bomb,alive:true,action:"idle",until:0});
 }
 const projectile=createBombProp();
 const ctx=vm.createContext({
  roomData:room(),actors,projectile,flight:null,demoHolder:null,demoPending:null,
  demoEndsAt:0,demoFuseStartAt:0,demoFuseDeadlineAt:0,serverClockOffset:0,
  demoSecondPass:null,demoVictimId:null,demoExplodedAt:0,demoFinishedAt:0,DEMO_FALL_HOLD_MS:4600,
  roundFuseProgress,Math,Date,el:()=>null,window:{}
 });
 const begin=game.indexOf("function animateHeldAndFlyingBomb(");
 const endIndex=game.indexOf("function animate(time){",begin);
 assert.ok(begin>=0&&endIndex>begin);
 vm.runInContext(game.slice(begin,endIndex)+"\nthis.run=animateHeldAndFlyingBomb;",ctx);
 ctx.run(1000,false);
 const expected=roundFuseProgress(ctx.roomData,Date.now());
 close(actors.get("p1").bomb.getFuseProgress(),expected,.01);
 ctx.roomData=room("p2");
 ctx.run(1050,false);
 close(actors.get("p2").bomb.getFuseProgress(),expected,.01);
 const oldProgress=actors.get("p2").bomb.getFuseProgress();
 ctx.serverClockOffset=3000;
 ctx.run(1100,false);
 assert.ok(actors.get("p2").bomb.getFuseProgress()<oldProgress-.2);
 const a=new THREE.Vector3(-2,1,0),b=new THREE.Vector3(2,1,0);
 ctx.flight=makePassAnimation({fromId:"p1",toId:"p2",start:a,end:b,startTime:1100});
 ctx.run(1150,false);
 close(projectile.getFuseProgress(),actors.get("p2").bomb.getFuseProgress(),.01);
 assert.equal(projectile.root.visible,true);
});
test("Renderer uses HUD server offset and DEMO has its own countdown",()=>{
 assert.match(page,/window\.Bomb3D\?\.syncRoom\(room,offset\)/);
 assert.match(page,/bomba3d\/game\.js\?v=11/);
 assert.match(game,/roundFuseProgress\(roomData,Date\.now\(\)\+serverClockOffset\)/);
 assert.match(game,/actor\.bomb\.update\(time,reduced,fuseProgress\)/);
 assert.match(game,/projectile\.update\(time,reduced,fuseProgress\)/);
 assert.match(game,/demoFuseDeadlineAt=now\+DEMO_FULL_DURATION_MS/);
 assert.match(page,/p_action:"pasar",p_target:target\.id/);
});
