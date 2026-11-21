from pathlib import Path
p=Path("liga.js");s=p.read_text()
def once(a,b,key):
 global s
 count=s.count(a)
 if count!=1:raise RuntimeError(key+": expected one anchor got "+str(count))
 s=s.replace(a,b,1)
once('''import {createLeagueExtras} from "./liga-plus.js?v=1.0.0";''',
'''import {createLeagueExtras} from "./liga-plus.js?v=1.0.0";
import {createCompetitiveProfile} from "./perfil-competitivo.js?v=1.0.0";''',"profile script")
once('''const extras=createLeagueExtras({
 sb,getLive:()=>live,getMe:()=>me,getView:()=>view,refreshPage:()=>load(true),
 render:()=>render(),flash:(msg,fail)=>flash(msg,fail),esc,btn,nameOf,personal
});''',
'''const extras=createLeagueExtras({
 sb,getLive:()=>live,getMe:()=>me,getView:()=>view,refreshPage:()=>load(true),
 render:()=>render(),flash:(msg,fail)=>flash(msg,fail),esc,btn,nameOf,personal
});
const competitiveProfile=createCompetitiveProfile({
 sb,getMe:()=>me,getView:()=>view,render:()=>render(),
 flash:(msg,fail)=>flash(msg,fail),esc,btn
});''',"create profile")
once('''const fn=({inicio:homeScreen,"mi-equipo":myTeamScreen,rivales:rivalsScreen,partidas:matchesScreen,ranking:rankingScreen,historial:historyScreen,admin:adminScreen})[view]||homeScreen;''',
'''const fn=({inicio:homeScreen,"mi-equipo":myTeamScreen,rivales:rivalsScreen,
 partidas:matchesScreen,ranking:rankingScreen,perfil:()=>competitiveProfile.screen(),
 historial:historyScreen,admin:adminScreen})[view]||homeScreen;''',"profile route")
once('''const isMore=["ranking","mi-equipo","historial","admin"].includes(view);''',
'''const isMore=["ranking","mi-equipo","perfil","historial","admin"].includes(view);''',"more selected profile")
once('''live=null;me=null;unsubscribeLeagueRealtime();extras.reset();''',
'''live=null;me=null;unsubscribeLeagueRealtime();extras.reset();competitiveProfile.reset();''',"logout profile clean")
once('''unsubscribeLeagueRealtime();extras.reset();
   expandedPvps.clear();''',
'''unsubscribeLeagueRealtime();extras.reset();competitiveProfile.reset();
   expandedPvps.clear();''',"account switch profile clean")
once('''function switchLeagueTab(next){
 view=next;moreOpen=false;render();''',
'''function switchLeagueTab(next){
 view=next;moreOpen=false;render();
 if(next==="perfil")void competitiveProfile.refresh();''',"load profile when selected")
once(''' if(await extras.runAction(action,b))return;
 if(action==="refresh"){''',
''' if(await extras.runAction(action,b))return;
 if(await competitiveProfile.runAction(action))return;
 if(action==="refresh"){''',"profile button handler")
once(''' if(action==="go_rank"){switchLeagueTab("ranking");return;}''',
''' if(action==="go_rank"){switchLeagueTab("ranking");return;}
 if(action==="go_profile"){switchLeagueTab("perfil");return;}''',"home profile link")
p.write_text(s)
p=Path("liga-plus.js");s=p.read_text()
old='''btn("Ver rango","go_rank",'',"small")'''
assert s.count(old)==1
s=s.replace(old,'''btn("Mi ficha","go_profile",'',"small")''',1)
p.write_text(s)
p=Path("liga.html");s=p.read_text()
once2=lambda a,b,label:None
old='''   <button type="button" data-tab="ranking">🏆 Rangos</button>'''
new='''   <button type="button" data-tab="ranking">🏆 Rangos</button>
   <button type="button" data-tab="perfil">👤 Mi perfil</button>'''
assert s.count(old)==1;s=s.replace(old,new,1)
old='''<script type="module" src="./liga.js?v=2.1.2"></script>'''
new='''<script type="module" src="./liga.js?v=2.2.0"></script>'''
assert s.count(old)==1;s=s.replace(old,new,1)
old='''</style>
</head>'''
new='''</style>
<link rel="stylesheet" href="./perfil-competitivo.css?v=1.0.0">
</head>'''
assert s.count(old)==1;s=s.replace(old,new,1)
p.write_text(s)
print("PROFILE_INTEGRATION_COMPLETE: Home mini ficha, Más > Mi perfil, public share controls, auto opt-in profile preview, version 2.2")
