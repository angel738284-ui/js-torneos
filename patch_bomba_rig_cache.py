from pathlib import Path
root=Path(__file__).parent
for name,src,dst in [
 ('bomba.html','./bomba3d/game.js?v=37','./bomba3d/game.js?v=38'),
 ('bomba3d/game.js','./imported.js?v=19','./imported.js?v=20'),
 ('modelo-js.html','./bomba3d/imported.js?v=1','./bomba3d/imported.js?v=20')
]:
 path=root/name
 s=path.read_text()
 assert src in s, f"{name} missing {src}"
 path.write_text(s.replace(src,dst,1))
 print('BUMPED',name)
