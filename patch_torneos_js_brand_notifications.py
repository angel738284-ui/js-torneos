from pathlib import Path
p=Path.home()/'js-torneos-pages/torneos.html'
s=p.read_text()

# Brand all user-visible labels while retaining private storage keys and existing routes.
translations={
 '<title>JS Family · Torneos para jugadores</title>':'<title>TORNEOS JS · Free Fire</title>',
 '<b>JS FAMILY</b>':'<b>TORNEOS JS</b>',
 'Buscando torneos de JS Family…':'Buscando torneos de TORNEOS JS…',
 'JS FAMILY · FREE FIRE':'TORNEOS JS · FREE FIRE',
 'Bienvenido a<br><em>JS Torneos</em>':'Bienvenido a<br><em>TORNEOS JS</em>',
 'Tu perfil, torneos e inscripciones de JS Family.':'Tu perfil, torneos e inscripciones de TORNEOS JS.',
 'Si ya tenés una cuenta de JS Torneos':'Si ya tenés una cuenta de TORNEOS JS',
 'aria-label="Perfil de JS Torneos"':'aria-label="Perfil de TORNEOS JS"',
 'type="button">Salir</button>':'type="button">🚪 Cerrar sesión</button>',
 'new Notification("JS Family · Torneos"':'new Notification("TORNEOS JS"',
 'JS Torneos Jugadores.':'TORNEOS JS.',
}
for old,new in translations.items():
 count=s.count(old)
 assert count>=1,repr(old)
 s=s.replace(old,new)
 print('REBRAND',count,old[:55])

# Make compact header actions for refresh + notifications.
old='<button id="refresh" class="refresh" aria-label="Actualizar" type="button">↻</button></header>'
new='''<div class="js-header-actions">
 <button id="js-open-notices" class="js-bell" type="button" aria-label="Abrir notificaciones" aria-expanded="false" aria-controls="js-notice-overlay">
  <span aria-hidden="true">🔔</span><span id="js-notice-dot" class="js-notice-dot account-hide" aria-hidden="true"></span>
 </button>
 <button id="refresh" class="refresh" aria-label="Actualizar torneos" type="button">↻</button>
 </div></header>'''
assert s.count(old)==1,'header anchor missing'
s=s.replace(old,new)

# Make the existing profile sign-out actually obvious, not just "Salir".
assert s.count('id="js-google-logout"')==1
s=s.replace('id="js-google-logout" class="btn-alt"','id="js-google-logout" class="btn-alt js-logout-btn"')

# Remove dedicated avisos section, replace it with a single bell-triggered accessible popup.
start=s.index('<section id="js-notices-view" class="account-section account-hide">')
end=s.index('\n<script type="module">',start)
replacement='''<div id="js-notice-overlay" class="js-notice-overlay account-hide">
 <section class="js-notice-panel" role="dialog" aria-modal="true" aria-labelledby="js-notice-title" tabindex="-1">
  <div class="js-notice-head">
   <div>
    <div class="js-notice-kicker">TORNEOS JS</div>
    <h2 id="js-notice-title">🔔 Notificaciones</h2>
   </div>
   <button id="js-notice-close" class="js-notice-close" type="button" aria-label="Cerrar notificaciones">✕</button>
  </div>
  <p class="js-notice-explain">Avisos sobre salas, enfrentamientos y resultados.</p>
  <div id="js-notice-list" class="js-notice-list" aria-live="polite"></div>
  <button id="js-alert-permission" class="btn-alt js-alert-button" type="button">Activar notificaciones de este dispositivo</button>
  <p class="tiny js-notice-footer">Los avisos del navegador dependen de sus permisos. Con la página cerrada no se garantizan notificaciones automáticas.</p>
 </section>
</div>
'''
s=s[:start]+replacement+s[end:]
assert 'id="js-notices-view"' not in s

# Style modal on small screens; preserve the other styles.
style_anchor='</style></head>'
assert s.count(style_anchor)==1
styles='''
/* TORNEOS JS: campanita superior y panel de notificaciones. */
.js-header-actions{display:flex;align-items:center;gap:8px}
.js-bell{position:relative;background:#18243a;color:white;border:1px solid #35465c;border-radius:12px;width:45px;height:45px;display:grid;place-items:center;font-size:21px}
.js-bell:hover,.js-bell:focus-visible{border-color:#7debd6}
.js-notice-dot{position:absolute;right:7px;top:6px;width:10px;height:10px;border-radius:50%;background:#fd647d;border:2px solid #18243a}
.js-notice-overlay{position:fixed;inset:0;z-index:500;background:#050913d9;display:flex;align-items:flex-start;justify-content:center;padding:env(safe-area-inset-top) 14px 20px;overflow:auto}
.js-notice-panel{position:relative;max-width:580px;width:100%;max-height:calc(100dvh - 36px);overflow-y:auto;background:linear-gradient(145deg,#182640,#0f1c2d);border:1px solid #49607f;border-radius:20px;padding:19px 17px 24px;margin:clamp(24px,12vh,90px) auto 0;box-shadow:0 20px 70px #000b}
.js-notice-head{display:flex;justify-content:space-between;align-items:flex-start;gap:9px}
.js-notice-kicker{font-size:10px;font-weight:900;letter-spacing:1.7px;color:#a1eadc}
.js-notice-head h2{font-size:21px;margin:5px 0 10px}
.js-notice-close{border:1px solid #5b6b81;background:#253750;color:white;border-radius:11px;min-width:41px;min-height:41px;font-size:19px}
.js-notice-explain{color:#aebfd3;font-size:12px;margin:0 0 15px}
.js-notice-list{display:grid;gap:8px;margin-bottom:12px}
.js-notice-list .notice-line{display:flex;flex-direction:column;align-items:flex-start;gap:5px;margin:0;font-size:13px}
.js-notice-list .notice-line small{font-size:10px;color:#a6bcd7}
.js-alert-button{margin:13px 0 4px;width:100%}
.js-notice-footer{line-height:1.5;margin-top:12px}
.js-logout-btn{border-color:#9a5b69!important;color:#ffc8d0!important;background:#342437!important}
@media(max-width:380px){.brand b{font-size:16px}.brand small{font-size:8px}.logo{width:43px;height:43px}.js-header-actions{gap:5px}.js-bell,.refresh{width:41px;height:41px}}
body.js-auth-required #js-notice-overlay,body.js-auth-checking #js-notice-overlay{display:none!important}
'''
s=s.replace(style_anchor,styles+style_anchor)

# Keep three bottom tabs, not a standalone "Avisos" page.
old='const scenes=["torneos","perfil","mis","avisos"];'
assert s.count(old)==1
s=s.replace(old,'const scenes=["torneos","perfil","mis"];')
old='const views={perfil:q("js-account-view"),mis:q("js-my-view"),avisos:q("js-notices-view")};'
assert s.count(old)==1
s=s.replace(old,'const views={perfil:q("js-account-view"),mis:q("js-my-view")};')
s=s.replace('const icons={torneos:"🏆",perfil:"👤",mis:"⚔️",avisos:"🔔"};','const icons={torneos:"🏆",perfil:"👤",mis:"⚔️"};')
s=s.replace('const names={torneos:"Torneos",perfil:"Perfil",mis:"Mis torneos",avisos:"Avisos"};','const names={torneos:"Torneos",perfil:"Perfil",mis:"Mis torneos"};')
old='''   if(tab==="avisos")showNotices();'''
assert s.count(old)==1
s=s.replace(old,'')
# Remove old browser UI on sign-out and ensure no stale notifications popup.
old=''' q("js-google-logout").onclick=async()=>{await sb.auth.signOut();session=null;profile=null;tournaments=[];fresh=false;await current()};'''
new=''' q("js-google-logout").onclick=async()=>{
   const button=q("js-google-logout");button.disabled=true;
   try{
     const {error}=await sb.auth.signOut();
     if(error)throw error;
     closeNotices();session=null;profile=null;tournaments=[];fresh=false;
     await current();window.scrollTo({top:0,behavior:"instant"});
   }catch(e){status("No se pudo cerrar la sesión: "+e.message,false)}
   finally{button.disabled=false}
 };'''
assert s.count(old)==1
s=s.replace(old,new)

# Bell behavior, read state and no separate page.
start=s.index(' function showNotices(){')
end=s.index(' function notify(text,id,initial){',start)
new=''' const lastSeenKey="js-torneos-notices-last-read-v1";
 function noticeUnread(){
   const seen=Number(localStorage.getItem(lastSeenKey)||0);
   return notices.some(n=>Date.parse(n.at||"")>seen);
 }
 function noticeBellUpdate(){
   q("js-notice-dot").classList.toggle("account-hide",!noticeUnread());
 }
 function showNotices(){
   const box=q("js-notice-list");box.replaceChildren();
   if(!notices.length)box.append(make("p","No hay avisos nuevos todavía.","tiny"));
   for(const n of notices.slice(0,60)){
     const row=make("div",undefined,"notice-line");
     row.append(make("span",n.title),make("small",new Date(n.at).toLocaleString("es-AR")));
     box.append(row);
   }
 }
 let notificationsOpen=false;
 function openNotices(){
   if(!session)return;
   notificationsOpen=true;
   q("js-notice-overlay").classList.remove("account-hide");
   q("js-open-notices").setAttribute("aria-expanded","true");
   showNotices();
   try{localStorage.setItem(lastSeenKey,String(Date.now()))}catch{}
   noticeBellUpdate();
   q("js-notice-close").focus();
 }
 function closeNotices(){
   notificationsOpen=false;
   q("js-notice-overlay").classList.add("account-hide");
   q("js-open-notices").setAttribute("aria-expanded","false");
 }
 q("js-open-notices").onclick=openNotices;
 q("js-notice-close").onclick=closeNotices;
 q("js-notice-overlay").onclick=event=>{if(event.target===q("js-notice-overlay"))closeNotices()};
 document.addEventListener("keydown",event=>{if(event.key==="Escape"&&notificationsOpen)closeNotices()});
 noticeBellUpdate();
'''
s=s[:start]+new+s[end:]
# Dots follow notifications, including when dialog is already opened.
old='''   localStorage.setItem(storeKey,JSON.stringify(notices));
   if(document.visibilityState==="visible"'''
new='''   localStorage.setItem(storeKey,JSON.stringify(notices));
   if(notificationsOpen){showNotices();localStorage.setItem(lastSeenKey,String(Date.now()))}
   noticeBellUpdate();
   if(document.visibilityState==="visible"'''
assert s.count(old)==1
s=s.replace(old,new)
# On auth change, panel must be dismissed and nothing can be shown without sign-in.
old='''   if(!session){profile=null;tournaments=[];renderProfile();status("Ingresá con Google o correo. Si no tenés cuenta, creá una gratis.");showMy();return}'''
new='''   if(!session){closeNotices();profile=null;tournaments=[];renderProfile();status("Ingresá con Google o correo. Si no tenés cuenta, creá una gratis.");showMy();return}'''
assert s.count(old)==1
s=s.replace(old,new)
# Render only three tabs and remove confusing notification legacy comments on page.
assert 'avisos:"🔔"' not in s
assert 'id="js-notices-view"' not in s
assert s.count('id="js-notice-overlay"')==1
p.write_text(s)
print('OK; bytes',len(s),'notification panel',s.count('id="js-notice-panel"'),'brand',s.count('TORNEOS JS'))
