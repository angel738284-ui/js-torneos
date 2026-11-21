
-- Private image evidence for 4-player matches. Object names contain only
-- match number, uploading user id and a random uuid; never original file names.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('js-liga-pruebas','js-liga-pruebas',false,5242880,
 array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=5242880,
 allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create or replace function public.js_liga_puede_prueba(p_path text,p_upload boolean default false)
returns boolean language plpgsql security definer set search_path=''
as $fn$
declare
 caller uuid:=auth.uid(); ref_match bigint;
 match_data public.js_liga_matches%rowtype; allowed boolean; count_uploaded integer;
 uploader text;
begin
 if caller is null or p_path is null or p_path !~
   '^[0-9]{1,18}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
 then return false;end if;
 ref_match:=split_part(p_path,'/',1)::bigint;
 uploader:=split_part(p_path,'/',2);
 select * into match_data from public.js_liga_matches m where m.id=ref_match
  and m.season_id in(select id from public.js_liga_seasons where state='active');
 if match_data.id is null or match_data.started_at is null then return false;end if;
 if (select count(*) from public.js_liga_match_votes v where v.match_id=ref_match and v.accepted=true)<>4
 then return false;end if;
 allowed:=coalesce(caller=any(match_data.lineup_a||match_data.lineup_b),false)
   or exists(select 1 from public.js_admins a where a.uid=caller);
 if not allowed then return false;end if;
 if not p_upload then return true;end if;
 if uploader<>caller::text or match_data.state not in('playing','review') then return false;end if;
 select count(*) into count_uploaded from storage.objects o
 where o.bucket_id='js-liga-pruebas'
   and o.name like ref_match::text||'/'||caller::text||'/%';
 return count_uploaded<3;
end
$fn$;
revoke all on function public.js_liga_puede_prueba(text,boolean) from public,anon;
grant execute on function public.js_liga_puede_prueba(text,boolean) to authenticated;

drop policy if exists "js_liga_proof_private_select" on storage.objects;
drop policy if exists "js_liga_proof_private_insert" on storage.objects;
create policy "js_liga_proof_private_select" on storage.objects
 for select to authenticated
 using(bucket_id='js-liga-pruebas' and public.js_liga_puede_prueba(name,false));
create policy "js_liga_proof_private_insert" on storage.objects
 for insert to authenticated
 with check(bucket_id='js-liga-pruebas' and public.js_liga_puede_prueba(name,true));

create or replace function public.js_liga_pruebas(p_match_id bigint)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare caller uuid:=auth.uid();proofs jsonb;
begin
 if caller is null then raise exception 'Iniciá sesión' using errcode='42501';end if;
 if not public.js_liga_puede_prueba(
   p_match_id::text||'/'||caller::text||'/'||gen_random_uuid()::text||'.png',false)
 then raise exception 'Solo los cuatro jugadores o JS pueden consultar estas pruebas' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'path',x.name,'created_at',x.created_at
 ) order by x.created_at desc),'[]'::jsonb) into proofs
 from (
  select name,created_at from storage.objects
  where bucket_id='js-liga-pruebas' and name like p_match_id::text||'/%'
  order by created_at desc limit 40
 ) x;
 return jsonb_build_object('ok',true,'files',proofs);
end
$fn$;
revoke all on function public.js_liga_pruebas(bigint) from public,anon;
grant execute on function public.js_liga_pruebas(bigint) to authenticated;

-- Realtime is an invalidation tick only: zero private messages, room passwords
-- or player data ever enter the published event payload.
create table if not exists public.js_liga_refresh_ticks(
 singleton smallint primary key default 1 check(singleton=1),
 revision bigint not null default 0,
 changed_at timestamptz not null default now()
);
insert into public.js_liga_refresh_ticks(singleton,revision)
values(1,0) on conflict(singleton) do nothing;
alter table public.js_liga_refresh_ticks enable row level security;
revoke all on public.js_liga_refresh_ticks from public,anon,authenticated;
grant select on public.js_liga_refresh_ticks to authenticated;
drop policy if exists "league_refresh_authenticated" on public.js_liga_refresh_ticks;
create policy "league_refresh_authenticated" on public.js_liga_refresh_ticks
 for select to authenticated using(auth.uid() is not null);

create or replace function public.js_liga_refresh_bump()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 update public.js_liga_refresh_ticks set revision=revision+1,changed_at=now()
 where singleton=1;
 if TG_OP='DELETE' then return old;end if;
 return new;
end
$fn$;
revoke all on function public.js_liga_refresh_bump() from public,anon,authenticated;
do $bind$
declare t text;
begin
 foreach t in array array[
   'js_liga_matches','js_liga_match_votes','js_liga_ready',
   'js_liga_chat','js_liga_reports','js_liga_rooms',
   'js_liga_control','js_liga_teams','js_liga_personal_results'
 ] loop
  execute format('drop trigger if exists league_ui_refresh on public.%I',t);
  execute format('create trigger league_ui_refresh after insert or update or delete on public.%I for each row execute function public.js_liga_refresh_bump()',t);
 end loop;
end
$bind$;

do $publication$
begin
 if not exists(select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'
    and tablename='js_liga_refresh_ticks') then
   alter publication supabase_realtime add table public.js_liga_refresh_ticks;
 end if;
end
$publication$;
