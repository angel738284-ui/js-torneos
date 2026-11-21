import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
const content=fs.readFileSync("liga-plus.js","utf8")
 .replace("export function createLeagueExtras","function createLeagueExtras");
const escape=x=>String(x??"").replace(/[&<>"']/g,c=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));
const players={u1:"Jugador JS",u2:"Pato",u3:"<script>alert(1)</script>",u4:"Benja"};
const match={
 id:44,state:"playing",confirmed:4,started_at:"2026-11-17T03:00:00Z",
 lineup_a:["u1","u2"],lineup_b:["u3","u4"],
 result_details:[{user_id:"u1",result:"win"},{user_id:"u2",result:"win"},
 {user_id:"u3",result:"loss"},{user_id:"u4",result:null}]
};
let live={matches:[match],admin:false,season:{id:1}},me="u1",view="partidas",message="",rendered=0;
const db={
 js_liga_rangos:{system:"individual",my:{rank:"Plata",score:180,wins:8,losses:2,duos:10,solos:0,next_rank_score:250},
 top:[{user_id:"u1",display_name:"Jugador JS",rank:"Plata",score:180,position:1,wins:8,losses:2,duos:10,solos:0}]},
 js_liga_espera:{ok:true,ready_count:1,everyone_ready:false,
 players:[{user_id:"u1",ready:true},{user_id:"u2",ready:false},
 {user_id:"u3",ready:false},{user_id:"u4",ready:false}],
 message:"1/4 listos."},
 js_liga_chat_seguro:{ok:true,messages:[]},
 js_liga_incidencias:{ok:true,reports:[]},
};
const calls=[];
const sb={
 rpc:async(name,args)=>{calls.push([name,args]);return{data:db[name],error:null}},
 storage:{from:()=>({createSignedUrls:async()=>({data:[],error:null})})},
 auth:{getUser:async()=>({data:{user:{id:"u1"}},error:null})}
};
const doc={
 activeElement:{matches:()=>false},
 getElementById:id=>({
   value:id.startsWith("chat-input")?"Vamos al PvP":"El rival no vino",
   files:[{type:"image/png",size:3000}],
 }),
 querySelectorAll:()=>[]
};
const context={console,Date,Math,Number,Array,Map,Set,String,Object,RegExp,Error,Promise,
 document:doc,crypto:{randomUUID:()=>"11111111-1111-4111-8111-111111111111"}};
const create=vm.runInNewContext(content+"\ncreateLeagueExtras",context);
const ext=create({
 sb,getLive:()=>live,getMe:()=>me,getView:()=>view,refreshPage:()=>{},
 render:()=>rendered++,flash:(m)=>{message=m},esc:escape,
 btn:(text,action,extra="")=>'<button data-action="'+escape(action)+'" '+extra+'>'+escape(text)+'</button>',
 nameOf:uid=>players[uid]||uid,personal:uid=>escape(players[uid]||uid)
});
assert.equal(ext.matchPanel({...match,confirmed:3}),"");
let output=ext.matchPanel(match);
for(const expected of ["Sala de espera","ESTOY LISTO","¿Quién confirmó el resultado","Gané","Su dúo ya informó","Chat privado","Capturas para JS","Reportar ausencia","&lt;script&gt;"])
 assert(output.includes(expected),expected);
assert.doesNotMatch(output,/<script>/);
me="outsider";output=ext.matchPanel(match);
assert.match(output,/¿Quién confirmó el resultado/);
assert.doesNotMatch(output,/Sala de espera|Chat privado|Capturas/);
me="u1";
await ext.refresh({force:true});
assert.equal(rendered,1);
assert.match(ext.myRank(),/Plata · 180 puntos/);
assert.match(ext.rankPanel(),/Clasificación personal/);
const button={dataset:{match:"44",report:"1"},disabled:false};
assert.equal(await ext.runAction("ready",button),true);
assert(calls.some(x=>x[0]==="js_liga_espera"&&x[1].p_action==="ready"));
assert.match(ext.matchPanel(match),/1\/2 dúos listos/);
assert.equal(await ext.runAction("not_my_action",button),false);
live={...live,admin:true};
db.js_liga_incidencias={ok:true,reports:[
 {id:13,match_id:44,target:"u2",reporter:"u1",kind:"absence",
  details:"No vino",state:"open",created_at:"2026-11-17T03:00:00Z"}
]};
await ext.refresh({force:true});
assert.match(ext.adminPanel(),/Casos pendientes para JS/);
assert.match(ext.adminPanel(),/No vino/);
assert(fs.readFileSync("liga.html","utf8").includes('liga.js?v=2.6.0'));
assert(fs.readFileSync("liga.js","utf8").includes('js_liga_refresh_ticks'));
console.log("PASS: individual rank, escaped Free Fire names, 4/4 waitroom, individual results, private chat/report/proofs, admin cases, realtime wiring.");
