
create table if not exists public.js_liga_wa_events(
 id bigint generated always as identity primary key,
 match_id bigint not null references public.js_liga_matches(id) on delete cascade,
 kind text not null check(kind in(
   'pending','playing','review','complete','cancelled','expired',
   'room','room_removed')),
 created_at timestamptz not null default now()
);
create index if not exists js_liga_wa_events_recent on public.js_liga_wa_events(id);
alter table public.js_liga_wa_events enable row level security;
revoke all on public.js_liga_wa_events from public,anon,authenticated;
grant select,insert,update,delete on public.js_liga_wa_events to service_role;
grant usage,select on sequence public.js_liga_wa_events_id_seq to service_role;

create or replace function public.js_liga_wa_match_changed()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 if tg_op='UPDATE' and new.state is not distinct from old.state then
   return new;
 end if;
 insert into public.js_liga_wa_events(match_id,kind)
 values(new.id,new.state);
 return new;
end
$fn$;
revoke all on function public.js_liga_wa_match_changed() from public,anon,authenticated;
drop trigger if exists js_liga_wa_notify_match on public.js_liga_matches;
create trigger js_liga_wa_notify_match
 after insert or update of state on public.js_liga_matches
 for each row execute function public.js_liga_wa_match_changed();

create or replace function public.js_liga_wa_room_changed()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 if tg_op='DELETE' then
  insert into public.js_liga_wa_events(match_id,kind) values(old.match_id,'room_removed');
  return old;
 end if;
 if tg_op='UPDATE'
    and new.room_id is not distinct from old.room_id
    and new.room_password is not distinct from old.room_password then
    return new;end if;
 insert into public.js_liga_wa_events(match_id,kind) values(new.match_id,'room');
 return new;
end
$fn$;
revoke all on function public.js_liga_wa_room_changed() from public,anon,authenticated;
drop trigger if exists js_liga_wa_notify_room on public.js_liga_rooms;
create trigger js_liga_wa_notify_room
 after insert or update of room_id,room_password or delete on public.js_liga_rooms
 for each row execute function public.js_liga_wa_room_changed();

-- Bot-only event feed with the recipients mapped to their Google user IDs.
-- Room credentials never appear in public Realtime or general league feeds.
create or replace function public.js_liga_wa_eventos(
 p_token text,p_after bigint default 0,p_limit int default 25)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 events jsonb;
 latest bigint;
 lim int:=least(greatest(coalesce(p_limit,25),0),40);
begin
 if not public.js_liga_wa_authorize(p_token) then
  raise exception 'Acceso denegado' using errcode='42501';end if;
 select coalesce(max(e.id),0) into latest from public.js_liga_wa_events e;
 select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'kind',e.kind,'match_id',m.id,
    'season_id',m.season_id,'state',m.state,
    'winner',case when m.winner=m.team_a then 'azul'
                  when m.winner=m.team_b then 'rojo'
                  else null end,
    'recipients',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'jid',l.jid,'name',left(coalesce(nullif(p.nickname,''),nullif(p.display_name,''),'Jugador'),65),
        'side',case when l.user_id=any(m.lineup_a) then 'azul' else 'rojo' end
      ) order by l.jid),'[]'::jsonb)
      from public.js_liga_wa_links l
      left join public.js_player_profiles p on p.user_id=l.user_id
      where l.user_id=any(m.lineup_a||m.lineup_b)
    ),
    'room',case when e.kind='room'
       and m.started_at is not null
       and (select count(*) from public.js_liga_match_votes v
        where v.match_id=m.id and v.accepted=true)=4
       then (select jsonb_build_object('id',r.room_id,'password',r.room_password)
          from public.js_liga_rooms r where r.match_id=m.id)
       else null end
 ) order by e.id),'[]'::jsonb) into events
 from (select * from public.js_liga_wa_events x
   where x.id>greatest(coalesce(p_after,0),0)
   order by x.id limit lim)e
 join public.js_liga_matches m on m.id=e.match_id;
 return jsonb_build_object('latest_id',latest,'events',events);
end
$fn$;
revoke all on function public.js_liga_wa_eventos(text,bigint,int) from public,authenticated;
grant execute on function public.js_liga_wa_eventos(text,bigint,int) to anon,service_role;
