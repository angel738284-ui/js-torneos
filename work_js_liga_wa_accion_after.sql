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
$function$
