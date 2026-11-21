from pathlib import Path
import hashlib,json,shutil,subprocess,re
home=Path.home()
repo=home/'js-torneos-pages'
base=home/'JS-Torneos-v1'
items=[
 ('admin',base/'android/build/JS-TORNEOS-v0.6.6.apk','JS-TORNEOS-v0.6.6.apk','0.6.6',38,'updates/admin.json',repo/'updates/JS-TORNEOS-v0.6.5.apk'),
 ('players',base/'android-jugadores/build/JS-TORNEOS-JUGADORES-v1.6.5.apk','JS-TORNEOS-JUGADORES-v1.6.5.apk','1.6.5',19,'updates/players.json',repo/'updates/JS-TORNEOS-JUGADORES-v1.6.4.apk')
]
for who,src,name,ver,code,meta,old in items:
 assert src.exists() and old.exists()
 if who=='admin':work=base/'android'
 else: work=base/'android-jugadores'
 for app in [src,old]:
  proc=subprocess.run(['apksigner','verify','--print-certs',str(app)],capture_output=True,text=True,check=True)
  m=re.search(r'Signer #1 certificate SHA-256 digest: ([a-f0-9]+)',proc.stdout)
  assert m,proc.stdout[:500]
  if app==src: newcert=m.group(1)
  else: oldcert=m.group(1)
 assert newcert==oldcert,(who,newcert,oldcert)
 dest=repo/'updates'/name
 shutil.copyfile(src,dest)
 data=json.loads((repo/meta).read_text())
 data.update(version_code=code,version_name=ver,apk_url='https://angel738284-ui.github.io/js-torneos/updates/'+name,sha256=hashlib.sha256(dest.read_bytes()).hexdigest())
 data['notes']='Corrección del detector de actualizaciones: ahora compara la versión realmente instalada en Android y no vuelve a pedir la misma actualización. Mantiene los tres mapas BR: Bermuda, Purgatorio y Kalahari.'
 (repo/meta).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 print(who,'SIGNED_COMPATIBLE','VERSION',ver,'SIZE',dest.stat().st_size,'SHA',data['sha256'])
