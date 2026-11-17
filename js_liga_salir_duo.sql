-- JS FAMILY · Salida voluntaria de dúo 2VS2.
-- Conserva historial/ranking individual, libera jugadores y evita salidas con PvP abiertos.
-- Ejecutar como propietario de la BD; no expone privilegios de servicio al navegador.
begin;

alter table public.js_liga_teams
  add column if not exists archived_at timestamptz;

create index if not exists js_liga_teams_active_season_idx
  on public.js_liga_teams(season_id) where archived_at is null;

-- Las funciones existentes deben ignorar equipos archivados al buscar miembro o rival.
-- Se conservan esas filas en el estado, marcadas como archived, para la historia.
do $update_existing$
declare
  fn text;
  body text;
  changes integer;
begin
  foreach fn in array array[
    'js_liga_accion', 'js_liga_busqueda', 'js_liga_duo_perfil',
    'js_liga_duo_privacidad', 'js_liga_wa_accion'
  ] loop
    select pg_get_functiondef(p.oid) into body
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=fn and p.prokind='f';
    if body is null then raise exception 'Falta función %', fn; end if;

    -- Selecciones de equipo con y sin alias.
    select count(*) into changes from regexp_matches(body,
      'from public[.]js_liga_teams[[:space:]]+where','gi');
    if fn='js_liga_accion' and changes<>11 then
      raise exception 'Versión inesperada de %: % búsquedas',fn,changes;
    end if;
    if fn='js_liga_busqueda' and changes<>1 then
      raise exception 'Versión inesperada de %: % búsquedas',fn,changes;
    end if;
    body:=regexp_replace(body,
      'from public[.]js_liga_teams[[:space:]]+where',
      'from public.js_liga_teams where archived_at is null and ','gi');

    if fn<>'js_liga_accion' then
      select count(*) into changes from regexp_matches(body,
        'from public[.]js_liga_teams t[[:space:]]+where','gi');
      if changes<>1 then
        raise exception 'Versión inesperada de %: % alias',fn,changes;
      end if;
      body:=regexp_replace(body,
        'from public[.]js_liga_teams t[[:space:]]+where',
        'from public.js_liga_teams t where t.archived_at is null and ','gi');
    end if;
    if fn='js_liga_busqueda' then
      if position('join public.js_liga_teams t on t.id=v.team_id' in body)=0 then
        raise exception 'Join inesperado en js_liga_busqueda';
      end if;
      body:=replace(body,
        'join public.js_liga_teams t on t.id=v.team_id',
        'join public.js_liga_teams t on t.id=v.team_id and t.archived_at is null');
    end if;
    execute body;
  end loop;

  select pg_get_functiondef('public.js_liga_estado()'::regprocedure) into body;
  if position('''wins'',t.wins,''losses'',t.losses,''created'',t.created_at)' in body)=0 then
    raise exception 'Versión inesperada de js_liga_estado';
  end if;
  body:=replace(body,
    '''wins'',t.wins,''losses'',t.losses,''created'',t.created_at)',
    '''wins'',t.wins,''losses'',t.losses,''created'',t.created_at,''archived'',t.archived_at is not null)');
  execute body;
end $update_existing$;

create or replace function public.js_liga_salir_duo()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $leave$
declare
  v_user uuid := auth.uid();
  current_season bigint;
  current_team public.js_liga_teams%rowtype;
  is_substitute boolean;
begin
  if v_user is null then
    raise exception 'Iniciá sesión para salir del dúo' using errcode='42501';
  end if;

  -- El mismo candado que usan los desafíos y las inscripciones.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('js-family-league-2vs2-v1'));

  select id into current_season from public.js_liga_seasons
   where state='active' order by id desc limit 1;
  if current_season is null then
    return jsonb_build_object('ok',false,'message','No hay una temporada activa.');
  end if;

  select * into current_team
  from public.js_liga_teams t
  where t.season_id=current_season and t.archived_at is null
    and v_user in (t.captain,t.partner,t.substitute)
  order by t.created_at desc limit 1 for update;

  if current_team.id is null then
    return jsonb_build_object('ok',false,'message','No pertenecés a un dúo activo.');
  end if;

  -- Expirar únicamente invitaciones de PvP cuyo tiempo ya terminó.
  update public.js_liga_matches m set state='expired'
  where m.season_id=current_season
    and current_team.id in (m.team_a,m.team_b)
    and m.state='pending' and m.accept_until<=now();

  if exists(select 1 from public.js_liga_matches m
    where m.season_id=current_season
      and current_team.id in (m.team_a,m.team_b)
      and m.state in ('pending','playing','review')) then
    return jsonb_build_object('ok',false,'message',
      'Tenés una invitación o un PvP pendiente, en juego o en revisión. Finalizalo o resolvelo con JS antes de salir.');
  end if;

  is_substitute := v_user=current_team.substitute;
  delete from public.js_liga_search_votes where team_id=current_team.id;

  if is_substitute then
    update public.js_liga_teams
      set substitute=null,replaced=null where id=current_team.id;
    update public.js_liga_duo_sharing set approved=false,updated_at=now()
      where team_id=current_team.id and user_id=v_user;
    update public.js_liga_invites set state='expired'
      where season_id=current_season and state='pending'
        and (from_user=v_user or to_user=v_user);
    return jsonb_build_object('ok',true,'message',
      'Saliste del dúo como suplente. Los titulares siguen juntos; ya podés recibir otra invitación.');
  end if;

  -- Nunca eliminar partidos, resultados ni el equipo histórico.
  update public.js_liga_teams
     set archived_at=now() where id=current_team.id;
  update public.js_liga_duo_sharing
     set approved=false,updated_at=now() where team_id=current_team.id;
  update public.js_liga_invites set state='expired'
     where season_id=current_season and state='pending'
       and (team_id=current_team.id or
            from_user in(current_team.captain,current_team.partner,current_team.substitute) or
            to_user in(current_team.captain,current_team.partner,current_team.substitute));

  return jsonb_build_object('ok',true,'message',
    'Saliste del dúo. El equipo anterior quedó archivado, tus partidas y resultados se conservaron y ambos jugadores pueden formar otro dúo.');
end
$leave$;

revoke all on function public.js_liga_salir_duo() from public,anon;
grant execute on function public.js_liga_salir_duo() to authenticated;

commit;
