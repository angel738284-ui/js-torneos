// Competitive profile cards use ONLY the restricted fields returned by
// js_liga_perfil_publico. Never display email, numeric FF ID, session info,
// private storage paths, or Google account names.
const ranks={
 Bronce:{emoji:"🥉",theme:"bronze",next:"Plata",nextPoints:100},
 Plata:{emoji:"🥈",theme:"silver",next:"Oro",nextPoints:250},
 Oro:{emoji:"🥇",theme:"gold",next:"Diamante",nextPoints:450},
 Diamante:{emoji:"💎",theme:"diamond",next:"Maestro",nextPoints:700},
 Maestro:{emoji:"👑",theme:"master",next:null,nextPoints:null},
};
const scalar=x=>Number.isFinite(Number(x))?Number(x):0;
export function competitiveProfileCard(p,esc){
 const r=ranks[p?.rank]||ranks.Bronce;
 const wins=scalar(p.wins),losses=scalar(p.losses),total=wins+losses;
 const rate=total?Math.round(wins*100/total):0;
 const nickname=esc(p.nickname||"Jugador JS");
 const badges=Array.isArray(p.badges)?p.badges:[];
 const recent=Array.isArray(p.recent)?p.recent:[];
 const remaining=r.nextPoints===null?null:Math.max(0,r.nextPoints-scalar(p.score));
 const progress=r.nextPoints===null?100:Math.min(100,Math.max(0,
  Math.round((scalar(p.score)-({Bronce:0,Plata:100,Oro:250,Diamante:450,Maestro:700}[p.rank]||0))/
  (r.nextPoints-({Bronce:0,Plata:100,Oro:250,Diamante:450,Maestro:700}[p.rank]||0))*100)));
 const played=recent.map(x=>
  '<div class="cp-last '+(x.outcome==="win"?"won":"lost")+'">'+
  '<span>'+(x.outcome==="win"?"✓":"✕")+'</span>'+
  '<small>'+(x.mode==="1v1"?"1VS1":"2VS2")+'</small></div>').join("");
 const achievements=badges.map(x=>'<div class="cp-medal">'+
  '<span aria-hidden="true">'+esc(x.emoji||"🏅")+'</span>'+
  '<strong>'+esc(x.name||"Insignia")+'</strong></div>').join("");
 return '<section class="cp-profile '+r.theme+'">'+
   '<div class="cp-cover"><div class="cp-cover-top"><strong>JS FAMILY</strong>'+
    '<span>PERFIL COMPETITIVO</span></div>'+
    '<div class="cp-avatar" aria-hidden="true">⚔️</div>'+
    '<h2>'+nickname+'</h2>'+
    '<div class="cp-verified">'+(p.verified?"✓ ID de Free Fire verificado":"Cuenta sin verificar")+
    ' · '+(p.public?"🌐 Público":"🔒 Privado")+'</div>'+
    '<div class="cp-rank"><span>'+r.emoji+'</span><div><small>RANGO PERSONAL</small>'+
     '<strong>'+esc(p.rank||"Bronce")+'</strong></div>'+
     '<b>'+scalar(p.score)+' <small>PTS</small></b></div>'+
   '</div>'+
   '<div class="cp-content">'+
    '<div class="cp-stats">'+
     '<div><b>'+wins+'</b><small>VICTORIAS</small></div>'+
     '<div><b>'+losses+'</b><small>DERROTAS</small></div>'+
     '<div><b>'+rate+'%</b><small>EFECTIVIDAD</small></div>'+
    '</div>'+
    '<div class="cp-progress"><div class="cp-progress-head"><span>PROGRESO DE RANGO</span>'+
     '<strong>'+(remaining===null?"👑 Rango máximo":remaining+" pts para "+r.next)+'</strong></div>'+
     '<div class="cp-bar"><div style="width:'+progress+'%"></div></div></div>'+
    '<div class="cp-modes"><span>🎮 2VS2 <b>'+scalar(p.duos)+'</b></span>'+
     '<span>⚔️ 1VS1 <b>'+scalar(p.solos)+'</b></span>'+
     '<span>🔥 Mejor racha <b>'+scalar(p.best_streak)+'</b></span></div>'+
    '<div class="cp-section-title"><strong>🏅 Insignias conseguidas</strong>'+
     '<small>'+badges.length+' desbloqueadas</small></div>'+
    (achievements?'<div class="cp-badges">'+achievements+'</div>':
      '<p class="cp-muted">Todavía no hay insignias. Ganá tu primer PvP para desbloquear la primera.</p>')+
    '<div class="cp-section-title"><strong>📋 Últimos resultados</strong></div>'+
    (played?'<div class="cp-recent">'+played+'</div>':
      '<p class="cp-muted">Los resultados oficiales aparecerán acá.</p>')+
    '<div class="cp-foot">JS FAMILY · Estadísticas de resultados oficiales</div>'+
   '</div>'+
  '</section>';
}
export function createCompetitiveProfile({sb,getMe,getView,render,flash,esc,btn}){
 let currentUser=null,loaded=false,loading=false,profile=null,sharing=false,error="";
 const rpc=async(name,args)=>{
  const {data,error:requestError}=await sb.rpc(name,args);
  if(requestError)throw requestError;
  if(!data?.ok)throw Error(data?.message||"No se pudo consultar el perfil.");
  return data;
 };
 const link=()=> {
  const url=new URL("./perfil-competitivo.html",window.location.href);
  url.search="";url.searchParams.set("u",String(getMe()));
  return url.toString();
 };
 function reset(){
  currentUser=null;loaded=false;loading=false;profile=null;sharing=false;error="";
 }
 async function refresh(force=false){
  const user=getMe();
  if(!user)return;
  if(currentUser!==user)reset();
  currentUser=user;
  if(loading||loaded&&!force)return;
  loading=true;error="";
  try{
   const [config,details]=await Promise.all([
    rpc("js_liga_perfil_config",{}),
    rpc("js_liga_perfil_publico",{p_user_id:user})
   ]);
   sharing=config.enabled===true;profile=details;loaded=true;
  }catch(e){error=e?.message||"No pudimos abrir tu perfil.";loaded=false;}
  finally{loading=false;if(getView()==="perfil")render();}
 }
 function screen(){
  if(!getMe())return '<section class="panel"><h2>👤 Perfil competitivo</h2><p>Iniciá sesión.</p></section>';
  if(!loaded){
   return '<section class="panel"><h2>👤 Mi perfil competitivo</h2>'+
    '<p class="muted">'+(loading?"Cargando tu rango e insignias…":esc(error||"Preparando tu ficha…"))+'</p>'+
    (!loading?btn("↻ Reintentar","profile_refresh",'',"small"):"")+'</section>';
  }
  return '<section class="cp-page">'+
   competitiveProfileCard({...profile,public:sharing},esc)+
   '<div class="cp-actions">'+
    '<strong>🔗 Compartir mi ficha</strong>'+
    '<p class="cp-muted">El enlace público muestra tu apodo de Free Fire, rango y estadísticas. Nunca muestra tu correo ni el ID numérico. Es opcional y podés desactivarlo.</p>'+
    '<div class="cp-share-toggle"><div><strong>'+(sharing?"🌐 Perfil público":"🔒 Perfil privado")+'</strong>'+
     '<small>'+(sharing?"Cualquiera con el enlace puede ver tu ficha.":"Solamente vos podés verla.")+
     '</small></div>'+
    btn(sharing?"Desactivar":"Hacer público",sharing?"profile_disable":"profile_enable",'',"small")+
    '</div>'+
    (sharing?'<div class="cp-share-buttons">'+
      btn("📋 Copiar enlace","profile_copy",'',"good")+
      btn("↗ Compartir","profile_share",'',"hot")+'</div>':
      '<p class="cp-muted">Activá la opción pública para obtener un enlace compartible.</p>')+
    (!profile.verified?'<p class="cp-muted">Primero verificá tu ID desde tu perfil de JS Torneos para habilitar el enlace público.</p>':"")+
   '</div>'+
  '</section>';
 }
 async function copyOrShare(isShare){
  if(!sharing){flash("Activá primero el perfil público para compartir.",true);return;}
  try{
   const url=link();
   if(isShare&&navigator.share){
    await navigator.share({title:"Mi perfil competitivo JS Family",text:"🏆 Mirá mi rango en JS Torneos",url});
    return;
   }
   if(navigator.clipboard?.writeText){
    await navigator.clipboard.writeText(url);flash("✅ Enlace del perfil copiado.");
   }else window.prompt("Copiá tu enlace competitivo:",url);
  }catch(e){
   if(e?.name!=="AbortError")flash("No se pudo compartir. Probá copiar el enlace.",true);
  }
 }
 async function runAction(action){
  if(!["profile_refresh","profile_enable","profile_disable","profile_copy","profile_share"].includes(action))return false;
  if(action==="profile_copy"||action==="profile_share"){await copyOrShare(action==="profile_share");return true;}
  if(action==="profile_refresh"){await refresh(true);return true;}
  if(loading)return true;
  const enable=action==="profile_enable";
  if(!enable&&!window.confirm("¿Desactivar tu perfil público? El enlace dejará de mostrar tus estadísticas."))return true;
  loading=true;
  try{
   const config=await rpc("js_liga_perfil_config",{p_enabled:enable});
   sharing=config.enabled===true;
   if(profile)profile.public=sharing;
   flash(config.message);
  }catch(e){flash(e?.message||"No se pudo cambiar la privacidad.",true);}
  finally{loading=false;render();}
  return true;
 }
 return {refresh,reset,screen,runAction};
}
