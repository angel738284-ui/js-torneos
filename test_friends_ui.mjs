import {initFriends} from "./js-friends-ui.js";
import assert from "node:assert/strict";
class FakeNode {
 constructor(tag,text="",cls=""){
  this.tag=tag;this._text=text||"";this.cls=cls;this.children=[];this.dataset={};
  this.disabled=false;this.style={};this.value="";this.attributes={};
 }
 get textContent(){return this._text+this.children.map(x=>x.textContent).join("")}
 set textContent(v){this._text=String(v);this.children=[]}
 replaceChildren(...nodes){this.children=nodes}
 append(...nodes){for(const n of nodes){this.children.push(n);if(this.tag==="select"&&this.children.length===1)this.value=n.value}}
 setAttribute(k,v){this.attributes[k]=v}
 scrollIntoView(){}
 addEventListener(type,fn){this["on"+type]=fn}
}
const names=[
 "js-friends-status","js-friend-search-result","js-friend-profile",
 "js-friends-list","js-friends-requests","js-friends-invites",
 "js-friends-count","js-friends-search","js-friends-id","js-friends-refresh"
];
const dom=Object.fromEntries(names.map(x=>[x,new FakeNode("div")]));
globalThis.document={createElement:(tag)=>new FakeNode(tag)};
globalThis.window={confirm:()=>true};
const me={session:{user:{id:"me"}},profile:{game_id:"111111111"}};
let memberships=[
 {id:"f1",game_id:"222222222",nickname:"Amigo Uno",region:"SAC",state:"friend"},
 {id:"f2",game_id:"333333333",nickname:"Pendiente",region:"SAC",state:"incoming"},
 {id:"f3",game_id:"444444444",nickname:"Solicitado",region:"SAC",state:"outgoing"}
];
let invitations=[{id:"inv1",from_nickname:"Amigo",tournament_name:"Torneo BR",tournament_code:"JS-ABCDEF12"}];
let calls=[];
const apiCall=async(action,params={})=>{
 calls.push({action,params});
 if(action==="friends_snapshot")return {ok:true,friends:memberships,invitations};
 if(action==="friend_lookup")return {ok:true,person:{nickname:"Nuevo",game_id:params.game_id,region:"SAC"}};
 if(action==="friend_request"){memberships.push({id:"f4",nickname:"Nuevo",game_id:params.game_id,state:"outgoing"});return {ok:true}};
 if(action==="friend_answer"){memberships=memberships.filter(x=>x.id!==params.friendship_id);return {ok:true}};
 if(action==="friend_remove"){memberships=memberships.filter(x=>x.id!==params.friendship_id);return {ok:true}};
 if(action==="public_profile")return {ok:true,profile:{nickname:"Amigo Uno",game_id:params.game_id,region:"SAC",bio:"Hola",is_admin:true}};
 if(action==="friend_tournaments")return {ok:true,tournaments:[{name:"BR",code:"JS-ABCDEF12",mode:"BR"}]};
 if(action==="friend_invite")return {ok:true,invited:true};
 if(action==="friend_invite_dismiss"){invitations=[];return {ok:true}};
 throw Error("Invalid action "+action)
};
const make=(tag,txt,cls)=>new FakeNode(tag,txt,cls);
const controller=initFriends({q:(id)=>dom[id],make,apiCall,getAccount:()=>me,safeProfileImage:()=>""});
const all=(root)=>[root,...root.children.flatMap(all)];
const find=(root,part)=>all(root).find(n=>n.tag==="button"&&n.textContent.includes(part));
await controller.refresh();
assert.equal(dom["js-friends-count"].textContent,"1");
assert.equal(dom["js-friends-list"].children.length,1);
assert.equal(dom["js-friends-requests"].children.length,2);
assert.equal(dom["js-friends-invites"].children.length,1);
dom["js-friends-id"].value="555555555";
await dom["js-friends-search"].onclick();
assert.equal(dom["js-friend-search-result"].children.length,1);
await find(dom["js-friend-search-result"],"Agregar amigo").onclick();
assert.ok(calls.some(x=>x.action==="friend_request"));
await find(dom["js-friends-list"],"Ver perfil").onclick();
assert.equal(dom["js-friend-profile"].children.length,1);
await find(dom["js-friends-list"],"Invitar a torneo").onclick();
assert.ok(calls.some(x=>x.action==="friend_tournaments"));
await find(dom["js-friends-list"],"Enviar invitación").onclick();
assert.ok(calls.some(x=>x.action==="friend_invite"));
await find(dom["js-friends-requests"],"Aceptar").onclick();
assert.ok(calls.some(x=>x.action==="friend_answer"));
await find(dom["js-friends-invites"],"Descartar").onclick();
assert.ok(calls.some(x=>x.action==="friend_invite_dismiss"));
console.log("FRIENDS_UI_MOCK_TESTS_PASS",calls.map(x=>x.action).join(","));
