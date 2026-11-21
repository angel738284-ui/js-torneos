from pathlib import Path
root=Path.home()/'js-torneos-pages'
p=root/'itachi-login.css'
s=p.read_text()
old='body.js-auth-required .js-itachi-cover{display:block;position:relative;width:min(100%,520px);height:auto;margin:3px auto 0;filter:drop-shadow(0 16px 32px #b82d4d44)}'
new='body.js-auth-required .js-itachi-cover{display:block;position:relative;width:min(100%,520px);height:auto;margin:15px auto 0;filter:drop-shadow(0 16px 32px #b82d4d44);-webkit-mask-image:linear-gradient(90deg,transparent 0%,#000 10%,#000 90%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0%,#000 10%,#000 90%,transparent 100%)}'
assert s.count(old)==1
s=s.replace(old,new)
old='body.js-auth-required .js-itachi-cover img{display:block;width:100%;height:auto;object-fit:contain;mix-blend-mode:screen;-webkit-mask-image:linear-gradient(180deg,#000 0%,#000 88%,transparent 100%);mask-image:linear-gradient(180deg,#000 0%,#000 88%,transparent 100%)}'
new='body.js-auth-required .js-itachi-cover img{display:block;width:100%;height:auto;object-fit:contain;mix-blend-mode:screen;-webkit-mask-image:linear-gradient(180deg,transparent 0%,#000 16%,#000 85%,transparent 100%);mask-image:linear-gradient(180deg,transparent 0%,#000 16%,#000 85%,transparent 100%)}'
assert s.count(old)==1
s=s.replace(old,new)
s=s.replace('body.js-auth-required .js-itachi-cover{margin:-3px auto 0}','body.js-auth-required .js-itachi-cover{margin:10px auto 0}')
p.write_text(s)
p=root/'torneos.html'
s=p.read_text()
assert s.count('itachi-login.css?v=1.0.0')==1
s=s.replace('itachi-login.css?v=1.0.0','itachi-login.css?v=1.0.1')
p.write_text(s)
print('TOP_AND_SIDES_FADE_APPLIED','mask_changes',Path(root/'itachi-login.css').read_text().count('mask-image:'))
