import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
const root=new URL("./",import.meta.url);
const page=readFileSync(new URL("bomba.html",root),"utf8");
const game=readFileSync(new URL("bomba3d/game.js",root),"utf8");
const arcade=readFileSync(new URL("bomba3d/arcade-sfx.js",root),"utf8");
const sounds=readFileSync(new URL("bomba3d/sounds.js",root),"utf8");

test("all eight arcade effects and mixer integrated",()=>{
 for(const key of ["whoosh","catchBomb","grunt","plof","beep","countdown","playStart","victory"]){
  assert.match(arcade,new RegExp("function "+key+"\\("));
 }
 for(const key of ["effects","music","voices"])assert.match(page,new RegExp('data-mix="'+key+'"'));
 assert.match(page,/id="bombAudioTest"/);
 assert.match(page,/game\.js\?v=17/);
 assert.match(game,/createArcadeSFX/);
 assert.match(game,/JSArcadeSFX\?\.whoosh/);
 assert.match(game,/JSArcadeSFX\?\.catchBomb/);
 assert.match(game,/JSArcadeSFX\?\.markWinner/);
 assert.match(game,/JSArcadeSFX\?\.countdown/);
 assert.match(game,/JSArcadeSFX\?\.explosion/);
 assert.match(sounds,/bomb-mix-change/);
 assert.match(arcade,/localStorage\.setItem/);
});
test("arcade playback requires user gesture and persists independent volumes",()=>{
 let count=0;const events={};const controls={};
 class P{setValueAtTime(){} exponentialRampToValueAtTime(){} setTargetAtTime(){}}
 class N{
  constructor(){this.gain=new P();this.frequency=new P();}
  connect(){} disconnect(){} start(){count++} stop(){}
 }
 class AC{
  constructor(){this.state="running";this.currentTime=1;this.destination={};}
  createGain(){return new N();}
  createOscillator(){return new N();}
  resume(){return Promise.resolve();}
 }
 const mixers={};
 for(const key of ["effects","music","voices"]){
  mixers[key]={value:"",addEventListener(name,fn){this.fn=fn}};
  mixers["output-"+key]={textContent:""};
 }
 const button={addEventListener(name,fn){this.fn=fn}};
 const rootElement={querySelector(selector){
  const key=selector.match(/data-(?:mix|level)="([^"]+)"/)?.[1];
  return selector.includes("data-level")?mixers["output-"+key]:mixers[key];
 }};
 const doc={
  hidden:false,readyState:"complete",
  getElementById(id){return id==="bombAudioMixer"?rootElement:id==="bombAudioTest"?button:null;},
  addEventListener(name,fn){(events[name]??=[]).push(fn);},
  dispatchEvent(event){for(const fn of events[event.type]||[])fn();}
 };
 const saved={};
 const store={getItem:()=>null,setItem:(key,val)=>saved[key]=val};
 const sandbox=vm.createContext({window:{AudioContext:AC},document:doc,localStorage:store,Math,Date,Event:class{constructor(type){this.type=type;}}});
 const script=arcade.replace("export function createArcadeSFX()","function createArcadeSFX()");
 const sfx=vm.runInContext(script+"\ncreateArcadeSFX();",sandbox);
 sfx.whoosh();assert.equal(count,0);
 events.pointerdown[0]();
 sfx.whoosh();sfx.catchBomb();sfx.grunt();sfx.plof();sfx.beep(1);
 sfx.markRound("demo-1",true);sfx.countdown(4,true,"demo-1");
 sfx.explosion();sfx.markWinner("bot-1");
 assert.ok(count>12);
 const before=count;
 sfx.markWinner("bot-1");assert.equal(count,before,"victory only once per champion");
 mixers.effects.value="0";mixers.effects.fn();
 assert.equal(sfx.getMix().effects,0);
 assert.equal(JSON.parse(saved["js-bomba-mix-v1"]).effects,0);
 const noFx=count;sfx.whoosh();assert.equal(count,noFx);
});
