import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const page=readFileSync(new URL("./bomba.html",import.meta.url),"utf8");
const scripts=[...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(x=>x[1]).filter(x=>x.includes('function canPass()'));
assert.equal(scripts.length,1);
const code=scripts[0];
const stop=code.lastIndexOf('if(!/^[A-F0-9]{12}$/.test(code))');
assert.ok(stop>0,"page init found");

class Node{
 constructor(tag="div"){
  this.tag=tag;this.children=[];this.attrs={};this.dataset={};this.events={};
  this.className="";this.textContent="";this.disabled=false;this.hidden=false;
  this.style={color:"",setProperty(){}};
  const classes=new Set();
  this.classList={add:(v)=>classes.add(v),toggle:(v,on)=>{
   if(on===undefined){if(classes.has(v))classes.delete(v);else classes.add(v);}
   else if(on)classes.add(v);else classes.delete(v);
  },contains:(v)=>classes.has(v)};
 }
 append(...nodes){this.children.push(...nodes)}
 replaceChildren(...nodes){this.children=[...nodes]}
 setAttribute(key,val){this.attrs[key]=val}
 addEventListener(type,fn){this.events[type]=fn}
}
const nodes=new Map();
const document={
 getElementById:id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id)},
 createElement:tag=>new Node(tag),
 querySelectorAll:selector=>selector===".player"?(nodes.get("players")?.children||[]):[]
};
const get=id=>document.getElementById(id);
const calls=[];
const now=()=>Date.now();
let serverRoom;
const context=vm.createContext({
 window:{JS_CONFIG:{supabaseUrl:"https://test.invalid",publishableKey:"public"}},
 document,URLSearchParams,location:{search:"?r=BE5BBA5D2FA4"},
 sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},history:{replaceState(){}},
 AbortSignal,Date,console,setTimeout,clearTimeout,setInterval:()=>42,
 fetch:async(url,opts)=>{
  const action=JSON.parse(opts.body);calls.push({url:String(url),...action});
  if(url.endsWith("js_bomba_jugar")&&action.p_action==="pasar"){
   serverRoom={...serverRoom,bomba_de:action.p_target,proteccion_hasta:new Date(now()+1500).toISOString()};
   return {ok:true,json:async()=>({ok:true,destinatario:"Beta"})};
  }
  if(url.endsWith("js_bomba_publica")){
   return {ok:true,json:async()=>({ok:true,...serverRoom,servidor_ahora:new Date().toISOString()})};
  }
  throw new Error("Unexpected fetch "+url);
 }
});
vm.runInContext(code.slice(0,stop),context);
const basePlayers=[
{id:"p1",nombre:"Alfa",vivo:true,avatar:{}},
{id:"p2",nombre:"Beta",vivo:true,avatar:{}},
{id:"p3",nombre:"Gamma",vivo:false,avatar:{}}
];
function setup(shieldOffsetMs=-2000){
 serverRoom={ok:true,estado:"playing",titulo:"Prueba botón",capacidad:3,
 ronda:1,vivos:2,jugadores:basePlayers,bomba_de:"p1",ganador:null,eventos:[],
 ronda_inicio:new Date(now()-10000).toISOString(),
 vencimiento:new Date(now()+20000).toISOString(),
 proteccion_hasta:new Date(now()+shieldOffsetMs).toISOString(),
 servidor_ahora:new Date().toISOString()};
 context.fixture=serverRoom;
 vm.runInContext("room=fixture;me={id:'p1',nombre:'Alfa',vivo:true};selectedTargetId=null;busy=false;roomSignature='';",context);
 vm.runInContext("drawRoster();updateHud()",context);
}
test("El botón está desactivado hasta elegir jugador",()=>{
 setup();
 assert.equal(get("passBomb").disabled,true);
 assert.equal(get("players").children[0].disabled,true);
 assert.equal(get("players").children[2].disabled,true);
 assert.equal(get("players").children[1].disabled,false);
});
test("Tocar jugador lo selecciona, sin pasar la bomba",()=>{
 setup();
 const callsBefore=calls.length;
 get("players").children[1].events.click();
 assert.equal(calls.length,callsBefore);
 assert.equal(get("passBomb").disabled,false);
 assert.ok(get("players").children[1].classList.contains("selected"));
 assert.match(get("selectedTargetLabel").textContent,/Beta/);
 get("players").children[1].events.click();
 assert.equal(get("passBomb").disabled,true);
});
test("Protección permite elegir, pero desactiva envío hasta vencer",()=>{
 setup(20000);
 get("players").children[1].events.click();
 assert.equal(get("passBomb").disabled,true);
 vm.runInContext("room.proteccion_hasta=new Date(Date.now()-1000).toISOString();updateHud()",context);
 assert.equal(get("passBomb").disabled,false);
});
test("Pulsar el botón transfiere exactamente una bomba",async()=>{
 setup();
 const prev=calls.filter(x=>x.p_action==="pasar").length;
 get("players").children[1].events.click();
 const result=get("passBomb").events.click();
 if(result instanceof Promise)await result;
 // The handler intentionally doesn't return the promise; wait for fetch and refresh microtasks.
 for(let i=0;i<10;i++)await new Promise(resolve=>setTimeout(resolve,0));
 const passes=calls.filter(x=>x.p_action==="pasar");
 assert.equal(passes.length,prev+1);
 assert.equal(passes.at(-1).p_target,"p2");
 assert.equal(serverRoom.bomba_de,"p2");
 assert.equal(get("passBomb").disabled,true);
});
test("El espectador nunca puede pasar la bomba",()=>{
 setup();
 vm.runInContext("me=null;selectedTargetId=null;drawRoster();updateHud()",context);
 assert.equal(get("passBomb").disabled,true);
 assert.equal(get("players").children[1].disabled,true);
});
