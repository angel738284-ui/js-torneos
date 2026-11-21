from pathlib import Path
root=Path.home()/'js-torneos-pages'
p=root/'torneos.html'
s=p.read_text()
def change(old,new):
 global s
 assert s.count(old)==1,(old[:95],s.count(old))
 s=s.replace(old,new)
change('<link rel="stylesheet" href="js-friends.css?v=1.0.0">',
       '<link rel="stylesheet" href="js-friends.css?v=1.0.0">\n<link rel="stylesheet" href="profile-social.css?v=1.0.0">')
change('''        <p id="js-web-user-bio" class="js-web-profile-bio"></p>
        <p id="js-web-freefire"''','''        <p id="js-web-user-bio" class="js-web-profile-bio"></p>
        <div id="js-web-social" class="js-social-links" aria-label="Redes sociales del jugador" hidden></div>
        <p id="js-web-freefire"''')
change('''          <textarea id="js-web-bio-edit" maxlength="180" placeholder="Contá algo sobre vos…"></textarea>
          <label for="js-web-avatar-file">''','''          <textarea id="js-web-bio-edit" maxlength="180" placeholder="Contá algo sobre vos…"></textarea>
          <label class="js-social-edit-label" for="js-web-instagram-edit">📷 Instagram</label>
          <input id="js-web-instagram-edit" maxlength="350" inputmode="url" autocomplete="off" placeholder="https://www.instagram.com/tu_usuario/">
          <label class="js-social-edit-label" for="js-web-tiktok-edit">♪ TikTok</label>
          <input id="js-web-tiktok-edit" maxlength="350" inputmode="url" autocomplete="off" placeholder="https://www.tiktok.com/@tu_usuario">
          <p class="js-social-help">Pegá el enlace completo o escribí @usuario. Son opcionales y los podés quitar cuando quieras.</p>
          <label for="js-web-avatar-file">''')
change('import {initFriends} from "./js-friends-ui.js?v=1.0.0";',
       'import {initFriends} from "./js-friends-ui.js?v=1.0.0";\nimport {normalizeSocialLink,renderSocialLinks} from "./profile-social.js?v=1.0.0";')
change('''   q("js-web-user-bio").textContent=profile.bio||"Todavía no agregaste una biografía.";
   q("js-web-freefire").textContent=''','''   q("js-web-user-bio").textContent=profile.bio||"Todavía no agregaste una biografía.";
   renderSocialLinks(q("js-web-social"),profile);
   q("js-web-freefire").textContent=''')
change('''   q("js-web-bio-edit").value=profile.bio||"";
   q("js-web-avatar-file")''','''   q("js-web-bio-edit").value=profile.bio||"";
   q("js-web-instagram-edit").value=profile.instagram_url||"";
   q("js-web-tiktok-edit").value=profile.tiktok_url||"";
   q("js-web-avatar-file")''')
change('''   try{
     indication.textContent="Guardando tu perfil en Supabase…";
     const avatarFile''','''   try{
     const instagram_url=normalizeSocialLink(q("js-web-instagram-edit").value,"instagram");
     const tiktok_url=normalizeSocialLink(q("js-web-tiktok-edit").value,"tiktok");
     indication.textContent="Guardando tu perfil en Supabase…";
     const avatarFile''')
change('''       display_name,username,bio,avatar_path:avatar,banner_path:banner
     });
     profile=result.profile;''','''       display_name,username,bio,avatar_path:avatar,banner_path:banner,
       instagram_url,tiktok_url
     });
     profile=result.profile;''')
change('status("✅ Perfil actualizado: nombre, foto y portada sincronizados con la APK.",true);',
       'status("✅ Perfil actualizado: foto, biografía y redes sociales guardadas en tu cuenta.",true);')
p.write_text(s)
p=root/'js-friends-ui.js'
s=p.read_text()
a='''/* Amigos de TORNEOS JS — mismas amistades e invitaciones de la APK.
   Toda operación pasa por js-jugadores-cuenta con JWT de Supabase. */'''
assert s.count(a)==1
s=s.replace(a,a+'\nimport {renderSocialLinks} from "./profile-social.js?v=1.0.0";')
a='''      card.append(make("p",p.bio||"Sin biografía.","js-friend-bio"));
      card.append(button("✕ Cerrar perfil",()=>root.replaceChildren(),"neutral"));'''
b='''      card.append(make("p",p.bio||"Sin biografía.","js-friend-bio"));
      const socials=make("div",undefined,"js-social-links");
      renderSocialLinks(socials,p);
      card.append(socials);
      card.append(button("✕ Cerrar perfil",()=>root.replaceChildren(),"neutral"));'''
assert s.count(a)==1
s=s.replace(a,b)
p.write_text(s)
print("SOCIAL_LINKS_EDIT_AND_PUBLIC_PROFILE_ENABLED")
