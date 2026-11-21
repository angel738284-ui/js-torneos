from pathlib import Path
root=Path.home()/'js-torneos-pages'
for name in ["index.html","torneos.html"]:
 p=root/name;s=p.read_text()
 assert s.count('location.replace("/admin.html"+location.search+location.hash);')==1
 s=s.replace('location.replace("/admin.html"+location.search+location.hash);','location.replace("/recuperar.html"+location.search+location.hash);')
 start=s.index(' q("js-auth-forgot").onclick=async()=>{')
 end=s.index(' setAuthTab(false);',start)
 old=s[start:end]
 assert 'resetPasswordForEmail' in old
 s=s[:start]+''' q("js-auth-forgot").onclick=()=>{window.location.assign("./recuperar.html")};
'''+s[end:]
 p.write_text(s)
assert (root/'index.html').read_bytes()==(root/'torneos.html').read_bytes()
print("PLAYER_RECOVERY_AND_ROOT_CALLBACK_ROUTED_TO_UNIVERSAL_PAGE")
