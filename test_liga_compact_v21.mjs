import fs from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";
const src=fs.readFileSync("liga.js","utf8");
const html=fs.readFileSync("liga.html","utf8");
const escape=x=>String(x??"").replace(/[&<>"']/g,c=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));
const button=(text,action,extra="")=>'<button data-action="'+action+'" '+extra+'>'+escape(text)+'</button>';
const card=(header,text)=>'<section><h2>'+header+'</h2>'+text+'</section>';
const current={id:"team1",captain:"u1",partner:"u2",wins:2,losses:0};
let live={season:{id:6,prize:"110 diamantes"},teams:[current],
 admin:false,paused:false,invites:[]},hasTeam=true,active=null;
const common={
 esc:escape,btn:button,card,
 teamOf:()=>hasTeam?current:null,teamName:()=>"Jugador 1 + Jugador 2",
 myActiveGame:()=>active,
 extras:{myRankCompact:()=>'<div>RANGO RESUMIDO</div>',myRank:()=>'<div>FULL RANK</div>'},
 me:"u1",get live(){return live;}
};
const homeStart=src.indexOf("function homeScreen(){");
const homeEnd=src.indexOf("\nfunction myTeamScreen(){",homeStart);
assert(homeStart>0&&homeEnd>homeStart);
const home=vm.runInNewContext(src.slice(homeStart,homeEnd)+";homeScreen",common);
let output=home();
for(const phrase of ["Arena 2VS2","RANGO RESUMIDO","JUGAR AHORA","MI DÚO","110 diamantes","Avisos y ayuda"])
 assert(output.includes(phrase),"Home missing "+phrase);
for(const phrase of ["Últimas partidas","Racha actual","Activar avisos del navegador","Ver ranking","TU RANGO PERSONAL"])
 assert(!output.includes(phrase),"Home too cluttered: "+phrase);
assert((output.match(/<section/g)||[]).length===1,"Home only one main panel");
live={...live,paused:true,admin:true};
output=home();
assert(output.includes("Liga pausada")&&output.includes("REANUDAR LIGA"));
assert(!output.includes("JUGAR AHORA"));
assert(output.includes('data-action="admin_resume"'),"Resume must actually execute admin action");
live={...live,admin:false};
output=home();
assert(output.includes("Búsquedas temporalmente pausadas"));
live={...live,paused:false};
hasTeam=false;output=home();
assert(output.includes("CREAR MI DÚO"));
hasTeam=true;active={id:52};output=home();
assert(output.includes("VER PVP #52"));
active=null;live={...live,admin:true};

const expandedPvps=new Set();
const game={id:41,state:"playing",confirmed:4,reported:1,
 started_at:"2026-11-17T03:00:00Z",lineup_a:["u1","u2"],lineup_b:["u3","u4"],
 a:"team1",b:"team2",my_vote:{accepted:true},winner:null};
const matchCtx={
 ...common,live,me:"u1",expandedPvps,
 teams:()=>[current,{id:"team2",captain:"u3",partner:"u4"}],
 allTeams:()=>[current,{id:"team2",captain:"u3",partner:"u4"}],
 games:()=>[game],
 teamOf:()=>current,
 isRealParticipant:()=>true,
 teamName:()=>escape("Equipo muy largo"),
 lineupText:()=>escape("A + B"),
 acceptanceDetails:()=>"<div>CONFIRMATIONS</div>",
 roomCard:()=>"<div>PRIVATE ROOM</div>",
 extras:{matchPanel:()=>"<div>PRIVATE TOOLS</div>"},
 date:()=> "17 nov",
 status:()=> "🎮 En juego",
 btn:button,
};
const matStart=src.indexOf("function matchCard(b){");
const matEnd=src.indexOf("\nfunction incomingInvites(){",matStart);
assert(matStart>0&&matEnd>matStart);
const matchCard=vm.runInNewContext(src.slice(matStart,matEnd)+";matchCard",matchCtx);
output=matchCard(game);
assert(output.includes("Sala, chat y detalles"),"Expandable tools required");
assert(!output.includes("PRIVATE TOOLS"),"Tools must be initially hidden");
assert(!output.includes("PRIVATE ROOM"),"Room must be initially hidden");
assert(output.includes("Gané"),"Main result action must remain visible");
expandedPvps.add(41);
output=matchCard(game);
assert(output.includes("PRIVATE ROOM")&&output.includes("PRIVATE TOOLS")&&output.includes("CONFIRMATIONS"));
expandedPvps.clear();
output=matchCard({...game,id:42,state:"pending",started_at:null,confirmed:2,my_vote:{accepted:false}});
assert(output.includes("CONFIRMATIONS")&&output.includes("Aceptar"),"Pending 2/4 still visible and actionable");
assert(!output.includes("PRIVATE TOOLS"));

const adminPanels=new Set();
const adminCtx={
 ...matchCtx,expandedAdminPanels:adminPanels,
 games:()=>[game],teams:()=>[current],
 live:{...live,admin:true,audit:[]},
 personal:()=>escape("Jugador"),
 roster:()=>escape("Jugador 1 + Jugador 2"),
 extras:{adminPanel:()=>"VISIBLE REPORTS",matchPanel:()=>"PRIVATE TOOLS"},
 id:escape,
};
const adminStart=src.indexOf("function adminExtras(){");
const adminEnd=src.indexOf("\nfunction render(){",adminStart);
assert(adminStart>0&&adminEnd>adminStart);
const adminExtras=vm.runInNewContext(src.slice(adminStart,adminEnd)+";adminExtras",adminCtx);
output=adminExtras();
assert(output.includes("VISIBLE REPORTS"),"Admin reports should remain visible");
assert(output.includes('data-panel="matches"')&&output.includes('data-panel="points"')&&output.includes('data-panel="history"'));
assert(!output.includes('admin-pvp-filter'),"Admin full match list should be collapsed");
adminPanels.add("matches");
output=adminExtras();
assert(output.includes('admin-pvp-filter')&&output.includes('admin-match-list'),"Admin match search opens");
adminPanels.clear();

const tabs=html.match(/<nav class="tabs" id="league-tabs"[^>]*>([\s\S]*?)<\/nav>/)?.[1]||"";
assert.equal((tabs.match(/<button/g)||[]).length,4,"There must be four main nav choices");
for(const tab of ["inicio","rivales","partidas"])
 assert(tabs.includes('data-tab="'+tab+'"'));
assert(tabs.includes('data-more-toggle="true"'),"More menu accessible");
const more=html.match(/<div id="league-more"[^>]*>([\s\S]*?)<\/div>/)?.[1]||"";
for(const tab of ["ranking","mi-equipo","historial","admin"])
 assert(more.includes('data-tab="'+tab+'"'),"Missing secondary tab "+tab);
assert(/liga\.js\?v=2\.[4-9]\.0/.test(html));
assert(html.includes(".metrics,.presence-explainer,.league-footer-note{display:none}"));
assert(src.includes('function switchLeagueTab(next){'));
console.log("PASS: one-screen compact home, paused/reopen controls, 4-nav More, admin hidden settings, live and pending match tools, no data/API removal.");
