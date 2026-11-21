from pathlib import Path
p=Path(__file__).with_name('imported.js')
s=p.read_text()
bak=p.with_suffix('.js.pre-animated.bak')
if not bak.exists(): bak.write_text(s)
assert 'rigRubber(original,originalBounding)' in s
s=s.replace(' * The file is unrigged (one mesh, zero animations); this adapter provides non-bone\n * idle/receive/death body motions while preserving the source model and its eyes.',
' * Skinned mobile GLB: preserves the original eyes/texture and adds six bone animations.\n * Each player gets an independent skeleton and animation mixer.')
s=s.replace('import {rigRubber} from "./skeleton.js?v=3";\n','')
s=s.replace('import {installTwoHandMorph,setTwoHandPose,setHeadNod} from "./two-hand-pose.js";\n','')
s=s.replace('const filename="./models/js-rubber-mobile.glb";','const filename="./models/js-rubber-animated.glb";')
start=s.index('   // Prepare a shared GPU morph target;')
end=s.index('   loaded={gltf,bounds};',start)
s=s[:start]+'''   if(!gltf.animations?.length||!gltf.scene.getObjectByName("Hips"))\n    throw Error("El GLB no tiene articulaciones y clips");\n'''+s[end:]
loc=s.index('export function createOriginalRubberActor(')
s=s[:loc]+'''/** Standard clone(true) keeps skeleton references to the SOURCE bones.\n * Rebind each player's skinned copy to its own cloned bones, otherwise all\n * players animate as one (and can deform in unexpected ways).\n */\nfunction cloneIndependentSkeleton(source){\n const copy=source.clone(true);\n const src=[],dst=[];\n source.traverse(o=>{if(o.isSkinnedMesh)src.push(o);});\n copy.traverse(o=>{if(o.isSkinnedMesh)dst.push(o);});\n if(!src.length||src.length!==dst.length)throw Error("Rig skinned inválido");\n for(let i=0;i<src.length;i++){\n  const original=src[i],clone=dst[i];\n  const bones=original.skeleton.bones.map(b=>copy.getObjectByName(b.name));\n  if(bones.some(b=>!b))throw Error("Faltan huesos del rig");\n  clone.bind(new THREE.Skeleton(bones,original.skeleton.boneInverses.map(m=>m.clone())),original.bindMatrix.clone());\n  clone.frustumCulled=false;\n }\n return copy;\n}\n\n'''+s[loc:]
s=s.replace(' const original=loaded.gltf.scene.clone(true);',' const original=cloneIndependentSkeleton(loaded.gltf.scene);')
s=s.replace(' const bodyRig=rigRubber(original,originalBounding);',''' const mixer=new THREE.AnimationMixer(original);\n const clipMap=new Map(loaded.gltf.animations.map(c=>[c.name,c]));\n const actionNames={idle:"Esperando",hold:"Sostener_Bomba",throw:"Lanzar_Bomba",\n   catch:"Recibir_Bomba",receive:"Recibir_Bomba",death:"Explotar_Caer",\n   walk:"Caminar",wave:"Esperando",dance:"Caminar",confident:"Esperando"};\n const loops=new Set(["Esperando","Sostener_Bomba","Caminar"]);\n let current=null,currentName="",time=0;\n function play(name){\n  if(currentName===name)return;\n  const clip=clipMap.get(name)||clipMap.get("Esperando");\n  if(!clip)return;\n  const next=mixer.clipAction(clip);\n  next.reset();next.enabled=true;\n  next.setLoop(loops.has(name)?THREE.LoopRepeat:THREE.LoopOnce,loops.has(name)?Infinity:1);\n  next.clampWhenFinished=!loops.has(name);\n  next.timeScale=name==="Lanzar_Bomba"?1.65:1;\n  if(current&&current!==next)current.fadeOut(.12);\n  next.fadeIn(.12).play();\n  current=next;currentName=name;\n }\n play("Esperando");''')
start=s.index(' let gripPose=0;')
end=s.index(' const dispose=()=>{',start)
s=s[:start]+''' let elapsed=0,deadAmount=0;\n const update=(delta,action="idle",reduced=false)=>{\n  const dt=Math.min(.10,Math.max(0,delta||0));\n  elapsed+=dt;\n  wardrobe.update(elapsed,reduced);\n  const name=actionNames[action]||"Esperando";\n  play(name);\n  mixer.update(reduced?0:dt);\n  const holding=action==="hold"||action==="catch"||action==="receive";\n  grippingHands.visible=holding;\n  // All spine bending is weighted in the source GLB, not a whole-torso morph.\n  // One-shot defeat is held at the end so eliminated players stay down.\n  if(name==="Explotar_Caer"){\n   deadAmount=Math.min(1,deadAmount+dt/1.6);\n   animatedRig.rotation.z=-.55*deadAmount;\n   animatedRig.position.y=-.10*deadAmount;\n  }else{\n   deadAmount=0;\n   animatedRig.rotation.set(0,0,0);\n   animatedRig.position.set(0,0,0);\n  }\n  animatedRig.scale.set(1,1,1);\n };\n'''+s[end:]
s=s.replace('  wardrobe.dispose();','  mixer.stopAllAction();mixer.uncacheRoot(original);\n  wardrobe.dispose();')
s=s.replace(' return {root,handAnchor:animatedRig,update,dispose,costume:"plain",kind:"uploaded",alive:true};',' return {root,handAnchor:animatedRig,update,dispose,costume:"plain",kind:"uploaded",alive:true,mixer};')
p.write_text(s)
print('UPDATED',p,'backup',bak)
