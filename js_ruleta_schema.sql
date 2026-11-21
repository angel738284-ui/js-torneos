
create schema if not exists js_wheel;
revoke all on schema js_wheel from public, anon, authenticated;
create table if not exists js_wheel.auth (
 slot integer primary key default 1 check (slot=1),
 token_hash text not null check (length(token_hash)=64),
 created_at timestamptz not null default now()
);
insert into js_wheel.auth(slot,token_hash) values (1,'1adc4913a2f34192d47fbc1ab3b9fe1151f4160094c2ea301ea8bb683d187653')
 on conflict (slot) do update set token_hash=excluded.token_hash;
create table if not exists js_wheel.rounds (
 id uuid primary key default gen_random_uuid(),
 public_code text not null unique check (public_code ~ '^[A-F0-9]{12}$'),
 group_jid text not null,
 title text not null default 'Ruleta JS Family',
 capacity integer not null check (capacity between 2 and 100),
 state text not null default 'open' check (state in ('open','closed','spinning','finished','canceled')),
 created_at timestamptz not null default now(),
 closed_at timestamptz,
 spin_at timestamptz,
 duration_ms integer not null default 9000,
 winner_idx integer,
 announced_at timestamptz
);
create index if not exists js_wheel_group_idx on js_wheel.rounds(group_jid,created_at desc);
create unique index if not exists js_wheel_active_group_idx on js_wheel.rounds(group_jid)
 where state in ('open','closed','spinning');
create table if not exists js_wheel.entries(
 id bigint generated always as identity primary key,
 round_id uuid not null references js_wheel.rounds(id) on delete cascade,
 sender_jid text not null,
 label text not null check (char_length(label) between 2 and 42),
 joined_at timestamptz not null default now(),
 unique(round_id,sender_jid)
);
create unique index if not exists js_wheel_unique_nick_per_round on js_wheel.entries(round_id,lower(label));
create index if not exists js_wheel_entries_round_idx on js_wheel.entries(round_id,joined_at,id);
alter table js_wheel.rounds enable row level security;
alter table js_wheel.entries enable row level security;
alter table js_wheel.auth enable row level security;
revoke all on all tables in schema js_wheel from public, anon, authenticated;

create or replace function public.js_ruleta_operar(
 p_token text,p_action text,p_group text,
 p_member_id text default null,p_name text default null,
 p_limit integer default null,p_title text default null
)
returns jsonb language plpgsql security definer set search_path=''
as $body$
declare
 r js_wheel.rounds%rowtype;
 v_action text := lower(trim(coalesce(p_action,'')));
 v_label text := trim(regexp_replace(coalesce(p_name,''),'[\r\n\t]',' ','g'));
 n integer;
 v_entry bigint;
 v_uint bigint;
 v_winner text;
 v_rows jsonb;
begin
 if p_token is null or char_length(p_token)<40 or
  encode(extensions.digest(p_token,'sha256'),'hex') is distinct from
  (select token_hash from js_wheel.auth where slot=1) then
    raise exception 'No autorizado' using errcode='42501';
 end if;
 if v_action='due' then
   select coalesce(jsonb_agg(jsonb_build_object(
    'grupo',q.group_jid,'codigo',q.public_code,'ganador',q.winner_label
   )), '[]'::jsonb) into v_rows from (
    select w.group_jid,w.public_code,
     (select e.label from js_wheel.entries e
      where e.round_id=w.id order by e.joined_at,e.id
      offset w.winner_idx limit 1) winner_label
    from js_wheel.rounds w where w.state='spinning'
      and w.spin_at+(w.duration_ms * interval '1 millisecond')<=now()
    order by w.spin_at limit 12
   ) q;
   return jsonb_build_object('ok',true,'due',v_rows);
 end if;
 if p_group is null or p_group !~ '@g[.]us$' then
  raise exception 'Grupo de WhatsApp inválido';
 end if;
 -- One serial writer per group, preventing join vs close/spin races.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('js_wheel_'||p_group));
 if v_action='create' then
   if p_limit is null or p_limit<2 or p_limit>100 then
     raise exception 'Elegí entre 2 y 100 participantes';
   end if;
   if exists(select 1 from js_wheel.rounds w
     where w.group_jid=p_group and w.state in ('open','closed','spinning')) then
     raise exception 'Ya hay una ruleta activa en este grupo. Finalizala o cancelala primero.';
   end if;
   insert into js_wheel.rounds(group_jid,public_code,capacity,title)
   values (p_group,upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
     p_limit,left(coalesce(nullif(trim(p_title),''),'Ruleta JS Family'),75))
   returning * into r;
 else
   select * into r from js_wheel.rounds w
    where w.group_jid=p_group order by w.created_at desc,w.id desc limit 1 for update;
   if r.id is null then raise exception 'No hay ruleta en este grupo. Usá .ruleta crear 20'; end if;
 end if;
 if v_action='join' then
   if r.state<>'open' then raise exception 'La inscripción está cerrada'; end if;
   if p_member_id is null or char_length(trim(p_member_id))<7 then
      raise exception 'Miembro de WhatsApp inválido';
   end if;
   if char_length(v_label)<2 then raise exception 'Escribí un apodo de al menos 2 letras'; end if;
   v_label:=left(v_label,42);
   if exists(select 1 from js_wheel.entries e where e.round_id=r.id and e.sender_jid=p_member_id) then
     return jsonb_build_object('ok',true,'already',true,'codigo',r.public_code,'estado',r.state);
   end if;
   if exists(select 1 from js_wheel.entries e where e.round_id=r.id and lower(e.label)=lower(v_label)) then
     raise exception 'Ese apodo ya está anotado. Elegí uno diferente.';
   end if;
   select count(*) into n from js_wheel.entries e where e.round_id=r.id;
   if n>=r.capacity then raise exception 'La ruleta ya está llena';end if;
   insert into js_wheel.entries(round_id,sender_jid,label) values(r.id,p_member_id,v_label) returning id into v_entry;
   n:=n+1;
   if n=r.capacity then
     update js_wheel.rounds set state='closed',closed_at=now() where id=r.id returning * into r;
   end if;
 elsif v_action='close' then
   if r.state<>'open' then raise exception 'La inscripción ya estaba cerrada';end if;
   select count(*) into n from js_wheel.entries e where e.round_id=r.id;
   if n<2 then raise exception 'Necesitás al menos 2 participantes para cerrar la ruleta';end if;
   update js_wheel.rounds set state='closed',closed_at=now() where id=r.id returning * into r;
 elsif v_action='spin' then
   if r.state<>'closed' then raise exception 'Primero cerrá las inscripciones';end if;
   select count(*) into n from js_wheel.entries e where e.round_id=r.id;
   if n<2 then raise exception 'No hay suficientes participantes';end if;
   v_uint:=('x'||encode(extensions.gen_random_bytes(4),'hex'))::bit(32)::bigint;
   update js_wheel.rounds set state='spinning',spin_at=clock_timestamp()+interval '3 seconds',
     winner_idx=(v_uint % n)::integer where id=r.id returning * into r;
 elsif v_action='finish' then
   if r.state='finished' then return jsonb_build_object('ok',true,'already',true,'codigo',r.public_code);end if;
   if r.state<>'spinning' then raise exception 'La ruleta todavía no está girando';end if;
   if r.spin_at+(r.duration_ms * interval '1 millisecond')>now() then raise exception 'La ruleta sigue girando';end if;
   update js_wheel.rounds set state='finished',announced_at=now() where id=r.id returning * into r;
 elsif v_action='cancel' then
   if r.state not in ('open','closed') then raise exception 'No se puede cancelar una ruleta que ya empezó a girar';end if;
   update js_wheel.rounds set state='canceled' where id=r.id returning * into r;
 elsif v_action<>'status' and v_action<>'create' then
   raise exception 'Acción desconocida';
 end if;
 select count(*) into n from js_wheel.entries e where e.round_id=r.id;
 if r.winner_idx is not null then
   select e.label into v_winner from js_wheel.entries e where e.round_id=r.id
    order by e.joined_at,e.id offset r.winner_idx limit 1;
 end if;
 return jsonb_build_object(
  'ok',true,'codigo',r.public_code,'titulo',r.title,'estado',r.state,
  'inscritos',n,'cupos',r.capacity,
  'enlace',case when r.state in ('closed','spinning','finished') then
    'https://jstorneos.com/ruleta.html?r='||r.public_code else null end,
  'ganador',case when r.state='finished' then v_winner else null end,
  'inicio',r.spin_at);
end $body$;

create or replace function public.js_ruleta_publica(p_codigo text)
returns jsonb language plpgsql security definer set search_path=''
as $public$
declare r js_wheel.rounds%rowtype;
 v_entries jsonb;
 v_state text;
 v_now timestamptz:=clock_timestamp();
begin
 if p_codigo is null or p_codigo !~ '^[A-F0-9]{12}$' then
  return jsonb_build_object('ok',false,'mensaje','Enlace de ruleta inválido');
 end if;
 select * into r from js_wheel.rounds w where w.public_code=p_codigo;
 if r.id is null or r.state in ('open','canceled') then
  return jsonb_build_object('ok',false,'mensaje','Esta ruleta todavía no está disponible');
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('nombre',x.label,'numero',x.n) order by x.n),'[]'::jsonb)
 into v_entries from (
  select e.label,row_number() over(order by e.joined_at,e.id) n
  from js_wheel.entries e where e.round_id=r.id
 ) x;
 v_state:=case when r.state='spinning' and
  v_now >= r.spin_at+(r.duration_ms * interval '1 millisecond') then 'finished'
  else r.state end;
 return jsonb_build_object('ok',true,'codigo',r.public_code,'titulo',r.title,
   'estado',v_state,'participantes',v_entries,
   'ganador_indice',case when v_state='finished' then r.winner_idx else null end,
   'inicio',r.spin_at,'duracion_ms',r.duration_ms,'servidor_ahora',v_now);
end $public$;

revoke all on function public.js_ruleta_operar(text,text,text,text,text,integer,text) from public,anon,authenticated;
revoke all on function public.js_ruleta_publica(text) from public,anon,authenticated;
grant execute on function public.js_ruleta_operar(text,text,text,text,text,integer,text) to anon,authenticated;
grant execute on function public.js_ruleta_publica(text) to anon,authenticated;
