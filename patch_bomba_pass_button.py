from pathlib import Path
p=Path('bomba.html')
s=p.read_text()
def change(old,new,label):
 global s
 count=s.count(old)
 if count!=1:raise ValueError(f'{label}: coincidencias {count}')
 s=s.replace(old,new,1)
change('.player.targetable:active{transform:scale(.96)}',
'''.player.targetable:active{transform:scale(.96)}
.player.selected{border:3px solid #8cfed8!important;background:linear-gradient(155deg,#28555a,#20344c);
 box-shadow:0 0 0 2px #225950,0 0 19px #69ffd177}
.player.selected:after{content:"✓ ELEGIDO";position:absolute;top:-9px;right:2px;background:#8cfed8;
 color:#102b35;font-size:9px;font-weight:1000;border-radius:7px;padding:3px 6px}
.passControls{position:relative;border:1px solid #456c80;background:#142c40;border-radius:16px;
 padding:13px;margin-top:6px;display:grid;gap:9px}
.passControls strong{font-size:13px;color:#b5ffea}
.passControls .passHelp{font-size:12px;color:#c2d5e8;line-height:1.5}
button.passBomb{min-height:58px;width:100%;font-size:18px;letter-spacing:.5px;
 border:1px solid #f7a17e;background:linear-gradient(135deg,#ed4765,#b72e67);
 box-shadow:0 7px 22px #f0446855;transition:transform .15s,filter .15s}
button.passBomb:not(:disabled):active{transform:scale(.98)}
button.passBomb:disabled{background:#33465b;border-color:#4b5d73;box-shadow:none;opacity:.75}
.passControls.ready{border-color:#ff8b70;box-shadow:0 0 20px #ff775033}
.passControls.ready button.passBomb:not(:disabled){animation:passPulse .7s infinite alternate}
@keyframes passPulse{from{filter:brightness(1)}to{filter:brightness(1.2)}}
@media(prefers-reduced-motion:reduce){.passControls.ready button.passBomb{animation:none!important}}''',
"CSS button, selected target")
change('<div id="players" class="field" aria-label="Todos los jugadores de la sala"></div>\n<div id="actionHint" class="spectator" role="status">Preparando personajes…</div>',
'''<div id="players" class="field" aria-label="Todos los jugadores de la sala"></div>
<div class="passControls" id="passControls">
 <strong>💣 Pasá la bomba antes de que explote</strong>
 <div class="passHelp" id="selectedTargetLabel" role="status" aria-live="polite">Elegí el personaje de otro jugador para pasarle la bomba.</div>
 <button type="button" id="passBomb" class="passBomb" disabled>💣 PASAR BOMBA</button>
</div>
<div id="actionHint" class="spectator" role="status">Preparando personajes…</div>''',
"large action button")
change('let room=null,me=null,busy=false,offset=0,loading=false,seenEvents="",roomSignature="",lastHolder="",lastGameState="";',
'let room=null,me=null,busy=false,offset=0,loading=false,seenEvents="",roomSignature="",selectedTargetId=null,actionMessage="",actionMessageUntil=0;',"selection state")
change('async function pass(target){\n if(!canPass()||busy)return;',
'''function canChooseTarget(target){
 return Boolean(me?.vivo&&room?.estado==="playing"&&room.bomba_de===me.id&&
  target?.vivo&&target.id!==me.id);
}
function selectTarget(id){
 const player=room?.jugadores?.find(p=>p.id===id);
 if(!canChooseTarget(player)||busy)return;
 selectedTargetId=id===selectedTargetId?null:id;
 actionMessage="";updateHud();
}
async function passSelected(){
 const target=room?.jugadores?.find(p=>p.id===selectedTargetId);
 if(!target||!canChooseTarget(target)||!canPass()||busy)return;''',"select and confirm")
change(' busy=true;el("actionHint").textContent="💣 Pasando la bomba…";\n try{\n  await rpc("js_bomba_jugar",{p_code:code,p_access:personalToken,p_action:"pasar",p_target:target});\n  await refresh();\n }catch(err){el("actionHint").textContent="⚠️ "+err.message;}\n finally{busy=false;}\n}',
''' busy=true;updateHud();
 try{
  await rpc("js_bomba_jugar",{p_code:code,p_access:personalToken,p_action:"pasar",p_target:target.id});
  selectedTargetId=null;
  actionMessage="✅ ¡Bomba enviada a "+target.nombre+"!";
  actionMessageUntil=Date.now()+3500;
  await refresh();
 }catch(err){
  actionMessage="⚠️ "+err.message;
  actionMessageUntil=Date.now()+3500;
 }finally{busy=false;updateHud();}
}
el("passBomb").addEventListener("click",()=>void passSelected());''',"pass logic")
change('  const clickable=canPass()&&p.vivo&&p.id!==me.id;',
'  const clickable=canChooseTarget(p);',"target choose before shield")
change('  if(clickable)card.classList.add("targetable");\n  card.disabled=!clickable;',
'''  if(clickable)card.classList.add("targetable");
  if(p.id===selectedTargetId)card.classList.add("selected");
  card.disabled=!clickable;
  card.setAttribute("aria-pressed",String(p.id===selectedTargetId));''',"target visuals")
change('  if(clickable)card.addEventListener("click",()=>void pass(p.id));',
'  if(clickable)card.addEventListener("click",()=>selectTarget(p.id));',"target click")
change(' if(status==="open")el("phase").textContent="🟢 Inscripciones abiertas · "+total+" / "+room.capacidad+" participantes";',
' if(status==="open")el("phase").textContent="🟢 Inscripciones abiertas · "+total+" / "+room.capacidad+" participantes";',"unnecessary") if False else None
change(' else if(status==="playing")el("phase").textContent="💣 ¡La bomba está en juego! Tocá un personaje para pasarla si la tenés.";',
' else if(status==="playing")el("phase").textContent="💣 ¡La bomba está en juego! Elegí a quién pasarla y tocá 💣 PASAR BOMBA.";',
"game instructions")
change('   hint.textContent=shield>0?"🛡️ Protección: "+(shield/1000).toFixed(1)+" s":\n    "💣 ¡LA TENÉS! Tocá el personaje de otro jugador para pasársela.";',
'''   hint.textContent=shield>0?"🛡️ Protección: "+(shield/1000).toFixed(1)+" s":
    "💣 ¡LA TENÉS! Elegí otro personaje y pulsá PASAR BOMBA." ;''',"holder instructions")
old=''' const old=document.querySelectorAll(".player");
 for(const card of old){
  const target=room.jugadores?.find(p=>p.id===card.dataset.playerId);
  const clickable=Boolean(target&&canPass()&&target.vivo&&target.id!==me.id);
  card.disabled=!clickable;
  card.classList.toggle("targetable",clickable);
 }
}'''
new=''' // A lost turn or eliminated target cancels any old choice.
 const selected=room.jugadores?.find(p=>p.id===selectedTargetId);
 if(selectedTargetId&&!canChooseTarget(selected))selectedTargetId=null;
 const passButton=el("passBomb"),passPanel=el("passControls");
 const chosen=room.jugadores?.find(p=>p.id===selectedTargetId);
 const ready=Boolean(chosen&&canPass()&&!busy);
 passButton.disabled=!ready;
 passButton.textContent=busy?"⏳ PASANDO…":"💣 PASAR BOMBA";
 passPanel.classList.toggle("ready",ready);
 const statusText=el("selectedTargetLabel");
 if(!me){statusText.textContent="👀 Estás mirando como espectador. Para jugar, abrí tu enlace privado de Guardian.";}
 else if(!me.vivo){statusText.textContent="💥 Quedaste eliminado; ahora podés mirar la partida.";}
 else if(room.estado!=="playing"){statusText.textContent="🎮 Prepará tu personaje. El botón se activará cuando empiece el juego.";}
 else if(room.bomba_de!==me.id){statusText.textContent="👀 Esperá: la bomba la tiene "+(activeHolder()?.nombre||"otro jugador")+".";}
 else if(chosen&&shieldMs()>0){statusText.textContent="🎯 Elegiste a "+chosen.nombre+". 🛡️ Protección: "+(shieldMs()/1000).toFixed(1)+" s";}
 else if(chosen){statusText.textContent="🎯 Elegiste a "+chosen.nombre+". ¡Ahora pulsá el botón para pasársela!";}
 else statusText.textContent="👇 Tocá el personaje de otro jugador y después apretá PASAR BOMBA.";
 if(Date.now()<actionMessageUntil)hint.textContent=actionMessage;
 for(const card of document.querySelectorAll(".player")){
  const target=room.jugadores?.find(p=>p.id===card.dataset.playerId);
  const clickable=Boolean(target&&canChooseTarget(target)&&!busy);
  const isSelected=Boolean(target?.id===selectedTargetId);
  card.disabled=!clickable;card.classList.toggle("targetable",clickable);
  card.classList.toggle("selected",isSelected);
  card.setAttribute("aria-pressed",String(isSelected));
 }
}'''
change(old,new,"refresh pass button state")
p.write_text(s)
print("PASS_BUTTON_INSTALLED",len(s))
