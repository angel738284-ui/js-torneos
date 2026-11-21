import assert from "node:assert/strict";
import {createLeagueWhatsApp} from "./liga-wa-link.js";

let actor="u1",view="whatsapp",linked=false;
let rendered=0,message="",copied="",unlinked=0,generated=0;
const calls=[];
const sb={rpc:async(name,args)=>{
 calls.push([name,args]);
 if(name==="js_liga_wa_estado")return{data:{ok:true,linked,phone_hint:linked?"****2891":null},error:null};
 if(name==="js_liga_wa_code"){
  generated++;
  return{data:{ok:true,code:"AB12CD34EF56",expires_at:"2026-11-17T16:55:00Z"},error:null};
 }
 if(name==="js_liga_wa_desvincular"){
  linked=false;unlinked++;
  return{data:{ok:true,message:"Desvinculado"},error:null};
 }
 throw Error("Unexpected RPC "+name);
}};
const esc=t=>String(t).replace(/[&<>\"']/g,c=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));
const btn=(title,action)=>'<button data-action="'+action+'">'+title+'</button>';
globalThis.window={confirm:()=>true,prompt:()=>{}};
Object.defineProperty(globalThis,"navigator",{configurable:true,value:{
 clipboard:{writeText:async value=>{copied=value;}}
}});
const module=createLeagueWhatsApp({sb,getMe:()=>actor,getView:()=>view,
 render:()=>{rendered++},flash:m=>{message=m},btn,esc});
assert(module.screen().includes("WhatsApp"));
await module.refresh();
assert(module.screen().includes("Aún no vinculaste"));
assert(module.screen().includes("Generar código"));
assert(!module.screen().includes("AB12CD34EF56"));
assert(await module.runAction("wa_generate"));
assert(module.screen().includes("AB12CD34EF56"));
assert(generated===1);
await module.runAction("wa_copy");
assert.equal(copied,".liga2 vincular AB12CD34EF56");
linked=true;
await module.runAction("wa_refresh");
assert(module.screen().includes("WhatsApp vinculado"));
assert(module.screen().includes("****2891"));
assert(!module.screen().includes("AB12CD34EF56"));
assert(module.screen().includes("Desvincular"));
await module.runAction("wa_unlink");
assert(unlinked===1);
assert(module.screen().includes("Aún no vinculaste"));
assert(!module.screen().includes("AB12CD34EF56"));
actor="u2";module.reset();
assert(module.screen().includes("Consultando")||module.screen().includes("Conectando"));
await module.refresh();
assert(module.screen().includes("Generar código"));
assert.equal(await module.runAction("unrelated"),false);
assert(!JSON.stringify(calls).includes("AB12CD34EF56"),"Don't send code into unexpected RPC");
console.log("PASS: private link UI, code created on click only, 10-minute code copy, linked status masked, revoke and user-switch reset.");
