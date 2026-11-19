-- Avatar customization upgrade for JS Family Bomba Mortal.
-- Keep all existing access controls and pass-the-bomb rules unchanged.
do $upgrade$
declare
  original text;
  begin_pos integer;
  end_pos integer;
begin
  select pg_catalog.pg_get_functiondef('public.js_bomba_jugar(text,text,text,uuid,jsonb)'::regprocedure)
  into original;
  begin_pos:=position('  safe_hair:=' in original);
  end_pos:=position('  update js_bomb.players set avatar=a where id=p.id;' in original);
  if begin_pos=0 or end_pos<=begin_pos then
    raise exception 'The Bomba avatar function no longer matches the reviewed version';
  end if;
  original:=substr(original,1,begin_pos-1) ||
$avatar$
  a:=jsonb_build_object(
    'gender', coalesce(p_avatar->>'gender',p.avatar->>'gender','man'),
    'body', coalesce(p_avatar->>'body',p.avatar->>'body','regular'),
    'face', coalesce(p_avatar->>'face',p.avatar->>'face','soft'),
    'skin', coalesce(p_avatar->>'skin',p.avatar->>'skin','#eac49b'),
    'eyes', coalesce(p_avatar->>'eyes',p.avatar->>'eyes','brown'),
    'expression', coalesce(p_avatar->>'expression',p.avatar->>'expression','smile'),
    'beard', coalesce(p_avatar->>'beard',p.avatar->>'beard','none'),
    'hair', coalesce(p_avatar->>'hair',p.avatar->>'hair','spiky'),
    'hairColor', coalesce(p_avatar->>'hairColor',p.avatar->>'hairColor','#262333'),
    'topStyle', coalesce(p_avatar->>'topStyle',p.avatar->>'topStyle','tee'),
    'shirt', coalesce(p_avatar->>'shirt',p.avatar->>'shirt','#775de6'),
    'pattern', coalesce(p_avatar->>'pattern',p.avatar->>'pattern','plain'),
    'bottomStyle', coalesce(p_avatar->>'bottomStyle',p.avatar->>'bottomStyle','pants'),
    'pants', coalesce(p_avatar->>'pants',p.avatar->>'pants','#273751'),
    'shoes', coalesce(p_avatar->>'shoes',p.avatar->>'shoes','white'),
    'accessory', coalesce(p_avatar->>'accessory',p.avatar->>'accessory','none'),
    'aura', coalesce(p_avatar->>'aura',p.avatar->>'aura','none'),
    'pose', coalesce(p_avatar->>'pose',p.avatar->>'pose','idle')
  );
  if (a->>'gender') not in ('man','woman') or
     (a->>'body') not in ('regular','slim','athletic') or
     (a->>'face') not in ('soft','round','sharp') or
     (a->>'skin') not in ('#f6d5b2','#eac49b','#b87a5b','#855036','#ffe0c6','#cd916f') or
     (a->>'eyes') not in ('brown','blue','green','violet','grey') or
     (a->>'expression') not in ('smile','confident','serious','wink','happy') or
     (a->>'beard') not in ('none','stubble','mustache','full') or
     (a->>'hair') not in ('spiky','short','long','mohawk','bob','curly','ponytail','braids','fade','waves','bun','bangs') or
     (a->>'hairColor') not in ('#262333','#784c32','#f4d76b','#d84461','#d8ecf1','#5e58d2','#34b7bb','#f4a3c3','#b76b33') or
     (a->>'topStyle') not in ('tee','hoodie','jacket','jersey','dress','crop') or
     (a->>'shirt') not in ('#775de6','#e7476f','#1eacc4','#2eae77','#ebba52','#151b2b','#f5f3ed','#ef793d') or
     (a->>'pattern') not in ('plain','stripes','star','number','bolt','heart') or
     (a->>'bottomStyle') not in ('pants','cargo','shorts','skirt','jeans') or
     (a->>'pants') not in ('#273751','#181d29','#a5acb8','#824b62','#426b75','#e5c4a5') or
     (a->>'shoes') not in ('white','black','red','gold','neon','pink') or
     (a->>'accessory') not in ('none','glasses','crown','mask','cap','headphones','earrings','bandana','horns') or
     (a->>'aura') not in ('none','cyan','purple','gold','fire','pink') or
     (a->>'pose') not in ('idle','wave','confident','dance') then
    raise exception 'Elegí piezas válidas del editor de personajes';
  end if;
$avatar$ || substr(original,end_pos);
  execute original;
end $upgrade$;
-- Defaults apply to newly registered players; existing avatars remain intact.
alter table js_bomb.players alter column avatar set default '{"gender":"man","body":"regular","face":"soft","skin":"#eac49b","eyes":"brown","expression":"smile","beard":"none","hair":"spiky","hairColor":"#262333","topStyle":"tee","shirt":"#775de6","pattern":"plain","bottomStyle":"pants","pants":"#273751","shoes":"white","accessory":"none","aura":"none","pose":"idle"}'::jsonb;
