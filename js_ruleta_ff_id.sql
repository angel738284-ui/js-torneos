
alter table js_wheel.entries
  add column if not exists game_id text,
  add column if not exists region text;
drop index if exists js_wheel.js_wheel_unique_nick_per_round;
create unique index if not exists js_wheel_unique_game_id_per_round
  on js_wheel.entries(round_id,game_id) where game_id is not null;

create or replace function public.js_ruleta_anotar_id(
 p_token text,p_group text,p_sender text,p_game_id text,p_nick text,p_region text
) returns jsonb
language plpgsql security definer set search_path=''
as $wheel$
declare
 r js_wheel.rounds%rowtype;
 v_label text := left(trim(regexp_replace(coalesce(p_nick,''),'[\r\n\t]',' ','g')),42);
 v_region text := upper(trim(coalesce(p_region,'')));
 v_count integer;
 v_previous text;
begin
 if p_token is null or char_length(p_token)<40 or
   encode(extensions.digest(p_token,'sha256'),'hex') is distinct from
   (select token_hash from js_wheel.auth where slot=1)
 then raise exception 'No autorizado' using errcode='42501';end if;
 if p_group is null or p_group !~ '@g[.]us$' then raise exception 'Grupo inválido';end if;
 if p_sender is null or length(p_sender)<7 then raise exception 'Participante inválido';end if;
 if p_game_id is null or p_game_id !~ '^[0-9]{5,16}$' then raise exception 'ID de Free Fire inválido';end if;
 if char_length(v_label)<2 then raise exception 'El verificador no devolvió un apodo válido';end if;
 if v_region !~ '^[A-Z0-9_-]{2,15}$' then raise exception 'La región del ID no está verificada';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('js_wheel_'||p_group));
 select * into r from js_wheel.rounds w where w.group_jid=p_group
  order by w.created_at desc,w.id desc limit 1 for update;
 if r.id is null then raise exception 'No hay ruleta abierta en este grupo';end if;
 if r.state<>'open' then raise exception 'La inscripción de esta ruleta ya está cerrada';end if;
 select e.game_id into v_previous from js_wheel.entries e where e.round_id=r.id
  and e.sender_jid=p_sender limit 1;
 if found then
   return jsonb_build_object('ok',true,'already',true,'codigo',r.public_code,
    'estado',r.state,'mensaje','Ya estás anotado con tu WhatsApp');
 end if;
 if exists(select 1 from js_wheel.entries e
           where e.round_id=r.id and e.game_id=p_game_id)
 then raise exception 'Ese ID de Free Fire ya está anotado en la ruleta';end if;
 select count(*) into v_count from js_wheel.entries e where e.round_id=r.id;
 if v_count>=r.capacity then raise exception 'La ruleta ya está llena';end if;
 insert into js_wheel.entries(round_id,sender_jid,game_id,label,region)
 values(r.id,p_sender,p_game_id,v_label,v_region);
 v_count:=v_count+1;
 if v_count=r.capacity then
   update js_wheel.rounds w set state='closed',closed_at=now()
   where w.id=r.id returning * into r;
 end if;
 return jsonb_build_object('ok',true,'codigo',r.public_code,'estado',r.state,
  'inscritos',v_count,'cupos',r.capacity,'nombre',v_label,'region',v_region,
  'enlace',case when r.state='closed' then
   'https://jstorneos.com/ruleta.html?r='||r.public_code else null end);
end
$wheel$;
revoke all on function public.js_ruleta_anotar_id(text,text,text,text,text,text)
 from public,anon,authenticated;
grant execute on function public.js_ruleta_anotar_id(text,text,text,text,text,text)
 to anon,authenticated;
