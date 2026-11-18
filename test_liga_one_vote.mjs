import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const path=(name)=>readFileSync(new URL(name,import.meta.url),"utf8");
const lookup=path("work_js_liga_busqueda_after.sql");
const scoring=path("work_js_liga_accion_after.sql");
const waiting=path("work_js_liga_espera_after.sql");
const state=path("work_js_liga_estado_after.sql");
const bot=path("work_js_liga_wa_accion_after.sql");
const overview=path("work_js_liga_wa_mios_after.sql");
const js=path("liga.js");
const extras=path("liga-plus.js");
const html=path("liga.html");

test("un integrante por dúo puede activar búsqueda automática",()=>{
 assert.match(lookup,/select count\(distinct user_id\)>=1 into team_ready/);
 assert.match(lookup,/\]\)\)>=1/);
 assert.match(lookup,/having count\(distinct v.user_id\)>=1/);
 assert.match(lookup,/valid_count<>4 or unique_ids<>4 or unique_regions<>1/);
 assert.match(lookup,/t.id<>mine.id/);
});
test("enfrentarse a otro dúo una vez habilita revancha",()=>{
 assert.match(lookup,/other_games_me<1 or other_games_enemy<1/);
 assert.doesNotMatch(lookup,/other_games_me<2 or other_games_enemy<2/);
 assert.equal((scoring.match(/if v_count2<1 then/g)||[]).length,2);
 assert.doesNotMatch(scoring,/if v_count2<2 then/);
 assert.match(scoring,/m\.state in\('pending','playing','review'\)/);
});
test("un jugador por lado marca Estoy listo",()=>{
 assert.match(waiting,/any\(match_data\.lineup_a\)/);
 assert.match(waiting,/any\(match_data\.lineup_b\)/);
 assert.match(waiting,/'everyone_ready',ready_total=2/);
 assert.match(waiting,/ready_total=2 then/);
 assert.match(extras,/number\+'\/2 dúos listos/);
});
test("resultado de un jugador por equipo no regala puntos si el otro no respondió",()=>{
 assert.match(scoring,/if \(v_a_win\+v_a_loss=0\) or \(v_b_win\+v_b_loss=0\) then/);
 assert.match(scoring,/v_a_win>=1 and v_b_loss>=1/);
 assert.match(scoring,/v_b_win>=1 and v_a_loss>=1/);
 assert.match(scoring,/update public\.js_liga_matches set state='review'/);
 assert.match(scoring,/v_a_win>0 and v_b_win>0/);
 assert.match(scoring,/and user_id=u and accepted=true and result is null/);
});
test("el frontend y el bot cuentan 2 dúos, no 4 jugadores, para resultados",()=>{
 assert.match(state,/'reported',\(/);
 assert.match(state,/any\(m\.lineup_a\)/);
 assert.match(state,/any\(m\.lineup_b\)/);
 assert.match(bot,/any\(current_match\.lineup_a\)/);
 assert.match(overview,/any\(m\.lineup_b\)/);
 assert.match(js,/b\.reported\+'\/2 dúos informaron/);
});
test("no se alteran las cuatro aceptaciones explícitas de desafíos manuales",()=>{
 assert.match(scoring,/if v_count=4 then/);
 assert.match(scoring,/where match_id=duel\.id and accepted=true/);
 assert.match(waiting,/if accepts<>4 or match_data\.started_at is null then/);
});
test("navegador móvil recibe versiones actualizadas de la liga",()=>{
 assert.match(html,/liga\.js\?v=2\.6\.0/);
 assert.match(js,/liga-plus\.js\?v=2\.1\.0/);
 assert.match(extras,/Alcanza con que una persona de cada dúo marque Estoy listo/);
});
