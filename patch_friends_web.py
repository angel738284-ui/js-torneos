from pathlib import Path
p=Path.home()/'js-torneos-pages/torneos.html'
s=p.read_text()
def change(old,new):
 global s
 assert s.count(old)==1,(old[:70],s.count(old))
 s=s.replace(old,new)

change('<link rel="stylesheet" href="auto-mis-torneos.css?v=1.0.0">',
       '<link rel="stylesheet" href="auto-mis-torneos.css?v=1.0.0">\n<link rel="stylesheet" href="js-friends.css?v=1.0.0">')
marker='<div id="js-notice-overlay" class="js-notice-overlay account-hide">'
assert s.count(marker)==1
new_section='''<section id="js-friends-view" class="account-section account-hide">
  <div class="js-friends-intro">
    <span class="tag">TORNEOS JS · COMUNIDAD</span>
    <h2>👥 Mis amigos</h2>
    <p>Buscá jugadores por su ID de Free Fire, agregalos e invitalos a participar de los torneos.</p>
  </div>
  <div class="js-friends-card">
    <h3>🔎 Buscar jugador por ID</h3>
    <p>El jugador debe tener una cuenta de TORNEOS JS con su ID de Free Fire verificado.</p>
    <div class="js-friends-search-row">
      <input id="js-friends-id" type="text" inputmode="numeric" maxlength="16" placeholder="ID de Free Fire" aria-label="ID de Free Fire" autocomplete="off">
      <button id="js-friends-search" type="button">Buscar</button>
    </div>
    <p id="js-friends-status" role="status" aria-live="polite"></p>
    <div id="js-friend-search-result"></div>
    <div id="js-friend-profile"></div>
  </div>
  <div class="js-friends-card">
    <div class="js-friends-section-head">
      <h3>🤝 Amigos agregados (<span id="js-friends-count">0</span>)</h3>
      <button id="js-friends-refresh" type="button">↻ Actualizar</button>
    </div>
    <div id="js-friends-list" class="js-friend-list"></div>
  </div>
  <div class="js-friends-card">
    <h3>📩 Solicitudes de amistad</h3>
    <div id="js-friends-requests" class="js-friend-list"></div>
  </div>
  <div class="js-friends-card">
    <h3>🏆 Invitaciones a torneos</h3>
    <div id="js-friends-invites" class="js-friend-list"></div>
  </div>
</section>
'''
s=s.replace(marker,new_section+marker)
change('import {createClient} from "https://esm.sh/@supabase/supabase-js@2";',
       'import {createClient} from "https://esm.sh/@supabase/supabase-js@2";\nimport {initFriends} from "./js-friends-ui.js?v=1.0.0";')
change('const scenes=["perfil","torneos","mis"];',
       'const scenes=["perfil","torneos","mis","amigos"];')
change('const views={perfil:q("js-account-view"),mis:q("js-my-view")};',
       'const views={perfil:q("js-account-view"),mis:q("js-my-view"),amigos:q("js-friends-view")};')
change('let session=null,profile=null,tournaments=[],fresh=false,activeTab="perfil";',
       'let session=null,profile=null,tournaments=[],fresh=false,activeTab="perfil";\n let friendsController=null;')
change('const icons={torneos:"🏆",perfil:"👤",mis:"⚔️"};',
       'const icons={torneos:"🏆",perfil:"👤",mis:"⚔️",amigos:"👥"};')
change('const names={torneos:"Torneos",perfil:"Perfil",mis:"Mis torneos"};',
       'const names={torneos:"Torneos",perfil:"Perfil",mis:"Mis torneos",amigos:"Amigos"};')
change('   if(tab==="mis")loadMy();\n\n   window.scrollTo',
       '   if(tab==="mis")loadMy();\n   if(tab==="amigos")friendsController?.refresh();\n\n   window.scrollTo')
change(' sb.auth.onAuthStateChange((event)=>{if(event==="SIGNED_IN"||event==="SIGNED_OUT")setTimeout(current,0)});',
       ''' friendsController=initFriends({
   q,make,apiCall,safeProfileImage,
   getAccount:()=>({session,profile})
 });
 sb.auth.onAuthStateChange((event)=>{if(event==="SIGNED_IN"||event==="SIGNED_OUT")setTimeout(current,0)});''')
# When the tab is open and the browser returns to foreground, also refresh friends
change('document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&session&&profile)loadMy()});',
       '''document.addEventListener("visibilitychange",()=>{
   if(document.visibilityState!=="visible"||!session||!profile)return;
   loadMy();
   if(activeTab==="amigos")friendsController?.refresh();
 });''')
p.write_text(s)
print('FRIENDS_SECTION_AND_NAV_INTEGRATED')
