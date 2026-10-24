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
     for(const row of items){
      const label=teamCache.find(t=>t.id===row.team_id)?.name||'Equipo';
      const holder=make('div',undefined,'results-proof-row');
      holder.append(make('span',label+' · '+(row.won?'Ganamos':'Perdimos')));
      const link=make('a','🖼️ Ver captura','link');link.target='_blank';link.rel='noopener noreferrer';
      const {data:url,error:linkErr}=await db.storage.from('js-torneos-evidencias').createSignedUrl(row.proof_path,600);
      if(linkErr||!url?.signedUrl)holder.append(make('span','Sin acceso a la captura','small'));
      else{link.href=url.signedUrl;holder.append(link)}
      block.append(holder);
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

