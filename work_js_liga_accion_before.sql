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
     if v_count2<2 then
       raise exception 'Tu dúo debe jugar contra otros dos rivales distintos antes de repetir';
     end if;
     select count(distinct case when team_a=other.id then team_b else team_a end)
       into v_count2 from public.js_liga_matches
       where season_id=season.id and state='complete' and decided_at>v_last
        and (team_a=other.id or team_b=other.id) and team.id not in(team_a,team_b);
     if v_count2<2 then
       raise exception 'El dúo rival debe jugar contra otros dos equipos distintos antes de repetir';
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
   if v_a_win+v_a_loss+v_b_win+v_b_loss<4 then
     return jsonb_build_object('ok',true,'message',
       'Resultado guardado ('||(v_a_win+v_a_loss+v_b_win+v_b_loss)||'/4). Sin puntos hasta que todos confirmen.');
   end if;
   if v_a_win=2 and v_b_loss=2 then v_winner:=duel.team_a;
   elsif v_b_win=2 and v_a_loss=2 then v_winner:=duel.team_b;
   else
     update public.js_liga_matches set state='review' where id=duel.id;
     return jsonb_build_object('ok',true,'message','Resultado en revisión; sin puntos');
   end if;
   update public.js_liga_matches set state='complete',winner=v_winner,decided_at=now() where id=duel.id;
   update public.js_liga_teams set wins=wins+1 where id=v_winner;
   update public.js_liga_teams set losses=losses+1
     where id=case when v_winner=duel.team_a then duel.team_b else duel.team_a end;
   return jsonb_build_object('ok',true,'message','¡PvP confirmado por los cuatro! Se actualizó el ranking.');
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
$function$
