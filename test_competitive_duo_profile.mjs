import fs from "node:fs";
import assert from "node:assert/strict";
import {competitiveProfileCard,createCompetitiveProfile} from "./perfil-competitivo.js";

const escape=x=>String(x??"").replace(/[&<>"']/g,c=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));
const teamId="11111111-2222-4333-8444-555555555555";
const players=["JS <script>hack()</script>","BENJA"];
const data={
 ok:true,team_id:teamId,season_id:6,title:players.join(" + "),
 players,public:false,is_member:true,mode:"2v2",
 wins:4,losses:0,played:4,win_rate:100,rank:"Plata",score:100,best_streak:4,
 recent:[{mode:"2v2",outcome:"win"},{mode:"2v2",outcome:"win"},
  {mode:"2v2",outcome:"loss"}],
 badges:[{emoji:"🏆",name:"Primer triunfo en dúo"},
  {emoji:"🔥",name:"Racha de equipo"}]
};
let result=competitiveProfileCard(data,escape);
for(const token of ["LIGA 2VS2","TEMPORADA #6","JS &lt;script&gt;","BENJA",
 "RANGO DEL DÚO","Plata","100","4","0","Partidas oficiales",
 "🏆","Racha de equipo","150 pts para Oro","UNA VEZ POR EQUIPO"]){
 assert(result.includes(token),"Missing "+token);
}
assert(!result.includes("<script>"));
assert(!result.includes("1VS1"));
assert.equal((result.match(/class="cp-last /g)||[]).length,3);
assert.equal((result.match(/class="cp-duo-player"/g)||[]).length,2);
assert.equal((result.match(/class="cp-medal"/g)||[]).length,2);

const empty={...data,title:"Nuevo equipo",players:["A","B"],wins:0,losses:0,
 played:0,best_streak:0,score:0,rank:"Bronce",badges:[],recent:[]};
result=competitiveProfileCard(empty,escape);
assert(result.includes("resultados oficiales del dúo"));
assert(result.includes("Primer PvP")||result.includes("primer PvP"));
assert(!result.includes("undefined"));

const button=(text,action,extra="")=>
 '<button data-action="'+escape(action)+'" '+extra+'>'+escape(text)+'</button>';
let actor="player-one",team={id:teamId},view="perfil",approved=false,
 partnerApproved=false,rendered=0,copied="",messages=[],substitute=false;
const windowMock={location:{href:"https://jstorneos.com/liga.html"},confirm:()=>true,prompt:()=>{}};
globalThis.window=windowMock;
Object.defineProperty(globalThis,"navigator",{configurable:true,value:{
 clipboard:{writeText:async x=>{copied=x;}}
}});
const sb={rpc:async(name,args)=>{
 if(name==="js_liga_duo_perfil"){
  assert.equal(args.p_team_id,teamId);
  return {data:{...data,public:approved&&partnerApproved},error:null};
 }
 if(name==="js_liga_duo_privacidad"){
  assert.equal(args.p_team_id,teamId);
  if(args?.p_enabled!==undefined)approved=args.p_enabled;
  return {data:{ok:true,team_id:teamId,public:approved&&partnerApproved,
    my_approved:approved,other_approved:partnerApproved,
    can_manage:!substitute,message:"Estado actualizado"},error:null};
 }
 throw Error("Unexpected RPC: "+name);
}};
const cp=createCompetitiveProfile({sb,getMe:()=>actor,getTeam:()=>team,
 getView:()=>view,render:()=>rendered++,flash:msg=>messages.push(msg),
 esc:escape,btn:button});
assert(cp.screen().includes("Preparando"));
await cp.refresh();
assert.equal(rendered,1);
let page=cp.screen();
assert(page.includes("Ficha del dúo")||page.includes("ficha del dúo"));
assert(page.includes("Autorizar"));
assert(!page.includes("Copiar enlace"));
await cp.runAction("profile_enable");
page=cp.screen();
assert(page.includes("Falta tu compañero"));
assert(!page.includes("Copiar enlace"));
partnerApproved=true;
await cp.refresh(true);
page=cp.screen();
assert(page.includes("Público"));
assert(page.includes("Copiar enlace"));
await cp.runAction("profile_copy");
assert(copied.includes("/perfil-competitivo.html?d="+teamId));
assert(!copied.includes("?u="));
await cp.runAction("profile_disable");
assert(!cp.screen().includes("Copiar enlace"));
substitute=true;cp.reset();await cp.refresh();
assert(!cp.screen().includes('data-action="profile_enable"'));
assert(!cp.screen().includes('data-action="profile_disable"'));
substitute=false;
team=null;cp.reset();assert(cp.screen().includes("formar un dúo"));
assert.equal(await cp.runAction("not-an-action"),false);
const publicHTML=fs.readFileSync("perfil-competitivo.html","utf8");
const publicJS=fs.readFileSync("perfil-competitivo-public.js","utf8");
const leagueHTML=fs.readFileSync("liga.html","utf8");
assert(publicJS.includes('p_team_id:teamId'));
assert(publicJS.includes('params.get("d")'));
assert(!publicJS.includes('js_liga_perfil_publico'));
assert(publicHTML.includes("Perfil de dúo 2VS2"));
assert(leagueHTML.includes('liga.js?v=2.6.0'));
assert(leagueHTML.includes('data-tab="perfil">🛡️ Perfil dúo'));
console.log("PASS: one card for two players, stats only 2VS2, achievements, XSS safety, dual consent, share and revoke, substitute read-only, no-team CTA, public team link.");
