
-- Individual competitive history. No shared team rank. Future 1VS1 can
-- write separate official '1v1' results with a unique match reference.
create table if not exists public.js_liga_personal_results(
 mode text not null check(mode in('2v2','1v1')),
 match_ref text not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 outcome text not null check(outcome in('win','loss')),
 points integer not null,
 played_at timestamptz not null default now(),
 primary key(mode,match_ref,user_id)
);
create index if not exists js_liga_personal_top on public.js_liga_personal_results(user_id,played_at desc);
alter table public.js_liga_personal_results enable row level security;
revoke all on public.js_liga_personal_results from public,anon,authenticated;
grant select,insert,update,delete on public.js_liga_personal_results to service_role;

create or replace function public.js_liga_personal_sync_match()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare
 current_id bigint;
 current_state text;
 winner_team uuid;
 team_a_id uuid;
 team_b_id uuid;
 lineup_winner uuid[];
 lineup_loser uuid[];
 match_done_at timestamptz;
begin
 current_id:=case when TG_OP='DELETE' then old.id else new.id end;
 delete from public.js_liga_personal_results where mode='2v2' and match_ref=current_id::text;
 if TG_OP='DELETE' then return old;end if;
 if new.state<>'complete' or new.winner is null then return new;end if;
 if new.winner not in (new.team_a,new.team_b) then return new;end if;
 lineup_winner:=case when new.winner=new.team_a then new.lineup_a else new.lineup_b end;
 lineup_loser:=case when new.winner=new.team_a then new.lineup_b else new.lineup_a end;
 if cardinality(lineup_winner)<>2 or cardinality(lineup_loser)<>2 or
 (select count(distinct u) from unnest(lineup_winner||lineup_loser) u)<>4 then
  return new;end if;
 match_done_at:=coalesce(new.decided_at,new.created_at,now());
 insert into public.js_liga_personal_results(mode,match_ref,user_id,outcome,points,played_at)
 select '2v2',new.id::text,player,'win',25,match_done_at from unnest(lineup_winner) player
 union all
 select '2v2',new.id::text,player,'loss',-10,match_done_at from unnest(lineup_loser) player;
 return new;
end
$fn$;
revoke all on function public.js_liga_personal_sync_match() from public,anon,authenticated;
drop trigger if exists js_liga_personal_scoring on public.js_liga_matches;
create trigger js_liga_personal_scoring
after insert or update of state,winner,lineup_a,lineup_b,decided_at or delete
on public.js_liga_matches
for each row execute function public.js_liga_personal_sync_match();

-- Backfill official historical completed match history once, with original
-- lineups frozen at the moment the encounter was played. No team scores changed.
insert into public.js_liga_personal_results(mode,match_ref,user_id,outcome,points,played_at)
select '2v2',m.id::text,u.user_id,u.outcome,
 case when u.outcome='win' then 25 else -10 end,
 coalesce(m.decided_at,m.created_at,now())
from public.js_liga_matches m
cross join lateral (
 select player as user_id,
 case when m.winner=m.team_a then 'win' else 'loss' end as outcome
 from unnest(m.lineup_a) player
 union all
 select player,
 case when m.winner=m.team_b then 'win' else 'loss' end
 from unnest(m.lineup_b) player
) u
where m.state='complete' and m.winner in(m.team_a,m.team_b)
and cardinality(m.lineup_a)=2 and cardinality(m.lineup_b)=2
and (select count(distinct z) from unnest(m.lineup_a||m.lineup_b) z)=4
on conflict(mode,match_ref,user_id) do nothing;

create or replace function public.js_liga_rangos()
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 me uuid:=auth.uid();
 result jsonb;
begin
 if me is null then raise exception 'Iniciá sesión para consultar los rangos' using errcode='42501';end if;
 with personal as (
  select r.user_id,
   count(*) filter(where r.outcome='win')::int as wins,
   count(*) filter(where r.outcome='loss')::int as losses,
   count(*) filter(where r.mode='2v2')::int as duos,
   count(*) filter(where r.mode='1v1')::int as solos,
   greatest(0,sum(r.points))::int as score,
   max(r.played_at) as last_played
  from public.js_liga_personal_results r
  group by r.user_id
 ), active as (
   select p.user_id,p.display_name,p.nickname,p.game_id,
    coalesce(x.wins,0) as wins,coalesce(x.losses,0) as losses,
    coalesce(x.duos,0) as duos,coalesce(x.solos,0) as solos,
    coalesce(x.score,0) as score, x.last_played
   from public.js_player_profiles p
   left join personal x on x.user_id=p.user_id
   where p.verified_at is not null or p.user_id=me
 ), scores as (
  select *,
   case when score>=700 then 'Maestro'
        when score>=450 then 'Diamante'
        when score>=250 then 'Oro'
        when score>=100 then 'Plata'
        else 'Bronce' end as rank,
   case when score>=700 then 700
        when score>=450 then 450
        when score>=250 then 250
        when score>=100 then 100 else 0 end as rank_floor,
   case when score>=700 then null
        when score>=450 then 700
        when score>=250 then 450
        when score>=100 then 250 else 100 end as next_rank_score
  from active
 ), ranked as (
  select *,row_number() over(order by score desc,wins desc, user_id)::int as position
  from scores
 )
 select jsonb_build_object(
  'system','individual',
  'my',coalesce((select to_jsonb(x) from ranked x where x.user_id=me),
      jsonb_build_object('user_id',me,'score',0,'wins',0,'losses',0,'duos',0,
        'solos',0,'rank','Bronce','rank_floor',0,'next_rank_score',100)),
  'top',coalesce((select jsonb_agg(to_jsonb(x) order by x.position)
      from (select * from ranked order by position limit 40)x),'[]'::jsonb),
  'points',jsonb_build_object('win',25,'loss',-10,'floor',0,
       '2v2','puntos por jugador, no por equipo','1v1','compatible cuando se habilite 1VS1')
 ) into result;
 return result;
end
$fn$;
revoke all on function public.js_liga_rangos() from public,anon;
grant execute on function public.js_liga_rangos() to authenticated;

create table if not exists public.js_liga_ready(
 match_id bigint not null references public.js_liga_matches(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 ready boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(match_id,user_id)
);
alter table public.js_liga_ready enable row level security;
revoke all on public.js_liga_ready from public,anon,authenticated;
grant select,insert,update,delete on public.js_liga_ready to service_role;

create or replace function public.js_liga_espera(p_action text,p_match_id bigint)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
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
 select count(*) into ready_total from public.js_liga_ready
 where match_id=p_match_id and ready=true and user_id=any(lineup);
 select coalesce(jsonb_agg(jsonb_build_object(
    'user_id',a.user_id,'ready',coalesce(r.ready,false)
  ) order by a.ord),'[]'::jsonb) into statuses
 from unnest(lineup) with ordinality a(user_id,ord)
 left join public.js_liga_ready r on r.match_id=p_match_id and r.user_id=a.user_id;
 return jsonb_build_object('ok',true,'match_id',p_match_id,'ready_count',ready_total,
  'everyone_ready',ready_total=4,'players',statuses,
  'message',case when ready_total=4 then '✅ ¡Los cuatro están listos! Ya pueden comenzar la sala.'
   else ready_total||'/4 listos. Esperando a los demás jugadores.' end);
end
$fn$;
revoke all on function public.js_liga_espera(text,bigint) from public,anon;
grant execute on function public.js_liga_espera(text,bigint) to authenticated;
