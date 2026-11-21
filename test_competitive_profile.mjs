import assert from "node:assert/strict";
import fs from "node:fs";
import {competitiveProfileCard,createCompetitiveProfile} from "./perfil-competitivo.js";

const escape=x=>String(x??"").replace(/[&<>"']/g,c=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));
const uuid="11111111-2222-4333-8444-555555555555";
const data={
 ok:true,user_id:uuid,is_owner:true,public:false,
 nickname:"<script>hack()</script>",rank:"Plata",score:175,wins:7,losses:3,duos:10,solos:0,
 win_rate:70,verified:true,best_streak:4,streak:2,streak_type:"win",
 recent:[{mode:"2v2",outcome:"win"},{mode:"2v2",outcome:"loss"},{mode:"1v1",outcome:"win"}],
 badges:[{emoji:"🏆",name:"Primera victoria"},{emoji:"🔥",name:"Racha imparable"}]
};
let html=competitiveProfileCard(data,escape);
for(const text of ["Plata","175","7","3","70%","2VS2","1VS1","Mejor racha","Primera victoria","Racha imparable","75 pts para Oro"]){
 if(!html.includes(text))throw Error("Card missing "+text);
}
assert(!html.includes("<script>"),"User supplied nickname not escaped");
assert(html.includes("&lt;script&gt;"),"Nickname safely escaped");
assert.equal((html.match(/class="cp-medal"/g)||[]).length,2);
assert.equal((html.match(/class="cp-last /g)||[]).length,3);

const full={...data,rank:"Maestro",score:795,badges:[],recent:[],nickname:"Jugador JS"};
html=competitiveProfileCard(full,escape);
assert(html.includes("Rango máximo"));assert(html.includes("Todavía no hay insignias"));
assert(!html.includes("undefined"));
const button=(text,action,attrs="",color="")=>'<button data-action="'+escape(action)+'" '+attrs+'>'+escape(text)+'</button>';
let visible=false,actor=uuid,where="perfil",messages=[],rendered=0,copied="";
globalThis.window={location:{href:"https://jstorneos.com/liga.html"},confirm:()=>true,prompt:()=>{}};
Object.defineProperty(globalThis,"navigator",{configurable:true,value:{
 clipboard:{writeText:async value=>{copied=value;}}
}});
const sb={rpc:async(name,args)=>{
 if(name==="js_liga_perfil_config"){
  if(args?.p_enabled!==undefined)visible=args.p_enabled;
  return {data:{ok:true,enabled:visible,user_id:actor,message:visible?"Compartible":"Privado"},error:null};
 }
 if(name==="js_liga_perfil_publico"){
  assert.equal(args.p_user_id,actor);
  return {data:{...data,public:visible},error:null};
 }
 throw Error("Unexpected RPC "+name);
}};
const profile=createCompetitiveProfile({sb,getMe:()=>actor,getView:()=>where,
 render:()=>rendered++,flash:text=>messages.push(text),esc:escape,btn:button});
let before=profile.screen();assert(before.includes("Preparando"));
await profile.refresh();
assert.equal(rendered,1);
let view=profile.screen();
assert(view.includes("Perfil privado"));assert(view.includes("Hacer público"));assert(!view.includes("Copiar enlace"));
assert.equal(await profile.runAction("profile_enable"),true);
assert(visible);
view=profile.screen();
assert(view.includes("Perfil público"));assert(view.includes("Copiar enlace"));
await profile.runAction("profile_copy");
assert(copied.startsWith("https://jstorneos.com/perfil-competitivo.html?u="));
assert(copied.includes(uuid));
await profile.runAction("profile_disable");
assert(!visible);
view=profile.screen();
assert(view.includes("Perfil privado"));assert(!view.includes("Copiar enlace"));
assert.equal(await profile.runAction("nonsense"),false);
actor="11111111-2222-4333-8444-555555555556";
profile.reset();assert(profile.screen().includes("Preparando"));
assert(fs.readFileSync("perfil-competitivo.html","utf8").includes('perfil-competitivo-public.js?v=1.0.0'));
assert(fs.readFileSync("liga.html","utf8").includes('data-tab="perfil"'));
assert(fs.readFileSync("liga.html","utf8").includes('liga.js?v=2.2.0'));
assert(fs.readFileSync("perfil-competitivo-public.js","utf8").includes("js_liga_perfil_publico"));
console.log("PASS: competitive card, verified badges, rank and next, recent modes, XSS safety, opt-in share/copy, revoke and session reset.");
