// Room-specific text chat; never insert user messages as HTML.
const panel=document.getElementById('bombChat');
if(panel){
 const list=panel.querySelector('#bombChatMessages'),form=panel.querySelector('#bombChatForm'),input=panel.querySelector('#bombChatInput'),status=panel.querySelector('#bombChatStatus'),toggle=panel.querySelector('#bombChatToggle'),count=panel.querySelector('#bombChatCount');
 const params=new URLSearchParams(location.search),code=params.get('r')||'BE5BBA5D2FA4',key='js-bomba-access:'+code;
 const api=(window.JS_CONFIG?.supabaseUrl||'')+'/rest/v1/rpc/js_bomba_chat',apikey=window.JS_CONFIG?.publishableKey||'';
 let latest=0,unread=0,busy=false,posting=false,lastSentAt=0;
 const bubbles=new Map();let initialized=false;
 const token=()=>params.get('t')||sessionStorage.getItem(key)||'';
 const canWrite=()=>Boolean(token());
 const say=t=>{status.textContent=t;status.hidden=!t;};
 const updateAccess=()=>{input.disabled=!canWrite();form.querySelector('button').disabled=!canWrite()||posting;input.placeholder=canWrite()?'Escribí un mensaje…':'Solo jugadores con enlace personal';};
 async function request(payload){const response=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json','apikey':apikey},body:JSON.stringify(payload)});const result=await response.json().catch(()=>({}));if(!response.ok||!result.ok)throw Error(result.mensaje||result.message||result.error||('Error HTTP '+response.status));return result;}
 function showBubble(msg){
  const cards=Array.from(document.querySelectorAll('#players .player'));
  const matches=cards.filter(card=>card.querySelector('.player-name')?.textContent?.trim()===String(msg.nombre||'').trim());
  if(matches.length!==1||matches[0].classList.contains('dead'))return;
  const card=matches[0],id=card.dataset.playerId,old=bubbles.get(id);
  if(old?.timer)clearTimeout(old.timer);
  card.querySelector('.chatBubble')?.remove();
  const bubble=document.createElement('span');bubble.className='chatBubble';bubble.textContent=String(msg.texto||'').slice(0,110);card.append(bubble);
  const timer=setTimeout(()=>{bubble.remove();if(bubbles.get(id)?.bubble===bubble)bubbles.delete(id);},5000);
  bubbles.set(id,{bubble,timer});
 }
 function restoreBubbles(){for(const [id,item] of bubbles){const card=Array.from(document.querySelectorAll('#players .player')).find(c=>c.dataset.playerId===id&&!c.classList.contains('dead'));if(card&&!card.contains(item.bubble))card.append(item.bubble);}}
 new MutationObserver(()=>restoreBubbles()).observe(document.getElementById('players'),{childList:true});
 function display(messages){const ordered=[...messages].reverse();const newest=ordered.at(-1)?.id||0;if(newest===latest&&list.childElementCount)return;
  if(initialized){for(const msg of ordered.filter(m=>m.id>latest))showBubble(msg);}else initialized=true;
  if(panel.open){unread=0;count.hidden=true;}else if(latest){unread+=ordered.filter(m=>m.id>latest).length;count.textContent=String(unread);count.hidden=unread===0;}
  latest=Math.max(latest,newest);list.replaceChildren();
  for(const msg of ordered){const line=document.createElement('div');line.className='bombChatLine';const who=document.createElement('strong');who.textContent=(msg.nombre||'Jugador')+': ';const body=document.createElement('span');body.textContent=msg.texto||'';line.append(who,body);list.append(line);}
  if(panel.open)list.scrollTop=list.scrollHeight;
 }
 async function refresh(){if(busy||document.hidden)return;busy=true;try{const result=await request({p_code:code,p_action:'list'});display(result.mensajes||[]);}catch(e){if(!posting)say('⚠️ No se pudo actualizar: '+e.message);}finally{busy=false;updateAccess();}}
 panel.addEventListener('toggle',()=>{if(panel.open){unread=0;count.hidden=true;list.scrollTop=list.scrollHeight;}});
 form.addEventListener('submit',async event=>{event.preventDefault();if(posting||!canWrite())return;const body=input.value.trim();if(!body)return;if(Date.now()-lastSentAt<2100){say('⏳ Esperá 2 segundos entre mensajes. Tu texto sigue acá.');return;}posting=true;updateAccess();try{await request({p_code:code,p_action:'send',p_access:token(),p_body:body});input.value='';lastSentAt=Date.now();say('✅ Enviado');await refresh();}catch(e){say('⚠️ '+e.message+' · Podés volver a intentar.');}finally{posting=false;updateAccess();}});
 updateAccess();void refresh();setInterval(refresh,2500);
}
