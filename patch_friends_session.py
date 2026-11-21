from pathlib import Path
p=Path.home()/'js-torneos-pages/js-friends-ui.js'
s=p.read_text()
old='''  let snapshot={friends:[],invitations:[]},searched=null,loading=false;'''
new='''  let snapshot={friends:[],invitations:[]},searched=null,loading=false,lastUserId=null;'''
assert s.count(old)==1
s=s.replace(old,new)
old='''  async function refresh(){
    if(clearIfNoProfile()||loading)return;
    loading=true;
    const b=q("js-friends-refresh");b.disabled=true;
    try{
      const r=await apiCall("friends_snapshot");
      snapshot={friends:Array.isArray(r.friends)?r.friends:[],
        invitations:Array.isArray(r.invitations)?r.invitations:[]};
      showFriends();showInvites();showSearch();
    }catch(e){label("⚠️ No se pudieron cargar tus amigos: "+e.message,"error")}
    finally{loading=false;b.disabled=false}
  }'''
new='''  async function refresh(){
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
  }'''
assert s.count(old)==1
s=s.replace(old,new)
p.write_text(s)
print("FRIENDS_SESSION_ISOLATION_ADDED")
