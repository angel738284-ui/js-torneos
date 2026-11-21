from pathlib import Path
p=Path("ruleta.html")
s=p.read_text()
def swap(old,new,why):
 global s
 cnt=s.count(old)
 if cnt!=1:raise RuntimeError(f"{why}: found {cnt}")
 s=s.replace(old,new,1)
swap('.names li.chosen{border-color:#76ecca;background:#24505c;font-weight:800}',
'''.names li.chosen{border-color:#76ecca;background:#24505c;font-weight:800}
.names li.eliminated{opacity:.5;background:#291e32;text-decoration:line-through;text-decoration-color:#fd8b8b}
.last-eliminated{margin:13px auto 0;max-width:560px;border:1px solid #cd6576;background:#3c2231;border-radius:14px;padding:12px 15px;text-align:center;font-weight:850;color:#ffd9e0;overflow-wrap:anywhere;font-size:14px}
.phase{margin:14px auto 0;text-align:center;font-size:12px;color:#b5dfd5}''',"new elimination styles")
swap('<div id="winner" class="winner" aria-live="polite">','<div id="lastEliminated" class="last-eliminated" hidden aria-live="polite"></div>\n<div id="phase" class="phase" hidden aria-live="polite"></div>\n<div id="winner" class="winner" aria-live="polite">',"elimination info")
swap('const namesEl=document.getElementById("names"),countEl=document.getElementById("count"),winEl=document.getElementById("winner"),winName=document.getElementById("winnerName");',
'''const namesEl=document.getElementById("names"),countEl=document.getElementById("count"),winEl=document.getElementById("winner"),winName=document.getElementById("winnerName");
const eliminatedEl=document.getElementById("lastEliminated"),phaseEl=document.getElementById("phase");''',"dom")
swap('let data=null,serverOffset=0,rotation=0,spinId="",lastState="",settle=null,lastPoll=0;',
'let data=null,serverOffset=0,rotation=0,settle=null;',"remove obsolete")
swap('function draw(angle=0){\n if(!data?.participantes?.length)return;\n const items=data.participantes,n=items.length,sz=canvas.width,mid=sz/2,r=sz*.465,arc=p2/n;',
'''function visibleParticipants(){
 const items=data?.participantes||[];
 if(data?.modalidad!=="eliminacion")return items.map((p,i)=>({...p,originalIndex:i}));
 const eliminated=new Set((data.eliminados||[]).map(x=>Number(x.indice)));
 return items.map((p,i)=>({...p,originalIndex:i})).filter(p=>!eliminated.has(p.originalIndex));
}
function draw(angle=0){
 if(!data?.participantes?.length)return;
 const items=visibleParticipants(),n=items.length,sz=canvas.width,mid=sz/2,r=sz*.465,arc=p2/Math.max(1,n);''',"dynamic segments")
swap('const txt=n>28?"#"+(i+1):(name.length>13?name.slice(0,12)+"…":name);',
     'const txt=n>28?"#"+items[i].numero:(name.length>13?name.slice(0,12)+"…":name);',"labels original")
swap('function fillNames(items,winner){',
     'function fillNames(items,winner,eliminated=[]){\n const gone=new Set(eliminated.map(x=>Number(x.indice)));',"list signature")
swap('  if(i===winner)li.className="chosen";','  if(gone.has(i))li.className="eliminated";\n  if(i===winner)li.className="chosen";',"cross out")
swap(' countEl.textContent=items.length+" participantes · lista cerrada";',
''' countEl.textContent=eliminated.length?
  (items.length-eliminated.length)+" siguen · "+eliminated.length+" eliminados · "+items.length+" anotados":
  items.length+" participantes · lista cerrada";''',"remaining count")
swap('function frame(){\n if(data?.estado==="spinning"&&data.inicio){',
'''function frame(){
 if(data?.modalidad==="eliminacion"&&data.estado==="spinning"&&data.inicio){
  const elapsed=Math.max(0,clock()-Date.parse(data.inicio));
  const stepMs=Number(data.duracion_paso_ms||7000);
  const phase=(elapsed%stepMs)/stepMs;
  const completed=Math.floor(elapsed/stepMs);
  rotation=reduced?0:p2*(completed*4+4*(1-Math.pow(1-phase,3)));
  draw(rotation);
 }else if(data?.estado==="spinning"&&data.inicio){''',"sync phase spinner")
swap('function render(next){\n const previous=data,oldState=data?.estado||"";\n data=next;',
'''function render(next){
 const previous=data,oldState=data?.estado||"";
 data=next;
 if(next.modalidad==="eliminacion"){
  renderElimination(next);
  return;
 }
 eliminatedEl.hidden=true;phaseEl.hidden=true;''',"render branch")
anchor='function render(next){'
code='''function renderElimination(next){
 document.getElementById("title").textContent=next.titulo||"Ruleta JS Family";
 content.hidden=false;errorEl.hidden=true;
 const players=next.participantes||[];
 const lost=next.eliminados||[];
 const winner=next.estado==="finished"?Number(next.ganador_indice):-1;
 fillNames(players,winner,lost);
 const last=lost.at(-1);
 eliminatedEl.hidden=!last;
 if(last)eliminatedEl.textContent="❌ Eliminado #"+last.orden+": "+last.nombre;
 phaseEl.hidden=false;
 winEl.classList.toggle("show",winner>=0);
 if(winner>=0){
  const name=players[winner]?.nombre||"Ganador registrado";
  winName.textContent=name;
  phaseEl.textContent="🏆 ¡Último sobreviviente!";
  setMessage("🏆 ¡ÚLTIMO SOBREVIVIENTE! Sorteo finalizado y registrado.","done");
  rotation=0;draw(0);
  return;
 }
 if(next.estado==="closed"){
  phaseEl.textContent=players.length+" jugadores listos · "+(players.length-1)+" eliminaciones";
  setMessage("🔒 Lista cerrada. JS iniciará las eliminaciones desde WhatsApp.","waiting");
  draw(0);return;
 }
 const start=Date.parse(next.inicio);
 if(!Number.isFinite(start)){
  setMessage("🎡 Preparando la eliminación…","spin");return;
 }
 const timeToStart=start-clock();
 if(timeToStart>0){
  setMessage("⏳ Comienzan las eliminaciones en "+Math.ceil(timeToStart/1000)+" segundos.","spin");
 }else{
  setMessage("🎡 Ronda "+next.ronda_actual+" de "+next.total_eliminaciones+
   " · Quedan "+next.sobrevivientes+" jugadores. ¡El último gana!","spin");
 }
 phaseEl.textContent="❌ Cada 7 segundos sale uno · "+
   next.sobrevivientes+" siguen en juego · "+lost.length+" eliminados";
 draw(rotation);
}
'''
swap(anchor,code+anchor,"insert elimination render")
p.write_text(s)
print("ELIMINATION_UI_UPDATED",len(s))
