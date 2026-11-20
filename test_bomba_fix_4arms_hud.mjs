import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const game=readFileSync(new URL('./bomba3d/game.js',import.meta.url),'utf8');
const imported=readFileSync(new URL('./bomba3d/imported.js',import.meta.url),'utf8');
const page=readFileSync(new URL('./bomba.html',import.meta.url),'utf8');
test('no duplicated helper hands or second pair of palms',()=>{
 assert.doesNotMatch(imported,/grippingHands|palmGeometry|palmMat|left_hand_gripping_bomb|right_hand_gripping_bomb/);
 assert.match(imported,/new THREE.AnimationMixer\(original\)/);
 assert.match(imported,/const original=cloneIndependentSkeleton\(loaded.gltf.scene\)/);
});
test('game exposes demo state from 3D source to the HTML HUD',()=>{
 assert.match(game,/export function getDemoState\(\)/);
 assert.match(game,/getDemoState,set3DEnabled/);
 assert.match(page,/window\.Bomb3D\?\.getDemoState\?\.\(\)/);
 assert.match(page,/bomba3d\/game\.js\?v=40/);
});
const begin=page.indexOf('function updateHud(){');
const block=page.slice(begin,page.indexOf(' // A lost turn',begin));
assert.ok(begin>=0&&block.length>100);
const names=['round','alive','timer','tableCenterName','tableCenterTimer','centerMark','actionHint'];
function execute(demo){
 const nodes=Object.fromEntries(names.map(id=>[id,{textContent:'',classList:{toggle(){},add(){},remove(){}}}]));
 const room={estado:'ready',titulo:'DEMO · Bomba Mortal JS Family',jugadores:Array.from({length:8},(_,i)=>({id:'p'+i,nombre:'Bot '+i}))};
 const ctx=vm.createContext({room,el:id=>nodes[id]||null,window:{Bomb3D:{getDemoState:()=>demo}}, Math,Date});
 vm.runInContext(block+'}\nupdateHud();',ctx);
 return nodes;
}
test('demo displays active holder and seconds, not waiting to start',()=>{
 const ui=execute({active:true,round:1,holderId:'p2',winnerId:null,exploding:false,inFlight:false,remainingMs:15200,alive:8,total:8});
 assert.equal(ui.tableCenterName.textContent,'Bot 2');
 assert.match(ui.tableCenterTimer.textContent,/16 s/);
 assert.match(ui.round.textContent,/Ronda 1/);
 assert.match(ui.alive.textContent,/8 \/ 8/);
 assert.equal(ui.timer.textContent,'16 s');
});
test('demo reacts to explosion and winner with correct center',()=>{
 const dead=execute({active:true,round:1,victimId:'p2',exploding:true,remainingMs:0,alive:7,total:8});
 assert.equal(dead.tableCenterName.textContent,'¡BOOM!');
 assert.match(dead.tableCenterTimer.textContent,/Bot 2 eliminado/);
 const win=execute({active:true,round:7,winnerId:'p4',exploding:false,remainingMs:0,alive:1,total:8});
 assert.match(win.tableCenterName.textContent,/Bot 4/);
 assert.match(win.tableCenterTimer.textContent,/Fin de la DEMO/);
 assert.match(win.alive.textContent,/1 \/ 8/);
});
