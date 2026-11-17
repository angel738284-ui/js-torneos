// JS FAMILY competitive duo profile (the league is officially 2VS2).
// Data are returned by js_liga_duo_perfil. A public team card requires
// independent consent from BOTH fixed starters. Never show FF IDs or emails.
const rankSteps={
 Bronce:{emoji:"🥉",theme:"bronze",lower:0,next:"Plata",upper:100},
 Plata:{emoji:"🥈",theme:"silver",lower:100,next:"Oro",upper:250},
 Oro:{emoji:"🥇",theme:"gold",lower:250,next:"Diamante",upper:450},
 Diamante:{emoji:"💎",theme:"diamond",lower:450,next:"Maestro",upper:700},
 Maestro:{emoji:"👑",theme:"master",lower:700,next:null,upper:null}
};
const safeNumber=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;

export function competitiveProfileCard(profile,esc){
 const p=profile||{};
 const rank=rankSteps[p.rank]||rankSteps.Bronce;
 const wins=safeNumber(p.wins),losses=safeNumber(p.losses);
 const total=wins+losses;
 const score=safeNumber(p.score);
 const played=safeNumber(p.played);
 const winrate=total?Math.round(wins*100/total):0;
 const names=Array.isArray(p.players)?p.players:[];
 const duoName=esc(p.title||names.join(" + ")||"Dúo JS Family");
 const badges=Array.isArray(p.badges)?p.badges:[];
 const recent=Array.isArray(p.recent)?p.recent:[];
 const progress=rank.upper===null?100:Math.max(0,Math.min(100,
  Math.round((score-rank.lower)/(rank.upper-rank.lower)*100)));
 const missing=rank.upper===null?null:Math.max(0,rank.upper-score);
 const playerNames=names.slice(0,2).map((name,index)=>
  '<div class="cp-duo-player"><span class="cp-duo-player-icon">'+(index===0?"🔵":"🔴")+'</span>'+
   '<strong>'+esc(name||"Jugador")+'</strong></div>').join("");
 const recentResults=recent.map(item=>
  '<div class="cp-last '+(item.outcome==="win"?"won":"lost")+'">'+
  '<span>'+(item.outcome==="win"?"✓":"✕")+'</span>'+
  '<small>2VS2</small></div>').join("");
 const awards=badges.map(badge=>
  '<div class="cp-medal"><span aria-hidden="true">'+esc(badge.emoji||"🏅")+
   '</span><strong>'+esc(badge.name||"Insignia")+'</strong></div>').join("");
 return '<section class="cp-profile cp-duo-profile '+rank.theme+'">'+
  '<div class="cp-cover"><div class="cp-cover-top"><strong>JS FAMILY</strong>'+
  '<span>LIGA 2VS2 · TEMPORADA #'+safeNumber(p.season_id)+'</span></div>'+
  '<div class="cp-avatar" aria-hidden="true">🛡️</div>'+
  '<h2>'+duoName+'</h2>'+
  '<div class="cp-duo-players">'+playerNames+'</div>'+
  '<div class="cp-verified">🤝 Estadísticas compartidas del equipo · '+
   (p.public?"🌐 Público":"🔒 Privado")+'</div>'+
  '<div class="cp-rank"><span>'+rank.emoji+'</span><div><small>RANGO DEL DÚO</small>'+
   '<strong>'+esc(p.rank||"Bronce")+'</strong></div>'+
   '<b>'+score+' <small>PTS</small></b></div>'+
  '</div><div class="cp-content">'+
  '<div class="cp-stats"><div><b>'+wins+'</b><small>VICTORIAS</small></div>'+
  '<div><b>'+losses+'</b><small>DERROTAS</small></div>'+
  '<div><b>'+winrate+'%</b><small>EFECTIVIDAD</small></div></div>'+
  '<div class="cp-progress"><div class="cp-progress-head"><span>PROGRESO DEL DÚO</span>'+
  '<strong>'+(missing===null?"👑 Rango máximo":missing+" pts para "+rank.next)+'</strong></div>'+
  '<div class="cp-bar"><div style="width:'+progress+'%"></div></div></div>'+
  '<div class="cp-modes"><span>🎮 Partidas oficiales <b>'+played+'</b></span>'+
  '<span>🏆 Victorias de dúo <b>'+wins+'</b></span>'+
  '<span>🔥 Mejor racha <b>'+safeNumber(p.best_streak)+'</b></span></div>'+
  '<div class="cp-section-title"><strong>🏅 Logros del dúo</strong>'+
   '<small>'+badges.length+' desbloqueados</small></div>'+
  (awards?'<div class="cp-badges">'+awards+'</div>':
   '<p class="cp-muted">Ganen su primer PvP 2VS2 para desbloquear insignias de equipo.</p>')+
  '<div class="cp-section-title"><strong>📋 Últimos PvP del dúo</strong></div>'+
  (recentResults?'<div class="cp-recent">'+recentResults+'</div>':
   '<p class="cp-muted">Todavía no hay resultados oficiales del dúo.</p>')+
  '<div class="cp-foot">JS FAMILY · LOS RESULTADOS SE CUENTAN UNA VEZ POR EQUIPO</div>'+
  '</div></section>';
}

export function createCompetitiveProfile({sb,getMe,getTeam,getView,render,flash,esc,btn}){
 let currentUser=null,currentTeamId=null,loaded=false,loading=false;
 let profile=null,sharing=null,error="";
 const rpc=async(name,args)=>{
  const {data,error:callError}=await sb.rpc(name,args);
  if(callError)throw callError;
  if(!data?.ok)throw Error(data?.message||"No se pudo consultar el dúo.");
  return data;
 };
 const link=()=>{
  const url=new URL("./perfil-competitivo.html",window.location.href);
  url.search="";
  url.searchParams.set("d",String(currentTeamId));
  return url.toString();
 };
 function reset(){
  currentUser=null;currentTeamId=null;loaded=false;loading=false;
  profile=null;sharing=null;error="";
 }
 async function refresh(force=false){
  const user=getMe(),team=getTeam();
  if(!user||!team?.id){
   currentUser=user;currentTeamId=null;profile=null;sharing=null;
   loaded=true;loading=false;error="";return;
  }
  if(currentUser!==user||currentTeamId!==team.id)reset();
  currentUser=user;currentTeamId=team.id;
  if(loading||(loaded&&!force))return;
  loading=true;error="";
  try{
   const [preview,config]=await Promise.all([
    rpc("js_liga_duo_perfil",{p_team_id:team.id}),
    rpc("js_liga_duo_privacidad",{p_team_id:team.id})
   ]);
   profile=preview;sharing=config;loaded=true;
  }catch(e){
   error=e?.message||"No se pudo cargar la ficha del dúo.";
   loaded=false;
  }finally{
   loading=false;
   if(getView()==="perfil")render();
  }
 }
 function screen(){
  if(!getMe())return '<section class="panel"><h2>🛡️ Perfil de dúo</h2><p>Iniciá sesión.</p></section>';
  if(!getTeam()?.id)return '<section class="panel"><h2>🤝 Perfil competitivo 2VS2</h2>'+
   '<p class="muted">Para tener una ficha competitiva primero necesitás formar un dúo en esta temporada.</p>'+
   btn("👥 Crear o buscar compañero","go_team",'',"hot block")+'</section>';
  if(!loaded||!profile){
   return '<section class="panel"><h2>🛡️ Mi perfil de dúo</h2>'+
    '<p class="muted">'+(loading?"Consultando las partidas del equipo…":
      esc(error||"Preparando la ficha…"))+'</p>'+
    (!loading?btn("↻ Reintentar","profile_refresh",'',"small"):"")+
    '</section>';
  }
  const canManage=sharing?.can_manage===true;
  const approved=sharing?.my_approved===true;
  const publicNow=sharing?.public===true;
  const partnerApproved=sharing?.other_approved===true;
  const status=publicNow?"🌐 Público: los dos titulares aprobaron":
    approved?"⏳ Autorizaste compartir. Falta tu compañero":
    canManage?"🔒 Privado: falta tu autorización":
     "🔒 Privado: solamente los titulares pueden autorizar";
  return '<section class="cp-page">'+
   competitiveProfileCard({...profile,public:publicNow},esc)+
   '<div class="cp-actions">'+
    '<strong>🔗 Compartir ficha del dúo</strong>'+
    '<p class="cp-muted">Este perfil cuenta solo los PvP 2VS2 del equipo. Se publica únicamente cuando ambos titulares lo autorizan. No se comparte correo ni ID numérico de Free Fire.</p>'+
    '<div class="cp-share-toggle"><div><strong>'+status+'</strong>'+
     '<small>'+(publicNow?"El enlace deja de funcionar si cualquiera retira su permiso.":
      approved?"Tu compañero debe entrar a Más → Mi perfil y autorizar también.":
      "La ficha es privada hasta que ambos titulares acepten.")+'</small></div>'+
      (canManage?btn(approved?"Retirar permiso":"Autorizar",
       approved?"profile_disable":"profile_enable",'',"small"):"")+
    '</div>'+
    (publicNow?'<div class="cp-share-buttons">'+
      btn("📋 Copiar enlace","profile_copy",'',"good")+
      btn("↗ Compartir","profile_share",'',"hot")+'</div>':
      '<p class="cp-muted">Cuando los dos autoricen, aparecerá el botón para compartir.</p>')+
    (!canManage?'<p class="cp-muted">Como suplente podés consultar las estadísticas, pero los titulares deciden si publican la ficha.</p>':"")+
    btn("↻ Actualizar ficha","profile_refresh",'',"small")+
   '</div></section>';
 }
 async function copyOrShare(share){
  if(!sharing?.public){flash("Se necesita permiso de los dos titulares.",true);return;}
  try{
   const url=link();
   if(share&&navigator.share){
    await navigator.share({title:"Nuestro dúo JS Family",text:"🏆 Mirá nuestro perfil 2VS2 en JS Torneos",url});
    return;
   }
   if(navigator.clipboard?.writeText){
    await navigator.clipboard.writeText(url);
    flash("✅ Enlace del dúo copiado.");
   }else window.prompt("Copiá el enlace:",url);
  }catch(e){
   if(e?.name!=="AbortError")flash("No se pudo compartir. Probá copiar el enlace.",true);
  }
 }
 async function runAction(action){
  if(!["profile_refresh","profile_enable","profile_disable","profile_copy","profile_share"].includes(action))
   return false;
  if(action==="profile_copy"||action==="profile_share"){
   await copyOrShare(action==="profile_share");return true;
  }
  if(action==="profile_refresh"){await refresh(true);return true;}
  if(loading)return true;
  if(!currentTeamId||sharing?.can_manage!==true){
   flash("Solo los dos titulares pueden autorizar compartir esta ficha.",true);
   return true;
  }
  const enable=action==="profile_enable";
  if(!enable&&!window.confirm("¿Retirar tu autorización? El perfil del dúo dejará de ser público."))
   return true;
  loading=true;
  try{
   const config=await rpc("js_liga_duo_privacidad",{
    p_team_id:currentTeamId,p_enabled:enable
   });
   sharing=config;
   if(profile)profile.public=config.public===true;
   flash(config.message);
  }catch(e){flash(e?.message||"No se pudo cambiar la privacidad.",true);}
  finally{loading=false;render();}
  return true;
 }
 return {refresh,reset,screen,runAction};
}
