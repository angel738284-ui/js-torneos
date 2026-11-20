// LiveKit voice: only authorized players receive a short-lived token from the Edge Function.
const root=document.getElementById('bombVoice');
if(root){
 const mic=root.querySelector('#bombVoiceMic'),mute=root.querySelector('#bombVoiceMute'),state=root.querySelector('#bombVoiceStatus');
 let room=null,localEnabled=false,deafened=false,connecting=false;
 const setStatus=message=>{state.textContent=message;};
 const setUI=()=>{mic.textContent=localEnabled?'🎙️ Micrófono encendido':'🎤 Encender micrófono';mute.textContent=deafened?'🔊 Escuchar jugadores':'🔇 Silenciar jugadores';};
 const cleanup=async()=>{if(room){await room.disconnect();room=null;}localEnabled=false;setUI();};
 async function connect(){
  if(room)return room;
  if(connecting)return null;
  connecting=true;setStatus('Conectando chat de voz…');
  try{
   const code=new URLSearchParams(location.search).get('r');
   const access=code&&sessionStorage.getItem('js-bomba-access:'+code);
   if(!code||!access)throw Error('Abrí tu enlace personal para hablar.');
   const response=await fetch('https://chfshxlykvmovwryjnxi.supabase.co/functions/v1/bomba-voice-token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,access})});
   const data=await response.json();if(!response.ok)throw Error(data.error||'No se pudo ingresar al chat');
   const LiveKit=await import('https://esm.sh/livekit-client@2.15.13');
   const instance=new LiveKit.Room({adaptiveStream:true,dynacast:true});
   instance.on(LiveKit.RoomEvent.TrackSubscribed,(track)=>{if(track.kind==='audio'){const element=track.attach();element.autoplay=true;element.dataset.bombaVoice='1';element.muted=deafened;document.body.append(element);}});
   instance.on(LiveKit.RoomEvent.TrackUnsubscribed,track=>track.detach().forEach(el=>el.remove()));
   instance.on(LiveKit.RoomEvent.Disconnected,()=>{room=null;localEnabled=false;setUI();setStatus('Chat desconectado');});
   await instance.connect(data.url,data.token,{autoSubscribe:true});room=instance;
   setStatus('🟢 Voz conectada · micrófono apagado');setUI();return room;
  }catch(error){setStatus('⚠️ '+String(error.message||error));return null;}
  finally{connecting=false;}
 }
 mic.addEventListener('click',async()=>{
  if(!room&&!(await connect()))return;
  try{await room.localParticipant.setMicrophoneEnabled(!localEnabled);localEnabled=!localEnabled;setStatus(localEnabled?'🎙️ Estás hablando':'🟢 Conectado · micrófono apagado');setUI();}
  catch{setStatus('⚠️ Permití usar el micrófono en Chrome');}
 });
 mute.addEventListener('click',()=>{deafened=!deafened;document.querySelectorAll('[data-bomba-voice]').forEach(el=>el.muted=deafened);setUI();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&room&&localEnabled){room.localParticipant.setMicrophoneEnabled(false).then(()=>{localEnabled=false;setUI();}).catch(()=>{});}});
 window.addEventListener('pagehide',()=>void cleanup());setUI();
}
