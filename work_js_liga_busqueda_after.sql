CREATE OR REPLACE FUNCTION public.js_liga_busqueda(p_action text DEFAULT 'status'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 me uuid:=auth.uid();
 curseason bigint;
 mine public.js_liga_teams%rowtype;
 opponent public.js_liga_teams%rowtype;
 lineup_me uuid[];
 lineup_enemy uuid[];
 allplayers uuid[];
 my_ready boolean:=false;
 partner_ready boolean:=false;
 team_ready boolean:=false;
 awaiting integer:=0;
 valid_count integer;
 unique_ids integer;
 unique_regions integer;
 region_me text;
 previous_games integer;
 previous_at timestamptz;
 other_games_me integer;
 other_games_enemy integer;
 match_new bigint;
begin
 if me is null then raise exception 'Iniciá sesión en JS Torneos' using errcode='42501';end if;
 if p_action not in('status','join','pulse','leave') then
  raise exception 'Acción de búsqueda no reconocida';end if;
 -- Same transaction lock as js_liga_accion: protects against simultaneous
 -- joins, manual challenges and duplicate PvP pairings.
 perform pg_advisory_xact_lock(hashtext('js-family-league-2vs2-v1'));
 delete from public.js_liga_search_votes where expires_at<=now();
 select id into curseason from public.js_liga_seasons
  where state='active' order by id desc limit 1;
 if curseason is null then
  return jsonb_build_object('my_ready',false,'partner_ready',false,
   'team_ready',false,'waiting_teams',0,'matched',false,'season_open',false);
 end if;
 -- A paused season never creates matches, even if an older client
 -- keeps sending matchmaking join requests.
 if exists(select 1 from public.js_liga_control c
    where c.season_id=curseason and c.paused) then
   if p_action='join' then
    raise exception '⏸️ La Liga 2VS2 está pausada por JS. Volvé a buscar cuando se reanude.';
   end if;
   return jsonb_build_object('my_ready',false,'partner_ready',false,
     'team_ready',false,'waiting_teams',0,'matched',false,
     'paused',true,'season_open',true);
 end if;
 select * into mine from public.js_liga_teams where archived_at is null and  season_id=curseason and me in(captain,partner,substitute) limit 1;
 if mine.id is null then
  if p_action<>'status' then raise exception 'Primero tenés que formar tu dúo';end if;
  return jsonb_build_object('my_ready',false,'partner_ready',false,
   'team_ready',false,'waiting_teams',0,'matched',false,'season_open',true);
 end if;
 lineup_me:=array[
  case when mine.replaced=mine.captain then mine.substitute else mine.captain end,
  case when mine.replaced=mine.partner then mine.substitute else mine.partner end
 ];
 if me<>all(lineup_me) and p_action in('join','pulse','leave') then
  raise exception 'Tu titular fue reemplazado. Solo los dos jugadores activos pueden buscar rival';
 end if;
 if p_action in('join','pulse') and exists(
  select 1 from public.js_liga_matches m
  where m.season_id=curseason and m.state in('pending','playing','review')
    and mine.id in(m.team_a,m.team_b)
    and (m.state='review'
         or (m.state='pending' and m.accept_until>now())
         or m.state='playing')
 ) then
  delete from public.js_liga_search_votes where team_id=mine.id;
  raise exception 'Tu dúo ya tiene un PvP activo o en revisión';
 end if;
 if p_action='join' then
  -- Joining is an explicit individual approval, never a team-wide approval.
  select count(*),count(distinct p.game_id),count(distinct p.region),min(p.region)
  into valid_count,unique_ids,unique_regions,region_me
  from public.js_player_profiles p
  where p.user_id=any(lineup_me) and p.verified_at is not null
    and p.region in('SAC','NA','US');
  if valid_count<>2 or unique_ids<>2 or unique_regions<>1 then
   raise exception 'Los dos jugadores necesitan IDs verificados, distintos y de la misma región';
  end if;
  insert into public.js_liga_search_votes(season_id,team_id,user_id,expires_at)
  values(curseason,mine.id,me,now()+interval '90 seconds')
  on conflict(team_id,user_id) do update set
   expires_at=excluded.expires_at;
 elsif p_action='pulse' then
  update public.js_liga_search_votes set expires_at=now()+interval '90 seconds'
  where team_id=mine.id and user_id=me and expires_at>now();
 elsif p_action='leave' then
  -- One player's cancellation cancels the duo's search.
  delete from public.js_liga_search_votes where team_id=mine.id;
 end if;
 select exists(select 1 from public.js_liga_search_votes
  where team_id=mine.id and user_id=me and expires_at>now())
 into my_ready;
 select exists(select 1 from public.js_liga_search_votes
  where team_id=mine.id and user_id=any(lineup_me)
    and user_id<>me and expires_at>now())
 into partner_ready;
 select count(distinct user_id)>=1 into team_ready
 from public.js_liga_search_votes where team_id=mine.id
   and user_id=any(lineup_me) and expires_at>now();

 if p_action='join' and team_ready then
  -- One explicit search from each duo is enough. Both real player IDs
  -- must still be verified and same-region before starting a match.
  for opponent in
   select t.* from public.js_liga_teams t where t.archived_at is null and  t.season_id=curseason and t.id<>mine.id
      and (select count(distinct v.user_id)
           from public.js_liga_search_votes v
           where v.team_id=t.id and v.expires_at>now()
             and v.user_id=any(array[
               case when t.replaced=t.captain then t.substitute else t.captain end,
               case when t.replaced=t.partner then t.substitute else t.partner end
             ]))>=1
    order by random()
  loop
   if exists(select 1 from public.js_liga_matches m
     where m.season_id=curseason and m.state in('pending','playing','review')
       and opponent.id in(m.team_a,m.team_b)
       and (m.state='review'
            or (m.state='pending' and m.accept_until>now())
            or m.state='playing')
   ) then continue;end if;
   lineup_enemy:=array[
    case when opponent.replaced=opponent.captain then opponent.substitute else opponent.captain end,
    case when opponent.replaced=opponent.partner then opponent.substitute else opponent.partner end
   ];
   allplayers:=lineup_me||lineup_enemy;
   if array_position(allplayers,null) is not null or
      (select count(distinct x) from unnest(allplayers)x)<>4 then
    continue;
   end if;
   select count(*),count(distinct p.game_id),count(distinct p.region)
   into valid_count,unique_ids,unique_regions
   from public.js_player_profiles p where p.user_id=any(allplayers)
     and p.verified_at is not null and p.region in('SAC','NA','US');
   if valid_count<>4 or unique_ids<>4 or unique_regions<>1 then continue;end if;
   select count(*),max(decided_at) into previous_games,previous_at
   from public.js_liga_matches m
   where m.season_id=curseason and m.state='complete'
     and ((m.team_a=mine.id and m.team_b=opponent.id)
          or (m.team_b=mine.id and m.team_a=opponent.id));
   if previous_games>=3 then continue;end if;
   if previous_games>0 then
    select count(distinct case when m.team_a=mine.id then m.team_b else m.team_a end)
    into other_games_me
    from public.js_liga_matches m
    where m.season_id=curseason and m.state='complete'
      and m.decided_at>previous_at and mine.id in(m.team_a,m.team_b)
      and opponent.id not in(m.team_a,m.team_b);
    select count(distinct case when m.team_a=opponent.id then m.team_b else m.team_a end)
    into other_games_enemy
    from public.js_liga_matches m
    where m.season_id=curseason and m.state='complete'
      and m.decided_at>previous_at and opponent.id in(m.team_a,m.team_b)
      and mine.id not in(m.team_a,m.team_b);
    if other_games_me<1 or other_games_enemy<1 then continue;end if;
   end if;
   insert into public.js_liga_matches(
    season_id,team_a,team_b,lineup_a,lineup_b,state,
    accept_until,started_at,result_until)
   values(curseason,mine.id,opponent.id,lineup_me,lineup_enemy,'playing',
    now(),now(),now()+interval '35 minutes')
   returning id into match_new;
   -- A single search by one representative of EACH team counts as
   -- team consent for the automated match. Four verified players are required;
   -- never require a second tap to accept an automatically matched game.
   insert into public.js_liga_match_votes(match_id,user_id,accepted)
   select match_new,x,true from unnest(allplayers) x;
   return jsonb_build_object('my_ready',false,'partner_ready',false,
    'team_ready',false,'waiting_teams',0,'matched',true,
    'match_id',match_new,'season_open',true,
    'message','¡Rival encontrado! Un integrante de cada dúo confirmó la búsqueda. Prepará la sala y jugá el PvP.');
  end loop;
 end if;
 select count(*) into awaiting
 from (
  select v.team_id
  from public.js_liga_search_votes v
  join public.js_liga_teams t on t.id=v.team_id and t.archived_at is null
  where v.season_id=curseason and v.expires_at>now()
    and v.user_id=any(array[
      case when t.replaced=t.captain then t.substitute else t.captain end,
      case when t.replaced=t.partner then t.substitute else t.partner end
    ])
  group by v.team_id having count(distinct v.user_id)>=1
 ) x;
 return jsonb_build_object(
  'my_ready',my_ready,
  'partner_ready',partner_ready,
  'team_ready',team_ready,
  'waiting_teams',awaiting,
  'matched',false,
  'season_open',true,
  'message',case
    when p_action='leave' then 'Búsqueda cancelada para ambos integrantes.'
    when team_ready then 'Tu dúo ya está buscando. Esperando a otro equipo compatible…'
    when my_ready then 'Tu búsqueda está activa. Esperando a un dúo rival compatible.'
    else 'Tocá Buscar rival para empezar.' end);
end
$function$
