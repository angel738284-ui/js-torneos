-- JS Family Bomba Mortal: select the actual Quaternius GLB outfit from 21 CC0 packs.
-- The old 18 avatar fields and all game authority checks remain untouched.
do $change$
declare
 source text;
 at_pos integer;
 outfits text[]:=array[
 'Male/Adventurer','Male/Beach','Male/Casual_2','Male/Casual_Hoodie',
 'Male/Farmer','Male/King','Male/Punk','Male/Spacesuit','Male/Suit','Male/Swat','Male/Worker',
 'Female/Adventurer','Female/Casual','Female/Formal','Female/Medieval','Female/Punk',
 'Female/SciFi','Female/Soldier','Female/Suit','Female/Witch','Female/Worker'];
begin
 select pg_catalog.pg_get_functiondef('public.js_bomba_jugar(text,text,text,uuid,jsonb)'::regprocedure) into source;
 at_pos:=position('  update js_bomb.players set avatar=a where id=p.id;' in source);
 if at_pos=0 or position('if (a->>''gender'') not in ' in source)=0 then
  raise exception 'Unexpected avatar function implementation, aborting safely';
 end if;
 if position('coalesce(p_avatar->>''outfit3d''' in source)=0 then
  source:=substring(source,1,at_pos-1) ||
$section$
  a:=a || jsonb_build_object('outfit3d',
   coalesce(nullif(p_avatar->>'outfit3d',''),
    nullif(p.avatar->>'outfit3d',''),
    case when a->>'gender'='woman' then 'Female/Casual' else 'Male/Casual_Hoodie' end));
  if not (a->>'outfit3d'=any(array[
 'Male/Adventurer','Male/Beach','Male/Casual_2','Male/Casual_Hoodie',
 'Male/Farmer','Male/King','Male/Punk','Male/Spacesuit','Male/Suit','Male/Swat','Male/Worker',
 'Female/Adventurer','Female/Casual','Female/Formal','Female/Medieval','Female/Punk',
 'Female/SciFi','Female/Soldier','Female/Suit','Female/Witch','Female/Worker'])) then
   raise exception 'El atuendo 3D no está disponible';
  end if;
$section$ || substring(source,at_pos);
  execute source;
 end if;
end $change$;

alter table js_bomb.players alter column avatar set default
 (('{"gender":"man","body":"regular","face":"soft","skin":"#eac49b","eyes":"brown","expression":"smile","beard":"none","hair":"spiky","hairColor":"#262333","topStyle":"tee","shirt":"#775de6","pattern":"plain","bottomStyle":"pants","pants":"#273751","shoes":"white","accessory":"none","aura":"none","pose":"idle","outfit3d":"Male/Casual_Hoodie"}')::jsonb);
