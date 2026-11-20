// LiveKit voice controls: push-to-talk or tap-to-toggle, microphone always off by default.
const root=document.getElementById('bombVoice');
if(root){
 const mic=root.querySelector('#bombVoiceMic'),mute=root.querySelector('#bombVoiceMute'),state=root.querySelector('#bombVoiceStatus'),holdButton=root.querySelector('#bombVoiceHoldMode'),toggleButton=root.querySelector('#bombVoiceToggleMode');
 let room=null,enabled=false,deafened=false,connecting=false,mode='hold',held=false,operation=Promise.resolve();
 const status=message=>{state.textContent=message;};
 const ui=()=>{mic.classList.toggle('talking',enabled);mic.classList.toggle('connecting',connecting);mic.setAttribute('aria-label',mode==='hold'?'Mantené pulsado para hablar':enabled?'Apagar micrófono':'Encender micrófono');mic.setAttribute('aria-pressed',String(enabled));holdButton.classList.toggle('active',mode==='hold');toggleButton.classList.toggle('active',mode==='toggle');holdButton.setAttribute('aria-pressed',String(mode==='hold'));toggleButton.setAttribute('aria-pressed',String(mode==='toggle'));mute.textContent=deafened?'🔇':'🔊';mute.setAttribute('aria-pressed',String(deafened));};
 async function connect(){
  if(room)return room;if(connecting)return null;connecting=true;ui();status('Conectando voz…');
  try{
   const params=new URLSearchParams(location.search),code=params.get('r');
   const access=code&&(params.get('t')||sessionStorage.getItem('js-bomba-access:'+code));
   if(!code||!access)throw Error('Para hablar, abrí tu enlace personal de jugador.');
   const response=await fetch('https://chfshxlykvmovwryjnxi.supabase.co/functions/v1/bomba-voice-token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,access})});
   const data=await response.json();if(!response.ok)throw Error(data.error||'No se pudo conectar');
   const LiveKit=await import('https://esm.sh/livekit-client@2');
   const instance=new LiveKit.Room({adaptiveStream:true,dynacast:true});
   instance.on(LiveKit.RoomEvent.TrackSubscribed,track=>{if(track.kind==='audio'){const el=track.attach();el.autoplay=true;el.dataset.bombaVoice='1';el.muted=deafened;document.body.append(el);}});
   instance.on(LiveKit.RoomEvent.TrackUnsubscribed,track=>track.detach().forEach(el=>el.remove()));
   instance.on(LiveKit.RoomEvent.Disconnected,()=>{room=null;enabled=false;ui();status('Voz desconectada');});
   await instance.connect(data.url,data.token,{autoSubscribe:true});room=instance;status('🟢 Conectado · micrófono apagado');return room;
  }catch(error){status('⚠️ '+String(error.message||error));return null;}finally{connecting=false;ui();}
 }
 async function setMic(value){
  if(value&&!room&&!(await connect()))return;
  if(!room)return;
  try{await room.localParticipant.setMicrophoneEnabled(value);enabled=value;status(value?'🔴 Hablando ahora':'🟢 Micrófono apagado');ui();}catch(error){status('⚠️ Revisá el permiso del micrófono');}
 }
 function queueMic(value){operation=operation.catch(()=>{}).then(()=>setMic(value));return operation;}
 function selectMode(next){held=false;mode=next;void queueMic(false);ui();}
 holdButton.addEventListener('click',()=>selectMode('hold'));toggleButton.addEventListener('click',()=>selectMode('toggle'));
 mic.addEventListener('pointerdown',event=>{if(mode!=='hold')return;event.preventDefault();held=true;try{mic.setPointerCapture(event.pointerId);}catch{}void queueMic(true).then(()=>{if(!held||mode!=='hold')void queueMic(false);});});
 function release(){if(mode==='hold'&&held){held=false;void queueMic(false);}}
 mic.addEventListener('pointerup',release);mic.addEventListener('pointercancel',release);mic.addEventListener('lostpointercapture',release);
 mic.addEventListener('click',()=>{if(mode==='toggle')void queueMic(!enabled);});
 mic.addEventListener('keydown',event=>{if(mode==='hold'&&(event.key===' '||event.key==='Enter')&&!event.repeat){event.preventDefault();held=true;void queueMic(true);}});
 mic.addEventListener('keyup',event=>{if(mode==='hold'&&(event.key===' '||event.key==='Enter')){event.preventDefault();release();}});
 mute.addEventListener('click',()=>{deafened=!deafened;document.querySelectorAll('[data-bomba-voice]').forEach(el=>el.muted=deafened);ui();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){held=false;void queueMic(false);}});
 window.addEventListener('pagehide',()=>{held=false;if(room)void room.disconnect();});ui();
}
