
-- Text chat and attendance disputes are linked to a specific fully accepted PvP.
create table if not exists public.js_liga_chat(
 id bigint generated always as identity primary key,
 match_id bigint not null references public.js_liga_matches(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(length(trim(body)) between 1 and 500 and body !~ '[[:cntrl:]]'),
 created_at timestamptz not null default now()
);
create index if not exists js_liga_chat_match on public.js_liga_chat(match_id,id desc);
alter table public.js_liga_chat enable row level security;
revoke all on public.js_liga_chat from public,anon,authenticated;
grant select,insert,update,delete on public.js_liga_chat to service_role;

create table if not exists public.js_liga_reports(
 id bigint generated always as identity primary key,
 match_id bigint not null references public.js_liga_matches(id) on delete cascade,
 reporter uuid not null references auth.users(id) on delete cascade,
 target uuid references auth.users(id) on delete cascade,
 kind text not null check(kind in('absence','dispute')),
 details text not null default '' check(length(details)<=350),
 state text not null default 'open' check(state in('open','resolved')),
 resolved_by uuid references auth.users(id),
 admin_note text,
 created_at timestamptz not null default now(),
 resolved_at timestamptz
);
create unique index if not exists js_liga_report_one_each on public.js_liga_reports(match_id,reporter,kind,coalesce(target,reporter));
create index if not exists js_liga_reports_open on public.js_liga_reports(state,created_at desc);
alter table public.js_liga_reports enable row level security;
revoke all on public.js_liga_reports from public,anon,authenticated;
grant select,insert,update,delete on public.js_liga_reports to service_role;

create or replace function public.js_liga_chat_seguro(
 p_action text,p_match_id bigint,p_message text default null
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 caller uuid:=auth.uid();
 match_data public.js_liga_matches%rowtype;
 permitted boolean;
 is_admin boolean;
 item_count int;
 result jsonb;
begin
 if caller is null then raise exception 'Iniciá sesión' using errcode='42501';end if;
 if p_action not in ('get','send') then raise exception 'Acción de chat inválida';end if;
 select * into match_data from public.js_liga_matches m
 where m.id=p_match_id and m.season_id in
  (select s.id from public.js_liga_seasons s where s.state='active')
 for share;
 if match_data.id is null then raise exception 'PvP no encontrado';end if;
 select exists(select 1 from public.js_admins where uid=caller) into is_admin;
 permitted:=coalesce(caller=any(match_data.lineup_a||match_data.lineup_b),false) or is_admin;
 if not permitted then
  raise exception 'Este chat es privado para los jugadores y JS' using errcode='42501';
 end if;
 if match_data.started_at is null or
  (select count(*) from public.js_liga_match_votes v
   where v.match_id=p_match_id and v.accepted=true)<>4 then
  raise exception 'El chat se habilita cuando aceptan los cuatro';
 end if;
 if p_action='send' then
  if match_data.state not in('playing','review') then
   raise exception 'El chat del PvP ya está cerrado';
  end if;
  if p_message is null or length(trim(p_message)) not between 1 and 500
     or p_message ~ '[[:cntrl:]]' then
   raise exception 'Escribí un mensaje de 1 a 500 caracteres, sin saltos de línea';
  end if;
  if exists(select 1 from public.js_liga_chat c
    where c.match_id=p_match_id and c.user_id=caller
     and c.created_at>now()-interval '3 seconds') then
    raise exception 'Esperá unos segundos antes de mandar otro mensaje';
  end if;
  select count(*) into item_count from public.js_liga_chat
   where match_id=p_match_id and user_id=caller and created_at>now()-interval '10 minutes';
  if item_count>=25 then raise exception 'Límite del chat: 25 mensajes cada 10 minutos';end if;
  insert into public.js_liga_chat(match_id,user_id,body)
   values(p_match_id,caller,trim(p_message));
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'user_id',c.user_id,'body',c.body,'created_at',c.created_at
   ) order by c.id),'[]'::jsonb) into result
 from (select * from public.js_liga_chat where match_id=p_match_id order by id desc limit 40)c;
 return jsonb_build_object('ok',true,'messages',result);
end $fn$;
revoke all on function public.js_liga_chat_seguro(text,bigint,text) from public,anon;
grant execute on function public.js_liga_chat_seguro(text,bigint,text) to authenticated;

create or replace function public.js_liga_incidencias(
 p_action text,p_match_id bigint default null,p_target uuid default null,
 p_details text default null,p_report_id bigint default null
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 caller uuid:=auth.uid();
 is_admin boolean;
 m public.js_liga_matches%rowtype;
 kind text;
 items jsonb;
begin
 if caller is null then raise exception 'Iniciá sesión' using errcode='42501';end if;
 if p_action not in('report_absence','report_dispute','get','list','resolve') then
  raise exception 'Acción de reporte inválida';
 end if;
 select exists(select 1 from public.js_admins where uid=caller) into is_admin;
 if p_action in('list','resolve') then
  if not is_admin then raise exception 'Solo JS puede gestionar las denuncias' using errcode='42501';end if;
  if p_action='resolve' then
   update public.js_liga_reports r set state='resolved',resolved_by=caller,
    resolved_at=now(),admin_note=left(trim(coalesce(p_details,'')),250)
   where r.id=p_report_id and r.state='open'
     and r.match_id in(select x.id from public.js_liga_matches x
      join public.js_liga_seasons s on s.id=x.season_id where s.state='active');
   if not found then raise exception 'No se encontró ese reporte pendiente';end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'match_id',r.match_id,
   'reporter',r.reporter,'target',r.target,'kind',r.kind,
   'details',r.details,'state',r.state,'admin_note',r.admin_note,
   'created_at',r.created_at) order by r.id desc),'[]'::jsonb)
  into items
  from (select r.* from public.js_liga_reports r
    join public.js_liga_matches x on x.id=r.match_id
    join public.js_liga_seasons s on s.id=x.season_id
    where s.state='active' order by r.id desc limit 80)r;
  return jsonb_build_object('ok',true,'reports',items);
 end if;
 select * into m from public.js_liga_matches x where x.id=p_match_id
  and x.season_id in(select id from public.js_liga_seasons where state='active');
 if m.id is null then raise exception 'PvP no encontrado';end if;
 if not is_admin and not coalesce(caller=any(m.lineup_a||m.lineup_b),false) then
  raise exception 'Solo quienes participaron pueden reportar este PvP' using errcode='42501';end if;
 if p_action in('report_absence','report_dispute') then
  if m.started_at is null or
   (select count(*) from public.js_liga_match_votes v where v.match_id=m.id and v.accepted=true)<>4 then
   raise exception 'Solo se puede reportar un PvP aceptado por los cuatro';
  end if;
  kind:=case when p_action='report_absence' then 'absence' else 'dispute' end;
  if p_action='report_absence' and (p_target is null or p_target=caller
    or not p_target=any(m.lineup_a||m.lineup_b)) then
   raise exception 'Seleccioná a otro jugador del mismo PvP para reportar la ausencia';
  end if;
  if p_details is null or length(trim(p_details)) not between 5 and 350 then
   raise exception 'Explicá lo que ocurrió en 5 a 350 caracteres';
  end if;
  if m.state not in('playing','review') then
   raise exception 'No se aceptan denuncias nuevas en un PvP finalizado';
  end if;
  insert into public.js_liga_reports(match_id,reporter,target,kind,details)
  values(m.id,caller,p_target,kind,trim(p_details))
  on conflict(match_id,reporter,kind,coalesce(target,reporter))
  do nothing;
  -- Reporting sends a case to JS, but never awards a victory automatically.
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'reporter',r.reporter,
  'target',r.target,'kind',r.kind,'details',r.details,'state',r.state,
  'created_at',r.created_at) order by r.id desc),'[]'::jsonb)
 into items from public.js_liga_reports r where r.match_id=m.id;
 return jsonb_build_object('ok',true,'reports',items,
  'message',case when p_action='get' then 'Reportes del PvP'
   else 'Tu reporte quedó registrado para que JS lo revise. No se dieron puntos automáticamente.' end);
end $fn$;
revoke all on function public.js_liga_incidencias(text,bigint,uuid,text,bigint) from public,anon;
grant execute on function public.js_liga_incidencias(text,bigint,uuid,text,bigint) to authenticated;
