
create table if not exists public.js_liga_wa_access(
 singleton smallint primary key default 1 check(singleton=1),
 token_sha256 bytea not null,
 changed_at timestamptz not null default now()
);
insert into public.js_liga_wa_access(singleton,token_sha256)
values(1,decode('48804bdf7bc3bd95b360053343217fa40532f14417e1624009123709adf60fc1','hex'))
on conflict(singleton) do update set token_sha256=excluded.token_sha256,changed_at=now();

create table if not exists public.js_liga_wa_link_codes(
 user_id uuid primary key references auth.users(id) on delete cascade,
 code_sha256 bytea not null,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index if not exists js_liga_wa_codes_expires on public.js_liga_wa_link_codes(expires_at);

create table if not exists public.js_liga_wa_links(
 user_id uuid not null unique references auth.users(id) on delete cascade,
 jid text primary key check(jid ~ '^[0-9]{6,20}@(s\.whatsapp\.net|lid)$'),
 linked_at timestamptz not null default now(),
 last_seen timestamptz not null default now()
);
create table if not exists public.js_liga_wa_link_attempts(
 jid text primary key,
 attempts int not null default 0,
 window_start timestamptz not null default now()
);
create table if not exists public.js_liga_wa_search(
 user_id uuid primary key references auth.users(id) on delete cascade,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index if not exists js_liga_wa_search_until on public.js_liga_wa_search(expires_at);

do $init$
declare table_name text;
begin
 foreach table_name in array array[
 'js_liga_wa_access','js_liga_wa_link_codes','js_liga_wa_links',
 'js_liga_wa_link_attempts','js_liga_wa_search'
 ] loop
   execute format('alter table public.%I enable row level security',table_name);
   execute format('revoke all on public.%I from public,anon,authenticated',table_name);
   execute format('grant select,insert,update,delete on public.%I to service_role',table_name);
 end loop;
end
$init$;

-- Token verification is server-only. It cannot be called from the public API.
create or replace function public.js_liga_wa_authorize(p_token text)
returns boolean language plpgsql security definer set search_path=''
as $fn$
begin
 if p_token is null or length(p_token)<>64
   or p_token !~ '^[0-9a-f]{64}$' then return false;end if;
 return coalesce((select token_sha256=sha256(convert_to(p_token,'UTF8'))
    from public.js_liga_wa_access where singleton=1),false);
end
$fn$;
revoke all on function public.js_liga_wa_authorize(text) from public,anon,authenticated;
grant execute on function public.js_liga_wa_authorize(text) to service_role;

-- Authenticated Google account generates a one-time 12-hex-digit code.
create or replace function public.js_liga_wa_code()
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 caller uuid:=auth.uid();
 code text;
 expiry timestamptz;
begin
 if caller is null then raise exception 'Iniciá sesión en JS Torneos para vincular WhatsApp'
    using errcode='42501';end if;
 if not exists(select 1 from public.js_player_profiles p
   where p.user_id=caller and p.verified_at is not null) then
   raise exception 'Verificá primero tu ID de Free Fire en tu perfil de JS Torneos';
 end if;
 code:=upper(left(replace(gen_random_uuid()::text,'-',''),12));
 expiry:=now()+interval '10 minutes';
 insert into public.js_liga_wa_link_codes(user_id,code_sha256,expires_at,created_at)
 values(caller,sha256(convert_to(code,'UTF8')),expiry,now())
 on conflict(user_id) do update set
  code_sha256=excluded.code_sha256,expires_at=excluded.expires_at,created_at=now();
 return jsonb_build_object('ok',true,'code',code,'expires_at',expiry,
  'message','Enviá .liga2 vincular '||code||' al privado de JS Guardian dentro de 10 minutos.');
end
$fn$;
revoke all on function public.js_liga_wa_code() from public,anon;
grant execute on function public.js_liga_wa_code() to authenticated;

-- Revoke a WhatsApp link from the logged-in web account at any time.
create or replace function public.js_liga_wa_desvincular()
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare caller uuid:=auth.uid();
begin
 if caller is null then raise exception 'Iniciá sesión' using errcode='42501';end if;
 delete from public.js_liga_wa_links where user_id=caller;
 delete from public.js_liga_wa_link_codes where user_id=caller;
 delete from public.js_liga_wa_search where user_id=caller;
 return jsonb_build_object('ok',true,'message','WhatsApp desvinculado de tu cuenta JS Torneos.');
end
$fn$;
revoke all on function public.js_liga_wa_desvincular() from public,anon;
grant execute on function public.js_liga_wa_desvincular() to authenticated;

-- Only the Samsung bot may redeem link codes. Rate limit even bad codes,
-- and return a result rather than raising so failed attempts are persisted.
create or replace function public.js_liga_wa_vincular(
 p_token text,p_jid text,p_code text)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid; counter int; valid boolean;
begin
 if not public.js_liga_wa_authorize(p_token) then
  raise exception 'Acceso denegado' using errcode='42501';end if;
 if p_jid is null or p_jid !~ '^[0-9]{6,20}@(s\.whatsapp\.net|lid)$' then
  raise exception 'Identidad de WhatsApp inválida' using errcode='42501';end if;
 if p_code is null or p_code !~ '^[0-9A-Fa-f]{12}$' then
  return jsonb_build_object('ok',false,'message',
   'El código tiene 12 letras o números. Generá uno desde Mi dúo en JS Torneos.');
 end if;
 insert into public.js_liga_wa_link_attempts(jid,attempts,window_start)
 values(p_jid,1,now())
 on conflict(jid) do update set
  attempts=case when public.js_liga_wa_link_attempts.window_start<now()-interval '10 minutes'
     then 1 else public.js_liga_wa_link_attempts.attempts+1 end,
  window_start=case when public.js_liga_wa_link_attempts.window_start<now()-interval '10 minutes'
     then now() else public.js_liga_wa_link_attempts.window_start end
 returning attempts into counter;
 if counter>6 then
  return jsonb_build_object('ok',false,'message',
    'Demasiados intentos. Probá de nuevo después de 10 minutos.');
 end if;
 select user_id into actor from public.js_liga_wa_link_codes
 where code_sha256=sha256(convert_to(upper(p_code),'UTF8'))
   and expires_at>now()
 order by created_at desc limit 1 for update;
 if actor is null then
  return jsonb_build_object('ok',false,'message',
    'Código inválido o vencido. Creá uno nuevo desde la web.');
 end if;
 if not exists(select 1 from public.js_player_profiles p
  where p.user_id=actor and p.verified_at is not null) then
  return jsonb_build_object('ok',false,'message',
   'Primero verificá tu Free Fire ID desde JS Torneos.');
 end if;
 -- An authenticated account can replace its former phone binding by code.
 -- A JID cannot stay linked to two different Google accounts.
 delete from public.js_liga_wa_links
  where jid=p_jid or user_id=actor;
 insert into public.js_liga_wa_links(user_id,jid)
  values(actor,p_jid);
 delete from public.js_liga_wa_link_codes where user_id=actor;
 delete from public.js_liga_wa_link_attempts where jid=p_jid;
 return jsonb_build_object('ok',true,
  'message','✅ Cuenta vinculada. Ahora podés buscar 2VS2, recibir la sala y confirmar Gané/Perdí desde este privado.');
end
$fn$;
revoke all on function public.js_liga_wa_vincular(text,text,text) from public,authenticated;
grant execute on function public.js_liga_wa_vincular(text,text,text) to anon,service_role;
