from pathlib import Path
p=Path("liga.js");s=p.read_text()
def rep(a,b,why):
 global s
 n=s.count(a)
 if n!=1:raise RuntimeError(f"{why}: expected exactly one, found {n}")
 s=s.replace(a,b,1)
rep('''import {createCompetitiveProfile} from "./perfil-competitivo.js?v=2.0.0";''',
'''import {createCompetitiveProfile} from "./perfil-competitivo.js?v=2.0.0";
import {createLeagueWhatsApp} from "./liga-wa-link.js?v=1.0.0";''',"WA import")
rep('''const competitiveProfile=createCompetitiveProfile({
 sb,getMe:()=>me,getTeam:()=>teamOf(me),getView:()=>view,render:()=>render(),
 flash:(msg,fail)=>flash(msg,fail),esc,btn
});''',
'''const competitiveProfile=createCompetitiveProfile({
 sb,getMe:()=>me,getTeam:()=>teamOf(me),getView:()=>view,render:()=>render(),
 flash:(msg,fail)=>flash(msg,fail),esc,btn
});
const leagueWhatsApp=createLeagueWhatsApp({
 sb,getMe:()=>me,getView:()=>view,render:()=>render(),
 flash:(msg,fail)=>flash(msg,fail),esc,btn
});''',"WA initialization")
rep('''const isMore=["ranking","mi-equipo","perfil","historial","admin"].includes(view);''',
'''const isMore=["ranking","mi-equipo","perfil","whatsapp","historial","admin"].includes(view);''',"More group")
rep('''partidas:matchesScreen,ranking:rankingScreen,perfil:()=>competitiveProfile.screen(),
 historial:historyScreen,admin:adminScreen})[view]||homeScreen;''',
'''partidas:matchesScreen,ranking:rankingScreen,perfil:()=>competitiveProfile.screen(),
 whatsapp:()=>leagueWhatsApp.screen(),
 historial:historyScreen,admin:adminScreen})[view]||homeScreen;''',"WA route")
# Logout and account switching both clear the linked-session widget.
old='unsubscribeLeagueRealtime();extras.reset();competitiveProfile.reset();'
if s.count(old)!=2:raise RuntimeError('Expected 2 session cleanup points')
s=s.replace(old,'unsubscribeLeagueRealtime();extras.reset();competitiveProfile.reset();leagueWhatsApp.reset();')
rep('''if(view==="perfil")void competitiveProfile.refresh(true);
  void refreshPresence();''',
'''if(view==="perfil")void competitiveProfile.refresh(true);
  if(view==="whatsapp")void leagueWhatsApp.refresh(true);
  void refreshPresence();''',"refresh selected WA")
rep('''if(next==="perfil")void competitiveProfile.refresh();''',
'''if(next==="perfil")void competitiveProfile.refresh();
 if(next==="whatsapp")void leagueWhatsApp.refresh();''',"WA tab entry")
rep('''if(await competitiveProfile.runAction(action))return;''',
'''if(await competitiveProfile.runAction(action))return;
 if(await leagueWhatsApp.runAction(action))return;''',"WA actions")
rep('''if(action==="go_profile"){switchLeagueTab("perfil");return;}''',
'''if(action==="go_profile"){switchLeagueTab("perfil");return;}
 if(action==="go_whatsapp"){switchLeagueTab("whatsapp");return;}''',"WA home shortcut")
rep('''btn("🔔 Activar notificaciones","enable_notices",'',"small")+''',
'''btn("🔔 Activar notificaciones","enable_notices",'',"small")+
  btn("💬 Jugar por WhatsApp","go_whatsapp",'',"small")+''',"WA home help")
p.write_text(s)
p=Path("liga.html");s=p.read_text()
old='''<button type="button" data-tab="perfil">🛡️ Perfil dúo</button>'''
new='''<button type="button" data-tab="perfil">🛡️ Perfil dúo</button>
   <button type="button" data-tab="whatsapp">💬 WhatsApp</button>'''
assert s.count(old)==1;s=s.replace(old,new,1)
old='''<script type="module" src="./liga.js?v=2.3.0"></script>'''
assert s.count(old)==1;s=s.replace(old,'''<script type="module" src="./liga.js?v=2.4.0"></script>''')
old='''</style>
<link rel="stylesheet" href="./perfil-competitivo.css?v=2.0.0">'''
css='''/* WhatsApp access remains secondary to the four main mobile tabs */
.wa-link-card{max-width:740px;margin:0 auto}
.wa-link-status{padding:13px;border:1px solid #365978;background:#10243c;border-radius:12px;margin:12px 0}
.wa-link-status strong{display:block;font-size:14px}
.wa-link-status p{margin:6px 0 0}
.wa-link-steps{margin:14px 0;padding:12px;background:#152640;border-radius:12px}
.wa-link-steps p{font-size:12px;margin:6px 0;color:#c9d8eb}
.wa-code-display{display:grid;gap:8px;padding:16px 13px;background:#122b3c;border:1px solid #66b6e8;border-radius:13px;margin:12px 0;text-align:center}
.wa-code-display strong{font:900 25px/1.2 ui-monospace,monospace;color:#a5e3ff;letter-spacing:2px;overflow-wrap:anywhere}
.wa-code-display small{color:#b5d5e9}
.wa-code-display span{font-size:11px;color:#e9cad0}
.wa-link-help{margin:17px 0 0;border-top:1px solid #314b67;padding-top:12px}
.wa-link-help summary{font-weight:850;font-size:13px;cursor:pointer;color:#d4e6ff}
'''
assert s.count(old)==1;s=s.replace(old,css+old,1)
p.write_text(s)
print("WHATSAPP_LINK_UI_CONNECTED_v2.4")
