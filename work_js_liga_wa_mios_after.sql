CREATE OR REPLACE FUNCTION public.js_liga_wa_mios(p_token text, p_jid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target_uid uuid;
  active_season bigint;
  total_matches integer:=0;
  items jsonb:='[]'::jsonb;
begin
  if not public.js_liga_wa_authorize(p_token) then
    raise exception 'Acceso denegado' using errcode='42501';
  end if;
  if p_jid is null or p_jid !~ '^[0-9]{6,20}@(s\.whatsapp\.net|lid)$' then
    raise exception 'Identidad de WhatsApp inválida' using errcode='42501';
  end if;
  select l.user_id into target_uid from public.js_liga_wa_links l where l.jid=p_jid;
  if target_uid is null then
    return jsonb_build_object('ok',false,'need_link',true,
      'message','Vinculá primero tu WhatsApp con JS Torneos.');
  end if;
  select s.id into active_season from public.js_liga_seasons s
    where s.state='active' order by s.id desc limit 1;
  if active_season is null then
    return jsonb_build_object('ok',true,'total',0,'matches','[]'::jsonb);
  end if;
  select count(*) into total_matches from public.js_liga_matches m
    where m.season_id=active_season
      and (target_uid=any(m.lineup_a) or target_uid=any(m.lineup_b))
      and (m.state in ('playing','review') or
           (m.state='pending' and m.accept_until>now()));
  select coalesce(jsonb_agg(q.item order by q.sort_order,q.id desc),'[]'::jsonb)
    into items
  from (
    select m.id,
      case when m.state='pending' and not coalesce(
        (select v.accepted from public.js_liga_match_votes v
          where v.match_id=m.id and v.user_id=target_uid),false) then 0
        when m.state='playing' then 1
        when m.state='pending' then 2
        else 3 end as sort_order,
      jsonb_build_object(
        'id',m.id,'state',m.state,
        'opponents',coalesce((
           select string_agg(left(coalesce(nullif(p.nickname,''),
             nullif(p.display_name,''),'Jugador'),34),' + ' order by z.pos)
           from unnest(case when target_uid=any(m.lineup_a)
              then m.lineup_b else m.lineup_a end)
                with ordinality as z(member,pos)
           left join public.js_player_profiles p on p.user_id=z.member
        ),'Dúo rival'),
        'accepted',(select count(*) from public.js_liga_match_votes v
           where v.match_id=m.id and v.accepted=true),
        'reported',(
    (case when exists(select 1 from public.js_liga_match_votes v
       where v.match_id=m.id and v.result is not null and v.user_id=any(m.lineup_a))
       then 1 else 0 end)+
    (case when exists(select 1 from public.js_liga_match_votes v
       where v.match_id=m.id and v.result is not null and v.user_id=any(m.lineup_b))
       then 1 else 0 end)
   ),
        'my_accepted',coalesce((select v.accepted from public.js_liga_match_votes v
           where v.match_id=m.id and v.user_id=target_uid),false),
        'my_result',(select v.result from public.js_liga_match_votes v
           where v.match_id=m.id and v.user_id=target_uid),
        'accept_until',m.accept_until
      ) as item
    from public.js_liga_matches m
    where m.season_id=active_season
      and (target_uid=any(m.lineup_a) or target_uid=any(m.lineup_b))
      and (m.state in ('playing','review') or
           (m.state='pending' and m.accept_until>now()))
    order by sort_order,m.id desc
    limit 40
  ) q;
  return jsonb_build_object('ok',true,'total',total_matches,'matches',items);
end
$function$
