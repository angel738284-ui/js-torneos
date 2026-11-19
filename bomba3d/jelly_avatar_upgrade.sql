-- JS Family original jelly characters: safe 3D customization without external assets.
do $upgrade$
declare source text; at_pos integer;
begin
 select pg_catalog.pg_get_functiondef('public.js_bomba_jugar(text,text,text,uuid,jsonb)'::regprocedure) into source;
 at_pos:=position('  update js_bomb.players set avatar=a where id=p.id;' in source);
 if at_pos=0 then raise exception 'Se modificó la función del editor';end if;
 if position('coalesce(p_avatar->>''costume3d''' in source)=0 then
  source:=substring(source,1,at_pos-1) ||
$validate$
  a:=a || jsonb_build_object(
   'costume3d', coalesce(nullif(p_avatar->>'costume3d',''),nullif(p.avatar->>'costume3d',''),'plain'),
   'bodyColor3d', coalesce(nullif(p_avatar->>'bodyColor3d',''),nullif(p.avatar->>'bodyColor3d',''),'#f83e50'),
   'hoodColor3d', coalesce(nullif(p_avatar->>'hoodColor3d',''),nullif(p.avatar->>'hoodColor3d',''),'#f6c843')
  );
  if (a->>'costume3d') not in (
    'plain','dino','cat','frog','chicken','bear','bunny','hero',
    'office','ninja','robot','astronaut'
  ) or (a->>'bodyColor3d') not in (
    '#f83e50','#27b9e8','#4acb75','#ffcf45','#ff84b6',
    '#8970e8','#ef8f43','#2c344e','#eff0e8','#54d7ca'
  ) or (a->>'hoodColor3d') not in (
    '#f6c843','#f83e50','#27b9e8','#4acb75','#ff84b6',
    '#8970e8','#ef8f43','#2c344e','#eff0e8','#54d7ca'
  ) then
   raise exception 'Elegí un disfraz o color válido para tu muñeco';
  end if;
$validate$ || substring(source,at_pos);
  execute source;
 end if;
end $upgrade$;
alter table js_bomb.players alter column avatar set default
('{"gender":"man","body":"regular","face":"soft","skin":"#eac49b","eyes":"brown","expression":"smile","beard":"none","hair":"spiky","hairColor":"#262333","topStyle":"tee","shirt":"#775de6","pattern":"plain","bottomStyle":"pants","pants":"#273751","shoes":"white","accessory":"none","aura":"none","pose":"idle","outfit3d":"Male/Casual_Hoodie","costume3d":"plain","bodyColor3d":"#f83e50","hoodColor3d":"#f6c843"}')::jsonb;
