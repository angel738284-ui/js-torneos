from pathlib import Path
p=Path('bomba3d/imported.js')
s=p.read_text()
def sub(a,b,key):
 global s
 n=s.count(a)
 if n!=1:raise RuntimeError(f"{key}: {n}")
 s=s.replace(a,b,1)
sub('import {dressOriginalRubber} from "./wardrobe.js?v=1";',
'''import {dressOriginalRubber} from "./wardrobe.js?v=2";
import {installTwoHandMorph,setTwoHandPose} from "./two-hand-pose.js";''','two-hand morph import')
sub('''   loaded={gltf,bounds};
   return loaded;''',
'''   // Prepare a shared GPU morph target; each user's copy has its own pose.
   gltf.scene.traverse(o=>{
    if(o.isMesh){
     installTwoHandMorph(o.geometry,bounds);
     o.updateMorphTargets();
    }
   });
   loaded={gltf,bounds};
   return loaded;''','preload morph')
sub(''' const wardrobe=dressOriginalRubber(animatedRig,options,baseMesh.geometry,originalBounding);
 let elapsed=0,deadAmount=0;''',
''' const wardrobe=dressOriginalRubber(animatedRig,options,baseMesh.geometry,originalBounding);
 const palmMat=new THREE.MeshStandardMaterial({
  color:options.bodyColor3d||defaultRed,roughness:.4,metalness:.02
 });
 const palmGeometry=new THREE.SphereGeometry(1,14,10);
 const grippingHands=new THREE.Group();
 grippingHands.name="JS_BOTH_HANDS_GRIPPING_HUGE_BOMB";
 // The source GLB arms are morphed forward, and the small rounded
 // fingertip/mitten tips make contact with both sides of the bomb.
 for(const side of [-1,1]){
  const palm=new THREE.Mesh(palmGeometry,palmMat);
  palm.name=side<0?"left_hand_gripping_bomb":"right_hand_gripping_bomb";
  palm.position.set(side*.51,1.12,.91);
  palm.scale.set(.14,.17,.14);
  grippingHands.add(palm);
 }
 grippingHands.visible=false;
 animatedRig.add(grippingHands);
 let gripPose=0;
 let elapsed=0,deadAmount=0;''','grip hand mesh')
sub('''  wardrobe.update(elapsed,reduced);
  if(action==="death"){''',
'''  wardrobe.update(elapsed,reduced);
  const gripping=action==="hold"||action==="catch";
  const target=gripping?1:action==="throw"?.02:0;
  gripPose+=(target-gripPose)*Math.min(1,Math.max(0,delta||0)*8);
  setTwoHandPose(animatedRig,gripPose);
  grippingHands.visible=gripPose>.14||gripping;
  if(action==="death"){''','morph animate')
sub('''  const idleSway=Math.sin(elapsed*1.9)*(dancing?.18:.085);''',
'''  const idleSway=Math.sin(elapsed*1.9)*(dancing?.18:.085);''','sway marker') if False else None
sub('''   throwing?-.25+Math.sin(elapsed*10)*.065:
   catching?.22+Math.sin(elapsed*8)*.045:idleSway;''',
'''   throwing?-.32+Math.sin(elapsed*10)*.07:
   catching?.19+Math.sin(elapsed*8)*.04:gripping?.045:idleSway;''','heavy object sway')
sub('''  wardrobe.dispose();
  for(const m of materials)m.dispose();''',
'''  wardrobe.dispose();
  palmMat.dispose();
  // Palm geometry remains shared with this actor only.
  palmGeometry.dispose();
  for(const m of materials)m.dispose();''','dispose palms')
p.write_text(s)
p=Path('bomba3d/game.js');s=p.read_text()
def fix(a,b,key):
 global s
 n=s.count(a)
 if n!=1:raise RuntimeError(f"{key}: {n}")
 s=s.replace(a,b,1)
fix('''    a.update(seconds,a.action,reduced);''',
'''    const holderId=demoHolder||(roomData?.estado==="playing"?roomData.bomba_de:null);
    const isHolder=holderId===id&&a.alive&&!flight;
    const playingAction=isHolder&&a.action==="idle"?"hold":a.action;
    a.update(seconds,playingAction,reduced);''','real holder posture')
fix('''    if(["throw","catch","receive"].includes(a.action)&&time>a.until)a.action="idle";''',
'''    if(["throw","catch","receive"].includes(a.action)&&time>a.until)a.action="idle";''','state marker') if False else None
fix('''} from "./bomb-effects.js?v=1";''','''} from "./bomb-effects.js?v=2";''','fresh bomb code')
p.write_text(s)
p=Path('bomba.html');s=p.read_text();a='./bomba3d/game.js?v=7';b='./bomba3d/game.js?v=8';assert s.count(a)==1;s=s.replace(a,b,1);p.write_text(s)
print("RIGGED_TWO_HAND_POSE_ANIMATION_WIRED_TO_GIANT_BOMB")
