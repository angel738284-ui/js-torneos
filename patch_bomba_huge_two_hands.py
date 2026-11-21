from pathlib import Path
p=Path('bomba3d/bomb-effects.js');s=p.read_text()
replacements=[
('const coreGeometry=new THREE.SphereGeometry(.19,18,14);','const coreGeometry=new THREE.SphereGeometry(.54,24,18);'),
('const bandGeometry=new THREE.TorusGeometry(.13,.025,8,24);','const bandGeometry=new THREE.TorusGeometry(.385,.046,10,32);'),
('const capGeometry=new THREE.CylinderGeometry(.063,.072,.055,12);','const capGeometry=new THREE.CylinderGeometry(.145,.16,.11,14);'),
('const fuseGeometry=new THREE.CylinderGeometry(.018,.023,.19,10);','const fuseGeometry=new THREE.CylinderGeometry(.032,.040,.30,10);'),
('const emberGeometry=new THREE.SphereGeometry(.047,10,8);','const emberGeometry=new THREE.SphereGeometry(.084,12,10);'),
('export const HAND_OFFSET=Object.freeze([.90,.86,.32]);','export const HAND_OFFSET=Object.freeze([0,1.12,.70]);'),
('export const PASS_MIN_MS=700;','export const PASS_MIN_MS=920;'),
('export const PASS_MAX_MS=1180;','export const PASS_MAX_MS=1500;'),
('Math.max(PASS_MIN_MS,Math.min(PASS_MAX_MS,650+d*85))','Math.max(PASS_MIN_MS,Math.min(PASS_MAX_MS,780+d*110))'),
('Math.min(2.4,Math.max(.62,.5+distance*.14))','Math.min(3.0,Math.max(1.25,1.05+distance*.17))'),
('Math.min(.70,distance*.09)','Math.min(.90,distance*.10)'),
('ring.position.set(0,.13,.05);','ring.position.set(0,.385,.05);'),
('cap.position.y=.195;','cap.position.y=.54;'),
('wick.position.set(.023,.305,0);','wick.position.set(.03,.735,0);'),
('ember.name="bomb_lit_fuse";ember.position.set(.066,.41,.012);','ember.name="bomb_lit_fuse";ember.position.set(.090,.918,.025);'),
('const sparkle=new THREE.PointLight(0xff9b3a,.30,1.35);','const sparkle=new THREE.PointLight(0xff9b3a,.45,2.4);')
]
for a,b in replacements:
 assert s.count(a)==1,(a,s.count(a))
 s=s.replace(a,b,1)
s=s.replace('root.name="JS_3D_HAND_BOMB";','root.name="JS_3D_HUGE_BOMB_TWO_HANDS";')
p.write_text(s)
p=Path('bomba3d/two-hand-pose.js');s=p.read_text()
s=s.replace('if(!attr||!norm||!bounds)throw Error("Missing character geometry");','if(!attr||!norm||(!bounds&&!normalized))throw Error("Missing character geometry");')
p.write_text(s)
p=Path('bomba3d/wardrobe.js');s=p.read_text()
s=s.replace('import * as THREE from "./vendor/three.module.js";','import * as THREE from "./vendor/three.module.js";\nimport {installTwoHandMorph} from "./two-hand-pose.js";')
needle=''' g.computeBoundingSphere();
 shapes.set(kind,g);'''
replacement=''' g.computeBoundingSphere();
 // Sleeves deform with the original GLB arms, avoiding stiff clothing.
 if(kind==="sleeves"||kind==="shortSleeves")installTwoHandMorph(g,null,true);
 shapes.set(kind,g);'''
assert s.count(needle)==1
s=s.replace(needle,replacement)
p.write_text(s)
print('OVERSIZED_BOMB_AND_SLEEVE_MORPH_CONFIGURED')
