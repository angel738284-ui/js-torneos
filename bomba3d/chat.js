// Room-specific text chat; never insert user messages as HTML.
const panel=document.getElementById('bombChat');
if(panel){
 const list=panel.querySelector('#bombChatMessages'),form=panel.querySelector('#bombChatForm'),input=panel.querySelector('#bombChatInput'),status=panel.querySelector('#bombChatStatus'),toggle=panel.querySelector('#bombChatToggle'),count=panel.querySelector('#bombChatCount');
 const params=new URLSearchParams(location.search),code=params.get('r')||'BE5BBA5D2FA4',key='js-bomba-access:'+code;
 const api=(window.JS_CONFIG?.supabaseUrl||'')+'/rest/v1/rpc/js_bomba_chat',apikey=window.JS_CONFIG?.publishableKey||'';
 let latest=0,unread=0,busy=false,posting=false;
 const token=()=>params.get('t')||sessionStorage.getItem(key)||'';
 const canWrite=()=>Boolean(token());
 const say=t=>{status.textContent=t;};
 const updateAccess=()=>{input.disabled=!canWrite();form.querySelector('button').disabled=!canWrite()||posting;input.placeholder=canWrite()?'Escribí un mensaje…':'Solo jugadores con enlace personal';};
 async function request(payload){const response=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json','apikey':apikey},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok||!result.ok)throw Error(result.mensaje||result.message||'No se pudo conectar');return result;}
 function display(messages){const ordered=[...messages].reverse();const newest=ordered.at(-1)?.id||0;if(newest===latest&&list.childElementCount)return;
  if(panel.open){unread=0;count.hidden=true;}else if(latest){unread+=ordered.filter(m=>m.id>latest).length;count.textContent=String(unread);count.hidden=unread===0;}
  latest=Math.max(latest,newest);list.replaceChildren();
  for(const msg of ordered){const line=document.createElement('div');line.className='bombChatLine';const who=document.createElement('strong');who.textContent=(msg.nombre||'Jugador')+': ';const body=document.createElement('span');body.textContent=msg.texto||'';line.append(who,body);list.append(line);}
  if(panel.open)list.scrollTop=list.scrollHeight;
 }
 async function refresh(){if(busy||document.hidden)return;busy=true;try{const result=await request({p_code:code,p_action:'list'});display(result.mensajes||[]);say('');}catch(e){say('⚠️ '+e.message);}finally{busy=false;updateAccess();}}
 panel.addEventListener('toggle',()=>{if(panel.open){unread=0;count.hidden=true;list.scrollTop=list.scrollHeight;}});
 form.addEventListener('submit',async event=>{event.preventDefault();if(posting||!canWrite())return;const body=input.value.trim();if(!body)return;posting=true;updateAccess();try{await request({p_code:code,p_action:'send',p_access:token(),p_body:body});input.value='';say('');await refresh();}catch(e){say('⚠️ '+e.message);}finally{posting=false;updateAccess();}});
 updateAccess();void refresh();setInterval(refresh,2500);
}
