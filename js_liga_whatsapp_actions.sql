
-- All WhatsApp actions reuse the SAME web league rules, votes and scores.
-- A signed-in user must explicitly bind their WhatsApp JID with a one-time code.
create or replace function public.js_liga_wa_accion(
 p_token text,p_jid text,p_action text,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
  target_uid uuid;
  original_claim text:=current_setting('request.jwt.claim.sub',true);
  season_id bigint;
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
 select s.id into season_id from public.js_liga_seasons s
 where s.state='active' order by s.id desc limit 1;
 if season_id is null then
   perform set_config('request.jwt.claim.sub',coalesce(original_claim,''),true);
   return jsonb_build_object('ok',false,'message',
      'JS todavía no abrió una temporada de Liga 2VS2.');
 end if;
 select * into current_team from public.js_liga_teams t
 where t.season_id=season_id and
   target_uid in(t.captain,t.partner,t.substitute)
 order by t.created_at limit 1;
 select left(coalesce(nullif(p.nickname,''),nullif(p.display_name,''),'Jugador'),70)
   into actor_name from public.js_player_profiles p where p.user_id=target_uid;
 if current_team.id is not null then
   select * into current_match from public.js_liga_matches m
   where m.season_id=season_id
    and (target_uid=any(m.lineup_a) or target_uid=any(m.lineup_b))
    -- If several invites exist, act ONLY on the PvP number the player chose.
    and (p_action='status' or coalesce(p_data->>'match_id','')='' or
         m.id::text=p_data->>'match_id')
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
          'reported',(select count(*) from public.js_liga_match_votes v
            where v.match_id=current_match.id and v.result is not null),
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
       else 'Tu dúo puede buscar rival con .liga2 buscar. Los dos integrantes deben confirmar.' end);
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
$fn$;
revoke all on function public.js_liga_wa_accion(text,text,text,jsonb) from public,authenticated;
grant execute on function public.js_liga_wa_accion(text,text,text,jsonb) to anon,service_role;

-- One-time WhatsApp searches stay active for 12 minutes, with individual
-- approvals extended every scheduler tick. Reuses web matchmaking exactly.
create or replace function public.js_liga_wa_tick(
 p_token text,p_limit int default 30)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
  original_claim text:=current_setting('request.jwt.claim.sub',true);
  searcher record;
  response jsonb;
  processed int:=0;
  matched int:=0;
begin
 if not public.js_liga_wa_authorize(p_token) then
  raise exception 'Acceso denegado' using errcode='42501';end if;
 delete from public.js_liga_wa_search where expires_at<=now();
 for searcher in
   select s.user_id,s.expires_at from public.js_liga_wa_search s
   where s.expires_at>now()
   and exists(select 1 from public.js_liga_wa_links l where l.user_id=s.user_id)
   order by s.created_at limit greatest(1,least(coalesce(p_limit,30),40))
 loop
   processed:=processed+1;
   perform set_config('request.jwt.claim.sub',searcher.user_id::text,true);
   begin
     response:=public.js_liga_busqueda('join');
     if coalesce((response->>'matched')::boolean,false) then
       matched:=matched+1;
       delete from public.js_liga_wa_search where user_id=searcher.user_id;
     end if;
   exception when others then
     -- Pause, retired duo, active match, invalid region, etc.
     -- Stop the old search; participants can start again once eligible.
     delete from public.js_liga_wa_search where user_id=searcher.user_id;
   end;
 end loop;
 perform set_config('request.jwt.claim.sub',coalesce(original_claim,''),true);
 return jsonb_build_object('ok',true,'processed',processed,'matched',matched);
end
$fn$;
revoke all on function public.js_liga_wa_tick(text,integer) from public,authenticated;
grant execute on function public.js_liga_wa_tick(text,integer) to anon,service_role;
