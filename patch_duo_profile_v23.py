from pathlib import Path
def patch_unique(text,old,new,label):
 c=text.count(old)
 if c!=1:raise RuntimeError(f"{label}: expected once, found {c}")
 return text.replace(old,new,1)

p=Path("liga.js")
s=p.read_text()
s=patch_unique(s,'from "./perfil-competitivo.js?v=1.0.0";',
 'from "./perfil-competitivo.js?v=2.0.0";',"profile module cache")
s=patch_unique(s,'''sb,getMe:()=>me,getView:()=>view,render:()=>render(),
 flash:(msg,fail)=>flash(msg,fail),esc,btn
});''',
'''sb,getMe:()=>me,getTeam:()=>teamOf(me),getView:()=>view,render:()=>render(),
 flash:(msg,fail)=>flash(msg,fail),esc,btn
});''',"profile team access")
start=s.index("function rankingScreen(){")
end=s.index("\nfunction historyScreen(){",start)
new_rank='''function rankingScreen(){
 const list=teams();
 return card("🏆 Clasificación de dúos 2VS2",
  '<p class="muted">Esta liga cuenta las victorias y derrotas del equipo completo. Un encuentro suma una sola victoria y una sola derrota, aunque hayan jugado dos titulares o un suplente.</p>'+
  (list.length?list.map((t,i)=>{
   const score=Math.max(0,Number(t.wins||0)*25-Number(t.losses||0)*10);
   const rank=score>=700?"👑 Maestro":score>=450?"💎 Diamante":
    score>=250?"🥇 Oro":score>=100?"🥈 Plata":"🥉 Bronce";
   return '<div class="match"><div class="flex"><strong style="color:var(--gold)">#'+(i+1)+'</strong>'+
    '<div style="flex:1;min-width:0">'+roster(t)+'</div>'+
    '<div style="text-align:right;white-space:nowrap"><div class="statnum">'+t.wins+'V</div>'+
    '<small class="muted">'+t.losses+'D · '+score+' pts</small></div></div>'+
    '<p class="muted" style="margin:6px 0 0">🏅 '+rank+'</p></div>';
   }).join(""):'<div class="empty">Todavía no hay equipos.</div>'));
}'''
s=s[:start]+new_rank+s[end:]
s=patch_unique(s,'''  void extras.refresh();
  void refreshPresence();''',
'''  void extras.refresh();
  if(view==="perfil")void competitiveProfile.refresh(true);
  void refreshPresence();''',"profile refresh on live score update")
p.write_text(s)

p=Path("liga-plus.js");s=p.read_text()
start=s.index(" function myRankCompact(){")
end=s.index(" function myRank(){",start)
new_mini=''' function myRankCompact(){
  const live=getLive(),self=live?.teams?.find(t=>
   [t.captain,t.partner,t.substitute].includes(getMe()));
  if(!self)return '<div class="rank-mini"><div class="rank-mini-copy">'+
   '<small>🛡️ RANGO DEL DÚO</small><strong>Sin equipo</strong>'+
   '<span>Formá un dúo para participar en la liga 2VS2.</span></div></div>';
  const wins=Number(self.wins||0),losses=Number(self.losses||0);
  const score=Math.max(0,25*wins-10*losses);
  const name=score>=700?"Maestro":score>=450?"Diamante":
   score>=250?"Oro":score>=100?"Plata":"Bronce";
  return '<div class="rank-mini"><div class="rank-mini-copy">'+
    '<small>🛡️ RANGO DEL DÚO · 2VS2</small><strong>'+
    rankIcon(name)+' '+esc(name)+'</strong>'+
    '<span>'+score+' puntos · '+wins+'V / '+losses+'D (equipo)</span></div>'+
    btn("Ficha dúo","go_profile",'',"small")+'</div>';
 }
'''
s=s[:start]+new_mini+s[end:]
p.write_text(s)

p=Path("liga.html");s=p.read_text()
s=patch_unique(s,'data-tab="perfil">👤 Mi perfil','data-tab="perfil">🛡️ Perfil dúo',"menu label")
s=patch_unique(s,'./perfil-competitivo.css?v=1.0.0','./perfil-competitivo.css?v=2.0.0',"shared css")
s=patch_unique(s,'./liga.js?v=2.2.0','./liga.js?v=2.3.0',"main cache")
s=patch_unique(s,'./liga-plus.js?v=1.0.0','./liga-plus.js?v=2.0.0',"none") if './liga-plus.js?v=1.0.0' in s else s
p.write_text(s)
p=Path("liga.js");s=p.read_text()
s=patch_unique(s,'./liga-plus.js?v=1.0.0','./liga-plus.js?v=2.0.0',"mini rank cache")
p.write_text(s)

p=Path("perfil-competitivo.html");s=p.read_text()
s=patch_unique(s,'<title>Perfil competitivo | JS Family Torneos</title>',
 '<title>Perfil de dúo 2VS2 | JS Family Torneos</title>',"public title")
s=patch_unique(s,'Insignias, rango y estadísticas competitivas oficiales de JS Family Torneos.',
 'Insignias, rango y resultados oficiales del dúo en la Liga 2VS2 de JS Family Torneos.',"description")
s=patch_unique(s,'./perfil-competitivo.css?v=1.0.0','./perfil-competitivo.css?v=2.0.0',"public css")
s=patch_unique(s,'<h1>🏅 Perfil competitivo</h1><p>Rango personal · Free Fire · JS Torneos</p>',
 '<h1>🛡️ Perfil de dúo</h1><p>Liga 2VS2 · Rangos y resultados por equipo</p>',"public header")
s=patch_unique(s,'./perfil-competitivo-public.js?v=1.0.0',
 './perfil-competitivo-public.js?v=2.0.0',"public js")
s=patch_unique(s,'JS FAMILY · LOS RANGOS SE BASAN EN PARTIDAS OFICIALES',
 'JS FAMILY · CADA PVP SE CUENTA UNA SOLA VEZ POR DÚO',"public footer")
p.write_text(s)

p=Path("perfil-competitivo.css");s=p.read_text()
s+='''\n/* Duo partners visible together on the shared competitive card. */\n.cp-duo-players{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}\n.cp-duo-player{display:flex;align-items:center;gap:7px;padding:10px 9px;border:1px solid #475875;background:#121c2e99;border-radius:11px;min-width:0}\n.cp-duo-player-icon{font-size:14px;flex:none}\n.cp-duo-player strong{font-size:11px;line-height:1.4;overflow-wrap:anywhere}\n.cp-duo-profile .cp-cover h2{font-size:20px}\n.cp-duo-profile .cp-avatar{transform:none}\n.cp-duo-profile .cp-stats small{font-size:9px}\n.cp-duo-profile .cp-modes{grid-template-columns:repeat(3,minmax(0,1fr))}\n@media(max-width:390px){.cp-duo-profile .cp-cover h2{font-size:17px}.cp-duo-player{padding:8px 6px}.cp-duo-player strong{font-size:10px}}\n'''
p.write_text(s)
print("UPDATED: duo-only league ranking, duo mini-rank, secure shared profile, duo player names, public card and cache versions")
