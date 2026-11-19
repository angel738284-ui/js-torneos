import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const page=readFileSync(new URL("./ruleta.html",import.meta.url),"utf8");
const migration=readFileSync(new URL("./js_ruleta_eliminacion.sql",import.meta.url),"utf8");

test("Eliminations are visible, crossed out, and absent from future wheel segments",()=>{
 assert.match(page,/function visibleParticipants\(\)/);
 assert.match(page,/\.filter\(p=>!eliminated\.has\(p\.originalIndex\)\)/);
 assert.match(page,/li\.className="eliminated"/);
 assert.match(page,/lastEliminated/);
 assert.match(page,/Eliminado #/);
 assert.match(page,/sobrevivientes/);
});
test("The browser restores the same stage from server clock after refresh",()=>{
 assert.match(page,/servidor_ahora/);
 assert.match(page,/Date\.parse\(data\.inicio\)/);
 assert.match(page,/duracion_paso_ms/);
 assert.match(page,/function renderElimination\(next\)/);
 assert.match(page,/if\(next\.modalidad==="eliminacion"\)/);
});
test("Only the last survivor displays as winner, without any public controls to change it",()=>{
 assert.match(page,/next\.estado==="finished"\?Number\(next\.ganador_indice\):-1/);
 assert.match(page,/ÚLTIMO SOBREVIVIENTE/);
 assert.doesNotMatch(page,/js_ruleta_eliminacion_iniciar|JS_WHEEL_BOT_TOKEN/);
 assert.doesNotMatch(page,/innerHTML\s*=/);
});
test("SQL stores the unrevealed elimination order securely and legacy wheels remain readable",()=>{
 assert.match(migration,/js_wheel\.eliminations/);
 assert.match(migration,/extensions\.gen_random_bytes\(16\)/);
 assert.match(migration,/v_has_elimination/);
 assert.match(migration,/x\.reveal_at<=v_now/);
 assert.match(migration,/winner_pos/);
 assert.match(migration,/v_state='finished'/);
 assert.match(migration,/set search_path=''/);
});
