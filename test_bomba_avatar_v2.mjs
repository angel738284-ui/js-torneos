import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const html=readFileSync(new URL("./bomba.html",import.meta.url),"utf8");
const css=readFileSync(new URL("./bomba_avatar.css",import.meta.url),"utf8");
const migration=readFileSync(new URL("./js_bomba_avatar_upgrade.sql",import.meta.url),"utf8")+readFileSync(new URL("./bomba3d/model_upgrade.sql",import.meta.url),"utf8");
const js=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).find(x=>x.includes('function avatarSafe(obj)'));
assert.ok(js,"Avatar source exists");
const start=js.indexOf("const fields="),end=js.indexOf("function showError(",start);
const factoryCode=js.slice(start,end);
const makeNode=(tag="div")=>({
 tagName:tag,style:{properties:{},setProperty(k,v){this.properties[k]=v}},
 children:[],dataset:{},className:"",textContent:"",
 append(...items){this.children.push(...items)}
});
const env=vm.createContext({document:{createElement:makeNode},window:{},Map,Math});
vm.runInContext(factoryCode+"\nthis.av={fields,defaults,allowed,avatarSafe,buildAvatar}",env);
const {fields,defaults,allowed,avatarSafe,buildAvatar}=env.av;

test("19 editable controls map to a declared SQL avatar property",()=>{
 assert.equal(fields.length,19);
 assert.equal(new Set(fields).size,19);
 for(const k of fields){
  assert.ok(html.includes('id="'+k+'"'),"Missing control "+k);
  assert.ok(allowed[k].includes(defaults[k]),"Missing default "+k);
  assert.ok(migration.includes("'"+k+"'"),"No server field "+k);
 }
});
test("gender choice is visible and respects both avatar styles",()=>{
 assert.match(html,/data-avatar-gender="man"/);
 assert.match(html,/data-avatar-gender="woman"/);
 assert.match(css,/\.char\[data-gender="woman"\] \.torso/);
 assert.match(css,/\.char\[data-body="athletic"\] \.torso/);
 const woman=buildAvatar({...defaults,gender:"woman",hair:"ponytail",topStyle:"dress"});
 assert.equal(woman.dataset.gender,"woman");
 assert.equal(woman.dataset.hair,"ponytail");
 assert.equal(woman.dataset.topStyle,"dress");
});
test("mix-and-match appearance includes real clothes, faces, hair and accessories",()=>{
 for(const [key,value] of [["hair","curly"],["topStyle","hoodie"],["bottomStyle","skirt"],
 ["pattern","star"],["expression","wink"],["accessory","headphones"],
 ["aura","gold"],["pose","dance"],["shoes","neon"]]){
  const part=buildAvatar({...defaults,[key]:value});
  assert.equal(key==="shoes"?part.style.properties["--shoe"]!==undefined:part.dataset[key],key==="shoes"?true:value);
 }
 for(const layer of ["hairBack","hairTail","topDetail","earrings","headphones","auraRing","bottomOverlay"]){
  assert.ok(buildAvatar(defaults).children.some(p=>p.className===layer),layer);
 }
});
test("unknown values revert safely to defaults rather than injecting styles",()=>{
 const output=avatarSafe({gender:"dragon",skin:"url(javascript:bad)",hair:"--custom"});
 assert.equal(output.gender,"man");
 assert.equal(output.skin,defaults.skin);
 assert.equal(output.hair,defaults.hair);
 assert.equal(buildAvatar(output).dataset.gender,"man");
});
test("all dropdown options exist in the server-side whitelist",()=>{
 for(const k of fields.filter(k=>k!=="gender")){
  const control=html.match(new RegExp('<select id="'+k+'">([\\s\\S]*?)<\\/select>'));
  assert.ok(control,"Select for "+k);
  const vals=[...control[1].matchAll(/<option value="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(vals,Array.from(allowed[k]),k+" must match backend");
 }
});
test("live preview and saved avatar use exactly the same rendering function",()=>{
 assert.match(js,/function preview\(\)\{/);
 assert.match(js,/el\("preview2D"\)\.replaceChildren\(buildAvatar/);
 assert.match(js,/p_action:"avatar",p_avatar:value/);
 assert.match(js,/buildAvatar\(p\.avatar\)/);
 assert.match(html,/bomba_avatar\.css\?v=2/);
 assert.match(css,/\.avatarEditor \.preview/);
 assert.match(css,/\.char\[data-hair="ponytail"\]/);
});
