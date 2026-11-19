import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const page=readFileSync(new URL("./bomba.html",import.meta.url),"utf8");
const js=[...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
 .map(m=>m[1]).find(x=>x.includes("function seatPositions("));
assert.ok(js,"Seat and effects script exists");
const start=js.indexOf("function seatPositions("),stop=js.indexOf("function drawRoster()",start);
assert.ok(start>0&&stop>start);
const functions=js.slice(start,stop);

const cls=()=>{const values=new Set();return {add:x=>values.add(x),remove:x=>values.delete(x),contains:x=>values.has(x)}};
const mk=(id,coords)=>{
 const variables={};
 return {
  dataset:{playerId:id},style:{
   left:"0px",top:"0px",height:"",width:"",
   setProperty:(name,val)=>{variables[name]=val},
   getPropertyValue:name=>variables[name]
  },classList:cls(),
  getBoundingClientRect:()=>coords
 };
};
const cards=[mk("p1",{left:20,top:45,width:80,height:140}),mk("p2",{left:255,top:280,width:80,height:140})];
const stage=mk("stage",{left:0,top:0,width:360,height:520});
stage.clientWidth=360;
const layer={children:[],append(el){this.children.push(el)}};
const root={children:cards,clientWidth:360};
const context=vm.createContext({
 Math,Array,Map,Date,
 window:{matchMedia:()=>({matches:false})},
 setTimeout:()=>1,
 document:{createElement:()=>{
  const node=mk("effect",{left:0,top:0,width:38,height:38});
  node.remove=()=>{};return node;
 }},
 el:id=>({
  tableStage:stage,effectLayer:layer,players:root
 })[id],
});
vm.runInContext(functions+"\nthis.api={seatPositions,layoutSeats,animateTransfer,animateExplosion,animateGameChanges}",context);
const {seatPositions,layoutSeats,animateTransfer,animateExplosion,animateGameChanges}=context.api;
test("8 characters distribute all around an oval table on mobile",()=>{
 const seats=seatPositions(8,320,520,82);
 assert.equal(seats.length,8);
 assert.ok(seats.some(x=>x.x<65));
 assert.ok(seats.some(x=>x.x>255));
 assert.ok(seats.some(x=>x.y<80));
 assert.ok(seats.some(x=>x.y>435));
 const gaps=seats.map((p,i)=>Math.min(...seats.filter((_,j)=>j!==i).map(q=>Math.hypot(p.x-q.x,p.y-q.y))));
 assert.ok(Math.min(...gaps)>80,"seats don't bunch up");
});
test("24 players get a taller arena and enough seat separation",()=>{
 const seats=seatPositions(24,320,1534,66);
 const gap=Math.min(...seats.map((p,i)=>Math.min(...seats.filter((_,j)=>i!==j).map(q=>Math.hypot(p.x-q.x,p.y-q.y)))));
 assert.ok(gap>95,"nearest centers "+gap);
});
test("A pass animates a bomb from one character to another",()=>{
 animateTransfer("p1","p2");
 assert.equal(layer.children.length,1);
 const effect=layer.children.at(-1);
 assert.equal(effect.className,"flyingBomb");
 assert.equal(effect.textContent,"💣");
 assert.ok(effect.style.getPropertyValue("--end-x").endsWith("px"));
 assert.ok(effect.style.getPropertyValue("--mid-y").endsWith("px"));
});
test("Elimination creates an explosion effect on the eliminated character",()=>{
 animateExplosion("p1");
 assert.equal(layer.children.length,2);
 assert.equal(layer.children.at(-1).textContent,"💥");
 assert.ok(stage.classList.contains("shock"));
});
test("State changes distinguish a pass from an explosion",()=>{
 const first={estado:"playing",bomba_de:"p1",jugadores:[{id:"p1",vivo:true},{id:"p2",vivo:true}]};
 const second={estado:"playing",bomba_de:"p2",jugadores:first.jugadores};
 const before=layer.children.length;
 animateGameChanges(null,first);
 assert.equal(layer.children.length,before,"opening the page does not replay stale effects");
 animateGameChanges(first,second);
 assert.equal(layer.children.at(-1).className,"flyingBomb");
 const next={estado:"finished",bomba_de:null,jugadores:[{id:"p1",vivo:true},{id:"p2",vivo:false}]};
 animateGameChanges(second,next);
 assert.equal(layer.children.at(-1).className,"bombExplosion");
});
test("Layout keeps all seats inside the arena dimensions",()=>{
 layoutSeats();
 for(const c of cards){
  const x=parseFloat(c.style.left),y=parseFloat(c.style.top);
  assert.ok(x>=0&&x<=360,"x "+x);
  assert.ok(y>=0&&y<=630,"y "+y);
 }
 assert.ok(stage.style.height.endsWith("px"));
});
