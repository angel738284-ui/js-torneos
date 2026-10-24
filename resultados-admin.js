"use strict";
(function(){
 const model=new Map();let queued=false,working=false;
 const make=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(cls)x.className=cls;return x};
 function decorateMatch(match,card){
  const box=make('section',undefined,'results-admin-card');
  const title=make('strong','📸 Capturas y resultados de los capitanes');
  const content=make('div','Todavía no hay informes.','small');
  box.append(title,content);card.append(box);model.set(match.id,{match,card,box,content});
  if(!queued){queued=true;Promise.resolve().then(()=>{queued=false;refresh()})}
 }
 async function refresh(){
  if(working||!opened||!db)return;
  const entries=[...model.values()].filter(x=>x.card.isConnected);if(!entries.length)return;
  working=true;
  try{
   const {data,error}=await db.from('js_match_reports')
    .select('match_id,game_number,team_id,won,proof_path,submitted_at')
    .in('match_id',entries.map(e=>e.match.id));
   if(error)throw error;
   const {data:aiRows,error:aiError}=await db.from('js_match_ai_checks')
     .select('match_id,game_number,status,summary,details,checked_at')
     .in('match_id',entries.map(e=>e.match.id));
   if(aiError)throw aiError;
   const byMatch=new Map();for(const row of data||[]){if(!byMatch.has(row.match_id))byMatch.set(row.match_id,[]);byMatch.get(row.match_id).push(row)}
   const checkMap=new Map((aiRows||[]).map(x=>[x.match_id+':'+x.game_number,x]));
   for(const info of entries){
    info.content.replaceChildren();
    const rows=(byMatch.get(info.match.id)||[]).sort((a,b)=>a.game_number-b.game_number);
    if(!rows.length){info.content.append(make('p','Esperando las capturas de los dos equipos.','small'));continue}
    const matches=new Map();for(const report of rows){if(!matches.has(report.game_number))matches.set(report.game_number,[]);matches.get(report.game_number).push(report)}
    for(const [n,items] of matches){
     const block=make('div',undefined,'results-admin-game');
     block.append(make('strong','Partida '+n));
     const both=items.length===2;
     const conflicting=both&&items[0].won===items[1].won;
     const ai=checkMap.get(info.match.id+':'+n);
     const status=conflicting?'⚠️ CONFLICTO: los capitanes se contradicen. Revisar manualmente.':
       !both?'⏳ Falta que el otro equipo envíe el informe y la captura.':
       ai?.status==='approved'?'✅ Capturas verificadas por Gemini: resultado aprobado.':
       ai?.status==='review'?'⚠️ GEMINI ENCONTRÓ DUDAS: revisar capturas antes de marcar el ganador.':
       ai?.status==='unavailable'?'⚠️ GEMINI NO DISPONIBLE: revisar capturas manualmente.':
       '🤖 Los capitanes coinciden. Esperando análisis de Gemini (NO confirmado).';
     block.append(make('p',status,conflicting||ai?.status==='review'||ai?.status==='unavailable'?'results-conflict':ai?.status==='approved'?'results-success':'small'));
     if(ai?.summary)block.append(make('p',ai.summary,'small'));
     if(!both&&!info.match.winner)block.append(make('p',
       'Si el rival se fue o no quiere confirmar: después de 10 minutos podés resolver con la captura del equipo que sí informó. No se concede victoria automática.','small'));
     for(const row of items){
      const label=teamCache.find(t=>t.id===row.team_id)?.name||'Equipo';
      const holder=make('div',undefined,'results-proof-row');
      holder.append(make('span',label+' · '+(row.won?'Ganamos':'Perdimos')));
      // Show signed private proof inline: Android WebView often blocks target=_blank.
      const preview=make('img');
      preview.alt='Captura privada de '+label;
      preview.style.cssText='display:block;width:100%;max-width:470px;max-height:230px;object-fit:contain;border:1px solid #4d6476;border-radius:10px;margin:8px auto;cursor:zoom-in;background:#06111f';
      preview.onclick=()=>{
        if(!preview.src)return;
        const overlay=make('div');
        overlay.style.cssText='position:fixed;inset:0;z-index:999999;background:#000e;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;gap:16px';
        const large=make('img');
        large.src=preview.src;large.alt=preview.alt;
        large.style.cssText='width:100%;height:85vh;object-fit:contain';
        const close=make('button','Cerrar imagen','secondary');
        close.onclick=()=>overlay.remove();
        overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};
        overlay.append(large,close);document.body.append(overlay);
      };
      const {data:url,error:linkErr}=await db.storage.from('js-torneos-evidencias').createSignedUrl(row.proof_path,600);
      if(linkErr||!url?.signedUrl){
        holder.append(make('span','No se pudo abrir la captura: '+(linkErr?.message||'Sin acceso')+' — tocá Actualizar','small'));
      }else{
        preview.src=url.signedUrl;
        preview.onerror=()=>{preview.style.display='none';holder.append(make('span','Error al cargar imagen. Tocá Actualizar.','small'))};
        holder.append(make('span','🖼️ Captura privada (tocá para ampliar)','small'));
      }
      block.append(holder);
      if(url?.signedUrl&&!linkErr)block.append(preview);
      if(!info.match.winner&&opened?.status!=='finished'){
        const waitEnd=Date.parse(items.map(x=>x.submitted_at).sort()[0])+600000;
        const missing=items.length===1;
        const canDecide=!missing||Date.now()>=waitEnd;
        const action=make('button',missing?'⚖️ Resolver si el rival no responde':'⚖️ Resolver tras revisar la prueba','secondary');
        action.type='button';action.disabled=!canDecide;
        action.style.cssText='margin:9px 0;width:100%';
        if(!canDecide){
          const seconds=Math.max(0,Math.ceil((waitEnd-Date.now())/1000));
          const mins=String(Math.floor(seconds/60)).padStart(2,'0');
          const secs=String(seconds%60).padStart(2,'0');
          action.textContent='⏳ Esperar al rival: '+mins+':'+secs;
        }
        action.onclick=async()=>{
          const winning= row.won ? row.team_id : (row.team_id===info.match.team_a?info.match.team_b:info.match.team_a);
          const winnerName=teamCache.find(t=>t.id===winning)?.name||'Equipo';
          const reason=missing?'no_respuesta':conflicting?'conflicto':'revision_ia';
          if(!await askConfirm('¿Adjudicar la partida '+n+' a '+winnerName+'?\n\nMotivo: '+(missing?'El rival no respondió en 10 minutos':'Revisión manual de las capturas')+'.\n\nVerificá primero que la imagen corresponda a esta partida. La decisión quedará registrada y actualizará la llave.'))return;
          action.disabled=true;action.textContent='Guardando decisión…';
          const {data:resolution,error:resolveErr}=await db.rpc('js_adjudicate_report',{
            p_match:info.match.id,p_game_number:n,p_reporter:row.team_id,p_reason:reason
          });
          if(resolveErr||!resolution?.ok){action.disabled=false;action.textContent='⚠️ Intentar de nuevo';message('No se pudo adjudicar: '+(resolveErr?.message||'Error al confirmar'),true);return}
          message('✅ Resultado adjudicado por administración a '+winnerName+'. Se actualizó la llave.');
          const tid=opened.id;await openTour(tid);await loadTours();
        };
        block.append(action);
      }
     }
     info.content.append(block);
    }
   }
  }catch(e){console.warn('No se pudieron cargar los informes:',e.message);for(const v of model.values())if(v.card.isConnected)v.content.textContent='No fue posible consultar las capturas. Tocá Actualizar para reintentar.'}
  finally{working=false}
 }
 setInterval(()=>{if(document.visibilityState==='visible'&&opened)refresh()},18000);
 window.JSResultsAdmin=Object.freeze({decorateMatch,refresh});
})();

