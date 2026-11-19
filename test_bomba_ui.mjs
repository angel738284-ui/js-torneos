import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const page=readFileSync(new URL("./bomba.html",import.meta.url),"utf8");
const migration=readFileSync(new URL("./js_bomba_mortal.sql",import.meta.url),"utf8");
test("Game page shows everyone, bomb holder, countdown and eliminations",()=>{
 for(const item of ["players","timer","events","alive","phase","winner","yourName"])assert.match(page,new RegExp('id="'+item+'"'));
 assert.match(page,/function drawRoster\(\)/);
 assert.match(page,/if\(isHolder\)card\.classList\.add\("held"\)/);
 assert.match(page,/if\(!p\.vivo\)card\.classList\.add\("dead"\)/);
 assert.match(page,/p_action:"pasar"/);
});
test("Character customization has independent permitted pieces and saved server state",()=>{
 for(const k of ["hair","hairColor","skin","shirt","pants","accessory"])assert.match(page,new RegExp('id="'+k+'"'));
 assert.match(page,/function avatarSafe\(obj\)/);
 assert.match(page,/p_action:"avatar",p_avatar:value/);
 assert.match(page,/id="wear3d"/);
 assert.match(page,/id="topStyle"/);
 assert.match(page,/id="accessory"/);
 assert.match(page,/className="modelSpace"/);
 assert.doesNotMatch(page,/function buildAvatar\(value\)/);
 assert.match(migration,/safe_hair not in/);
 assert.match(migration,/safe_shirt not in/);
 assert.match(migration,/safe_acc not in/);
});
test("Private access stays separate from public spectating",()=>{
 assert.match(page,/sessionStorage\.setItem\(storageKey,personalToken\)/);
 assert.match(page,/history\.replaceState/);
 assert.match(page,/p_action:"soy"/);
 assert.match(page,/!personalToken/);
 assert.match(page,/const clickable=canChooseTarget\(p\)/);
 assert.match(page,/if\(!target\|\|!canChooseTarget\(target\)\|\|!canPass\(\)\|\|busy\)return/);
 assert.match(page,/id="passBomb"/);
 assert.match(page,/p_action:"pasar",p_target:target.id/);
 assert.doesNotMatch(page,/JS_WHEEL_BOT_TOKEN|p_sender|sender_jid/);
});
test("Server owns validation, timing and whose turn it is",()=>{
 assert.match(migration,/r\.bomb_holder is distinct from p\.id/);
 assert.match(migration,/p_target=p\.id/);
 assert.match(migration,/r\.deadline/);
 assert.match(migration,/js_bomb\.advance/);
 assert.match(migration,/clock_timestamp\(\)/);
 assert.match(migration,/encode\(extensions\.digest\(p_access,'sha256'\),'hex'\)/);
 assert.match(migration,/unique\(room_id,game_id\)/);
 assert.match(migration,/set search_path=''/);
});
