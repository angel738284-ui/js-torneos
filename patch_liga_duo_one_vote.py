from pathlib import Path
root=Path(__file__).parent

def exact(src,old,new,tag):
 n=src.count(old)
 if n!=1:raise RuntimeError(f"{tag} had {n} occurrences, expected 1")
 return src.replace(old,new,1)

source=(root/"work_js_liga_busqueda_before.sql").read_text()
source=exact(source,"select count(distinct user_id)=2 into team_ready","select count(distinct user_id)>=1 into team_ready","my duo one vote")
source=exact(source,"  -- Random candidate ordering, but region/anti-farming/unique IDs and both\n  -- participants online+consenting are checked before creating a match.",
             "  -- One explicit search from each duo is enough. Both real player IDs\n  -- must still be verified and same-region before starting a match.","search description")
source=exact(source,"             ]))=2","             ]))>=1","other duo one vote")
source=exact(source,"group by v.team_id having count(distinct v.user_id)=2","group by v.team_id having count(distinct v.user_id)>=1","waiting count")
source=exact(source,"if other_games_me<2 or other_games_enemy<2 then continue;end if;",
             "if other_games_me<1 or other_games_enemy<1 then continue;end if;","rematch one different")
source=exact(source,"   -- Four explicit queue confirmations count as acceptance; do not require\n   -- tapping accept a second time.",
             "   -- A single search by one representative of EACH team counts as\n   -- team consent for the automated match. Four verified players are required;\n   -- never require a second tap to accept an automatically matched game.","queue consent")
source=exact(source,"'message','¡Rival encontrado! Los cuatro ya confirmaron la búsqueda. Prepará la sala y jugá el PvP.'",
             "'message','¡Rival encontrado! Un integrante de cada dúo confirmó la búsqueda. Prepará la sala y jugá el PvP.'","match reply")
source=exact(source,"when team_ready then 'Ambos confirmaron. Buscando un dúo compatible…'\n    when my_ready then 'Confirmaste tu búsqueda. Falta que tu compañero también confirme.'",
             "when team_ready then 'Tu dúo ya está buscando. Esperando a otro equipo compatible…'\n    when my_ready then 'Tu búsqueda está activa. Esperando a un dúo rival compatible.'","waiting reply")
(root/"work_js_liga_busqueda_after.sql").write_text(source)

source=(root/"work_js_liga_accion_before.sql").read_text()
if source.count("if v_count2<2 then")!=2:raise RuntimeError("manual rematch conditions count changed")
source=source.replace("if v_count2<2 then","if v_count2<1 then")
source=exact(source,"Tu dúo debe jugar contra otros dos rivales distintos antes de repetir",
             "Tu dúo debe completar un PvP contra otro rival antes de repetir","manual error me")
source=exact(source,"El dúo rival debe jugar contra otros dos equipos distintos antes de repetir",
             "El dúo rival debe completar un PvP contra otro equipo antes de repetir","manual error enemy")
source=exact(source,"if v_a_win+v_a_loss+v_b_win+v_b_loss<4 then",
             "if (v_a_win+v_a_loss=0) or (v_b_win+v_b_loss=0) then","one from each side")
source=exact(source,"'Resultado guardado ('||(v_a_win+v_a_loss+v_b_win+v_b_loss)||'/4). Sin puntos hasta que todos confirmen.'",
             "'Resultado guardado para tu dúo. Falta que al menos un jugador del dúo contrario confirme el resultado.'","waiting result message")
source=exact(source,"if v_a_win=2 and v_b_loss=2 then v_winner:=duel.team_a;\n   elsif v_b_win=2 and v_a_loss=2 then v_winner:=duel.team_b;",
             "if v_a_win>=1 and v_b_loss>=1 then v_winner:=duel.team_a;\n   elsif v_b_win>=1 and v_a_loss>=1 then v_winner:=duel.team_b;","determine winner by team")
source=exact(source,"'¡PvP confirmado por los cuatro! Se actualizó el ranking.'",
             "'¡PvP confirmado por los dos equipos! Un resultado por dúo fue suficiente. Se actualizó el ranking.'","winner message")
(root/"work_js_liga_accion_after.sql").write_text(source)

source=(root/"work_js_liga_espera_before.sql").read_text()
source=exact(source," select count(*) into ready_total from public.js_liga_ready\n where match_id=p_match_id and ready=true and user_id=any(lineup);",
""" select
  (case when exists(select 1 from public.js_liga_ready v
     where v.match_id=p_match_id and v.ready=true
       and v.user_id=any(match_data.lineup_a)) then 1 else 0 end)+
  (case when exists(select 1 from public.js_liga_ready v
     where v.match_id=p_match_id and v.ready=true
       and v.user_id=any(match_data.lineup_b)) then 1 else 0 end)
 into ready_total;""","ready one per side")
source=exact(source,"'everyone_ready',ready_total=4,'players',statuses,",
             "'everyone_ready',ready_total=2,'players',statuses,","ready status")
source=exact(source,"'message',case when ready_total=4 then '✅ ¡Los cuatro están listos! Ya pueden comenzar la sala.'\n   else ready_total||'/4 listos. Esperando a los demás jugadores.' end)",
             "'message',case when ready_total=2 then '✅ ¡Ambos dúos están listos! Un representante por equipo confirmó.'\n   else ready_total||'/2 dúos listos. Falta que el otro equipo confirme.' end)","ready response")
(root/"work_js_liga_espera_after.sql").write_text(source)

source=(root/"work_js_liga_estado_before.sql").read_text()
source=exact(source,
"'reported',(select count(*) from public.js_liga_match_votes v where v.match_id=m.id and v.result is not null),",
"""'reported',(
       (case when exists(select 1 from public.js_liga_match_votes v
         where v.match_id=m.id and v.result is not null and v.user_id=any(m.lineup_a))
           then 1 else 0 end)+
       (case when exists(select 1 from public.js_liga_match_votes v
         where v.match_id=m.id and v.result is not null and v.user_id=any(m.lineup_b))
           then 1 else 0 end)
     ),""","count teams instead of players")
(root/"work_js_liga_estado_after.sql").write_text(source)
print("CREATED_SQL_CHANGES",*(f"{x}={ (root/('work_'+x+'_after.sql')).stat().st_size}" for x in ["js_liga_busqueda","js_liga_accion","js_liga_espera","js_liga_estado"]))
