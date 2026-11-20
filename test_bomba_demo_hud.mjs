import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
const js=readFileSync(new URL("./bomba3d/game.js",import.meta.url),"utf8");
const begin=js.indexOf("let lastDemoHudUpdate=0;");
const end=js.indexOf("function animateHeldAndFlyingBomb(",begin);
assert.ok(begin>=0&&end>begin);
function make(data={}){
 const nodes=Object.fromEntries(["tableCenterName","tableCenterTimer","centerMark","round","alive","timer"].map(k=>[k,{textContent:"",classList:{toggle(){}}}]));
 const ctx=vm.createContext({
  ...{roomData:{estado:"ready",titulo:"DEMO · Bomba Mortal JS Family",jugadores:Array.from({length:8},(_,i)=>({id:"p"+i,nombre:"Jugador "+i}))},demoRound:1,
  demoHolder:"p2",demoExplodedAt:0,demoChampionId:null,demoVictimId:null,flight:null,demoFuseDeadlineAt:16000,demoEliminated:new Set()},...data,
  el:k=>nodes[k]||null, Math,String
 });
 vm.runInContext(js.slice(begin,end)+"\nthis.update=updateDemoHud;",ctx);
 return {ctx,nodes,update:time=>ctx.update(time)};
}
test("Ronda DEMO muestra al que tiene la bomba, segundos y vivos",()=>{
 const a=make();a.update(3000);
 assert.match(a.nodes.tableCenterName.textContent,/Jugador 2/);
 assert.match(a.nodes.tableCenterTimer.textContent,/13 s/);
 assert.match(a.nodes.round.textContent,/Ronda 1/);
 assert.match(a.nodes.alive.textContent,/8 \/ 8/);
});
test("Demo explota y avanza entre rondas sin cambiar Supabase",()=>{
 const a=make({demoExplodedAt:12000,demoVictimId:"p2",demoHolder:null,demoEliminated:new Set(["p2"])});
 a.update(12001);
 assert.match(a.nodes.tableCenterName.textContent,/BOOM/);
 assert.match(a.nodes.alive.textContent,/7 \/ 8/);
 const b=make({demoRound:2,demoHolder:"p3",demoEliminated:new Set(["p2"])});
 b.update(3000);
 assert.match(b.nodes.round.textContent,/Ronda 2/);
 assert.match(b.nodes.alive.textContent,/7 \/ 8/);
});
test("Demo tiene ganador al quedar un jugador",()=>{
 const a=make({demoRound:7,demoChampionId:"p7",demoHolder:null,demoEliminated:new Set(["p0","p1","p2","p3","p4","p5","p6"])});
 a.update(3000);
 assert.match(a.nodes.tableCenterName.textContent,/Jugador 7/);
 assert.match(a.nodes.tableCenterTimer.textContent,/Fin/);
 assert.match(a.nodes.alive.textContent,/1 \/ 8/);
});
test("La partida real nunca muestra el HUD de la demo",()=>{
 const a=make({roomData:{estado:"playing",titulo:"Partida real"}});
 a.nodes.tableCenterName.textContent="real";
 a.update(4000);
 assert.equal(a.nodes.tableCenterName.textContent,"real");
});
