-- Elimination mode for new JS Family winner wheels.
-- Past traditional rounds and public links remain valid.
create table if not exists js_wheel.eliminations(
 round_id uuid not null references js_wheel.rounds(id) on delete cascade,
 step integer not null check(step>=1),
 entry_idx integer not null check(entry_idx>=0),
 reveal_at timestamptz not null,
 primary key(round_id,step),
 unique(round_id,entry_idx)
);
create index if not exists js_wheel_elimination_lookup on js_wheel.eliminations(round_id,reveal_at);
alter table js_wheel.eliminations enable row level security;
revoke all on js_wheel.eliminations from public,anon,authenticated;

create or replace function public.js_ruleta_eliminacion_iniciar(p_token text,p_group text)
returns jsonb language plpgsql security definer set search_path=''
as $elimination$
declare
 r js_wheel.rounds%rowtype;
 n int;
 winner_pos int;
begin
 if p_token is null or char_length(p_token)<40 or
    encode(extensions.digest(p_token,'sha256'),'hex') is distinct from
      (select token_hash from js_wheel.auth where slot=1)
 then raise exception 'No autorizado' using errcode='42501'; end if;
 if p_group is null or p_group !~ '@g[.]us$' then
  raise exception 'Grupo de WhatsApp inválido';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('js_wheel_'||p_group));
 select * into r from js_wheel.rounds w where w.group_jid=p_group
 order by w.created_at desc,w.id desc limit 1 for update;
 if r.id is null or r.state<>'closed' then
  raise exception 'Primero cerrá la inscripción con 2 o más jugadores';end if;
 select count(*) into n from js_wheel.entries e where e.round_id=r.id;
 if n<2 or n>100 then raise exception 'Se necesitan entre 2 y 100 jugadores';end if;

 -- Server-side cryptographic randomness determines the full elimination order.
 -- Public access never receives unrevealed outcomes.
 update js_wheel.rounds
  set state='spinning',spin_at=clock_timestamp()+interval '3 seconds',
      duration_ms=(n-1)*7000,winner_idx=null
 where id=r.id returning * into r;
 with numbered as (
  select id,(row_number() over(order by joined_at,id)-1)::integer pos
  from js_wheel.entries where round_id=r.id
 ), shuffled as (
  select num.pos,row_number() over(
    order by encode(extensions.gen_random_bytes(16),'hex'), num.id
  )::integer as turn
  from numbered num
 )
 insert into js_wheel.eliminations(round_id,step,entry_idx,reveal_at)
 select r.id,s.turn,s.pos,r.spin_at+(s.turn*interval '7 seconds')
 from shuffled s where s.turn<n;
 select pos into winner_pos from (
  select (row_number() over(order by joined_at,id)-1)::integer pos
  from js_wheel.entries where round_id=r.id
 ) positions
 where not exists(
  select 1 from js_wheel.eliminations x
  where x.round_id=r.id and x.entry_idx=positions.pos
 );
 if winner_pos is null then raise exception 'No se pudo seleccionar al último sobreviviente';end if;
 update js_wheel.rounds set winner_idx=winner_pos where id=r.id;

 return jsonb_build_object('ok',true,'codigo',r.public_code,
  'titulo',r.title,'estado','spinning','inscritos',n,'cupos',r.capacity,
  'inicio',r.spin_at,'duracion_ms',r.duration_ms,
  'eliminaciones',n-1,'paso_ms',7000,
  'enlace','https://jstorneos.com/ruleta.html?r='||r.public_code);
end $elimination$;

create or replace function public.js_ruleta_publica(p_codigo text)
returns jsonb language plpgsql security definer set search_path=''
as $public$
declare
 r js_wheel.rounds%rowtype;
 v_entries jsonb;
 v_eliminated jsonb;
 v_has_elimination boolean;
 v_count integer;
 v_eliminated_count integer;
 v_state text;
 v_now timestamptz:=clock_timestamp();
begin
 if p_codigo is null or p_codigo !~ '^[A-F0-9]{12}$' then
  return jsonb_build_object('ok',false,'mensaje','Enlace de ruleta inválido');end if;
 select * into r from js_wheel.rounds w where w.public_code=p_codigo;
 if r.id is null or r.state in('open','canceled') then
  return jsonb_build_object('ok',false,'mensaje','Esta ruleta todavía no está disponible');end if;

 select coalesce(jsonb_agg(jsonb_build_object('nombre',x.label,'numero',x.n) order by x.n),'[]'::jsonb)
 into v_entries from (
  select e.label,row_number() over(order by e.joined_at,e.id) n
  from js_wheel.entries e where e.round_id=r.id
 ) x;
 v_count:=jsonb_array_length(v_entries);
 select exists(select 1 from js_wheel.eliminations x where x.round_id=r.id)
 into v_has_elimination;

 if v_has_elimination then
  select coalesce(jsonb_agg(jsonb_build_object(
   'indice',x.entry_idx,'orden',x.step,'hora',x.reveal_at,
   'nombre',e.label
  ) order by x.step),'[]'::jsonb)
  into v_eliminated
  from js_wheel.eliminations x
  join (
   select label,(row_number() over(order by joined_at,id)-1)::integer pos
   from js_wheel.entries where round_id=r.id
  ) e on e.pos=x.entry_idx
  where x.round_id=r.id and x.reveal_at<=v_now;
 else v_eliminated:='[]'::jsonb;
 end if;
 v_eliminated_count:=jsonb_array_length(v_eliminated);
 v_state:=case when r.state='spinning' and
  v_now>=r.spin_at+(r.duration_ms*interval '1 millisecond') then 'finished'
  else r.state end;
 return jsonb_build_object(
  'ok',true,'codigo',r.public_code,'titulo',r.title,
  'estado',v_state,'participantes',v_entries,'servidor_ahora',v_now,
  'modalidad',case when v_has_elimination then 'eliminacion' else 'tradicional' end,
  'eliminados',v_eliminated,'sobrevivientes',v_count-v_eliminated_count,
  'ronda_actual',least(v_count-1,v_eliminated_count+1),
  'total_eliminaciones',greatest(0,v_count-1),
  'duracion_paso_ms',7000,
  'ganador_indice',case when v_state='finished' then r.winner_idx else null end,
  'inicio',r.spin_at,'duracion_ms',r.duration_ms);
end $public$;

revoke all on function public.js_ruleta_eliminacion_iniciar(text,text) from public,anon,authenticated;
grant execute on function public.js_ruleta_eliminacion_iniciar(text,text) to anon,authenticated;
revoke all on function public.js_ruleta_publica(text) from public,anon,authenticated;
grant execute on function public.js_ruleta_publica(text) to anon,authenticated;
