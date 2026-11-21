
import { createClient } from "npm:@supabase/supabase-js@2";

const url=Deno.env.get("SUPABASE_URL")!;
const admin=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{
 auth:{persistSession:false,autoRefreshToken:false}
});
const h={"content-type":"application/json;charset=utf-8","access-control-allow-origin":"*","access-control-allow-headers":"authorization,apikey,content-type","access-control-allow-methods":"POST,OPTIONS","cache-control":"no-store"};
const reply=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:h});
const validId=(s:unknown):s is string=>typeof s==="string"&&/^[0-9]{5,16}$/.test(s);
const validCode=(s:unknown):s is string=>typeof s==="string"&&/^JS-EQ-[A-HJ-NP-Z2-9]{20}$/.test(s);
async function digest(text:string){
 const data=new TextEncoder().encode(text);
 const h=await crypto.subtle.digest("SHA-256",data);
 return Array.from(new Uint8Array(h)).map(v=>v.toString(16).padStart(2,"0")).join("");
}

// Los torneos antiguos usan NAC; el verificador de Free Fire responde NA para Norte.
function sameGameRegion(a: unknown,b: unknown): boolean {
 const norm=(x: unknown)=>{const value=String(x??"").trim().toUpperCase();return value==="NAC"?"NA":value;};
 return !!norm(a) && norm(a)===norm(b);
}

async function gameLookup(id:string){
 const {data:key,error}=await admin.rpc("js_epinby_key_private");
 if(error||!key)throw new Error("No se pudo acceder al verificador de Free Fire");
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),12500);
 let res:Response;
 try{
   res=await fetch("https://epinby.com/api/v1/validate-player",{
     method:"POST",signal:abort.signal,
     headers:{"X-API-KEY":String(key),"accept":"application/json","content-type":"application/json"},
     body:JSON.stringify({product_id:2484,player_id:id})
   });
 }finally{clearTimeout(timer)}
 if(!res.ok)throw new Error("El verificador de Free Fire no responde. Probá más tarde.");
 const json=await res.json(),info=json?.data;
 if(json?.success!==true||info?.nickname_verified!==true)
   throw new Error("No se pudo verificar el apodo de este ID");
 const nickname=String(info.nickname||info.player_name||"").trim();
 if(!nickname||nickname.length>100)throw new Error("No pudimos leer el nombre del jugador");
 // La validación gratuita de Epinby confirma apodo, pero puede ocultar la región.
 // Nunca atribuir SAC, NA o US sin evidencia; guardar PENDIENTE hasta confirmarla.
 const rawRegion=String(info.actual_region||info.region||"").trim().toUpperCase();
 const region=rawRegion==="NAC"?"NA":
   ["SAC","NA","US"].includes(rawRegion)?rawRegion:"PENDIENTE";
 return {nickname,region};
}
async function profileFor(uid:string){
 const {data,error}=await admin.from("js_player_profiles")
 .select("game_id,nickname,region,verified_at,updated_at,display_name,username,bio,avatar_path,banner_path,instagram_url,tiktok_url").eq("user_id",uid).maybeSingle();
 if(error)throw new Error("No se pudo cargar el perfil");
 return data||null;
}
async function mine(uid:string,id:string){
 const {data:roster,error}=await admin.from("js_players")
 .select("team_id,player_role").eq("game_id",id).limit(100);
 if(error)throw new Error("No se pudo buscar tus inscripciones");
 const ids=[...new Set((roster||[]).map(x=>x.team_id).filter(Boolean))];
 if(!ids.length)return [];
 const {data:teamRoster,error:rosterError}=await admin.from("js_players")
  .select("team_id,game_id,nickname,player_role,roster_order").in("team_id",ids).limit(500);
 if(rosterError)throw new Error("No se pudieron cargar los integrantes");
 const {data:teams,error:teamError}=await admin.from("js_teams")
 .select("id,name,status,tournament_id").in("id",ids);
 if(teamError)throw new Error("No se pudieron consultar tus equipos");
 const tourIds=[...new Set((teams||[]).map(x=>x.tournament_id))];
 if(!tourIds.length)return [];
 const {data:tournaments,error:tourError}=await admin.from("js_tournaments")
 .select("id,name,code,status,team_size,mode,br_format,starts_at,rounds,archived_at")
 .in("id",tourIds);
 if(tourError)throw new Error("No se pudieron consultar tus torneos");
 const visible=(tournaments||[]).filter(t=>!t.archived_at);
 const tourIdsVisible=visible.map(x=>x.id);
 const brTourIds=visible.filter(t=>t.mode==="BR").map(t=>t.id);
 const {data:brRooms,error:brError}=brTourIds.length
 ?await admin.from("js_br_rooms").select("tournament_id,room_id,room_password,sent_at,is_open,winner_team").in("tournament_id",brTourIds)
 :{data:[]};
 if(brError)throw new Error("No se pudieron consultar las salas BR");
 const brMap=new Map((brRooms||[]).map(r=>[r.tournament_id,r]));
 const {data:brMapRooms,error:brMapRoomsError}=brTourIds.length
 ?await admin.from("js_br_map_rooms").select("tournament_id,map_number,map_name,room_id,room_password,sent_at,is_open")
   .in("tournament_id",brTourIds).order("map_number"):{data:[]};
 if(brMapRoomsError)throw new Error("No se pudieron cargar los mapas BR");
 const brMapsByTour=new Map<string,any[]>();
 for(const room of brMapRooms||[]){
  if(!brMapsByTour.has(room.tournament_id))brMapsByTour.set(room.tournament_id,[]);
  brMapsByTour.get(room.tournament_id)!.push(room);
 }

 const winnerIds=[...new Set((brRooms||[]).map(r=>r.winner_team).filter(Boolean))];
 const {data:brWinners}=winnerIds.length
  ?await admin.from("js_teams").select("id,name").in("id",winnerIds):{data:[]};
 const brWinnerMap=new Map((brWinners||[]).map(t=>[t.id,t.name]));
 const {data:matches}=tourIdsVisible.length
 ?await admin.from("js_matches").select("id,tournament_id,round,team_a,team_b,winner,final_wins_a,final_wins_b")
  .in("tournament_id",tourIdsVisible).limit(250)
 :{data:[]};
 const relevant=(matches||[]).filter(m=>ids.includes(m.team_a)||ids.includes(m.team_b));
 const matchIds=relevant.map(x=>x.id);
 const {data:rooms}=matchIds.length
 ?await admin.from("js_match_rooms").select("match_id,sent_at,expires_at,room_id,room_password").in("match_id",matchIds)
 :{data:[]};
 const roomsMap=new Map((rooms||[]).map(x=>[x.match_id,x]));
 const {data:checkins,error:readyError}=matchIds.length
 ?await admin.from("js_player_match_checkins")
  .select("match_id,team_id,user_id,confirmed_at").in("match_id",matchIds).limit(1000)
 :{data:[]};
 if(readyError)throw new Error("No se pudieron consultar las confirmaciones");
 const otherIds=[...new Set(relevant.flatMap(m=>[m.team_a,m.team_b]).filter(Boolean))];
 const {data:opponents}=otherIds.length
 ?await admin.from("js_teams").select("id,name").in("id",otherIds).limit(250):{data:[]};
 const opponentMap=new Map((opponents||[]).map(t=>[t.id,t.name]));
 const ownTeamMap=new Map((teams||[]).map(t=>[t.id,t]));
 const toured=new Map(visible.map(t=>[t.id,t]));
 return (roster||[]).flatMap(item=>{
   const squad=ownTeamMap.get(item.team_id);
   if(!squad)return [];
   const tour=toured.get(squad.tournament_id);
   if(!tour)return [];
   const games=relevant.filter(m=>m.tournament_id===tour.id&&(m.team_a===squad.id||m.team_b===squad.id))
     .map(m=>{
       const room=roomsMap.get(m.id);
       const expires=room?.sent_at?Date.parse(room.expires_at||new Date(Date.parse(room.sent_at)+600000).toISOString()):NaN;
       // Only the Google account associated with a rostered Free Fire ID gets
       // the room secret, and only while their team is registered and the
       // administrator's 10-minute window is active.
       const sent=room?.sent_at?Date.parse(room.sent_at):NaN;
       const active=squad.status==="registered"&&tour.status!=="finished"&&
         !m.winner&&Number.isFinite(sent)&&Number.isFinite(expires)&&
         Date.now()>=sent&&expires>Date.now()&&!!m.team_a&&!!m.team_b;
       const isOwnA=m.team_a===squad.id;
       const ready=(checkins||[]).filter(x=>x.match_id===m.id&&x.team_id===squad.id);
       return {
         round:m.round,match_id:m.id,
         opponent:opponentMap.get(isOwnA?m.team_b:m.team_a)||"Por definir",
         result:m.winner?(m.winner===squad.id?"win":"lose"):"pending",
         room_status:active?"active":room?.sent_at?"expired":"not_sent",
         room_id:active?room.room_id:null,room_password:active?room.room_password:null,
         room_expires_at:active?new Date(expires).toISOString():null,
         ready_count:ready.length,self_ready:ready.some(x=>x.user_id===uid),
         can_check_in:!m.winner&&!!m.team_a&&!!m.team_b&&(!room?.sent_at||active)
       };
     });
   const br=brMap.get(tour.id);
   const canSeeBR=squad.status==="registered"&&br?.is_open&&tour.status!=="finished";
   const brWinnerName=br?.winner_team?brWinnerMap.get(br.winner_team)||"Ganador":null;
   const br_maps=tour.mode==="BR" ? [1,2,3].map(number=>{
    const mapName=["Bermuda","Purgatorio","Kalahari"][number-1];
    const mapRoom=(brMapsByTour.get(tour.id)||[]).find(x=>x.map_number===number);
    const allowed=squad.status==="registered"&&tour.status!=="finished"&&!!mapRoom?.is_open;
    return {map_number:number,map_name:mapName,
      status:tour.status==="finished"?"finished":allowed?"active":mapRoom?"closed":"pending",
      room_id:allowed?mapRoom.room_id:null,room_password:allowed?mapRoom.room_password:null,
      sent_at:mapRoom?.sent_at||null};
   }):null;
   const br_room=tour.mode==="BR" ? {
      status:br?.winner_team?"finished":canSeeBR?"active":br?"closed":"not_sent",
      room_id:canSeeBR?br.room_id:null,room_password:canSeeBR?br.room_password:null,
      sent_at:br?.sent_at||null,
      winner_name:brWinnerName,
      winner:br?.winner_team===squad.id?"win":br?.winner_team?"lose":null
   }:null;
   return [{team:squad.name,team_id:squad.id,tournament_id:tour.id,br_format:tour.br_format,role:item.player_role,
     tournament:tour.name,code:tour.code,status:tour.status,
     mode:tour.mode,starts_at:tour.starts_at,team_status:squad.status,br_room,br_maps,
     roster:(teamRoster||[]).filter(p=>p.team_id===squad.id)
      .sort((a,b)=>(a.player_role==="suplente")-(b.player_role==="suplente")||a.roster_order-b.roster_order)
      .map(p=>({nickname:p.nickname,game_id:p.game_id,role:p.player_role,order:p.roster_order})),
     matches:games}];
 });
}

async function statsFor(id:string){
 const {data:membership,error:memberError}=await admin.from("js_players")
  .select("tournament_id,team_id").eq("game_id",id).limit(500);
 if(memberError)throw new Error("No se pudieron consultar estadísticas");
 const members=membership||[];
 const tid=[...new Set(members.map(m=>m.tournament_id))];
 if(!tid.length)return {tournaments:0,victories:0,defeats:0,championships:0};
 const owned=new Set(members.map(x=>x.team_id));
 const {data:tours,error:tourError}=await admin.from("js_tournaments")
  .select("id,status,rounds,mode").in("id",tid).limit(500);
 if(tourError)throw new Error("Estadísticas no disponibles");
 const {data:games,error:gameError}=await admin.from("js_matches")
  .select("tournament_id,round,team_a,team_b,winner").in("tournament_id",tid).limit(1500);
 if(gameError)throw new Error("Estadísticas no disponibles");
 const won=(games||[]).filter(m=>m.winner&&owned.has(m.winner));
 const lost=(games||[]).filter(m=>m.winner&&(owned.has(m.team_a)||owned.has(m.team_b))&&!owned.has(m.winner));
 const champion=new Set((tours||[]).filter(t=>t.status==="finished").flatMap(t=>
  won.filter(m=>m.tournament_id===t.id&&m.round===t.rounds).map(m=>t.id)));
 const brTours=(tours||[]).filter(t=>t.mode==="BR");
 if(brTours.length){
   const {data:brWinners}=await admin.from("js_br_rooms").select("tournament_id,winner_team")
     .in("tournament_id",brTours.map(t=>t.id));
   for(const entry of brWinners||[]){
     if(owned.has(entry.winner_team))champion.add(entry.tournament_id);
   }
 }
 return {tournaments:tid.length,victories:won.length,defeats:lost.length,championships:champion.size};
}

async function markReady(uid:string,id:string,matchId:string){
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,40}$/i.test(matchId))throw new Error("Partida inválida");
 const {data:match,error:matchError}=await admin.from("js_matches")
  .select("id,tournament_id,team_a,team_b,winner").eq("id",matchId).maybeSingle();
 if(matchError||!match||match.winner||!match.team_a||!match.team_b)
  throw new Error("El cruce todavía no admite confirmaciones");
 const {data:player,error:playerError}=await admin.from("js_players")
  .select("team_id").eq("tournament_id",match.tournament_id).eq("game_id",id).maybeSingle();
 if(playerError||!player||![match.team_a,match.team_b].includes(player.team_id))
  throw new Error("No figurás como participante de ese enfrentamiento");
 const {data:team}=await admin.from("js_teams").select("status").eq("id",player.team_id).maybeSingle();
 const {data:tour}=await admin.from("js_tournaments")
  .select("status,archived_at").eq("id",match.tournament_id).maybeSingle();
 if(!team||team.status!=="registered"||!tour||tour.status==="finished"||tour.archived_at)
  throw new Error("El encuentro ya no admite confirmaciones");
 const {data:room}=await admin.from("js_match_rooms").select("sent_at").eq("match_id",match.id).maybeSingle();
 if(room?.sent_at&&Date.now()>Date.parse(room.sent_at)+600000)
  throw new Error("El tiempo para ingresar a la sala ya terminó");
 const {error}=await admin.from("js_player_match_checkins").upsert({
  match_id:match.id,team_id:player.team_id,user_id:uid,game_id:id,
  confirmed_at:new Date().toISOString()
 },{onConflict:"match_id,user_id"});
 if(error)throw new Error("No pudimos guardar tu confirmación");
 const {count}=await admin.from("js_player_match_checkins")
  .select("user_id",{head:true,count:"exact"}).eq("match_id",match.id).eq("team_id",player.team_id);
 return {ok:true,confirmed:true,match_id:match.id,ready_count:count??1};
}


async function requireProfile(uid:string) {
 const p=await profileFor(uid);
 if(!p)throw new Error("Primero verificá tu ID de Free Fire en Perfil");
 return p;
}
async function targetAccount(gameId:string,self:string) {
 if(!validId(gameId))throw new Error("Ingresá un ID de Free Fire de 5 a 16 cifras");
 const {data,error}=await admin.from("js_player_profiles")
  .select("user_id,game_id,nickname,region").eq("game_id",gameId).maybeSingle();
 if(error)throw new Error("No se pudo buscar el jugador");
 if(!data)throw new Error("Ese ID aún no tiene cuenta registrada en JS Torneos con Google");
 if(data.user_id===self)throw new Error("No podés enviarte una solicitud a vos mismo");
 return data;
}
async function playerSocialSnapshot(uid:string) {
 const {data:links,error}=await admin.from("js_player_friendships")
  .select("id,user_a,user_b,requested_by,status,created_at")
  .or("user_a.eq."+uid+",user_b.eq."+uid).order("created_at",{ascending:false}).limit(250);
 if(error)throw new Error("No se pudieron consultar tus amistades");
 const peopleIds=[...new Set((links||[]).map(x=>x.user_a===uid?x.user_b:x.user_a))];
 const {data:people,error:peopleError}=peopleIds.length
 ?await admin.from("js_player_profiles").select("user_id,game_id,nickname,region").in("user_id",peopleIds)
 :{data:[]};
 if(peopleError)throw new Error("No se pudieron cargar tus amigos");
 const byId=new Map((people||[]).map(p=>[p.user_id,p]));
 const friends=(links||[]).map(item=>{
   const person=byId.get(item.user_a===uid?item.user_b:item.user_a);
   if(!person)return null;
   const state=item.status==="accepted"?"friend":item.requested_by===uid?"outgoing":"incoming";
   return {id:item.id,game_id:person.game_id,nickname:person.nickname,
     region:person.region,state,created_at:item.created_at};
 }).filter(Boolean);
 const {data:invites,error:inviteErr}=await admin.from("js_player_tournament_invites")
 .select("id,tournament_id,sender_id,status,created_at")
 .eq("recipient_id",uid).eq("status","pending").order("created_at",{ascending:false}).limit(60);
 if(inviteErr)throw new Error("No se pudieron consultar las invitaciones");
 const senderIds=[...new Set((invites||[]).map(x=>x.sender_id))];
 const tourIds=[...new Set((invites||[]).map(x=>x.tournament_id))];
 const {data:senders}=senderIds.length
 ?await admin.from("js_player_profiles").select("user_id,game_id,nickname").in("user_id",senderIds):{data:[]};
 const {data:tours}=tourIds.length
 ?await admin.from("js_tournaments").select("id,name,code,status,archived_at,starts_at").in("id",tourIds):{data:[]};
 const from=new Map((senders||[]).map(p=>[p.user_id,p]));
 const events=new Map((tours||[]).map(t=>[t.id,t]));
 const invitations=(invites||[]).flatMap(inv=>{
    const tour=events.get(inv.tournament_id),sender=from.get(inv.sender_id);
    if(!tour||!sender||tour.archived_at||tour.status!=="open")return [];
    return [{id:inv.id,from_nickname:sender.nickname,from_game_id:sender.game_id,
      tournament_name:tour.name,tournament_code:tour.code,starts_at:tour.starts_at,created_at:inv.created_at}];
 });
 return {ok:true,friends,invitations};
}
async function socialAction(uid:string,input:any) {
 await requireProfile(uid);
 const action=String(input?.action||"");
 if(action==="friend_lookup") {
   const found=await targetAccount(String(input.game_id||""),uid);
   return {ok:true,person:{game_id:found.game_id,nickname:found.nickname,region:found.region}};
 }
 if(action==="friends_snapshot")return await playerSocialSnapshot(uid);
 if(action==="friend_request"){
  const target=await targetAccount(String(input.game_id||""),uid);
  const userA=uid<target.user_id?uid:target.user_id;
  const userB=uid<target.user_id?target.user_id:uid;
  const {data:existing,error:checkErr}=await admin.from("js_player_friendships")
    .select("id,status,requested_by").eq("user_a",userA).eq("user_b",userB).maybeSingle();
  if(checkErr)throw Error("No se pudo comprobar la solicitud");
  if(existing){
   if(existing.status==="accepted")throw Error("Ya son amigos");
   if(existing.requested_by!==uid)throw Error("Esta persona ya te envió una solicitud. Aceptala en Amigos");
   throw Error("Ya enviaste la solicitud de amistad");
  }
  const since=new Date(Date.now()-86400000).toISOString();
  const {count,error:countErr}=await admin.from("js_player_friendships")
   .select("id",{count:"exact",head:true}).eq("requested_by",uid).gte("created_at",since);
  if(countErr||count===null)throw Error("No se pudo comprobar el límite de solicitudes");
  if(count>=25)throw Error("Alcanzaste el máximo de 25 solicitudes por día");
  const {error}=await admin.from("js_player_friendships").insert({
   user_a:userA,user_b:userB,requested_by:uid,status:"pending"
  });
  if(error?.code==="23505")throw Error("Ya existe una solicitud entre estas dos cuentas");
  if(error)throw Error("No se pudo enviar la solicitud");
  return {ok:true,sent:true,nickname:target.nickname};
 }
 if(action==="friend_answer"||action==="friend_remove"){
  const id=String(input.friendship_id||"");
  if(!/^[0-9a-f-]{36}$/i.test(id))throw Error("Solicitud inválida");
  const {data:link,error:err}=await admin.from("js_player_friendships")
    .select("id,user_a,user_b,requested_by,status").eq("id",id).maybeSingle();
  if(err||!link||![link.user_a,link.user_b].includes(uid))throw Error("Esta relación no te pertenece");
  if(action==="friend_remove"){
   const {error:e}=await admin.from("js_player_friendships").delete().eq("id",id);
   if(e)throw Error("No se pudo eliminar la amistad");
   return {ok:true,removed:true};
  }
  if(link.status!=="pending"||link.requested_by===uid)
   throw Error("Solamente quien recibió la solicitud puede aceptarla o rechazarla");
  if(input.answer==="accept"){
   const {error:e}=await admin.from("js_player_friendships")
     .update({status:"accepted",accepted_at:new Date().toISOString()})
     .eq("id",id).eq("status","pending");
   if(e)throw Error("No se pudo aceptar la amistad");
   return {ok:true,accepted:true};
  }
  if(input.answer==="reject"){
   const {error:e}=await admin.from("js_player_friendships").delete().eq("id",id);
   if(e)throw Error("No se pudo rechazar la solicitud");
   return {ok:true,rejected:true};
  }
  throw Error("Respuesta inválida");
 }
 if(action==="friend_tournaments"){
  const {data,error}=await admin.from("js_tournaments")
   .select("code,name,mode,starts_at,status,max_teams")
   .eq("status","open").is("archived_at",null).order("starts_at",{ascending:true,nullsFirst:false}).limit(40);
  if(error)throw Error("No se pudieron buscar los torneos");
  return {ok:true,tournaments:(data||[]).map(({code,name,mode,starts_at})=>({code,name,mode,starts_at}))};
 }
 if(action==="friend_invite"){
  const target=await targetAccount(String(input.game_id||""),uid);
  const a=uid<target.user_id?uid:target.user_id,b=uid<target.user_id?target.user_id:uid;
  const {data:link}=await admin.from("js_player_friendships").select("id")
    .eq("user_a",a).eq("user_b",b).eq("status","accepted").maybeSingle();
  if(!link)throw Error("Solo podés invitar a tus amigos confirmados");
  const code=String(input.tournament_code||"").trim().toUpperCase();
  if(!/^JS-[A-F0-9]{8}$/.test(code))throw Error("Código de torneo inválido");
  const {data:t,error:te}=await admin.from("js_tournaments")
    .select("id,name,status,archived_at").eq("code",code).maybeSingle();
  if(te||!t||t.status!=="open"||t.archived_at)
    throw Error("El torneo ya no recibe inscripciones");
  const {data:existing}=await admin.from("js_player_tournament_invites")
    .select("id").eq("sender_id",uid).eq("recipient_id",target.user_id)
    .eq("tournament_id",t.id).maybeSingle();
  if(existing)throw Error("Ya invitaste a esta persona a ese torneo");
  const {count,error:limitErr}=await admin.from("js_player_tournament_invites")
    .select("id",{head:true,count:"exact"}).eq("sender_id",uid)
    .gte("created_at",new Date(Date.now()-86400000).toISOString());
  if(limitErr||count===null)throw Error("No se pudo comprobar el límite de invitaciones");
  if(count>=40)throw Error("Límite de invitaciones del día alcanzado");
  const {error:e}=await admin.from("js_player_tournament_invites").insert({
    sender_id:uid,recipient_id:target.user_id,tournament_id:t.id
  });
  if(e?.code==="23505")throw Error("Ya enviaste esa invitación");
  if(e)throw Error("No se pudo enviar la invitación");
  return {ok:true,invited:true,tournament:t.name,nickname:target.nickname};
 }
 if(action==="friend_invite_dismiss"){
  const id=String(input.invite_id||"");
  if(!/^[0-9a-f-]{36}$/i.test(id))throw Error("Invitación inválida");
  const {error}=await admin.from("js_player_tournament_invites")
   .update({status:"dismissed",viewed_at:new Date().toISOString()})
   .eq("recipient_id",uid).eq("id",id);
  if(error)throw Error("No se pudo cerrar la invitación");
  return {ok:true};
 }
 throw Error("Acción social desconocida");
}


async function isOfficialAdmin(uid:string){
 const {data,error}=await admin.from("js_player_special_badges").select("badge").eq("user_id",uid).eq("badge","owner_admin").maybeSingle();
 if(error)throw Error("No se pudo comprobar el rango de usuario");
 return Boolean(data);
}
const textClean=(val:unknown,max:number,name:string)=>{
 if(typeof val!=="string"||val.trim().length>max||/[\x00-\x1f\x7f]/.test(val))
 throw Error(name+" tiene un formato incorrecto");
 return val.trim();
};
/** Enlaces de perfil de usuario: HTTPS + host oficial, nunca hosts parecidos. */
function normalizeSocialUrl(raw:unknown,platform:"instagram"|"tiktok"):string|null {
 if(raw===null||raw===undefined||raw==="")return null;
 if(typeof raw!=="string"||raw.trim().length>350)throw Error("El enlace de "+platform+" es demasiado largo o inválido");
 let value=raw.trim();
 if(!value)return null;
 const handle=value.match(/^@?([a-zA-Z0-9._]{1,30})$/);
 if(handle){
  const nick=handle[1];
  if(platform==="tiktok"&&nick.length<2)throw Error("Usuario de TikTok demasiado corto");
  value=platform==="instagram"?"https://www.instagram.com/"+nick+"/":"https://www.tiktok.com/@"+nick;
 }else if(/^(?:www\.)?(?:instagram\.com|tiktok\.com|m\.tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)\//i.test(value)){
  value="https://"+value;
 }
 let parsed:URL;
 try{parsed=new URL(value)}catch{throw Error("Pegá un enlace válido de "+platform+" o escribí @usuario");}
 const allowed=platform==="instagram"?
  ["instagram.com","www.instagram.com"]:
  ["tiktok.com","www.tiktok.com","m.tiktok.com","vm.tiktok.com","vt.tiktok.com"];
 if(parsed.protocol!=="https:"||!allowed.includes(parsed.hostname.toLowerCase())||
    !!parsed.username||!!parsed.password||!!parsed.port||parsed.pathname.length<2)
  throw Error("Usá un enlace oficial de "+(platform==="instagram"?"Instagram":"TikTok"));
 parsed.search="";parsed.hash="";
 const result=parsed.toString();
 if(result.length>350)throw Error("El enlace de "+platform+" es demasiado largo");
 return result;
}
function validatePath(path:unknown,uid:string,kind:"avatar"|"banner"){
 if(path===null||path==="")return null;
 const exact=uid+"/"+kind+".webp";
 if(path!==exact)throw Error("Ruta de imagen no autorizada");
 return exact;
}
async function editProfile(uid:string,input:any){
 await requireProfile(uid);
 const display_name=textClean(input.display_name,42,"El nombre");
 if(display_name.length<2)throw Error("Ingresá un nombre de 2 a 42 caracteres");
 const username=textClean(input.username,22,"El usuario").toLowerCase();
 if(!/^[a-z0-9_]{3,22}$/.test(username))throw Error("El @usuario admite letras, números y guiones bajos (3–22)");
 const bio=textClean(input.bio??"",180,"La biografía");
 const avatar=validatePath(input.avatar_path,uid,"avatar");
 const banner=validatePath(input.banner_path,uid,"banner");
 const socialUpdate:Record<string,string|null>={};
 if(Object.prototype.hasOwnProperty.call(input,"instagram_url"))socialUpdate.instagram_url=normalizeSocialUrl(input.instagram_url,"instagram");
 if(Object.prototype.hasOwnProperty.call(input,"tiktok_url"))socialUpdate.tiktok_url=normalizeSocialUrl(input.tiktok_url,"tiktok");
 if(avatar||banner){
   const {data:files,error}=await admin.storage.from("js-player-profiles").list(uid,{limit:30});
   if(error)throw Error("No se pudieron confirmar tus fotos");
   for(const path of [avatar,banner].filter(Boolean) as string[])
    if(!files?.some(f=>f.name===path.split("/")[1]))throw Error("Subí primero la foto o portada");
 }
 const {data,error}=await admin.from("js_player_profiles")
 .update({display_name,username,bio,avatar_path:avatar,banner_path:banner,...socialUpdate,updated_at:new Date().toISOString()})
 .eq("user_id",uid)
 .select("game_id,nickname,region,verified_at,updated_at,display_name,username,bio,avatar_path,banner_path,instagram_url,tiktok_url").single();
 if(error?.code==="23505")throw Error("Ese @usuario ya está ocupado. Elegí otro");
 if(error)throw Error("No se pudieron guardar los cambios del perfil");
 return {ok:true,profile:{...data,is_admin:await isOfficialAdmin(uid)}};
}
async function viewProfile(uid:string,gameId:unknown){
 await requireProfile(uid);
 if(!validId(gameId))throw Error("Ingresá un ID válido");
 const {data,error}=await admin.from("js_player_profiles")
 .select("user_id,game_id,nickname,region,display_name,username,bio,avatar_path,banner_path,instagram_url,tiktok_url,updated_at")
 .eq("game_id",gameId).maybeSingle();
 if(error||!data)throw Error("No se encontró el perfil de este jugador");
 const is_admin=await isOfficialAdmin(data.user_id);
 const {user_id,...info}=data;
 return {ok:true,profile:{...info,is_admin}};
}

// Vault de códigos: AES-GCM server-only. Nunca guardar el JS-EQ en texto claro.
async function accessKey(){
 const raw=new TextEncoder().encode("js-family-web-account-code-v1:"+Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
 const digest=await crypto.subtle.digest("SHA-256",raw);
 return crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["encrypt","decrypt"]);
}
function base64Data(arr:Uint8Array){
 return btoa(String.fromCharCode(...arr)).replace(/=+$/,"").replace(/\+/g,"-").replace(/\//g,"_");
}
function unbase64(raw:string){
 const s=raw.replace(/-/g,"+").replace(/_/g,"/");
 return Uint8Array.from(atob(s+"=".repeat((4-s.length%4)%4)),x=>x.charCodeAt(0));
}
async function encryptedAccess(code:string){
 const nonce=crypto.getRandomValues(new Uint8Array(12));
 const data=new TextEncoder().encode(code);
 const bytes=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv:nonce},await accessKey(),data));
 return {nonce_b64:base64Data(nonce),encrypted_code:base64Data(bytes)};
}
async function decodedAccess(enc:string,nonce:string){
 const decrypted=await crypto.subtle.decrypt(
  {name:"AES-GCM",iv:unbase64(nonce)},await accessKey(),unbase64(enc));
 return new TextDecoder().decode(decrypted);
}
async function findAuthorizedAccess(accessHash:string,gameId:string){
 const {data:team,error:err}=await admin.from("js_teams")
  .select("id,name,status,tournament_id").eq("access_code_hash",accessHash).maybeSingle();
 if(err)throw Error("No se pudo consultar la inscripción");
 if(team){
  const {data:player}=await admin.from("js_players")
   .select("id").eq("team_id",team.id).eq("game_id",gameId).maybeSingle();
  if(!player)return null;
  const {data:tour}=await admin.from("js_tournaments").select("name,code").eq("id",team.tournament_id).maybeSingle();
  return {kind:"registered",name:team.name,tournament:tour?.name||"Torneo",tournament_code:tour?.code||"",status:team.status};
 }
 const {data:wait,error:waitError}=await admin.from("js_tournament_waitlist")
  .select("id,team_name,tournament_id,roster,status").eq("access_code_hash",accessHash).maybeSingle();
 if(waitError)throw Error("No se pudo consultar la lista de espera");
 if(!wait||!Array.isArray(wait.roster)||!wait.roster.some((p:any)=>String(p?.id||p?.game_id||"")===gameId))
  return null;
 const {data:tour}=await admin.from("js_tournaments").select("name,code").eq("id",wait.tournament_id).maybeSingle();
 return {kind:"waiting",name:wait.team_name,tournament:tour?.name||"Torneo",tournament_code:tour?.code||"",status:wait.status};
}

Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:h});
 if(req.method!=="POST")return reply({error:"Método no permitido"},405);
 const bearer=(req.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
 if(!bearer)return reply({error:"Ingresá con Google o con tu correo electrónico"},401);
 const {data:identity,error:identityError}=await admin.auth.getUser(bearer);
 if(identityError||!identity?.user)return reply({error:"La sesión venció. Volvé a ingresar."},401);
 const user=identity.user;
 const providers=user.app_metadata?.providers;
 const google=Array.isArray(providers)&&providers.includes("google");
 const verifiedEmail=Boolean(user.email_confirmed_at&&user.email&&Array.isArray(providers)&&providers.includes("email"));
 if(!google&&!verifiedEmail)
   return reply({error:"Entrá con Google o confirmá tu correo antes de continuar"},403);
 let input:any;
 try{
   const length=Number(req.headers.get("content-length")||0);
   if(length>8192)return reply({error:"Solicitud demasiado grande"},413);
   input=await req.json();
 }catch{return reply({error:"Solicitud incorrecta"},400)}
 try{

   if(input?.action==="br_solo_register"||input?.action==="br_solo_cancel"){
     const profile=await requireProfile(user.id);
     const caller=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")!,{
       global:{headers:{Authorization:"Bearer "+bearer}},
       auth:{persistSession:false,autoRefreshToken:false}
     });
     if(input.action==="br_solo_register"){
       const code=String(input.tournament_code||"").trim().toUpperCase();
       if(!/^JS-[A-F0-9]{8}$/.test(code))return reply({error:"Código de torneo inválido"},400);
       const {data:tour,error:tourErr}=await admin.from("js_tournaments")
         .select("id,allowed_region,mode,br_format,status").eq("code",code).maybeSingle();
       if(tourErr||!tour)return reply({error:"Torneo no encontrado"},404);
       if(tour.mode!=="BR"||tour.br_format!=="solo")return reply({error:"La inscripción directa solo funciona en BR Solo"},400);
       if(tour.status!=="open")return reply({error:"Inscripciones cerradas"},409);
       const real=await gameLookup(profile.game_id);
       // Se valida apodo e ID; región no es requisito de inscripción.
       if(profile.region!==real.region || profile.nickname!==real.nickname){
         const {error:updated}=await admin.from("js_player_profiles")
           .update({region:real.region,nickname:real.nickname,verified_at:new Date().toISOString()})
           .eq("user_id",user.id);
         if(updated)return reply({error:"No se pudo actualizar el apodo verificado"},503);
       }
       const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
       const bytes=crypto.getRandomValues(new Uint8Array(20));
       const access="JS-EQ-"+Array.from(bytes,b=>alphabet[b%alphabet.length]).join("");
       const hash=await digest("js-torneos-team-access-v1:"+access);
       const {data,error}=await caller.rpc("js_register_br_solo",{p_code:code,p_access_hash:hash});
       if(error)return reply({error:error.message},409);
       return reply({ok:true,...data,team_access_code:data.already_registered?null:access});
     }
     const id=String(input.tournament_id||"");
     if(!/^[0-9a-f]{8}-[0-9a-f-]{27,40}$/i.test(id))
       return reply({error:"Torneo inválido"},400);
     const {data,error}=await caller.rpc("js_cancel_br_solo",{p_tournament:id});
     if(error)return reply({error:error.message},409);
     return reply({ok:true,...data});
   }
   if(input?.action==="profile"){
     const profile=await profileFor(user.id);
     return reply({ok:true,profile:profile?{...profile,is_admin:await isOfficialAdmin(user.id)}:null,
       google_name:String(user.user_metadata?.full_name||user.user_metadata?.name||"").slice(0,80)});
   }
   if(input?.action==="profile_update"){
     return reply(await editProfile(user.id,input));
   }
   if(input?.action==="public_profile"){
     return reply(await viewProfile(user.id,input.game_id));
   }
   if(input?.action==="verify_id"){
     const gameId=typeof input.game_id==="string"?input.game_id.trim():"";
     if(!validId(gameId))return reply({error:"Ingresá un ID numérico de 5 a 16 cifras"},400);
     const previous=await profileFor(user.id);
     if(previous?.game_id===gameId)return reply({ok:true,profile:{...previous,is_admin:await isOfficialAdmin(user.id)},already_saved:true});
     if(previous?.verified_at&&Date.now()-Date.parse(previous.verified_at)<180000)
       return reply({error:"Para cambiar de ID, esperá 3 minutos desde la última verificación."},429);
     const ip=(req.headers.get("x-forwarded-for")||"unknown").split(",")[0];
     const hash=await digest("js-jugadores-profile|"+user.id+"|"+ip);
     const {data:can,error:limitError}=await admin.rpc("js_allow_attempt",{p_key:hash});
     if(limitError||can!==true)return reply({error:"Muchas verificaciones seguidas. Probá más tarde."},429);
     const found=await gameLookup(gameId);
     const {data,error}=await admin.from("js_player_profiles").upsert({
       user_id:user.id,game_id:gameId,nickname:found.nickname,region:found.region,
       verified_at:new Date().toISOString(),updated_at:new Date().toISOString()
     },{onConflict:"user_id"}).select("game_id,nickname,region,verified_at,updated_at,instagram_url,tiktok_url").single();
     if(error?.code==="23505")return reply({error:"Ese ID de Free Fire ya está vinculado a otra cuenta Google."},409);
     if(error)throw new Error("No se pudo guardar el perfil");
     return reply({ok:true,profile:{...data,is_admin:await isOfficialAdmin(user.id)}});
   }
   if(["friends_snapshot","friend_lookup","friend_request","friend_answer","friend_remove",
       "friend_tournaments","friend_invite","friend_invite_dismiss"].includes(input?.action)){
      const result=await socialAction(user.id,input);
      return reply(result);
   }
   if(input?.action==="notifications"){
     const profile=await profileFor(user.id);
     if(!profile)return reply({ok:true,notifications:[]});
     const {data,error}=await admin.from("js_player_notices")
      .select("id,kind,title,body,created_at,event_key")
      .eq("game_id",profile.game_id).order("created_at",{ascending:false}).limit(70);
     if(error)throw new Error("No se pudieron consultar los avisos");
     return reply({ok:true,notifications:data||[]});
   }
   if(input?.action==="my_tournaments"){
     const profile=await profileFor(user.id);
     if(!profile)return reply({ok:true,tournaments:[]});
     return reply({ok:true,tournaments:await mine(user.id,profile.game_id),
       stats:await statsFor(profile.game_id),server_now:new Date().toISOString()});
   }
   if(input?.action==="check_in"){
     const profile=await profileFor(user.id);
     if(!profile)return reply({error:"Primero verificá tu ID de Free Fire"},409);
     const matchId=String(input.match_id||"");
     return reply(await markReady(user.id,profile.game_id,matchId));
   }
   if(input?.action==="save_web_code"){
     const p=await profileFor(user.id);
     if(!p?.game_id)return reply({error:"Verificá tu ID de Free Fire en Perfil para guardar el código en tu cuenta"},409);
     const access=String(input.team_code||"").trim().toUpperCase();
     if(!validCode(access))return reply({error:"Código privado incorrecto"},400);
     const hash=await digest("js-torneos-team-access-v1:"+access);
     const membership=await findAuthorizedAccess(hash,p.game_id);
     if(!membership)return reply({error:"Para guardar este código, tu ID de Free Fire verificado debe figurar como titular o suplente en esa inscripción"},403);
     const {count,error:countError}=await admin.from("js_web_saved_codes")
       .select("access_hash",{head:true,count:"exact"}).eq("user_id",user.id);
     if(countError)throw Error("No se pudo comprobar los códigos guardados");
     const {data:already}=await admin.from("js_web_saved_codes")
       .select("access_hash").eq("user_id",user.id).eq("access_hash",hash).maybeSingle();
     if((count||0)>=30&&!already)return reply({error:"Esta cuenta llegó al máximo de 30 códigos guardados"},409);
     const encrypted=await encryptedAccess(access);
     const {error}=await admin.from("js_web_saved_codes").upsert({
       user_id:user.id,access_hash:hash,encrypted_code:encrypted.encrypted_code,
       nonce_b64:encrypted.nonce_b64,updated_at:new Date().toISOString()
     },{onConflict:"user_id,access_hash"});
     if(error)throw Error("No se pudo guardar el código privado");
     return reply({ok:true,saved:true,...membership});
   }
   if(input?.action==="my_web_codes"){
     const p=await profileFor(user.id);
     if(!p?.game_id)return reply({ok:true,codes:[]});
     const {data,error}=await admin.from("js_web_saved_codes")
       .select("access_hash,encrypted_code,nonce_b64,updated_at").eq("user_id",user.id)
       .order("updated_at",{ascending:false}).limit(30);
     if(error)throw Error("No se pudieron leer tus códigos");
     const list:any[]=[];
     for(const item of data||[]){
       const membership=await findAuthorizedAccess(item.access_hash,p.game_id);
       if(!membership)continue;
       try{
         const access=await decodedAccess(item.encrypted_code,item.nonce_b64);
         if(validCode(access)&&await digest("js-torneos-team-access-v1:"+access)===item.access_hash)
           list.push({code:access,...membership});
       }catch{/* Invalid/stale encrypted record is not returned. */}
     }
     return reply({ok:true,codes:list});
   }
   if(input?.action==="link_team"){
     const profile=await profileFor(user.id);
     if(!profile)return reply({error:"Primero verificá tu ID de Free Fire"},409);
     const access=typeof input.team_code==="string"?input.team_code.trim().toUpperCase():"";
     if(!validCode(access))return reply({error:"Código privado de equipo incorrecto"},400);
     const hash=await digest("js-torneos-team-access-v1:"+access);
     const {data:team}=await admin.from("js_teams")
       .select("id,name,tournament_id").eq("access_code_hash",hash).maybeSingle();
     if(!team)return reply({error:"El código del equipo no existe"},404);
     const {data:roster}=await admin.from("js_players").select("game_id")
       .eq("team_id",team.id).eq("game_id",profile.game_id).maybeSingle();
     if(!roster)return reply({error:"Tu ID de Free Fire no figura en ese equipo"},403);
     const {error}=await admin.from("js_player_team_links").upsert({user_id:user.id,team_id:team.id});
     if(error)throw new Error("No pudimos vincular tu equipo");
     return reply({ok:true,team:team.name});
   }
   return reply({error:"Acción desconocida"},400);
 }catch(err){
   return reply({error:err instanceof Error?err.message:"Error del servidor"},503);
 }
});
