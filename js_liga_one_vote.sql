-- JS Liga 2VS2: 1 duo rival between repeats, one representative per team for search, ready, and outcome.
BEGIN;
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
$function$;

CREATE OR REPLACE FUNCTION public.js_liga_accion(p_accion text, p_datos jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 u uuid := auth.uid();
 is_admin boolean := false;
 season public.js_liga_seasons%rowtype;
 team public.js_liga_teams%rowtype;
 other public.js_liga_teams%rowtype;
 invitation public.js_liga_invites%rowtype;
 duel public.js_liga_matches%rowtype;
 v_target uuid;
 v_team_id uuid;
 v_inv_id uuid;
 v_match_id bigint;
 v_la uuid[];
 v_lb uuid[];
 v_players uuid[];
 v_regions text[];
 v_count integer;
 v_count2 integer;
 v_last timestamptz;
 v_a_win integer;
 v_a_loss integer;
 v_b_win integer;
 v_b_loss integer;
 v_status text;
 v_value text;
 v_winner uuid;
 v_champion uuid;
 v_role text;
begin
 if u is null then raise exception 'Iniciá sesión para usar la liga' using errcode='42501'; end if;
 if p_accion is null or length(p_accion)>30 then raise exception 'Acción inválida'; end if;
 -- Serialize all league mutations. Prevent repeated scores, duplicate members and
 -- simultaneous approvals, even when multiple devices act at once.
 perform pg_advisory_xact_lock(hashtext('js-family-league-2vs2-v1'));
 select exists(select 1 from public.js_admins a where a.uid=u) into is_admin;
 update public.js_liga_invites set state='expired'
  where state='pending' and expires_at<=now();
 update public.js_liga_matches set state='expired' where state='pending' and accept_until<=now();
 -- Playing matches never expire; they await results or JS resolution.
 select * into season from public.js_liga_seasons where state='active' order by id desc limit 1 for update;
 if p_accion='start' then
   if not is_admin then raise exception 'Solo JS puede iniciar una temporada'; end if;
   if season.id is not null then raise exception 'La Liga 2VS2 ya está abierta'; end if;
   insert into public.js_liga_seasons(prize) values('Premio a definir') returning * into season;
   return jsonb_build_object('ok',true,'message','Liga 2VS2 abierta. Invitá a tu compañero desde la web.');
 end if;
 if p_accion='expire' then
   return jsonb_build_object('ok',true,'message','Tiempos de partidas actualizados');
 end if;
 if season.id is null then raise exception 'La liga todavía no está abierta. JS debe iniciarla'; end if;
 -- Paused season blocks all new registrations, invitations, challenges and
 -- approvals, while results, admin corrections and safe maintenance remain.
 if p_accion not in ('result','expire','prize','end','admin_resolve','admin_cancel')
 and exists(select 1 from public.js_liga_control c
  where c.season_id=season.id and c.paused=true) then
  raise exception '⏸️ JS pausó la Liga 2VS2. No se permiten nuevas inscripciones, desafíos ni aceptaciones hasta reanudar.';
 end if;
 if p_accion='prize' then
   if not is_admin then raise exception 'Solo JS puede editar el premio'; end if;
   v_value:=trim(coalesce(p_datos->>'prize',''));
   if length(v_value)<3 or length(v_value)>100 or v_value ~ '[<>]' then
     raise exception 'Escribí un premio válido de 3 a 100 caracteres';
   end if;
   update public.js_liga_seasons set prize=v_value where id=season.id;
   return jsonb_build_object('ok',true,'message','Premio actualizado');
 end if;
 if p_accion='end' then
   if not is_admin then raise exception 'Solo JS puede finalizar la temporada'; end if;
   if exists(select 1 from public.js_liga_matches
     where season_id=season.id and state in('pending','playing','review')) then
     raise exception 'Hay PvP abiertos o en revisión. Anulalos o resolvelos primero';
   end if;
   select id into v_champion from public.js_liga_teams where archived_at is null and  season_id=season.id and wins>0 order by wins desc,losses,created_at limit 1;
   update public.js_liga_seasons set state='finished',finished_at=now(),champion=v_champion where id=season.id;
   return jsonb_build_object('ok',true,'message','Temporada archivada sin borrar los partidos');
 end if;
 if p_accion in ('invite_partner','invite_sub') then
   v_target:=(p_datos->>'user_id')::uuid;
   if v_target is null or v_target=u then raise exception 'Elegí otro jugador registrado'; end if;
   if not exists(select 1 from public.js_player_profiles where user_id=u
      and verified_at is not null and region in('SAC','NA','US')) or
      not exists(select 1 from public.js_player_profiles where user_id=v_target
      and verified_at is not null and region in('SAC','NA','US')) then
      raise exception 'Los jugadores necesitan un ID de Free Fire verificado y región confirmada';
   end if;
   if (select region from public.js_player_profiles where user_id=u) <>
      (select region from public.js_player_profiles where user_id=v_target) then
      raise exception 'No se puede formar dúo entre regiones distintas';
   end if;
   if exists(select 1 from public.js_liga_teams where archived_at is null and  season_id=season.id and
      (v_target in(captain,partner,substitute))) then
      raise exception 'Ese jugador ya pertenece a un dúo de esta temporada';
   end if;
   if exists(select 1 from public.js_liga_invites where season_id=season.id and state='pending'
      and (v_target in(from_user,to_user))) then
      raise exception 'Ese jugador ya tiene una invitación pendiente';
   end if;
   if p_accion='invite_partner' then
     if exists(select 1 from public.js_liga_teams where archived_at is null and  season_id=season.id and u in(captain,partner,substitute)) then
       raise exception 'Ya pertenecés a un equipo; no podés cambiar de dúo';
     end if;
     if exists(select 1 from public.js_liga_invites where season_id=season.id
       and state='pending' and u in(from_user,to_user)) then
       raise exception 'Ya tenés una invitación pendiente';
     end if;
     insert into public.js_liga_invites(season_id,kind,from_user,to_user)
       values(season.id,'partner',u,v_target);
   else
     select * into team from public.js_liga_teams where archived_at is null and  season_id=season.id and u in(captain,partner) limit 1;
     if team.id is null then raise exception 'Solo un titular puede invitar al suplente'; end if;
     if team.substitute is not null then raise exception 'El dúo ya tiene un suplente fijo'; end if;
     if exists(select 1 from public.js_liga_matches where season_id=season.id
       and state in('pending','playing','review') and team.id in(team_a,team_b)) then
       raise exception 'Primero terminá el PvP activo antes de registrar un suplente';
     end if;
     if exists(select 1 from public.js_liga_invites where season_id=season.id
       and state='pending' and team_id=team.id) then
       raise exception 'Tu equipo ya tiene una invitación de suplente pendiente';
     end if;
     insert into public.js_liga_invites(season_id,kind,from_user,to_user,team_id)
       values(season.id,'substitute',u,v_target,team.id);
   end if;
   return jsonb_build_object('ok',true,'message','Invitación enviada. El jugador debe aceptarla desde su cuenta.');
 end if;
 if p_accion in ('accept_invite','decline_invite') then
   v_inv_id:=(p_datos->>'invite_id')::uuid;
   select * into invitation from public.js_liga_invites where id=v_inv_id
      and season_id=season.id and to_user=u and state='pending' and expires_at>now() for update;
   if invitation.id is null then raise exception 'No tenés esa invitación vigente'; end if;
   if p_accion='decline_invite' then
     update public.js_liga_invites set state='declined' where id=v_inv_id;
     return jsonb_build_object('ok',true,'message','Invitación rechazada');
   end if;
   if exists(select 1 from public.js_liga_teams where archived_at is null and  season_id=season.id and
     (u in(captain,partner,substitute))) then raise exception 'Ya pertenecés a un equipo'; end if;
   if exists(select 1 from public.js_liga_teams where archived_at is null and  season_id=season.id and
      (invitation.from_user in(captain,partner,substitute))) and invitation.kind='partner' then
     raise exception 'El invitador ya pertenece a un equipo';
   end if;
   if not exists(select 1 from public.js_player_profiles where user_id=u and
      verified_at is not null and region in('SAC','NA','US')) or
      not exists(select 1 from public.js_player_profiles where user_id=invitation.from_user and
      verified_at is not null and region in('SAC','NA','US')) then
      raise exception 'Los dos jugadores deben tener ID verificado y región confirmada';
   end if;
   if (select region from public.js_player_profiles where user_id=u) <>
      (select region from public.js_player_profiles where user_id=invitation.from_user) then
      raise exception 'Los jugadores pertenecen a regiones distintas';
   end if;
   if (select game_id from public.js_player_profiles where user_id=u) =
      (select game_id from public.js_player_profiles where user_id=invitation.from_user) then
      raise exception 'No pueden participar dos cuentas con el mismo ID de Free Fire';
   end if;
   if invitation.kind='partner' then
     insert into public.js_liga_teams(season_id,captain,partner)
       values(season.id,invitation.from_user,u);
   else
     select * into team from public.js_liga_teams where archived_at is null and  id=invitation.team_id
        and season_id=season.id for update;
     if team.id is null or team.substitute is not null then
       raise exception 'Ese dúo ya no acepta suplentes';
     end if;
     if exists(select 1 from public.js_liga_matches where season_id=season.id
       and state in('pending','playing','review') and team.id in(team_a,team_b)) then
       raise exception 'No se puede agregar suplente durante un PvP';
     end if;
     select array_agg(distinct region) into v_regions from public.js_player_profiles
       where user_id in(team.captain,team.partner,u) and verified_at is not null and region in('SAC','NA','US');
     if coalesce(array_length(v_regions,1),0)<>1 or
       (select count(*) from public.js_player_profiles where user_id in(team.captain,team.partner,u)
          and verified_at is not null and region in('SAC','NA','US'))<>3 then
       raise exception 'Los tres participantes necesitan región verificada y coincidente';
     end if;
     if (select count(distinct game_id) from public.js_player_profiles
        where user_id in(team.captain,team.partner,u))<>3 then
       raise exception 'Los tres jugadores deben tener IDs diferentes';
     end if;
     update public.js_liga_teams set substitute=u where id=team.id;
   end if;
   update public.js_liga_invites set state='accepted' where id=v_inv_id;
   return jsonb_build_object('ok',true,'message',
      case when invitation.kind='partner' then '¡Dúo formado! Compañeros fijos durante la temporada.'
        else '¡Suplente confirmado! El titular podrá activarlo antes de un PvP.' end);
 end if;
 if p_accion in ('activate_sub','deactivate_sub','remove_sub') then
   if p_accion='remove_sub' then
     if not is_admin then raise exception 'Solo JS puede retirar un suplente fijo'; end if;
     v_team_id:=(p_datos->>'team_id')::uuid;
     select * into team from public.js_liga_teams where archived_at is null and  id=v_team_id and season_id=season.id for update;
   else
     select * into team from public.js_liga_teams where archived_at is null and  season_id=season.id
       and u in(captain,partner) limit 1 for update;
   end if;
   if team.id is null then raise exception 'No se encontró el dúo'; end if;
   if team.substitute is null then raise exception 'Ese dúo todavía no tiene suplente'; end if;
   if exists(select 1 from public.js_liga_matches where season_id=season.id
     and state in('pending','playing','review') and team.id in(team_a,team_b)) then
     raise exception 'No podés modificar el suplente durante un PvP activo';
   end if;
   if p_accion='remove_sub' then
     update public.js_liga_teams set substitute=null,replaced=null where id=team.id;
   elsif p_accion='deactivate_sub' then
     update public.js_liga_teams set replaced=null where id=team.id;
   else
     v_target:=(p_datos->>'user_id')::uuid;
     if v_target is null or v_target not in(team.captain,team.partner) then
       raise exception 'Seleccioná un titular de TU dúo para reemplazar';
     end if;
     update public.js_liga_teams set replaced=v_target where id=team.id;
   end if;
   return jsonb_build_object('ok',true,'message','Alineación actualizada para los próximos PvP');
 end if;
 if p_accion='challenge' then
   v_team_id:=(p_datos->>'team_id')::uuid;
   select * into team from public.js_liga_teams where archived_at is null and  season_id=season.id and u in(captain,partner,substitute) limit 1;
   select * into other from public.js_liga_teams where archived_at is null and  id=v_team_id and season_id=season.id;
   if team.id is null or other.id is null then raise exception 'Necesitás un dúo y un rival registrados'; end if;
   if team.id=other.id then raise exception 'No podés desafiar a tu propio dúo'; end if;
   v_la:=array[team.captain,team.partner];
   if team.replaced=team.captain then v_la[1]:=team.substitute;
   elsif team.replaced=team.partner then v_la[2]:=team.substitute; end if;
   v_lb:=array[other.captain,other.partner];
   if other.replaced=other.captain then v_lb[1]:=other.substitute;
   elsif other.replaced=other.partner then v_lb[2]:=other.substitute; end if;
   if u <> all(v_la) then raise exception 'Tu lugar está ocupado por el suplente'; end if;
   v_players:=v_la || v_lb;
   if array_position(v_players,null) is not null or
      (select count(distinct x) from unnest(v_players) x)<>4 then
      raise exception 'Los cuatro jugadores deben ser distintos';
   end if;
   select array_agg(distinct region) into v_regions from public.js_player_profiles
      where user_id=any(v_players) and verified_at is not null and region in('SAC','NA','US');
   if coalesce(array_length(v_regions,1),0)<>1 or
     (select count(*) from public.js_player_profiles
        where user_id=any(v_players) and verified_at is not null and region in('SAC','NA','US'))<>4 then
      raise exception 'Los cuatro jugadores necesitan la misma región verificada';
   end if;
   if (select count(distinct game_id) from public.js_player_profiles where user_id=any(v_players))<>4 then
     raise exception 'Hay IDs de Free Fire duplicados en los equipos';
   end if;
   if exists(select 1 from public.js_liga_matches m
      where m.season_id=season.id and m.state in('pending','playing','review')
      and (m.team_a in(team.id,other.id) or m.team_b in(team.id,other.id))) then
      raise exception 'Uno de los dúos tiene un PvP pendiente de terminar';
   end if;
   select count(*),max(decided_at) into v_count,v_last from public.js_liga_matches
    where season_id=season.id and state='complete'
      and ((team_a=team.id and team_b=other.id) or (team_b=team.id and team_a=other.id));
   if v_count>=3 then raise exception 'Estos dúos ya se enfrentaron tres veces esta temporada'; end if;
   if v_count>0 then
     select count(distinct case when team_a=team.id then team_b else team_a end)
       into v_count2 from public.js_liga_matches
       where season_id=season.id and state='complete' and decided_at>v_last
        and (team_a=team.id or team_b=team.id) and team.id not in(team_a,team_b) is false
        and other.id not in(team_a,team_b);
     if v_count2<1 then
       raise exception 'Tu dúo debe completar un PvP contra otro rival antes de repetir';
     end if;
     select count(distinct case when team_a=other.id then team_b else team_a end)
       into v_count2 from public.js_liga_matches
       where season_id=season.id and state='complete' and decided_at>v_last
        and (team_a=other.id or team_b=other.id) and team.id not in(team_a,team_b);
     if v_count2<1 then
       raise exception 'El dúo rival debe completar un PvP contra otro equipo antes de repetir';
     end if;
   end if;
   insert into public.js_liga_matches(season_id,team_a,team_b,lineup_a,lineup_b)
     values(season.id,team.id,other.id,v_la,v_lb) returning * into duel;
   insert into public.js_liga_match_votes(match_id,user_id,accepted)
     values(duel.id,u,true);
   return jsonb_build_object('ok',true,'message','Desafío enviado. Los otros 3 jugadores tienen 2 minutos para aceptar.','match_id',duel.id);
 end if;
 if p_accion in('accept_match','reject_match','result') then
   v_match_id:=(p_datos->>'match_id')::bigint;
   select * into duel from public.js_liga_matches where id=v_match_id
     and season_id=season.id for update;
   if duel.id is null then raise exception 'No existe ese PvP de la temporada'; end if;
   if not (u=any(duel.lineup_a) or u=any(duel.lineup_b)) then
     raise exception 'No participás en este enfrentamiento';
   end if;
   if p_accion in('accept_match','reject_match') then
     if duel.state<>'pending' or duel.accept_until<=now() then
       raise exception 'Este desafío ya no está pendiente de aceptación';
     end if;
     if exists(select 1 from public.js_liga_match_votes where match_id=duel.id and user_id=u) then
       raise exception 'Ya respondiste a este desafío';
     end if;
     if p_accion='reject_match' then
       update public.js_liga_matches set state='cancelled' where id=duel.id;
       return jsonb_build_object('ok',true,'message','Desafío rechazado. No se otorgaron puntos.');
     end if;
     insert into public.js_liga_match_votes(match_id,user_id,accepted) values(duel.id,u,true);
     select count(*) into v_count from public.js_liga_match_votes
       where match_id=duel.id and accepted=true;
     if v_count=4 then
       update public.js_liga_matches set state='playing',started_at=now(),
         result_until=now()+interval '20 minutes' where id=duel.id;
     end if;
     return jsonb_build_object('ok',true,'message',
       case when v_count=4 then '¡Los cuatro aceptaron! Creen la sala, jueguen y confirmen resultados.'
            else 'Confirmado ('||v_count||'/4). Esperando al resto.' end);
   end if;
   if duel.state<>'playing' then
     raise exception 'Este PvP no está jugando. Si está en revisión, debe resolverlo JS';
   end if;
   v_value:=p_datos->>'result';
   if v_value not in('win','loss') then raise exception 'Seleccioná Gané o Perdí'; end if;
   update public.js_liga_match_votes set result=v_value,updated_at=now()
     where match_id=duel.id and user_id=u and accepted=true and result is null;
   get diagnostics v_count=row_count;
   if v_count<>1 then raise exception 'Ya informaste tu resultado'; end if;
   select
    count(*) filter(where user_id=any(duel.lineup_a) and result='win'),
    count(*) filter(where user_id=any(duel.lineup_a) and result='loss'),
    count(*) filter(where user_id=any(duel.lineup_b) and result='win'),
    count(*) filter(where user_id=any(duel.lineup_b) and result='loss')
   into v_a_win,v_a_loss,v_b_win,v_b_loss
   from public.js_liga_match_votes where match_id=duel.id;
   if (v_a_win>0 and v_a_loss>0) or (v_b_win>0 and v_b_loss>0)
      or (v_a_win>0 and v_b_win>0) or (v_a_loss>0 and v_b_loss>0) then
     update public.js_liga_matches set state='review' where id=duel.id;
     return jsonb_build_object('ok',true,'message','Resultados contradictorios. JS revisará este PvP; nadie recibió puntos.');
   end if;
   if (v_a_win+v_a_loss=0) or (v_b_win+v_b_loss=0) then
     return jsonb_build_object('ok',true,'message',
       'Resultado guardado para tu dúo. Falta que al menos un jugador del dúo contrario confirme el resultado.');
   end if;
   if v_a_win>=1 and v_b_loss>=1 then v_winner:=duel.team_a;
   elsif v_b_win>=1 and v_a_loss>=1 then v_winner:=duel.team_b;
   else
     update public.js_liga_matches set state='review' where id=duel.id;
     return jsonb_build_object('ok',true,'message','Resultado en revisión; sin puntos');
   end if;
   update public.js_liga_matches set state='complete',winner=v_winner,decided_at=now() where id=duel.id;
   update public.js_liga_teams set wins=wins+1 where id=v_winner;
   update public.js_liga_teams set losses=losses+1
     where id=case when v_winner=duel.team_a then duel.team_b else duel.team_a end;
   return jsonb_build_object('ok',true,'message','¡PvP confirmado por los dos equipos! Un resultado por dúo fue suficiente. Se actualizó el ranking.');
 end if;
 if p_accion in('admin_resolve','admin_cancel') then
   -- Older APKs/web caches can still resolve old/expired games via the
   -- audited correction path. Score reversals are never duplicated.
   return public.js_liga_admin_arbitrar(
     case when p_accion='admin_resolve' then 'resolve' else 'cancel' end,
     (p_datos->>'match_id')::bigint,
     p_datos->>'side',null,null,null,gen_random_uuid(),
     'Resolución mediante cliente anterior'
   );
 end if;
 raise exception 'Acción desconocida de Liga JS Family';
end
$function$;

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
 select
  (case when exists(select 1 from public.js_liga_ready v
     where v.match_id=p_match_id and v.ready=true
       and v.user_id=any(match_data.lineup_a)) then 1 else 0 end)+
  (case when exists(select 1 from public.js_liga_ready v
     where v.match_id=p_match_id and v.ready=true
       and v.user_id=any(match_data.lineup_b)) then 1 else 0 end)
 into ready_total;
 select coalesce(jsonb_agg(jsonb_build_object(
    'user_id',a.user_id,'ready',coalesce(r.ready,false)
  ) order by a.ord),'[]'::jsonb) into statuses
 from unnest(lineup) with ordinality a(user_id,ord)
 left join public.js_liga_ready r on r.match_id=p_match_id and r.user_id=a.user_id;
 return jsonb_build_object('ok',true,'match_id',p_match_id,'ready_count',ready_total,
  'everyone_ready',ready_total=2,'players',statuses,
  'message',case when ready_total=2 then '✅ ¡Ambos dúos están listos! Un representante por equipo confirmó.'
   else ready_total||'/2 dúos listos. Falta que el otro equipo confirme.' end);
end
$function$;

CREATE OR REPLACE FUNCTION public.js_liga_estado()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 v_user uuid := auth.uid();
 v_season public.js_liga_seasons%rowtype;
 v_teams jsonb := '[]'::jsonb;
 v_players jsonb := '[]'::jsonb;
 v_matches jsonb := '[]'::jsonb;
 v_invites jsonb := '[]'::jsonb;
 v_hist jsonb := '[]'::jsonb;
 v_admin boolean := false;
begin
 if v_user is null then
   raise exception 'Iniciá sesión con tu cuenta JS Torneos' using errcode='42501';
 end if;
 select exists(select 1 from public.js_admins where uid=v_user) into v_admin;
 select * into v_season from public.js_liga_seasons
  where state='active' order by id desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.user_id,'name',left(coalesce(nullif(p.display_name,''),p.nickname),80),
    'region',p.region
  ) order by p.nickname), '[]'::jsonb)
 into v_players
 from public.js_player_profiles p where p.verified_at is not null;
 if v_season.id is not null then
   select coalesce(jsonb_agg(jsonb_build_object(
     'id',t.id,'captain',t.captain,'partner',t.partner,
     'substitute',t.substitute,'replaced',t.replaced,
     'wins',t.wins,'losses',t.losses,'created',t.created_at,'archived',t.archived_at is not null)
     order by t.wins desc,t.losses,t.created_at), '[]'::jsonb)
   into v_teams from public.js_liga_teams t where t.season_id=v_season.id;
   select coalesce(jsonb_agg(jsonb_build_object(
     'id',m.id,'a',m.team_a,'b',m.team_b,'lineup_a',m.lineup_a,'lineup_b',m.lineup_b,
     'state',case
       when m.state='pending' and m.accept_until<now() then 'expired'

       else m.state end,
     'created',m.created_at,'started_at',m.started_at,'accept_until',m.accept_until,
     'result_until',m.result_until,'winner',m.winner,
     'confirmed',(select count(*) from public.js_liga_match_votes v where v.match_id=m.id and v.accepted=true),
     'reported',(
       (case when exists(select 1 from public.js_liga_match_votes v
         where v.match_id=m.id and v.result is not null and v.user_id=any(m.lineup_a))
           then 1 else 0 end)+
       (case when exists(select 1 from public.js_liga_match_votes v
         where v.match_id=m.id and v.result is not null and v.user_id=any(m.lineup_b))
           then 1 else 0 end)
     ),
     'result_details',(
      select coalesce(jsonb_agg(jsonb_build_object('user_id',u.user_id,
       'result',v.result) order by u.ord),'[]'::jsonb)
      from unnest(coalesce(m.lineup_a,'{}'::uuid[])||coalesce(m.lineup_b,'{}'::uuid[]))
        with ordinality as u(user_id,ord)
      left join public.js_liga_match_votes v on v.match_id=m.id and v.user_id=u.user_id
     ),
     'my_vote',(select jsonb_build_object('accepted',v.accepted,'result',v.result)
                from public.js_liga_match_votes v where v.match_id=m.id and v.user_id=v_user),
     'acceptances',(
       select coalesce(jsonb_agg(
         jsonb_build_object(
           'user_id',participant.user_id,
           'accepted',coalesce(votes.accepted,false),
           'status',case
             when votes.accepted is true then 'accepted'
             when votes.accepted is false then 'rejected'
             else 'pending' end
         )
         order by participant.ordinality
       ),'[]'::jsonb)
       from unnest(coalesce(m.lineup_a,'{}'::uuid[]) || coalesce(m.lineup_b,'{}'::uuid[]))
          with ordinality as participant(user_id,ordinality)
       left join public.js_liga_match_votes votes
         on votes.match_id=m.id and votes.user_id=participant.user_id
     )
   ) order by m.created_at desc), '[]'::jsonb) into v_matches
   from (
     select * from public.js_liga_matches m0
     where m0.season_id=v_season.id
       and (
         -- New invitations remain visible ONLY during their 2-minute period
         -- so the other three participants can still accept or reject.
         (m0.state='pending' and m0.accept_until>now())
         or
         -- Only fully approved and actually started games belong to the
         -- official results/history, including old reviewed games.
         (m0.started_at is not null
           and (select count(*) from public.js_liga_match_votes v0
                where v0.match_id=m0.id and v0.accepted=true)=4)
       )
     order by m0.id desc limit 80
   ) m;
   select coalesce(jsonb_agg(jsonb_build_object(
    'id',i.id,'kind',i.kind,'from_user',i.from_user,'to_user',i.to_user,
    'team_id',i.team_id,'expires_at',i.expires_at
   ) order by i.created_at desc),'[]'::jsonb) into v_invites
   from public.js_liga_invites i where i.season_id=v_season.id and
   i.state='pending' and i.expires_at>now() and (i.from_user=v_user or i.to_user=v_user);
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',h.id,'prize',h.prize,'champion',h.champion,'finished_at',h.finished_at
 ) order by h.id desc),'[]'::jsonb) into v_hist
 from (select * from public.js_liga_seasons where state='finished' order by id desc limit 8) h;
 return jsonb_build_object(
    'ok',true,'user',v_user,'admin',v_admin,
   'paused',case when v_season.id is null then false else
      coalesce((select c.paused from public.js_liga_control c
      where c.season_id=v_season.id),false) end,
   'season',case when v_season.id is null then null else
     jsonb_build_object('id',v_season.id,'state',v_season.state,'prize',v_season.prize,
       'started',v_season.created_at) end,
   'players',v_players,'teams',v_teams,'matches',v_matches,
   'invites',v_invites,'history',v_hist
 );
end
$function$;

CREATE OR REPLACE FUNCTION public.js_liga_wa_accion(p_token text, p_jid text, p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target_uid uuid;
  original_claim text:=current_setting('request.jwt.claim.sub',true);
  target_season_id bigint;
  current_team public.js_liga_teams%rowtype;
  current_match public.js_liga_matches%rowtype;
  queue_data jsonb;
  result jsonb;
  extra jsonb;
  room_id text;
  password text;
  actor_side text;
  actor_name text;
  teammate_name text;
  rival_names text;
  linked boolean;
begin
 if not public.js_liga_wa_authorize(p_token) then
   raise exception 'Acceso denegado' using errcode='42501';end if;
 if p_jid is null or p_jid !~ '^[0-9]{6,20}@(s\.whatsapp\.net|lid)$' then
   raise exception 'WhatsApp inválido' using errcode='42501';end if;
 if p_action not in ('status','search','leave','result_win','result_loss',
                     'accept','reject','room_save','room_get','room_clear',
                     'ready','unready') then
   raise exception 'Comando de Liga 2VS2 no reconocido';end if;
 select x.user_id into target_uid from public.js_liga_wa_links x
 where x.jid=p_jid;
 if target_uid is null then
   return jsonb_build_object('ok',false,'need_link',true,
    'message','🔗 Primero vinculá tu cuenta desde la web: Liga → Más → Perfil dúo → Vincular WhatsApp. Después enviá .liga2 vincular CODIGO acá.');
 end if;
 perform set_config('request.jwt.claim.sub',target_uid::text,true);
 select s.id into target_season_id from public.js_liga_seasons s
 where s.state='active' order by s.id desc limit 1;
 if target_season_id is null then
   perform set_config('request.jwt.claim.sub',coalesce(original_claim,''),true);
   return jsonb_build_object('ok',false,'message',
      'JS todavía no abrió una temporada de Liga 2VS2.');
 end if;
 select * into current_team from public.js_liga_teams t where t.archived_at is null and  t.season_id=target_season_id and
   target_uid in(t.captain,t.partner,t.substitute)
 order by t.created_at limit 1;
 select left(coalesce(nullif(p.nickname,''),nullif(p.display_name,''),'Jugador'),70)
   into actor_name from public.js_player_profiles p where p.user_id=target_uid;
 if current_team.id is not null then
   select * into current_match from public.js_liga_matches m
   where m.season_id=target_season_id
    and (target_uid=any(m.lineup_a) or target_uid=any(m.lineup_b))
    and (p_action='status' or coalesce(p_data->>'match_id','')='' or m.id::text=p_data->>'match_id')
    and (m.state in('playing','review') or
        (m.state='pending' and m.accept_until>now()))
   order by case when m.state='playing' then 0
      when m.state='pending' then 1 else 2 end,m.id desc limit 1;
 end if;
 if p_action='status' then
   if current_team.id is not null then
      queue_data:=public.js_liga_busqueda('status');
   else
      queue_data:='{}'::jsonb;
   end if;
   result:=jsonb_build_object('ok',true,'user_id',target_uid,
      'nickname',actor_name,'team_id',current_team.id,
      'has_team',current_team.id is not null,
      'match',case when current_match.id is null then null else
         jsonb_build_object('id',current_match.id,'state',current_match.state,
          'accepted',(select count(*) from public.js_liga_match_votes v
            where v.match_id=current_match.id and v.accepted=true),
          'reported',(
    (case when exists(select 1 from public.js_liga_match_votes v
       where v.match_id=current_match.id and v.result is not null and v.user_id=any(current_match.lineup_a))
       then 1 else 0 end)+
    (case when exists(select 1 from public.js_liga_match_votes v
       where v.match_id=current_match.id and v.result is not null and v.user_id=any(current_match.lineup_b))
       then 1 else 0 end)
   ),
          'my_result',(select v.result from public.js_liga_match_votes v
             where v.match_id=current_match.id and v.user_id=target_uid),
          'accept_until',current_match.accept_until,'started_at',current_match.started_at)
        end,
      'queue',queue_data,
      'message',case when current_team.id is null then
       'Aún no pertenecés a un dúo 2VS2. Formá uno desde jstorneos.com/liga.html.'
       when current_match.id is not null then
       'Tenés el PvP #'||current_match.id||' en estado '||current_match.state||'.'
       when coalesce((queue_data->>'my_ready')::boolean,false) then
       'Estás en la búsqueda 2VS2. Esperando rival; el bot mantendrá tu confirmación mientras siga activa.'
       else 'Tu dúo puede buscar rival con .liga2 buscar. Con que uno de los dos busque rival alcanza.' end);
 elsif p_action='search' then
   if current_team.id is null then
     raise exception 'Primero necesitás un dúo registrado en JS Torneos.';
   end if;
   queue_data:=public.js_liga_busqueda('join');
   if coalesce((queue_data->>'matched')::boolean,false) then
      delete from public.js_liga_wa_search
       where user_id=target_uid;
   else
      insert into public.js_liga_wa_search(user_id,expires_at)
      values(target_uid,now()+interval '12 minutes')
      on conflict(user_id) do update set expires_at=excluded.expires_at;
   end if;
   result:=queue_data||jsonb_build_object('ok',true,'action','search',
     'message',coalesce(queue_data->>'message','Buscando rival 2VS2…')||
       case when coalesce((queue_data->>'matched')::boolean,false)
            then '' else ' El bot mantendrá tu búsqueda hasta 12 minutos.' end);
 elsif p_action='leave' then
   if current_team.id is null then
      delete from public.js_liga_wa_search where user_id=target_uid;
      result:=jsonb_build_object('ok',true,'message','Saliste de la búsqueda 2VS2.');
   else
      queue_data:=public.js_liga_busqueda('leave');
      delete from public.js_liga_wa_search
        where user_id in(current_team.captain,current_team.partner,current_team.substitute);
      result:=queue_data||jsonb_build_object('ok',true,'message',
          'Búsqueda cancelada para los dos integrantes del dúo.');
   end if;
 else
   if current_match.id is null then
      raise exception 'No tenés un PvP 2VS2 en curso. Usá .liga2 buscar o consultá .liga2 mio.';
   end if;
   if p_action in('result_win','result_loss') then
     result:=public.js_liga_accion('result',
      jsonb_build_object('match_id',current_match.id,
         'result',case when p_action='result_win' then 'win' else 'loss' end));
     result:=result||jsonb_build_object('match_id',current_match.id);
   elsif p_action in('accept','reject') then
     result:=public.js_liga_accion(
       case when p_action='accept' then 'accept_match' else 'reject_match' end,
       jsonb_build_object('match_id',current_match.id));
     result:=result||jsonb_build_object('match_id',current_match.id);
   elsif p_action in('ready','unready') then
     result:=public.js_liga_espera(p_action,current_match.id);
   elsif p_action in('room_save','room_get','room_clear') then
     room_id:=trim(coalesce(p_data->>'room_id',''));
     password:=coalesce(p_data->>'password','');
     result:=public.js_liga_sala(
       case when p_action='room_save' then 'save'
            when p_action='room_clear' then 'clear' else 'get' end,
       current_match.id,
       case when p_action='room_save' then room_id else null end,
       case when p_action='room_save' then password else null end);
     result:=result||jsonb_build_object('match_id',current_match.id);
   end if;
 end if;
 perform set_config('request.jwt.claim.sub',coalesce(original_claim,''),true);
 return result;
end
$function$;

CREATE OR REPLACE FUNCTION public.js_liga_wa_mios(p_token text, p_jid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target_uid uuid;
  active_season bigint;
  total_matches integer:=0;
  items jsonb:='[]'::jsonb;
begin
  if not public.js_liga_wa_authorize(p_token) then
    raise exception 'Acceso denegado' using errcode='42501';
  end if;
  if p_jid is null or p_jid !~ '^[0-9]{6,20}@(s\.whatsapp\.net|lid)$' then
    raise exception 'Identidad de WhatsApp inválida' using errcode='42501';
  end if;
  select l.user_id into target_uid from public.js_liga_wa_links l where l.jid=p_jid;
  if target_uid is null then
    return jsonb_build_object('ok',false,'need_link',true,
      'message','Vinculá primero tu WhatsApp con JS Torneos.');
  end if;
  select s.id into active_season from public.js_liga_seasons s
    where s.state='active' order by s.id desc limit 1;
  if active_season is null then
    return jsonb_build_object('ok',true,'total',0,'matches','[]'::jsonb);
  end if;
  select count(*) into total_matches from public.js_liga_matches m
    where m.season_id=active_season
      and (target_uid=any(m.lineup_a) or target_uid=any(m.lineup_b))
      and (m.state in ('playing','review') or
           (m.state='pending' and m.accept_until>now()));
  select coalesce(jsonb_agg(q.item order by q.sort_order,q.id desc),'[]'::jsonb)
    into items
  from (
    select m.id,
      case when m.state='pending' and not coalesce(
        (select v.accepted from public.js_liga_match_votes v
          where v.match_id=m.id and v.user_id=target_uid),false) then 0
        when m.state='playing' then 1
        when m.state='pending' then 2
        else 3 end as sort_order,
      jsonb_build_object(
        'id',m.id,'state',m.state,
        'opponents',coalesce((
           select string_agg(left(coalesce(nullif(p.nickname,''),
             nullif(p.display_name,''),'Jugador'),34),' + ' order by z.pos)
           from unnest(case when target_uid=any(m.lineup_a)
              then m.lineup_b else m.lineup_a end)
                with ordinality as z(member,pos)
           left join public.js_player_profiles p on p.user_id=z.member
        ),'Dúo rival'),
        'accepted',(select count(*) from public.js_liga_match_votes v
           where v.match_id=m.id and v.accepted=true),
        'reported',(
    (case when exists(select 1 from public.js_liga_match_votes v
       where v.match_id=m.id and v.result is not null and v.user_id=any(m.lineup_a))
       then 1 else 0 end)+
    (case when exists(select 1 from public.js_liga_match_votes v
       where v.match_id=m.id and v.result is not null and v.user_id=any(m.lineup_b))
       then 1 else 0 end)
   ),
        'my_accepted',coalesce((select v.accepted from public.js_liga_match_votes v
           where v.match_id=m.id and v.user_id=target_uid),false),
        'my_result',(select v.result from public.js_liga_match_votes v
           where v.match_id=m.id and v.user_id=target_uid),
        'accept_until',m.accept_until
      ) as item
    from public.js_liga_matches m
    where m.season_id=active_season
      and (target_uid=any(m.lineup_a) or target_uid=any(m.lineup_b))
      and (m.state in ('playing','review') or
           (m.state='pending' and m.accept_until>now()))
    order by sort_order,m.id desc
    limit 40
  ) q;
  return jsonb_build_object('ok',true,'total',total_matches,'matches',items);
end
$function$;
COMMIT;
