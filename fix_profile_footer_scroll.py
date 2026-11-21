from pathlib import Path
root=Path.home()/'js-torneos-pages'
p=root/'torneos.html'
s=p.read_text()
old='''      <p class="tiny">La verificación identifica el apodo del ID, pero no demuestra que seas el propietario de esa cuenta de Free Fire.</p>
    </div>

  </div>
</section>'''
new='''      <p class="tiny">La verificación identifica el apodo del ID, pero no demuestra que seas el propietario de esa cuenta de Free Fire.</p>
    </div>
    <div class="js-profile-end" aria-label="Fin de tu perfil">
      <span class="js-profile-end-line" aria-hidden="true"></span>
      <span class="js-profile-end-text">✦ FIN DE TU PERFIL ✦</span>
      <span class="js-profile-end-line" aria-hidden="true"></span>
    </div>
  </div>
</section>'''
assert s.count(old)==1, "Could not find profile end insertion"
s=s.replace(old,new)
css_link='profile-tiktok.css?v=1.0.2'
assert s.count(css_link)==1
s=s.replace(css_link,'profile-tiktok.css?v=1.0.3')
p.write_text(s)
p=root/'profile-tiktok.css'
s=p.read_text()
assert 'PROFUNDIDAD FINAL DE PERFIL' not in s
s+='''

/* PROFUNDIDAD FINAL DE PERFIL (móvil y escritorio)
   La navegación es fija. Reservar su altura por debajo del contenido
   evita que tape el último campo e impida llegar al marco de cierre. */
body.js-profile-tab:not(.js-auth-required):not(.js-auth-checking) #js-account-view {
  height:auto;
  max-height:none;
  overflow:visible;
  padding-bottom:calc(126px + env(safe-area-inset-bottom, 0px));
}
body.js-profile-tab:not(.js-auth-required):not(.js-auth-checking) #js-account-signed>.account-card {
  margin:20px 16px 0;
  padding:19px 17px 24px;
  border-radius:17px;
  border:1px solid #4b536b;
  box-shadow:0 10px 32px #0005, inset 0 1px #ffffff09;
  background:linear-gradient(160deg,#172134,#0e1422);
}
body.js-profile-tab:not(.js-auth-required):not(.js-auth-checking) .js-profile-end {
  display:flex;
  align-items:center;
  justify-content:center;
  gap:12px;
  margin:24px 22px 0;
  padding:10px 0 6px;
}
.js-profile-end-line {
  flex:1;
  max-width:155px;
  height:1px;
  background:linear-gradient(90deg,transparent,#814256,transparent);
}
.js-profile-end-text {
  color:#a1aabe;
  font-size:10px;
  font-weight:800;
  white-space:nowrap;
  letter-spacing:1.2px;
}
body.js-profile-tab:not(.js-auth-required):not(.js-auth-checking) {
  overflow-y:visible;
  overscroll-behavior-y:auto;
}
@media(max-width:380px){
  body.js-profile-tab:not(.js-auth-required):not(.js-auth-checking) #js-account-signed>.account-card{
    margin-left:12px;margin-right:12px;padding-left:13px;padding-right:13px;
  }
  .js-profile-end{gap:6px!important}
}
'''
p.write_text(s)
print('PROFILE_SCROLL_AND_FINISH_UPDATED')
