from pathlib import Path
p=Path("test_bomba_3d_throw_catch.mjs");s=p.read_text()
old='actors,projectile,ready:true,roomData:null,flight:null,demoHolder:null,demoPending:null,demoEndsAt:0,Math,Map,'
new='actors,projectile,ready:true,roomData:null,flight:null,demoHolder:null,demoPending:null,demoEndsAt:0,demoFuseStartAt:0,demoFuseDeadlineAt:0,serverClockOffset:0,roundFuseProgress:()=>1,Math,Map,'
assert s.count(old)==1;s=s.replace(old,new)
p.write_text(s)
p=Path("test_bomba_demo_throw.mjs");s=p.read_text()
old='demoHolder:null,demoPending:null,demoEndsAt:0,'
new='demoHolder:null,demoPending:null,demoEndsAt:0,demoFuseStartAt:0,demoFuseDeadlineAt:0,serverClockOffset:0,roundFuseProgress:()=>1,'
assert s.count(old)==1;s=s.replace(old,new)
p.write_text(s)
for filename in ["test_bomba_3d_throw_catch.mjs","test_bomba_big_two_hands.mjs","test_bomba_uploaded_glb.mjs","test_bomba_3d_only_wardrobe.mjs","test_bomba_ui.mjs"]:
 p=Path(filename);s=p.read_text()
 s=s.replace(r'game\.js\?v=8',r'game\.js\?v=9')
 p.write_text(s)
print("TEST_HARNESSES_AND_CACHE_REFS_UPDATED")
