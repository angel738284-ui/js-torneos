import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const js=readFileSync(new URL("./liga.js",import.meta.url),"utf8");
const html=readFileSync(new URL("./liga.html",import.meta.url),"utf8");
const sql=readFileSync(new URL("./js_liga_salir_duo.sql",import.meta.url),"utf8");

test("mostrar la salida en la sección Mi dúo",()=>{
 assert.match(js,/card\("⚙️ Gestionar mi dúo"/);
 assert.match(js,/btn\(asSub\?"🚪 Dejar de ser suplente":"🚪 Salir de mi dúo","leave_duo"/);
 assert.match(js,/btn\(teamOf\(me\)\.substitute===me\?"🚪 Dejar de ser suplente":"🚪 Salir de mi dúo","leave_duo"/);
});
test("confirmar que se libera el dúo completo y que hay historial",()=>{
 assert.match(js,/if\(action==="leave_duo"\)/);
 assert.match(js,/Se disolverá el equipo actual para TODOS sus integrantes/);
 assert.match(js,/partidas y puntos individuales se conservan/);
 assert.match(js,/js_liga_salir_duo/);
 assert.doesNotMatch(js,/from\("js_liga_teams"\)\.delete/);
});
test("los equipos archivados desaparecen del ranking pero conservan datos históricos",()=>{
 assert.match(js,/const allTeams=\(\)=>live\?\.teams\|\|\[\]/);
 assert.match(js,/const teams=\(\)=>allTeams\(\)\.filter\(t=>t\.archived!==true\)/);
 assert.match(js,/const a=allTeams\(\)\.find\(t=>t\.id===b\.a\),z=allTeams\(\)\.find\(t=>t\.id===b\.b\)/);
 const all=[{id:"old",archived:true,captain:"u1",partner:"u2"},{id:"new",archived:false,captain:"u1",partner:"u3"}];
 const active=all.filter(t=>t.archived!==true);
 assert.deepEqual(active.map(t=>t.id),["new"]);
 assert.equal(all.length,2);
});
test("la acción requiere usuario autenticado y no permite abandonar partidos abiertos",()=>{
 assert.match(sql,/v_user uuid := auth\.uid\(\)/);
 assert.match(sql,/if v_user is null then/);
 assert.match(sql,/pg_catalog\.pg_advisory_xact_lock/);
 assert.match(sql,/m\.state in \('pending','playing','review'\)/);
 assert.match(sql,/set archived_at=now\(\)/);
 assert.match(sql,/delete from public\.js_liga_search_votes/);
 assert.match(sql,/grant execute on function public\.js_liga_salir_duo\(\) to authenticated/);
});
test("no se pierden partidas ni resultados",()=>{
 assert.doesNotMatch(sql,/delete from public\.js_liga_matches/i);
 assert.doesNotMatch(sql,/delete from public\.js_liga_personal_results/i);
 assert.doesNotMatch(sql,/update public\.js_liga_teams\s+set wins/i);
 assert.doesNotMatch(sql,/update public\.js_liga_teams\s+set losses/i);
 assert.match(sql,/update public\.js_liga_duo_sharing/);
});
test("cache actualizada para el celular",()=>{
 assert.match(html,/liga\.js\?v=2\.5\.0/);
});
