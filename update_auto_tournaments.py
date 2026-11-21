from pathlib import Path
p=Path.home()/'js-torneos-pages/torneos.html'
s=p.read_text()
# Remove private-code storage from player-facing profile, not the database and not the team access system.
start=s.index('    <div class="account-card">\n      <h3>🔐 Guardar mi código privado</h3>')
end=s.index('\n  </div>\n</section>\n<section id="js-my-view"',start)
removed=s[start:end]
assert 'id="js-team-code"' in removed and 'id="js-saved-codes"' in removed
s=s[:start]+s[end:]
# Make ID-based auto-linking explicit and simple to refresh.
old='''<section id="js-my-view" class="account-section account-hide">
  <h2>⚔️ Mis torneos</h2>
  <p>Las inscripciones encontradas con el ID de Free Fire de tu perfil.</p>
  <div id="js-my-list"><div class="empty">Ingresá con correo o Google para ver tus participaciones.</div></div>
</section>'''
new='''<section id="js-my-view" class="account-section account-hide">
  <h2>⚔️ Mis torneos</h2>
  <p>Encontramos tus participaciones automáticamente según el ID de Free Fire guardado en tu perfil.</p>
  <div class="js-auto-tournaments">
    <div><strong>🎮 ID vinculado: <span id="js-my-game-id">—</span></strong>
    <p class="tiny">No tenés que ingresar códigos. Se muestran las inscripciones donde figura tu ID, como titular o suplente.</p></div>
    <button id="js-my-refresh" class="btn-alt" type="button">↻ Actualizar</button>
  </div>
  <div id="js-my-list" aria-live="polite"><div class="empty">Iniciá sesión para ver tus participaciones.</div></div>
</section>'''
assert s.count(old)==1
s=s.replace(old,new)
# Remove JS no longer associated with controls in DOM.
start=s.index(' async function loadSavedCodes(){')
end=s.index(' const imageHost=',start)
assert 'js-saved-codes' in s[start:end]
s=s[:start]+s[end:]
start=s.index(' q("js-team-link").onclick=async()=>{')
end=s.index(' let jsSignupMode=false;',start)
assert 'loadSavedCodes()' in s[start:end]
s=s[:start]+s[end:]
assert s.count('loadMy();loadSavedCodes();')==1
s=s.replace('loadMy();loadSavedCodes();','loadMy();')
# Explicit ID auto-linking, refreshed when the user selects My tournaments or switches verified ID.
old=''' function showMy(){
   const root=q("js-my-list");root.replaceChildren();
   if(!session){root.append(make("div","Ingresá con correo o Google para ver tus torneos.","empty"));return}
   if(!profile){root.append(make("div","Primero verificá tu ID de Free Fire desde Perfil.","empty"));return}
   if(!tournaments.length){root.append(make("div","Aún no encontramos equipos inscritos con tu ID.","empty"));return}'''
new=''' function showMy(){
   const root=q("js-my-list");root.replaceChildren();
   q("js-my-game-id").textContent=profile?.game_id||"Sin verificar";
   if(!session){root.append(make("div","Ingresá con Google o correo para ver tus torneos.","empty"));return}
   if(!profile){root.append(make("div","Verificá tu ID de Free Fire desde Perfil y acá aparecerán tus inscripciones automáticamente.","empty"));return}
   if(!tournaments.length){root.append(make("div","Todavía no hay inscripciones activas donde figure tu ID "+profile.game_id+". Si te anotaron recién, tocá Actualizar.","empty"));return}'''
assert s.count(old)==1
s=s.replace(old,new)
# Refresh button triggers the existing authenticated Supabase account endpoint; no private code required.
marker=' async function loadMy(){'
assert s.count(marker)==1
s=s.replace(marker,''' q("js-my-refresh").onclick=()=>{
   const btn=q("js-my-refresh");
   if(btn.disabled)return;
   btn.disabled=true;
   loadMy().finally(()=>{btn.disabled=false});
 };
'''+marker)
# Improve feedback during asynchronous lookup without flickering when polls happen in the background.
old=''' async function loadMy(){
   if(!session||!profile){tournaments=[];showMy();return}
   try{
     const result=await apiCall("my_tournaments");'''
new=''' async function loadMy(){
   if(!session||!profile){tournaments=[];showMy();return}
   q("js-my-game-id").textContent=profile.game_id;
   if(activeTab==="mis"){
     q("js-my-list").replaceChildren(make("div","🔎 Buscando los torneos registrados con tu ID "+profile.game_id+"…","empty"));
   }
   try{
     const result=await apiCall("my_tournaments");'''
assert s.count(old)==1
s=s.replace(old,new)
# Styling on this page only.
style='<link rel="stylesheet" href="profile-tiktok.css?v=1.0.2">'
assert s.count(style)==1
s=s.replace(style,style+'\n<link rel="stylesheet" href="auto-mis-torneos.css?v=1.0.0">')
# Zero references should remain, including the calls that would throw on absent DOM elements.
for ident in ['js-team-code','js-team-link','js-saved-codes','js-saved-refresh','loadSavedCodes','save_web_code','my_web_codes']:
 assert ident not in s,ident
p.write_text(s)
print("AUTO_MY_TOURNAMENTS_FORM_UPDATED",len(s))
