
-- JS FAMILY: Hot potato multiplayer, private gameplay tokens + public read-only room.
create schema if not exists js_bomb;
revoke all on schema js_bomb from public,anon,authenticated;

create table if not exists js_bomb.auth (
 slot integer primary key default 1 check (slot=1),
 token_hash text not null check(length(token_hash)=64)
);
insert into js_bomb.auth(slot,token_hash)
values(1,'1adc4913a2f34192d47fbc1ab3b9fe1151f4160094c2ea301ea8bb683d187653')
on conflict(slot) do update set token_hash=excluded.token_hash;

create table if not exists js_bomb.rooms(
 id uuid primary key default gen_random_uuid(),
 code text not null unique check (code ~ '^[A-F0-9]{12}$'),
 group_jid text not null,
 title text not null default 'Bomba Mortal JS Family',
 capacity integer not null check(capacity between 2 and 24),
 state text not null default 'open' check(state in('open','ready','playing','finished','canceled')),
 created_at timestamptz not null default clock_timestamp(),
 started_at timestamptz, round_started_at timestamptz,
 deadline timestamptz, round_no integer not null default 0,
 bomb_holder uuid,
 shield_until timestamptz,
 last_pass_at timestamptz,
 winner_id uuid,
 finished_at timestamptz
);
create unique index if not exists bomb_active_group on js_bomb.rooms(group_jid)
where state in('open','ready','playing');
create index if not exists bomb_rooms_order on js_bomb.rooms(group_jid,created_at desc);
create table if not exists js_bomb.players(
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references js_bomb.rooms(id) on delete cascade,
 sender_jid text not null,
 sender_ids text[] not null default '{}'::text[],
 game_id text not null check(game_id ~ '^[0-9]{5,16}$'),
 nickname text not null check(char_length(nickname) between 2 and 42),
 region text not null,
 avatar jsonb not null default '{"skin":"#eac49b","hair":"spiky","hairColor":"#262333","shirt":"#775de6","pants":"#273751","accessory":"none"}'::jsonb,
 access_hash text,
 alive boolean not null default true,
 joined_at timestamptz not null default clock_timestamp(),
 eliminated_at timestamptz,
 unique(room_id,sender_jid),
 unique(room_id,game_id)
);
create index if not exists bomb_player_room on js_bomb.players(room_id,joined_at,id);
create index if not exists bomb_player_sender on js_bomb.players(sender_jid);
create table if not exists js_bomb.events (
 id bigint generated always as identity primary key,
 room_id uuid not null references js_bomb.rooms(id) on delete cascade,
 kind text not null check(kind in ('pass','explosion','winner')),
 actor_id uuid,
 target_id uuid,
 round_no integer,
 at timestamptz not null default clock_timestamp(),
 announced boolean not null default true
);
create index if not exists bomb_events_pending on js_bomb.events(announced,id)
where announced=false;
create index if not exists bomb_events_room on js_bomb.events(room_id,id desc);

alter table js_bomb.auth enable row level security;
alter table js_bomb.rooms enable row level security;
alter table js_bomb.players enable row level security;
alter table js_bomb.events enable row level security;
revoke all on all tables in schema js_bomb from public,anon,authenticated;

-- Pure server-side timer progress; no public permissions on private schema.
create or replace function js_bomb.advance(p_room uuid)
returns void language plpgsql security invoker set search_path=''
as $advance$
declare
 r js_bomb.rooms%rowtype;
 remaining integer;
 next_holder uuid;
 winner uuid;
begin
 select * into r from js_bomb.rooms where id=p_room for update;
 if r.id is null or r.state<>'playing' or r.deadline>clock_timestamp() then return;end if;
 update js_bomb.players set alive=false,eliminated_at=clock_timestamp()
 where id=r.bomb_holder and room_id=r.id and alive=true;
 insert into js_bomb.events(room_id,kind,actor_id,round_no,announced)
 values(r.id,'explosion',r.bomb_holder,r.round_no,false);
 select count(*) into remaining from js_bomb.players where room_id=r.id and alive;
 if remaining=1 then
  select id into winner from js_bomb.players where room_id=r.id and alive limit 1;
  update js_bomb.rooms set state='finished',winner_id=winner,
    bomb_holder=null,deadline=null,shield_until=null,finished_at=clock_timestamp()
  where id=r.id;
  insert into js_bomb.events(room_id,kind,actor_id,round_no,announced)
  values(r.id,'winner',winner,r.round_no,false);
 else
  select id into next_holder from js_bomb.players where room_id=r.id and alive
   order by encode(extensions.gen_random_bytes(8),'hex') limit 1;
  update js_bomb.rooms set round_no=r.round_no+1,bomb_holder=next_holder,
   round_started_at=clock_timestamp()+interval '3 seconds',
   deadline=clock_timestamp()+((3+14+floor(random()*10))::int*interval '1 second'),
   shield_until=clock_timestamp()+interval '4.5 seconds',
   last_pass_at=null
  where id=r.id;
 end if;
end
$advance$;

create or replace function public.js_bomba_control(
 p_token text,p_action text,p_group text default null,p_limit integer default null,
 p_title text default null,p_event_id bigint default null
) returns jsonb
language plpgsql security definer set search_path=''
as $control$
declare
 r js_bomb.rooms%rowtype;
 action text:=lower(trim(coalesce(p_action,'')));
 n integer;
 holder uuid;
 event_rows jsonb;
 evt record;
begin
 if p_token is null or char_length(p_token)<40 or
  encode(extensions.digest(p_token,'sha256'),'hex') is distinct from
  (select token_hash from js_bomb.auth where slot=1) then
  raise exception 'No autorizado' using errcode='42501';
 end if;
 if action='tick' then
   for r in
    select * from js_bomb.rooms where state='playing' and deadline<=clock_timestamp()
    order by deadline limit 16
   loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bomb-'||r.group_jid));
    perform js_bomb.advance(r.id);
   end loop;
   select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'codigo',r.code,'grupo',r.group_jid,
    'tipo',e.kind,'nombre',p.nickname,'ronda',e.round_no
   ) order by e.id),'[]'::jsonb) into event_rows
   from (select * from js_bomb.events where announced=false order by id limit 25) e
   join js_bomb.rooms r on r.id=e.room_id
   left join js_bomb.players p on p.id=e.actor_id;
   return jsonb_build_object('ok',true,'eventos',event_rows);
 elsif action='ack' then
   if p_event_id is null then raise exception 'Evento requerido';end if;
   update js_bomb.events set announced=true where id=p_event_id and announced=false;
   return jsonb_build_object('ok',true);
 end if;
 if p_group is null or p_group !~ '@g[.]us$' then raise exception 'Grupo inválido';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bomb-'||p_group));
 if action='create' then
  if p_limit is null or p_limit not between 2 and 24 then
   raise exception 'Elegí entre 2 y 24 participantes';end if;
  if exists(select 1 from js_bomb.rooms
     where group_jid=p_group and state in('open','ready','playing')) then
   raise exception 'Ya hay una Bomba Mortal activa en este grupo';end if;
  insert into js_bomb.rooms(code,group_jid,title,capacity)
  values(upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),p_group,
   left(coalesce(nullif(trim(p_title),''),'Bomba Mortal JS Family'),70),p_limit)
  returning * into r;
 else
  select * into r from js_bomb.rooms where group_jid=p_group
   order by created_at desc,id desc limit 1 for update;
  if r.id is null then raise exception 'No hay partida de Bomba Mortal en este grupo';end if;
 end if;
 if action='close' then
  if r.state<>'open' then raise exception 'La inscripción ya estaba cerrada';end if;
  select count(*) into n from js_bomb.players where room_id=r.id;
  if n<2 then raise exception 'Se necesitan al menos dos jugadores';end if;
  update js_bomb.rooms set state='ready' where id=r.id returning * into r;
 elsif action='start' then
  if r.state<>'ready' then raise exception 'Primero cerrá las inscripciones';end if;
  select id into holder from js_bomb.players where room_id=r.id and alive
   order by encode(extensions.gen_random_bytes(8),'hex') limit 1;
  update js_bomb.rooms set state='playing',started_at=clock_timestamp(),
   round_no=1,bomb_holder=holder,
   round_started_at=clock_timestamp()+interval '3 seconds',
   deadline=clock_timestamp()+((3+14+floor(random()*10))::int*interval '1 second'),
   shield_until=clock_timestamp()+interval '4.5 seconds'
  where id=r.id returning * into r;
 elsif action='cancel' then
  if r.state not in ('open','ready') then raise exception 'No se puede cancelar una partida iniciada';end if;
  update js_bomb.rooms set state='canceled' where id=r.id returning * into r;
 elsif action<>'status' and action<>'create' then
  raise exception 'Acción desconocida';
 end if;
 select count(*) into n from js_bomb.players where room_id=r.id;
 return jsonb_build_object('ok',true,'codigo',r.code,'estado',r.state,'titulo',r.title,
  'inscritos',n,'cupos',r.capacity,
  'enlace', 'https://jstorneos.com/bomba.html?r='||r.code,
  'ronda',r.round_no);
end
$control$;

create or replace function public.js_bomba_inscribir(
 p_token text,p_group text,p_sender text,p_aliases text[],
 p_game_id text,p_nick text,p_region text
) returns jsonb language plpgsql security definer set search_path=''
as $signup$
declare r js_bomb.rooms%rowtype; n integer; new_name text;
begin
 if p_token is null or char_length(p_token)<40 or
  encode(extensions.digest(p_token,'sha256'),'hex') is distinct from
  (select token_hash from js_bomb.auth where slot=1) then raise exception 'No autorizado' using errcode='42501';end if;
 if p_group is null or p_group !~ '@g[.]us$' then raise exception 'Grupo inválido';end if;
 if p_sender is null or length(trim(p_sender))<7 then raise exception 'Jugador inválido';end if;
 if p_game_id is null or p_game_id !~ '^[0-9]{5,16}$' then raise exception 'ID de Free Fire inválido';end if;
 new_name:=left(trim(regexp_replace(coalesce(p_nick,''),'[\r\n\t]',' ','g')),42);
 if length(new_name)<2 then raise exception 'Sin apodo verificado';end if;
 if p_region is null or length(p_region)<2 then raise exception 'Región no verificada';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bomb-'||p_group));
 select * into r from js_bomb.rooms where group_jid=p_group
 order by created_at desc,id desc limit 1 for update;
 if r.id is null or r.state<>'open' then raise exception 'No hay inscripción abierta para Bomba Mortal';end if;
 if exists(select 1 from js_bomb.players where room_id=r.id and
  (sender_jid=p_sender or sender_ids && coalesce(p_aliases,'{}'::text[]))) then
  return jsonb_build_object('ok',true,'already',true,'codigo',r.code,'estado',r.state);end if;
 if exists(select 1 from js_bomb.players where room_id=r.id and game_id=p_game_id) then
  raise exception 'Este ID de Free Fire ya está anotado';end if;
 select count(*) into n from js_bomb.players where room_id=r.id;
 if n>=r.capacity then raise exception 'La partida ya está llena';end if;
 insert into js_bomb.players(room_id,sender_jid,sender_ids,game_id,nickname,region)
 values(r.id,p_sender,coalesce(p_aliases,'{}'::text[])||array[p_sender],p_game_id,new_name,p_region);
 n:=n+1;
 if n=r.capacity then update js_bomb.rooms set state='ready' where id=r.id returning * into r;end if;
 return jsonb_build_object('ok',true,'codigo',r.code,'estado',r.state,
  'nombre',new_name,'inscritos',n,'cupos',r.capacity,'enlace',
  'https://jstorneos.com/bomba.html?r='||r.code);
end $signup$;

create or replace function public.js_bomba_acceso(
 p_token text,p_sender text,p_aliases text[],p_code text default null
) returns jsonb language plpgsql security definer set search_path=''
as $access$
declare pl js_bomb.players%rowtype; r js_bomb.rooms%rowtype; secret text;
begin
 if p_token is null or char_length(p_token)<40 or
  encode(extensions.digest(p_token,'sha256'),'hex') is distinct from
  (select token_hash from js_bomb.auth where slot=1) then raise exception 'No autorizado' using errcode='42501';end if;
 if p_sender is null or length(p_sender)<7 then raise exception 'WhatsApp inválido';end if;
 select p.* into pl from js_bomb.players p
 join js_bomb.rooms room on room.id=p.room_id
 where (p.sender_jid=p_sender or p.sender_ids && coalesce(p_aliases,'{}'::text[]))
  and (p_code is null or room.code=p_code)
  and room.state in('open','ready','playing')
 order by room.created_at desc limit 1 for update of p;
 if pl.id is null then raise exception 'No estás anotado en una partida activa. Inscribite en el grupo primero.';end if;
 select * into r from js_bomb.rooms where id=pl.room_id;
 secret:=encode(extensions.gen_random_bytes(32),'hex');
 update js_bomb.players set access_hash=encode(extensions.digest(secret,'sha256'),'hex')
 where id=pl.id;
 return jsonb_build_object('ok',true,'codigo',r.code,'nombre',pl.nickname,
  'enlace','https://jstorneos.com/bomba.html?r='||r.code||'&t='||secret);
end $access$;

create or replace function public.js_bomba_publica(p_code text)
returns jsonb language plpgsql security definer set search_path=''
as $public$
declare r js_bomb.rooms%rowtype; roster jsonb; recent jsonb; n integer;
begin
 if p_code is null or p_code !~ '^[A-F0-9]{12}$' then
  return jsonb_build_object('ok',false,'mensaje','Código inválido');end if;
 select * into r from js_bomb.rooms where code=p_code;
 if r.id is null or r.state='canceled' then
  return jsonb_build_object('ok',false,'mensaje','Sala no disponible');end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',p.id,'nombre',p.nickname,'avatar',p.avatar,'vivo',p.alive
  ) order by p.joined_at,p.id),'[]'::jsonb)
 into roster from js_bomb.players p where p.room_id=r.id;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',e.id,'tipo',e.kind,'nombre',a.nickname,
   'objetivo',t.nickname,'ronda',e.round_no,'hora',e.at
  ) order by e.id desc),'[]'::jsonb)
 into recent from (
  select * from js_bomb.events where room_id=r.id order by id desc limit 14
 ) e left join js_bomb.players a on a.id=e.actor_id
 left join js_bomb.players t on t.id=e.target_id;
 select count(*) into n from js_bomb.players where room_id=r.id and alive;
 return jsonb_build_object('ok',true,'codigo',r.code,'titulo',r.title,
   'estado',r.state,'capacidad',r.capacity,'jugadores',roster,
   'vivos',n,'bomba_de',r.bomb_holder,'ganador',r.winner_id,
   'vencimiento',r.deadline,'ronda',r.round_no,
   'ronda_inicio',r.round_started_at,'proteccion_hasta',r.shield_until,
   'servidor_ahora',clock_timestamp(),'eventos',recent);
end $public$;

create or replace function public.js_bomba_jugar(
 p_code text,p_access text,p_action text,p_target uuid default null,
 p_avatar jsonb default null
) returns jsonb language plpgsql security definer set search_path=''
as $player$
declare r js_bomb.rooms%rowtype; p js_bomb.players%rowtype;
 target js_bomb.players%rowtype;
 a jsonb; safe_hair text; safe_hair_color text; safe_skin text;
 safe_shirt text; safe_pants text; safe_acc text;
begin
 if p_code is null or p_code !~ '^[A-F0-9]{12}$'
  or p_access is null or length(p_access)<>64 or p_access !~ '^[a-f0-9]{64}$'
 then raise exception 'Acceso inválido';end if;
 select * into r from js_bomb.rooms where code=p_code;
 if r.id is null then raise exception 'Partida no encontrada';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bomb-'||r.group_jid));
 select * into r from js_bomb.rooms where id=r.id for update;
 select * into p from js_bomb.players
 where room_id=r.id and access_hash=encode(extensions.digest(p_access,'sha256'),'hex')
 for update;
 if p.id is null then raise exception 'Enlace personal vencido. Pedí otro con .bomba jugar por privado.';end if;
 if p_action='soy' then
  return jsonb_build_object('ok',true,'id',p.id,'nombre',p.nickname,'vivo',p.alive,'avatar',p.avatar);
 elsif p_action='avatar' then
  if p_avatar is null or jsonb_typeof(p_avatar)<>'object' then raise exception 'Avatar inválido';end if;
  safe_hair:=p_avatar->>'hair';safe_hair_color:=p_avatar->>'hairColor';
  safe_skin:=p_avatar->>'skin';safe_shirt:=p_avatar->>'shirt';
  safe_pants:=p_avatar->>'pants';safe_acc:=p_avatar->>'accessory';
  if safe_hair is null or safe_hair_color is null or safe_skin is null or safe_shirt is null or safe_pants is null or safe_acc is null or
     safe_hair not in ('spiky','short','long','mohawk') or
     safe_hair_color not in ('#262333','#784c32','#f4d76b','#d84461','#d8ecf1') or
     safe_skin not in ('#f6d5b2','#eac49b','#b87a5b','#855036') or
     safe_shirt not in ('#775de6','#e7476f','#1eacc4','#2eae77','#ebba52') or
     safe_pants not in ('#273751','#181d29','#a5acb8','#824b62') or
     safe_acc not in ('none','glasses','crown','mask') then
    raise exception 'Elegí piezas válidas del editor';end if;
  a:=jsonb_build_object('hair',safe_hair,'hairColor',safe_hair_color,
   'skin',safe_skin,'shirt',safe_shirt,'pants',safe_pants,'accessory',safe_acc);
  update js_bomb.players set avatar=a where id=p.id;
  return jsonb_build_object('ok',true,'avatar',a);
 elsif p_action='pasar' then
  if r.state<>'playing' then raise exception 'La partida todavía no empezó o ya terminó';end if;
  if not p.alive then raise exception 'Estás eliminado; ahora podés mirar la partida';end if;
  if r.bomb_holder is distinct from p.id then raise exception 'La bomba no está en tus manos';end if;
  if clock_timestamp()<r.round_started_at then raise exception 'La ronda está por empezar';end if;
  if clock_timestamp()>=r.deadline then raise exception '¡Ya terminó el tiempo de esta ronda!';end if;
  if clock_timestamp()<r.shield_until then raise exception 'Protección activa; intentá en un momento';end if;
  if p_target is null or p_target=p.id then raise exception 'Elegí otro jugador';end if;
  select * into target from js_bomb.players where id=p_target and room_id=r.id and alive;
  if target.id is null then raise exception 'El destinatario ya no participa';end if;
  update js_bomb.rooms set bomb_holder=target.id,
   shield_until=clock_timestamp()+interval '1.5 seconds',last_pass_at=clock_timestamp()
   where id=r.id;
  insert into js_bomb.events(room_id,kind,actor_id,target_id,round_no)
  values(r.id,'pass',p.id,target.id,r.round_no);
  return jsonb_build_object('ok',true,'destinatario',target.nickname);
 end if;
 raise exception 'Acción no permitida';
end $player$;

revoke all on function public.js_bomba_control(text,text,text,integer,text,bigint) from public,anon,authenticated;
revoke all on function public.js_bomba_inscribir(text,text,text,text[],text,text,text) from public,anon,authenticated;
revoke all on function public.js_bomba_acceso(text,text,text[],text) from public,anon,authenticated;
revoke all on function public.js_bomba_publica(text) from public,anon,authenticated;
revoke all on function public.js_bomba_jugar(text,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.js_bomba_control(text,text,text,integer,text,bigint) to anon,authenticated;
grant execute on function public.js_bomba_inscribir(text,text,text,text[],text,text,text) to anon,authenticated;
grant execute on function public.js_bomba_acceso(text,text,text[],text) to anon,authenticated;
grant execute on function public.js_bomba_publica(text) to anon,authenticated;
grant execute on function public.js_bomba_jugar(text,text,text,uuid,jsonb) to anon,authenticated;
