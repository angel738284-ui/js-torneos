/* Amigos de TORNEOS JS — mismas amistades e invitaciones de la APK.
   Toda operación pasa por js-jugadores-cuenta con JWT de Supabase. */
export function initFriends({q,make,apiCall,getAccount,safeProfileImage}){
  let snapshot={friends:[],invitations:[]},searched=null,loading=false,lastUserId=null;
  const label=(msg,kind="")=>{
    const el=q("js-friends-status");el.textContent=msg;
    el.dataset.kind=kind;
  };
  const empty=(root,message)=>{
    root.replaceChildren(make("p",message,"js-friends-empty"));
  };
  const button=(text,fn,extra="")=>{
    const b=make("button",text,"js-friends-btn "+extra);
    b.type="button";b.onclick=fn;return b;
  };
  const caption=(person)=>person.nickname||"Jugador";
  const friendState=(gameId)=>snapshot.friends.find(f=>f.game_id===gameId);

  async function operation(b,action,params,message){
    if(b.disabled)return false;
    b.disabled=true;
    try{
      await apiCall(action,params);
      label(message,"ok");
      await refresh();
      return true;
    }catch(e){label("⚠️ "+e.message,"error");return false}
    finally{b.disabled=false}
  }
  function clearIfNoProfile(){
    const {session,profile}=getAccount();
    if(session&&profile?.game_id)return false;
    searched=null;snapshot={friends:[],invitations:[]};
    q("js-friend-search-result").replaceChildren();
    q("js-friend-profile").replaceChildren();
    empty(q("js-friends-list"),session?
      "Verificá tu ID de Free Fire en Perfil para encontrar y agregar amigos.":
      "Iniciá sesión para ver tus amigos.");
    empty(q("js-friends-requests"),"No hay solicitudes.");
    empty(q("js-friends-invites"),"No hay invitaciones.");
    label("");
    return true;
  }
  function showSearch(){
    const root=q("js-friend-search-result");root.replaceChildren();
    if(!searched)return;
    const person=searched;
    const relation=friendState(person.game_id);
    const card=make("div",undefined,"js-friend-row");
    const main=make("div",undefined,"js-friend-main");
    main.append(make("strong",caption(person)),make("span","ID "+person.game_id+" · "+(person.region||"Región no indicada")));
    card.append(main);
    const actions=make("div",undefined,"js-friend-actions");
    actions.append(button("👤 Ver perfil",()=>viewProfile(person.game_id),"neutral"));
    if(!relation){
      const add=button("➕ Agregar amigo",async()=>operation(add,"friend_request",
        {game_id:person.game_id},"Solicitud enviada a "+caption(person)+"."));
      actions.append(add);
    }else if(relation.state==="friend"){
      actions.append(make("span","✅ Ya son amigos","js-friend-note"));
    }else if(relation.state==="incoming"){
      actions.append(make("span","📩 Te envió una solicitud","js-friend-note"));
    }else{
      actions.append(make("span","⏳ Solicitud enviada","js-friend-note"));
    }
    card.append(actions);root.append(card);
  }
  async function findFriend(){
    const id=q("js-friends-id").value.trim().replace(/\s+/g,"");
    if(!/^[0-9]{5,16}$/.test(id)){label("Ingresá un ID válido de 5 a 16 números.","error");return}
    if(!getAccount().profile){label("Primero verificá tu ID desde Perfil.","error");return}
    const b=q("js-friends-search");b.disabled=true;
    label("Buscando jugador…");
    try{
      const r=await apiCall("friend_lookup",{game_id:id});
      searched=r.person;
      showSearch();
      label("Jugador encontrado.","ok");
    }catch(e){searched=null;showSearch();label("⚠️ "+e.message,"error")}
    finally{b.disabled=false}
  }
  async function viewProfile(gameId){
    const root=q("js-friend-profile");root.replaceChildren();
    root.append(make("p","Cargando perfil…","js-friends-empty"));
    try{
      const r=await apiCall("public_profile",{game_id:gameId});
      const p=r.profile;
      root.replaceChildren();
      const card=make("div",undefined,"js-public-profile");
      const cover=make("div",undefined,"js-public-cover");
      const imageCover=safeProfileImage(p.banner_path,p.updated_at);
      if(imageCover)cover.style.backgroundImage='url("'+imageCover+'")';
      card.append(cover);
      const top=make("div",undefined,"js-public-head");
      const avatar=make("div",undefined,"js-public-avatar");
      const imageAvatar=safeProfileImage(p.avatar_path,p.updated_at);
      if(imageAvatar){
        const img=make("img");img.src=imageAvatar;img.alt="Foto de "+(p.display_name||p.nickname||"jugador");
        img.loading="lazy";avatar.append(img);
      }else avatar.textContent=(p.display_name||p.nickname||"JS").slice(0,2).toUpperCase();
      const info=make("div");
      info.append(make("strong",p.display_name||p.nickname||"Jugador"),
        make("span",(p.username?"@"+p.username+" · ":"")+"ID "+p.game_id+" · "+(p.region||"")));
      if(p.is_admin)info.append(make("b","🛡️ ADM","js-friend-admin"));
      top.append(avatar,info);
      card.append(top);
      card.append(make("p",p.bio||"Sin biografía.","js-friend-bio"));
      card.append(button("✕ Cerrar perfil",()=>root.replaceChildren(),"neutral"));
      root.append(card);
      root.scrollIntoView({behavior:"smooth",block:"nearest"});
    }catch(e){empty(root,"⚠️ "+e.message)}
  }
  async function openInvitation(person,holder){
    holder.replaceChildren();
    holder.append(make("p","Buscando torneos disponibles…","js-friends-empty"));
    try{
      const r=await apiCall("friend_tournaments");
      holder.replaceChildren();
      const tours=Array.isArray(r.tournaments)?r.tournaments:[];
      if(!tours.length){empty(holder,"No hay torneos abiertos para invitar por ahora.");return}
      const picker=make("div",undefined,"js-invite-picker");
      const select=document.createElement("select");
      select.setAttribute("aria-label","Elegí el torneo");
      for(const tour of tours){
        const opt=document.createElement("option");
        opt.value=tour.code;opt.textContent=tour.name+" · "+tour.mode;
        select.append(opt);
      }
      const send=button("🏆 Enviar invitación",async()=>{
        const success=await operation(send,"friend_invite",
          {game_id:person.game_id,tournament_code:select.value},
          "Invitación enviada a "+caption(person)+".");
        if(success)holder.replaceChildren();
      });
      picker.append(make("span","Elegí un torneo abierto:"),select,send,
        button("Cancelar",()=>holder.replaceChildren(),"neutral"));
      holder.append(picker);
    }catch(e){empty(holder,"⚠️ "+e.message)}
  }
  function personRow(friend){
    const card=make("div",undefined,"js-friend-row");
    const main=make("div",undefined,"js-friend-main");
    main.append(make("strong",caption(friend)),
      make("span","ID "+friend.game_id+" · "+(friend.region||"")));
    card.append(main);
    const actions=make("div",undefined,"js-friend-actions");
    const holder=make("div",undefined,"js-friend-invite-panel");
    if(friend.state==="friend"){
      actions.append(
        button("👤 Ver perfil",()=>viewProfile(friend.game_id),"neutral"),
        button("🏆 Invitar a torneo",()=>openInvitation(friend,holder)));
      const del=button("Eliminar",()=>{
        if(!window.confirm("¿Eliminar a "+caption(friend)+" de tus amigos?"))return;
        operation(del,"friend_remove",{friendship_id:friend.id},"Amigo eliminado.");
      },"danger");
      actions.append(del);
    }else if(friend.state==="incoming"){
      const accept=button("✓ Aceptar",()=>operation(accept,"friend_answer",
        {friendship_id:friend.id,answer:"accept"},"¡Ahora son amigos!"));
      const reject=button("Rechazar",()=>operation(reject,"friend_answer",
        {friendship_id:friend.id,answer:"reject"},"Solicitud rechazada."),"danger");
      actions.append(accept,reject);
    }else{
      const cancel=button("Cancelar solicitud",()=>operation(cancel,"friend_remove",
        {friendship_id:friend.id},"Solicitud cancelada."),"neutral");
      actions.append(cancel);
    }
    card.append(actions,holder);
    return card;
  }
  function showFriends(){
    const friendsRoot=q("js-friends-list"),pendingRoot=q("js-friends-requests");
    friendsRoot.replaceChildren();pendingRoot.replaceChildren();
    const friends=snapshot.friends.filter(f=>f.state==="friend");
    const pending=snapshot.friends.filter(f=>f.state!=="friend");
    q("js-friends-count").textContent=String(friends.length);
    if(!friends.length)empty(friendsRoot,"Todavía no agregaste amigos. Buscá a alguien por su ID.");
    else for(const friend of friends)friendsRoot.append(personRow(friend));
    if(!pending.length)empty(pendingRoot,"No hay solicitudes pendientes.");
    else for(const friend of pending)pendingRoot.append(personRow(friend));
  }
  function showInvites(){
    const root=q("js-friends-invites");root.replaceChildren();
    if(!snapshot.invitations.length){empty(root,"No hay invitaciones pendientes.");return}
    for(const item of snapshot.invitations){
      const row=make("div",undefined,"js-friend-row");
      row.append(make("strong",item.from_nickname+" te invitó a "+item.tournament_name));
      const actions=make("div",undefined,"js-friend-actions");
      const link=make("a","🏆 Ver torneo","js-friends-btn");
      link.href="./inscripcion.html?codigo="+encodeURIComponent(item.tournament_code);
      const dismiss=button("Descartar",()=>operation(dismiss,
        "friend_invite_dismiss",{invite_id:item.id},"Invitación descartada."),"neutral");
      actions.append(link,dismiss);row.append(actions);root.append(row);
    }
  }
  async function refresh(){
    const account=getAccount(),userId=account.session?.user?.id||null;
    if(userId!==lastUserId){
      lastUserId=userId;searched=null;snapshot={friends:[],invitations:[]};
      q("js-friend-search-result").replaceChildren();
      q("js-friend-profile").replaceChildren();
      q("js-friends-list").replaceChildren();
      q("js-friends-requests").replaceChildren();
      q("js-friends-invites").replaceChildren();
      q("js-friends-count").textContent="0";
    }
    if(clearIfNoProfile()||loading)return;
    loading=true;
    const b=q("js-friends-refresh");b.disabled=true;
    try{
      const r=await apiCall("friends_snapshot");
      // Nunca dibujar amistades de una sesión anterior al cambiar de cuenta.
      if(getAccount().session?.user?.id!==userId)return;
      snapshot={friends:Array.isArray(r.friends)?r.friends:[],
        invitations:Array.isArray(r.invitations)?r.invitations:[]};
      showFriends();showInvites();showSearch();
    }catch(e){
      if(getAccount().session?.user?.id===userId)
        label("⚠️ No se pudieron cargar tus amigos: "+e.message,"error");
    }finally{loading=false;b.disabled=false}
  }
  q("js-friends-search").onclick=findFriend;
  q("js-friends-id").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();findFriend()}});
  q("js-friends-refresh").onclick=refresh;
  return {refresh};
}
