import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";

const root=new URL("./",import.meta.url);
const page=readFileSync(new URL("bomba.html",root),"utf8");
const css=readFileSync(new URL("bomba3d/wardrobe-ui.css",root),"utf8");
const wardrobe=readFileSync(new URL("bomba3d/wardrobe-ui.js",root),"utf8");
const game=readFileSync(new URL("bomba3d/game.js",root),"utf8");
const sounds=readFileSync(new URL("bomba3d/sounds.js",root),"utf8");

test("visual wardrobe is connected to real 3D fields and does not change RPC schema",()=>{
 assert.match(page,/id="wardrobeCatalog"/);
 assert.match(page,/wardrobe-ui\.js\?v=1/);
 assert.match(page,/wardrobe-ui\.css\?v=1/);
 assert.match(page,/id="openWardrobe"/);
 assert.match(page,/window\.JSWardrobe\?\.sync\?\.\(\)/);
 assert.match(css,/#wardrobeCatalog\.ready \+ \.customSections\{display:none\}/);
 for(const category of ["Muñeco","Arriba","Abajo","Zapas","Accesorios","Efectos"]){
  assert.ok(wardrobe.includes('name:"'+category+'"'),category);
 }
 for(const field of ["wear3d","topStyle","shirt","bottomStyle","pants",
  "shoes","accessory","aura","pose"]){
  assert.match(wardrobe,new RegExp('"'+field+'"'));
  assert.match(page,new RegExp('id="'+field+'"'));
 }
 assert.match(wardrobe,/dispatchEvent\(new Event\("change"/);
 assert.match(wardrobe,/document\.getElementById\("wear3d"\)\.value="yes"/);
 assert.match(page,/const value=Object\.fromEntries\(fields\.map/);
});
test("game triggers real/demonstration SFX on passes/explosions without touching server",()=>{
 assert.match(page,/id="bombSoundToggle"/);
 assert.match(game,/import \{createBombSFX\} from "\.\/sounds\.js\?v=1"/);
 assert.equal((game.match(/JSBombSFX\?\.playThrow/g)||[]).length,2);
 assert.equal((game.match(/JSBombSFX\?\.playExplosion/g)||[]).length,2);
 assert.match(game,/JSBombSFX\?\.setFuseActive\?\.\(Boolean\(current&&!flight/);
 assert.match(sounds,/window\.AudioContext\|\|window\.webkitAudioContext/);
 assert.match(sounds,/document\.addEventListener\(event/);
 assert.match(sounds,/setEnabled\(!enabled\)/);
});

test("audio is gesture-gated, can be muted, and does not create repeat sound events at idle",()=>{
 let contexts=0;
 const params=[];
 class Param{
  constructor(){this.events=[];params.push(this);}
  setValueAtTime(...args){this.events.push(["set",...args]);}
  exponentialRampToValueAtTime(...args){this.events.push(["ramp",...args]);}
  setTargetAtTime(...args){this.events.push(["target",...args]);}
 }
 const stats={sources:0,oscillators:0,gains:[]};
 class Node{
  constructor(){this.frequency=new Param();this.gain=new Param();}
  connect(target){return target;}
  disconnect(){}
  start(){}
  stop(){}
 }
 class AC{
  constructor(){contexts++;this.sampleRate=22050;this.currentTime=1;this.state="running";this.destination={};}
  createBuffer(channels,length){return{getChannelData:()=>new Float32Array(length)};}
  createBufferSource(){stats.sources++;return new Node();}
  createBiquadFilter(){return new Node();}
  createGain(){const x=new Node();stats.gains.push(x);return x;}
  createOscillator(){stats.oscillators++;return new Node();}
  resume(){this.state="running";return Promise.resolve();}
 }
 const events={},buttonEvents={};
 const button={
  disabled:false,textContent:"",
  setAttribute(name,value){this[name]=value;},
  addEventListener(name,fn){buttonEvents[name]=fn;}
 };
 const doc={
  hidden:false,readyState:"complete",
  getElementById(id){return id==="bombSoundToggle"?button:null;},
  addEventListener(event,fn){(events[event]??=[]).push(fn);}
 };
 const store=new Map();
 const storage={getItem:key=>store.get(key)||null,setItem:(key,val)=>store.set(key,val)};
 const sandbox=vm.createContext({window:{AudioContext:AC},document:doc,localStorage:storage,Math});
 const js=sounds.replace("export function createBombSFX()","function createBombSFX()");
 const sfx=vm.runInContext(js+"\ncreateBombSFX();",sandbox);
 sfx.playThrow();sfx.playExplosion();
 assert.equal(contexts,0,"no audio before user interaction");
 events.pointerdown[0]();
 assert.equal(contexts,1);
 sfx.setFuseActive(true,.5);
 const hiss=stats.gains.at(-1);
 assert.ok(hiss.gain.events.length>0);
 sfx.setFuseActive(false);
 const count=hiss.gain.events.length;
 for(let i=0;i<200;i++)sfx.setFuseActive(false);
 assert.equal(hiss.gain.events.length,count,"idle frames don't queue repeated automation");
 sfx.playThrow();sfx.playExplosion();
 assert.ok(stats.sources>=4,"fuse, throw and double-layer explosion all generated");
 assert.ok(stats.oscillators>=3,"whoosh and explosion have lower frequency layers");
 buttonEvents.click();
 assert.equal(sfx.isEnabled(),false);
 assert.equal(button["aria-pressed"],"false");
 const total=stats.sources;
 sfx.playThrow();sfx.playExplosion();
 assert.equal(stats.sources,total,"mute blocks effects");
 buttonEvents.click();
 assert.equal(sfx.isEnabled(),true);
 assert.equal(button["aria-pressed"],"true");
});
