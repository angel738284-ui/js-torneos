import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const page=readFileSync(new URL("./ruleta.html",import.meta.url),"utf8");
test("Public page displays only sanitized names via textContent",()=>{
 assert.match(page,/new URLSearchParams\(location\.search\)\.get\("r"\)/);
 assert.match(page,/js_ruleta_publica/);
 assert.match(page,/name\.textContent=p\.nombre/);
 assert.match(page,/winName\.textContent=name/);
 assert.doesNotMatch(page,/innerHTML\s*=/);
});
test("Same spin source and result for every device",()=>{
 assert.match(page,/servidor_ahora/);
 assert.match(page,/Date\.parse\(data\.inicio\)/);
 assert.match(page,/next\.ganador_indice/);
 assert.match(page,/setInterval\(update,2100\)/);
});
test("Viewer can only read and copy; no private token or admin call",()=>{
 assert.doesNotMatch(page,/JS_WHEEL_BOT_TOKEN|js_ruleta_operar|p_token/);
 assert.match(page,/config\.publishableKey/);
 assert.match(page,/navigator\.clipboard\.writeText/);
});
