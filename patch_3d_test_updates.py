from pathlib import Path
p=Path("test_bomba_ui.mjs")
s=p.read_text()
a=''' assert.match(page,/function buildAvatar\\(value\\)/);
 assert.match(page,/p_action:"avatar",p_avatar:value/);
 assert.match(page,/const a=avatarSafe\\(value\\)/);'''
b=''' assert.match(page,/function avatarSafe\\(obj\\)/);
 assert.match(page,/p_action:"avatar",p_avatar:value/);
 assert.match(page,/id="wear3d"/);
 assert.match(page,/id="topStyle"/);
 assert.match(page,/id="accessory"/);
 assert.match(page,/className="modelSpace"/);
 assert.doesNotMatch(page,/function buildAvatar\\(value\\)/);'''
assert s.count(a)==1;s=s.replace(a,b,1)
p.write_text(s)
p=Path("test_bomba_uploaded_glb.mjs");s=p.read_text()
a='test("Bomba Mortal game uses the uploaded GLB for every player and keeps the 2D fallback",()=>{'
assert s.count(a)==1;s=s.replace(a,'test("Bomba Mortal game uses only the uploaded GLB with a 3D wardrobe",()=>{',1)
a=''' assert.match(page,/bomba3d\\/game\\.js\\?v=5/);
 assert.match(game,/preloadOriginalModel\\(\\)/);
 assert.match(game,/createOriginalRubberActor\\(p\\.avatar\\|\\|\\{\\}\\)/);
 assert.match(game,/createOriginalRubberActor\\(avatar\\)/);
 assert.match(game,/wantsUploaded\\?createOriginalRubberActor\\(p\\.avatar\\|\\|\\{\\}\\):createJellyAvatar/);
 assert.match(game,/function ensureSeamless\\(\\)/);'''
b=''' assert.match(page,/bomba3d\\/game\\.js\\?v=6/);
 assert.match(game,/preloadOriginalModel\\(\\)/);
 assert.match(game,/createOriginalRubberActor\\(avatar\\)/);
 assert.match(game,/studio\\.actor=createOriginalRubberActor\\(avatar\\)/);
 assert.doesNotMatch(game,/createJellyAvatar|ensureSeamless/);
 assert.match(page,/id="wear3d"/);'''
assert s.count(a)==1;s=s.replace(a,b,1)
p.write_text(s)
print("EXISTING_TESTS_ADAPTED_TO_3D_ONLY")
