CREATE OR REPLACE FUNCTION public.js_liga_espera(p_action text, p_match_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 caller uuid:=auth.uid();
 match_data public.js_liga_matches%rowtype;
 lineup uuid[];
 accepts integer;
 statuses jsonb;
 ready_total integer;
 ready_current boolean;
begin
 if caller is null then raise exception 'Iniciá sesión' using errcode='42501';end if;
 if p_action not in('get','ready','unready') then raise exception 'Acción no admitida';end if;
 perform pg_advisory_xact_lock(hashtext('js-family-league-2vs2-v1'));
 select * into match_data from public.js_liga_matches m
 where m.id=p_match_id and m.season_id in
 (select id from public.js_liga_seasons where state='active') for update;
 if match_data.id is null then raise exception 'PvP no encontrado';end if;
 lineup:=match_data.lineup_a||match_data.lineup_b;
 if not caller=any(lineup) and not exists(select 1 from public.js_admins where uid=caller)
 then raise exception 'Solo los participantes o JS pueden ver esta sala de espera' using errcode='42501';end if;
 select count(*) into accepts from public.js_liga_match_votes
 where match_id=p_match_id and accepted=true and user_id=any(lineup);
 if accepts<>4 or match_data.started_at is null then
  raise exception 'Este PvP todavía no fue aceptado por los cuatro';
 end if;
 if p_action in('ready','unready') then
  if not caller=any(lineup) then raise exception 'Solo los jugadores marcan Estoy listo';end if;
  if match_data.state not in('playing','review') then
   raise exception 'Este PvP ya terminó y no se pueden cambiar las confirmaciones';end if;
  insert into public.js_liga_ready(match_id,user_id,ready)
  values(p_match_id,caller,p_action='ready')
  on conflict(match_id,user_id) do update set ready=excluded.ready,updated_at=now();
 end if;
 select count(*) into ready_total from public.js_liga_ready
 where match_id=p_match_id and ready=true and user_id=any(lineup);
 select coalesce(jsonb_agg(jsonb_build_object(
    'user_id',a.user_id,'ready',coalesce(r.ready,false)
  ) order by a.ord),'[]'::jsonb) into statuses
 from unnest(lineup) with ordinality a(user_id,ord)
 left join public.js_liga_ready r on r.match_id=p_match_id and r.user_id=a.user_id;
 return jsonb_build_object('ok',true,'match_id',p_match_id,'ready_count',ready_total,
  'everyone_ready',ready_total=4,'players',statuses,
  'message',case when ready_total=4 then '✅ ¡Los cuatro están listos! Ya pueden comenzar la sala.'
   else ready_total||'/4 listos. Esperando a los demás jugadores.' end);
end
$function$
