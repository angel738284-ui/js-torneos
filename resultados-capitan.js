"use strict";
(function(){
 const drafts=new Map();
 let sending=false;
 const endpoint=String(window.JS_CONFIG?.supabaseUrl||'').replace(/\/$/,'')+'/functions/v1/torneo';
 const el=(tag,text,klass)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(klass)n.className=klass;return n};
 const notify=(text,bad=false)=>{const n=document.getElementById('notice');if(n){n.textContent=text;n.className='status show'+(bad?' error':'')}};
 const draftActive=()=>sending||drafts.size>0;
 function compress(file){
  return new Promise((resolve,reject)=>{
   if(!file||!file.type.startsWith('image/')||file.size>12000000){reject(new Error('Elegí una captura válida de menos de 12 MB.'));return;}
   const url=URL.createObjectURL(file);
   const image=new Image();
   image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('No se pudo abrir esta imagen. Probá con otra captura.'))};
   image.onload=()=>{
    URL.revokeObjectURL(url);
    try{
     let maxSide=1600,quality=.82;
     const canvas=document.createElement('canvas');const ctx=canvas.getContext('2d');
     if(!ctx)throw new Error('Tu navegador no puede procesar la captura');
     for(let i=0;i<6;i++){
      const ratio=Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight));
      canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));
      canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
      ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(image,0,0,canvas.width,canvas.height);
      const jpeg=canvas.toDataURL('image/jpeg',quality);
      const base64=jpeg.split(',')[1]||'';
      if(base64.length<1950000){resolve(base64);return;}
      quality=Math.max(.4,quality-.13);maxSide=Math.floor(maxSide*.85);
     }
     reject(new Error('La captura sigue pesando demasiado. Recortá el resultado y probá de nuevo.'));
    }catch(e){reject(e)}
   };
   image.src=url;
  });
 }
 function decorateMatch(card,match,data){
  if(!match.match_id)return;
  const game=Number(match.report_game_number)||1;
  const key=match.match_id+':'+game;
  const container=el('section',undefined,'results-captain-card');
  container.append(el('h3','📸 Resultado de partida '+game));
  if(match.report_state==='dispute'){
   container.append(el('p','⚠️ Los equipos informaron resultados contradictorios. El administrador deberá resolverlo.','results-conflict'));
  }else if(match.reported_by_me){
   const label=match.reported_by_opponent
    ?(match.ai_status==='approved'?'✅ Gemini aprobó las capturas y el resultado está confirmado.':
      match.ai_status==='review'?'⚠️ Gemini detectó dudas. El administrador debe revisar las pruebas.':
      match.ai_status==='unavailable'?'⚠️ No se pudo usar Gemini. Resultado pendiente de revisión.':
      '🤖 Ambos informes coinciden. Esperando verificación de Gemini.')
    :'✅ Enviamos nuestro resultado y captura. Esperando al rival.';
   container.append(el('p',label,match.ai_status==='review'||match.ai_status==='unavailable'?'results-conflict':'results-success'));
   if(match.ai_summary&&match.reported_by_opponent)
     container.append(el('p',match.ai_summary,'small'));
  }else if(match.can_report){
   if(match.reported_by_opponent){container.append(el('p','El rival ya envió su resultado. Falta que vos confirmes.','small'));}
   const instructions=el('p','Subí una captura real del resultado y marcá si ganaron o perdieron. No se permite modificar el informe después de enviarlo.','small');
   const file=el('input');file.type='file';file.accept='image/*';file.setAttribute('aria-label','Seleccionar captura del resultado');
   const chosen=el('p','Todavía no seleccionaste una captura.','small');
   file.onchange=()=>{
    if(file.files?.[0]){drafts.set(key,file.files[0]);chosen.textContent='✅ Captura seleccionada: '+file.files[0].name;}
    else{drafts.delete(key);chosen.textContent='Elegí una captura del resultado.'}
   };
   const actions=el('div',undefined,'results-choice-row');
   const win=el('button','🏆 Ganamos','good');const lose=el('button','❌ Perdimos','secondary');
   win.type='button';lose.type='button';
   async function submit(outcome){
    if(sending)return;
    const selected=drafts.get(key)||file.files?.[0];
    if(!selected){chosen.textContent='⚠️ Primero elegí la captura del resultado.';file.focus();return;}
    sending=true;win.disabled=true;lose.disabled=true;chosen.textContent='Comprimiendo y enviando captura…';
    try{
     const jpeg=await compress(selected);
     chosen.textContent='Enviando informe al servidor…';
     const res=await fetch(endpoint,{method:'POST',cache:'no-store',headers:{'content-type':'application/json'},
       body:JSON.stringify({action:'team_report_match',team_code:document.getElementById('teamAccess').value.trim().toUpperCase(),
         match_id:match.match_id,game_number:game,outcome,photo_base64:jpeg})});
     const answer=await res.json();
     if(!res.ok||!answer.ok)throw new Error(answer.error||'No se pudo guardar tu resultado');
     drafts.delete(key);
     const msg=answer.status==='confirmed'?'✅ Gemini verificó ambas capturas. Resultado confirmado y llave actualizada.':
       answer.status==='needs_review'?'⚠️ Gemini no pudo validar las capturas; administrador debe revisar.':
       answer.status==='pending_ai'?'🤖 Las capturas se guardaron. Esperando la verificación de Gemini.':
       answer.status==='dispute'?'⚠️ Los resultados se contradicen. El administrador deberá revisarlos.':
       '✅ Informe y captura guardados. Esperando al otro equipo.';
     notify(msg);chosen.textContent=msg;
     await window.lookupTeamAfterRosterChange?.();
    }catch(e){chosen.textContent='❌ '+(e.message||String(e));notify(chosen.textContent,true);win.disabled=false;lose.disabled=false;}
    finally{sending=false;}
   }
   win.onclick=()=>submit('win');lose.onclick=()=>submit('lose');
   actions.append(win,lose);container.append(instructions,file,chosen,actions);
  }else{
   container.append(el('p',match.winner?'Esta partida ya finalizó.':'Podrás enviar tu resultado después de que el administrador cree y envíe la sala.','small'));
  }
  card.append(container);
 }
 window.JSResultsCaptain=Object.freeze({decorateMatch,draftActive});
})();

