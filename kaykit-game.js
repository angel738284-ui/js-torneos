import * as THREE from './bomba3d/vendor/three.module.js';
import {GLTFLoader} from './bomba3d/vendor/GLTFLoader.js';
const names=['Knight','Rogue','Rogue_Hooded','Mage','Barbarian','Skeleton_Mage','Skeleton_Minion','Skeleton_Rogue','Skeleton_Warrior','Chibi_Frost_Sprite_Coral','Blocky_01_hero','Blocky_03_knight','Blocky_05_wizard','Blocky_06_pirate','Blocky_07_astronaut','Blocky_08_robot','Blocky_09_zombie','Blocky_19_princess'];
const loader=new GLTFLoader();let models=null;
export async function preloadKayKit(){
 if(models)return models;
 const chosen=(()=>{try{return Math.max(0,Math.min(names.length-1,Number(localStorage.getItem('jsfamily-kaykit-character-v1'))||0))}catch{return 0}})();
 const indexes=new Set([0,1,2,3,4,5,6,7,chosen]);
 const results=await Promise.all([...indexes].map(async i=>{try{const gltf=await loader.loadAsync('./kaykit/'+names[i]+'.glb');return [i,{scene:gltf.scene,animations:gltf.animations}]}catch(e){console.warn('Modelo no disponible:',names[i],e);return [i,null]}}));
 const map=new Map(results.filter(([,model])=>model));if(!map.size)throw Error('No se pudo cargar ningún personaje 3D');
 const fallback=map.values().next().value;models=names.map((_,i)=>map.get(i)||fallback);return models;
}
function cloneRig(source){const original=source.scene,copy=original.clone(true),sourceNodes={},copyNodes={};original.traverse(o=>sourceNodes[o.uuid]=o);copy.traverse(o=>{if(o.userData.__sourceUUID)copyNodes[o.userData.__sourceUUID]=o});
// Match source and cloned nodes by traversal order, preserving independent bone bindings.
const a=[],b=[];original.traverse(o=>a.push(o));copy.traverse(o=>b.push(o));const map=new Map(a.map((o,i)=>[o,b[i]]));for(const obj of a){if(!obj.isSkinnedMesh)continue;const dst=map.get(obj);dst.bind(new THREE.Skeleton(obj.skeleton.bones.map(bone=>map.get(bone)),obj.skeleton.boneInverses.map(m=>m.clone())),obj.bindMatrix.clone())}return copy}
export function createKayKitActor(index){if(!models)throw Error('KayKit no precargado');const src=models[index%models.length];const root=new THREE.Group(),body=cloneRig(src);root.add(body);const box=new THREE.Box3().setFromObject(body),size=box.getSize(new THREE.Vector3());body.scale.setScalar(2.45/Math.max(.1,size.y));body.updateMatrixWorld(true);const newBox=new THREE.Box3().setFromObject(body);body.position.y-=newBox.min.y;const mixer=new THREE.AnimationMixer(body);const clips=Object.fromEntries(src.animations.map(c=>[c.name,c]));let active=null;function play(name){const clip=clips[name]||clips[name==='Running_A'?'run':'idle']|| (name==='Running_A'?src.animations.find(c=>/Dash_Run/i.test(c.name)):src.animations.find(c=>/Cheer_Wave/i.test(c.name))) || clips.Idle || src.animations[0];if(!clip)return;const action=mixer.clipAction(clip);if(action===active)return;action.reset().fadeIn(.16).play();if(active)active.fadeOut(.16);active=action}play('Idle');return {root,update(dt,mode){play(mode==='walk'?'Running_A':'Idle');mixer.update(dt)},dispose(){mixer.stopAllAction();mixer.uncacheRoot(body)}}}
