-- Only extend the existing authenticated Bomba Mortal avatar RPC with a
-- backwards-compatible 3D wardrobe toggle; do not change game authorization.
do $upgrade$
declare
 source text; at_pos integer;
begin
 select pg_catalog.pg_get_functiondef(
  'public.js_bomba_jugar(text,text,text,uuid,jsonb)'::regprocedure
 ) into source;
 at_pos:=position('  update js_bomb.players set avatar=a where id=p.id;' in source);
 if at_pos=0 or position('if p.id is null' in source)=0 then
  raise exception 'Avatar RPC validation changed; no alteration made';
 end if;
 if position('coalesce(p_avatar->>''wear3d''' in source)=0 then
  source:=substr(source,1,at_pos-1)||
$wardrobe$
  a:=a||jsonb_build_object('wear3d',
     coalesce(nullif(p_avatar->>'wear3d',''),
       nullif(p.avatar->>'wear3d',''),'no'));
  if a->>'wear3d' not in ('yes','no') then
    raise exception 'La opción de vestimenta 3D no es válida';
  end if;
$wardrobe$||substr(source,at_pos);
  execute source;
 end if;
end $upgrade$;