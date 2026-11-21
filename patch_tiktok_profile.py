from pathlib import Path
p=Path.home()/'js-torneos-pages/torneos.html'
s=p.read_text()
def change(a,b):
 global s
 assert s.count(a)==1,(a[:100],s.count(a))
 s=s.replace(a,b)
change('const scenes=["torneos","perfil","mis"];','const scenes=["perfil","torneos","mis"];')
change('let session=null,profile=null,tournaments=[],fresh=false,activeTab="torneos";','let session=null,profile=null,tournaments=[],fresh=false,activeTab="perfil";')
change('''   const wasGuest=body.classList.contains("js-auth-required");
   body.classList.remove("js-auth-checking");
   body.classList.toggle("js-auth-required",guest);
   if(guest) switchTab("perfil");
   else if(wasGuest) switchTab("torneos");''','''   const wasGuest=body.classList.contains("js-auth-required");
   const wasChecking=body.classList.contains("js-auth-checking");
   body.classList.remove("js-auth-checking");
   body.classList.toggle("js-auth-required",guest);
   // El perfil es la primera pantalla después del login, sin forzar cambios
   // cuando el jugador está navegando entre las otras pestañas.
   if(guest||wasGuest||wasChecking) switchTab("perfil");''')
change('''   document.body.classList.toggle("player-account-screen",tab!=="torneos");
   for(const x of original)''','''   document.body.classList.toggle("player-account-screen",tab!=="torneos");
   document.body.classList.toggle("js-profile-tab",tab==="perfil"&&!document.body.classList.contains("js-auth-required"));
   const brandLabel=document.querySelector("header .brand b");
   if(brandLabel) brandLabel.textContent=tab==="perfil"&&profile?.username?
     "@"+profile.username:tab==="perfil"?"Mi perfil":"TORNEOS JS";
   for(const x of original)''')
change('''   q("js-web-user-handle").textContent=profile.username?"@"+profile.username:"ID "+profile.game_id;
   const badge''','''   q("js-web-user-handle").textContent=profile.username?"@"+profile.username:"ID "+profile.game_id;
   if(activeTab==="perfil"){
     const brandLabel=document.querySelector("header .brand b");
     if(brandLabel) brandLabel.textContent=profile.username?"@"+profile.username:"Mi perfil";
   }
   const badge''')
# Remove old heading and explanation just for signed profile via CSS; preserve for script.
# Add stylesheet version independently to avoid stale CSS.
marker='<link rel="stylesheet" href="itachi-login.css?v=1.0.1">'
assert s.count(marker)==1
s=s.replace(marker,marker+'\n<link rel="stylesheet" href="profile-tiktok.css?v=1.0.0">')
p.write_text(s)
print('REORDER_AND_PROFILE_HOME_COMPLETE')
