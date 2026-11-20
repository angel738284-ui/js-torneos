import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const path=new URL('./bomba3d/models/js-rubber-animated.glb',import.meta.url);
const bytes=readFileSync(path);
const n=bytes.readUInt32LE(12);
const gltf=JSON.parse(bytes.toString('utf8',20,20+n));
const binOffset=20+n+8;
const bin=bytes.subarray(binOffset);
const attrs=gltf.meshes[0].primitives[0].attributes;
const viewOf=id=>{
 const a=gltf.accessors[id],v=gltf.bufferViews[a.bufferView];
 const offset=(v.byteOffset||0)+(a.byteOffset||0);
 return {a,v,offset};
};
test('GLB skinned opens with six animation clips and 11 bones',()=>{
 assert.equal(bytes.toString('utf8',0,4),'glTF');
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 assert.equal(gltf.skins.length,1);
 assert.equal(gltf.skins[0].joints.length,11);
 assert.deepEqual(gltf.animations.map(a=>a.name),[
  'Esperando','Caminar','Sostener_Bomba','Lanzar_Bomba','Recibir_Bomba','Explotar_Caer']);
 assert.ok(attrs.JOINTS_0!==undefined && attrs.WEIGHTS_0!==undefined);
 assert.equal(gltf.skins[0].inverseBindMatrices>=0,true);
});
test('Each of the 11383 vertices has four bone weights summing to 1',()=>{
 const j=viewOf(attrs.JOINTS_0),w=viewOf(attrs.WEIGHTS_0);
 assert.equal(j.a.count,w.a.count);assert.equal(w.a.count,11383);
 for(let i=0;i<w.a.count;i++){
  const b=[0,1,2,3].map(k=>bin.readFloatLE(w.offset+i*16+k*4));
  const ids=[0,1,2,3].map(k=>bin.readUInt8(j.offset+i*4+k));
  assert.ok(Math.abs(b.reduce((s,v)=>s+v,0)-1)<.001);
  assert.ok(b.every(x=>Number.isFinite(x)&&x>=0&&x<=1));
  assert.ok(ids.every(x=>x<11));
 }
});
test('Animation keyframe times are valid and joint paths exist',()=>{
 for(const clip of gltf.animations){
  for(const channel of clip.channels){
   const s=clip.samplers[channel.sampler],acc=viewOf(s.input);
   let previous=-1;
   for(let i=0;i<acc.a.count;i++){
    const value=bin.readFloatLE(acc.offset+4*i);
    assert.ok(value>previous,clip.name);
    previous=value;
   }
   assert.ok(['rotation','translation'].includes(channel.target.path));
   assert.ok(gltf.skins[0].joints.includes(channel.target.node));
   assert.equal(viewOf(s.output).a.count,acc.a.count);
  }
 }
});
test('Game creates independently animated characters without replacing multiplayer',()=>{
 const imported=readFileSync(new URL('./bomba3d/imported.js',import.meta.url),'utf8');
 const game=readFileSync(new URL('./bomba3d/game.js',import.meta.url),'utf8');
 assert.match(imported,/cloneIndependentSkeleton\(loaded\.gltf\.scene\)/);
 assert.match(imported,/new THREE\.AnimationMixer\(original\)/);
 assert.match(imported,/clone\.bind\(new THREE\.Skeleton\(bones,/);
 assert.match(game,/onGameTransition\(before,after\)/);
 assert.match(game,/createOriginalRubberActor\(avatar\)/);
});
