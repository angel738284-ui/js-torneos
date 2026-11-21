CREATE OR REPLACE FUNCTION public.js_liga_estado()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 v_user uuid := auth.uid();
 v_season public.js_liga_seasons%rowtype;
 v_teams jsonb := '[]'::jsonb;
 v_players jsonb := '[]'::jsonb;
 v_matches jsonb := '[]'::jsonb;
 v_invites jsonb := '[]'::jsonb;
 v_hist jsonb := '[]'::jsonb;
 v_admin boolean := false;
begin
 if v_user is null then
   raise exception 'Iniciá sesión con tu cuenta JS Torneos' using errcode='42501';
 end if;
 select exists(select 1 from public.js_admins where uid=v_user) into v_admin;
 select * into v_season from public.js_liga_seasons
  where state='active' order by id desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.user_id,'name',left(coalesce(nullif(p.display_name,''),p.nickname),80),
    'region',p.region
  ) order by p.nickname), '[]'::jsonb)
 into v_players
 from public.js_player_profiles p where p.verified_at is not null;
 if v_season.id is not null then
   select coalesce(jsonb_agg(jsonb_build_object(
     'id',t.id,'captain',t.captain,'partner',t.partner,
     'substitute',t.substitute,'replaced',t.replaced,
     'wins',t.wins,'losses',t.losses,'created',t.created_at,'archived',t.archived_at is not null)
     order by t.wins desc,t.losses,t.created_at), '[]'::jsonb)
   into v_teams from public.js_liga_teams t where t.season_id=v_season.id;
   select coalesce(jsonb_agg(jsonb_build_object(
     'id',m.id,'a',m.team_a,'b',m.team_b,'lineup_a',m.lineup_a,'lineup_b',m.lineup_b,
     'state',case
       when m.state='pending' and m.accept_until<now() then 'expired'
       
       else m.state end,
     'created',m.created_at,'started_at',m.started_at,'accept_until',m.accept_until,
     'result_until',m.result_until,'winner',m.winner,
     'confirmed',(select count(*) from public.js_liga_match_votes v where v.match_id=m.id and v.accepted=true),
     'reported',(
       (case when exists(select 1 from public.js_liga_match_votes v
         where v.match_id=m.id and v.result is not null and v.user_id=any(m.lineup_a))
           then 1 else 0 end)+
       (case when exists(select 1 from public.js_liga_match_votes v
         where v.match_id=m.id and v.result is not null and v.user_id=any(m.lineup_b))
           then 1 else 0 end)
     ),
     'result_details',(
      select coalesce(jsonb_agg(jsonb_build_object('user_id',u.user_id,
       'result',v.result) order by u.ord),'[]'::jsonb)
      from unnest(coalesce(m.lineup_a,'{}'::uuid[])||coalesce(m.lineup_b,'{}'::uuid[]))
        with ordinality as u(user_id,ord)
      left join public.js_liga_match_votes v on v.match_id=m.id and v.user_id=u.user_id
     ),
     'my_vote',(select jsonb_build_object('accepted',v.accepted,'result',v.result)
                from public.js_liga_match_votes v where v.match_id=m.id and v.user_id=v_user),
     'acceptances',(
       select coalesce(jsonb_agg(
         jsonb_build_object(
           'user_id',participant.user_id,
           'accepted',coalesce(votes.accepted,false),
           'status',case
             when votes.accepted is true then 'accepted'
             when votes.accepted is false then 'rejected'
             else 'pending' end
         )
         order by participant.ordinality
       ),'[]'::jsonb)
       from unnest(coalesce(m.lineup_a,'{}'::uuid[]) || coalesce(m.lineup_b,'{}'::uuid[]))
          with ordinality as participant(user_id,ordinality)
       left join public.js_liga_match_votes votes
         on votes.match_id=m.id and votes.user_id=participant.user_id
     )
   ) order by m.created_at desc), '[]'::jsonb) into v_matches
   from (
     select * from public.js_liga_matches m0
     where m0.season_id=v_season.id
       and (
         -- New invitations remain visible ONLY during their 2-minute period
         -- so the other three participants can still accept or reject.
         (m0.state='pending' and m0.accept_until>now())
         or
         -- Only fully approved and actually started games belong to the
         -- official results/history, including old reviewed games.
         (m0.started_at is not null
           and (select count(*) from public.js_liga_match_votes v0
                where v0.match_id=m0.id and v0.accepted=true)=4)
       )
     order by m0.id desc limit 80
   ) m;
   select coalesce(jsonb_agg(jsonb_build_object(
    'id',i.id,'kind',i.kind,'from_user',i.from_user,'to_user',i.to_user,
    'team_id',i.team_id,'expires_at',i.expires_at
   ) order by i.created_at desc),'[]'::jsonb) into v_invites
   from public.js_liga_invites i where i.season_id=v_season.id and
   i.state='pending' and i.expires_at>now() and (i.from_user=v_user or i.to_user=v_user);
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',h.id,'prize',h.prize,'champion',h.champion,'finished_at',h.finished_at
 ) order by h.id desc),'[]'::jsonb) into v_hist
 from (select * from public.js_liga_seasons where state='finished' order by id desc limit 8) h;
 return jsonb_build_object(
    'ok',true,'user',v_user,'admin',v_admin,
   'paused',case when v_season.id is null then false else
      coalesce((select c.paused from public.js_liga_control c
      where c.season_id=v_season.id),false) end,
   'season',case when v_season.id is null then null else
     jsonb_build_object('id',v_season.id,'state',v_season.state,'prize',v_season.prize,
       'started',v_season.created_at) end,
   'players',v_players,'teams',v_teams,'matches',v_matches,
   'invites',v_invites,'history',v_hist
 );
end
$function$
