from pathlib import Path
root=Path.home()/'js-torneos-pages'
for fname in ['index.html','inscripcion.html','equipo.html','llaves.html','br-mapas.html','admin.html']:
 p=root/fname
 s=p.read_text()
 orig=s
 for old,new in [
  ('JS FAMILY','TORNEOS JS'),
  ('JS Family','TORNEOS JS'),
  ('JS Torneos','TORNEOS JS'),
  ('js-torneos','js-torneos'),
 ]:
  s=s.replace(old,new)
 if s!=orig:
  p.write_text(s)
  print('BRAND_UPDATED',fname)
 else:print('ALREADY_OK',fname)
