"use strict";
const $=id=>document.getElementById(id);
const show=(id,on)=>$(id).classList.toggle("hidden",!on);
const tell=(text,bad=false)=>{
 const n=$("notice");n.textContent=text;n.className="status show"+(bad?" error":"");
};
let tournament=null;
let starterRows=[],substituteRows=[];
const minSub=()=>tournament?.requires_substitute===false?0:1;
const config=window.JS_CONFIG||{};
const base=String(config.supabaseUrl||"").replace(/\/$/,"");
const endpoint=base+"/functions/v1/torneo";
if(!base)tell("El organizador todavía no configuró la conexión a Supabase.",true);
function setRulesExpanded(open){
 $("rulesWindow").classList.toggle("is-collapsed",!open);
 $("rulesToggle").setAttribute("aria-expanded",String(open));
 $("rulesToggle").textContent=open?"▲ Ocultar reglas":"▼ Ver todas las reglas";
}
$("rulesToggle").onclick=()=>{
 const opening=$("rulesWindow").classList.contains("is-collapsed");
 setRulesExpanded(opening);
 if(!opening)$("rulesSection").scrollIntoView({behavior:"smooth",block:"start"});
};
const params=new URLSearchParams(location.search);
const code=params.get("codigo")||"";
if(code){$("code").value=code;setTimeout(loadTournament,100)}
$("find").onclick=loadTournament;

function updateSubButton(){
 const count=substituteRows.length;
 const b=$("addSub");
 b.disabled=count>=2||!tournament||tournament.status!=="open";
 b.textContent=count>=2?"✓ Suplentes completos (2/2)":count===0?"＋ Agregar suplente (opcional)":"＋ Agregar segundo suplente (opcional)";
 substituteRows.forEach((row,i)=>{row.remove?.classList.toggle("hidden",count<=minSub());});
}
function everyRow(){return [...starterRows,...substituteRows]}
function resetRoster(){
 starterRows=[];substituteRows=[];
 $("players").replaceChildren();
 $("substitutes").replaceChildren();
 updateSubButton();
}
function makePlayerRow(number,isSubstitute){
 const wrapper=document.createElement("div");
 wrapper.className="item";
 wrapper.style.cssText="border:1px solid #36465d;border-radius:14px;padding:14px;margin:12px 0";
 const label=document.createElement("div");
 label.style.cssText="font-weight:800;margin-bottom:10px";
 label.textContent=isSubstitute?(number===1?"🔁 Suplente 1 — "+(minSub()?"OBLIGATORIO":"opcional"):"🔁 Suplente 2 — opcional"):"Titular "+number;
 const input=document.createElement("input");
 input.type="text";input.inputMode="numeric";input.maxLength=16;input.autocomplete="off";
 input.placeholder="ID numérico de Free Fire";input.className="player-id";input.required=!isSubstitute;
 const status=document.createElement("div");status.className="small";
 status.style.cssText="margin:10px 0;white-space:normal;overflow-wrap:anywhere";
 status.textContent="Sin verificar";
 const buttons=document.createElement("div");
 buttons.style.cssText="display:flex;gap:10px;flex-wrap:wrap;margin-top:9px";
 const verify=document.createElement("button");verify.type="button";verify.className="secondary";
 verify.textContent="🔍 Verificar ID";verify.style.cssText="flex:1;min-width:120px";
 const correct=document.createElement("button");correct.type="button";correct.className="ghost";
 correct.textContent="Borrar / Corregir ID";correct.style.cssText="flex:1;min-width:120px";
 correct.classList.add("hidden");
 const remove=document.createElement("button");remove.type="button";remove.className="ghost";
 remove.textContent="Quitar suplente";remove.style.cssText="min-width:110px";
 if(isSubstitute)buttons.append(verify,correct,remove);
 else buttons.append(verify,correct);
 if(isSubstitute&&number===1&&minSub()===1)remove.classList.add("hidden");
 wrapper.append(label,input,status,buttons);
 const state={element:wrapper,input,status,verify,correct,remove,verified:null,role:isSubstitute?"suplente":"titular"};
 function invalidate(){
  state.verified=null;status.textContent="Sin verificar";status.style.color="";
  verify.classList.remove("hidden");correct.classList.add("hidden");
 }
 input.addEventListener("input",()=>{
  const clean=input.value.replace(/\D/g,"");
  if(input.value!==clean)input.value=clean;
  invalidate();
 });
 correct.onclick=()=>{
   input.readOnly=false;input.value="";invalidate();input.focus();
 };
 remove.onclick=()=>{
   if(!isSubstitute||substituteRows.length<=minSub())return;
   const idx=substituteRows.indexOf(state);
   if(idx>=0)substituteRows.splice(idx,1);
   wrapper.remove();
   substituteRows.forEach((v,i)=>{
     const d=v.element.firstChild;if(d)d.textContent=i===0?"🔁 Suplente 1 — "+(minSub()?"OBLIGATORIO":"opcional"):"🔁 Suplente 2 — opcional";
   });
   updateSubButton();
 };
 verify.onclick=async()=>{
   const id=input.value.trim();
   if(!tournament)return tell("Primero buscá el torneo.",true);
   if(!/^[0-9]{5,16}$/.test(id)){
     status.textContent="Ingresá un ID numérico válido.";
     status.style.color="#ffa9ae";return;
   }
   if(everyRow().some(row=>row!==state&&row.input.value.trim()===id)){
     status.textContent="Ese ID ya está cargado en este equipo.";
     status.style.color="#ffa9ae";return;
   }
   input.readOnly=true;verify.disabled=true;verify.textContent="Verificando…";
   status.textContent="Consultando el nombre en Free Fire…";
   const token=window.turnstile?.getResponse?.()||"";
   try{
      const res=await fetch(endpoint,{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({action:"verify",code:tournament.code,player_id:id,turnstile_token:token})
      });
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||"No se pudo verificar el ID");
      if(String(data.id)!==id||!data.nickname||data.verified!==true)
        throw new Error("La respuesta del verificador no coincide con el ID.");
      const detected=String(data.region||"").trim().toUpperCase();
      const allowed=String(tournament?.allowed_region||"SAC").trim().toUpperCase();
      if(!detected||detected!==allowed||data.eligible===false){
        throw new Error("❌ No podés participar: este torneo solo acepta región "+allowed+". Tu ID es "+(detected||"desconocida")+".");
      }
      state.verified={id,nickname:data.nickname,region:detected};
      if(tournament?.mode==="BR"&&tournament?.br_format==="solo"&&state.role==="titular")
        $("team").value=data.nickname.slice(0,45);
      status.style.color="#7ee9c0";
      status.textContent="✓ "+data.nickname+" · "+id+" · "+state.verified.region;
      verify.classList.add("hidden");correct.classList.remove("hidden");
   }catch(e){
      state.verified=null;input.readOnly=false;status.style.color="#ffa9ae";
      status.textContent="No verificado: "+(e.message||"error de red");
      verify.classList.remove("hidden");correct.classList.add("hidden");
      window.turnstile?.reset?.();
   }finally{
      verify.disabled=false;verify.textContent="🔍 Verificar ID";
   }
 };
 return state;
}

function addSubstitute(){
 if(!tournament||substituteRows.length>=2)return;
 const state=makePlayerRow(substituteRows.length+1,true);
 substituteRows.push(state);
 $("substitutes").append(state.element);
 updateSubButton();
}
$("addSub").onclick=addSubstitute;

async function loadTournament(){
 let code=$("code").value.trim().toUpperCase();
 $("code").value=code;
 if(!/^JS-[A-F0-9]{8}$/.test(code))return tell("Código inválido. Ejemplo: JS-A12B34CD",true);
 try{
  const res=await fetch(endpoint+"?code="+encodeURIComponent(code));
  const data=await res.json();
  if(!res.ok)throw Error(data.error||"No se pudo buscar el torneo");
  tournament=data;
  show("tournament",true);
  const canRegister=data.status==="open"&&data.queue_open===true;
  const isFull=data.registered>=data.max_teams;
  show("form",canRegister);show("success",false);
  show("waitlistInfo",canRegister&&(isFull||data.waitlist_count>0));
  show("waitlistLookup",canRegister&&(isFull||data.waitlist_count>0));
  $("waitlistInfoText").textContent=isFull?
    "Los cupos están completos, pero podés anotar a todo tu equipo en espera. Posiciones pendientes: "+(data.waitlist_count||0)+".":
    "Hay "+data.waitlist_count+" equipo(s) en espera. Se respeta el orden de llegada.";
  $("register").textContent=isFull||data.waitlist_count>0?"⏳ Anotarme en lista de espera":"Inscribir equipo";
  $("name").textContent=data.name;
  $("mode").textContent=data.mode==="BR"?("BR "+({solo:"Solo",duo:"Dúo",escuadra:"Escuadra"}[data.br_format]||"")+" · "+data.team_size+" titular(es)"):(data.mode||"PVP")+" · "+data.team_size+" vs "+data.team_size;
  $("slots").textContent=data.registered+" / "+data.max_teams+(data.mode==="BR"&&data.br_format==="solo"?" jugadores":" equipos");
  $("date").textContent=data.starts_at?"Fecha: "+new Date(data.starts_at).toLocaleString("es-AR"):"Fecha por confirmar";
  $("regionRuleTitle").textContent="🌎 Región permitida: "+(data.allowed_region||"SAC");
  $("regionRuleNote").textContent="Solo pueden anotarse jugadores y suplentes verificados de "+(data.allowed_region||"SAC")+". Los ID de otras regiones se rechazan al verificar.";
  $("publicBracketLink").href="llaves.html?codigo="+encodeURIComponent(data.code);
  $("rulesSection").dataset.mode=data.mode||"";
  const hasRules=Boolean(data.rules && data.rules.trim());
  show("rulesSection",hasRules);
  window.JSRuleFormat.render($("rules"),data.rules||"");
  // El reglamento se despliega con una flecha clara, sin recortar su parte inferior.
  setRulesExpanded(false);
  show("rulesToggle",hasRules);
  const finalMentioned=/al mejor de 3 solo ultima ronda\(\s*final\s*\)/i.test(data.rules||"");
  show("finalPublicInfo",data.mode!=="BR"&&!finalMentioned);
  show("publicBracketLink",data.mode!=="BR");
  const n=Number(data.prize_quantity)||0;
  const unit=data.prize_kind==="diamantes"?"diamantes 💎":data.prize_kind==="pases"?"pase(s) 🎟️":"premio(s)";
  $("prizePublic").textContent=data.prize_kind&&data.prize_kind!=="ninguno"&&n>0?
      "🏆 Premio anunciado: "+n.toLocaleString("es-AR")+" "+unit+(data.prize_details?" · "+data.prize_details:""):"";
  const single=data.mode==="BR"&&data.br_format==="solo";
  $("registrationHeading").textContent=single?"Inscribirme en BR Solo":"Anotar equipo";
  show("teamNameWrap",!single);
  $("team").required=!single;
  if(single)$("team").value="";
  $("teamNameLabel").textContent=single?"Nombre del participante / alias":"Nombre del equipo";
  $("team").placeholder=single?"Ej. JSPro":"Ej. Los Akatsuki";
  $("subHeading").textContent=minSub()?"🔁 Suplentes: mínimo 1, máximo 2":"🔁 Suplentes opcionales (0 a 2)";
  $("subDescription").textContent=minSub()?"Además de los titulares, al menos un suplente debe verificar su ID.":"Podés inscribirte sin suplente. Si querés, agregá hasta dos y verificá sus ID.";
  resetRoster();
  for(let i=0;i<data.team_size;i++){
    const row=makePlayerRow(i+1,false);
    starterRows.push(row);$("players").append(row.element);
  }
  if(canRegister&&minSub()===1)addSubstitute();
  else updateSubButton();
  if(!canRegister)tell("Este torneo ya cerró inscripciones o comenzó sus enfrentamientos.",true);
  else if(isFull||data.waitlist_count>0)tell("⏳ Cupos completos o lista pendiente: podés verificar tus ID y anotarte en espera.");
  else tell("Torneo encontrado: verificá "+data.team_size+" titular(es). "+(minSub()?"Al menos un suplente obligatorio.":"No necesitás suplente."));
 }catch(e){
  tournament=null;resetRoster();show("form",false);show("tournament",false);
  tell(e.message,true);
 }
}

$("form").addEventListener("submit",async event=>{
 event.preventDefault();
 if(!tournament)return;
 const solo=tournament.mode==="BR"&&tournament.br_format==="solo";
 const rows=everyRow();
 const team=solo?String(starterRows[0]?.verified?.nickname||"").trim().slice(0,45):$("team").value.trim();
 if(team.length<2||team.length>45)return tell(solo?"Verificá tu ID para utilizar tu apodo automáticamente.":"Ingresá el nombre del equipo.",true);
 if(starterRows.length!==tournament.team_size || substituteRows.length<minSub() || substituteRows.length>2)
    return tell("Revisá los "+tournament.team_size+" titulares y "+(minSub()?"al menos un suplente.":"los suplentes opcionales."),true);
 const invalidRegion=rows.find(row=>row.verified&&String(row.verified.region||"").trim().toUpperCase()!==String(tournament.allowed_region||"SAC").trim().toUpperCase());
 if(invalidRegion)return tell("❌ Hay un jugador de otra región. Este torneo admite únicamente "+(tournament.allowed_region||"SAC")+".",true);
 const missing=rows.filter(row=>!row.verified||row.verified.id!==row.input.value.trim());
 if(missing.length){
   missing[0].element.scrollIntoView({behavior:"smooth",block:"center"});
   return tell("Faltan ID por verificar. Revisá todos los titulares y suplentes que cargaste.",true);
 }
 const ids=rows.map(x=>x.verified.id);
 if(new Set(ids).size!==ids.length)return tell("Hay ID repetidos entre titulares y suplentes.",true);
 const btn=$("register");btn.disabled=true;btn.textContent="Inscribiendo equipo…";
 try{
  const token=window.turnstile?.getResponse?.()||"";
  const res=await fetch(endpoint,{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({
      action:"register",code:tournament.code,team_name:team,
      player_ids:starterRows.map(r=>r.verified.id),
      substitute_ids:substituteRows.map(r=>r.verified.id),
      turnstile_token:token
    })
  });
  const data=await res.json();
  if(!res.ok)throw Error(data.error||"No se pudo inscribir el equipo");
  if(!/^JS-EQ-[A-HJ-NP-Z2-9]{20}$/.test(data.team_access_code||""))
    throw Error("La inscripción fue recibida pero el servidor no devolvió el código. Contactá al administrador, no vuelvas a inscribirte.");
  show("form",false);show("success",true);$("teamSuccess").textContent=solo?"Jugador: "+team:"Equipo: "+team;
  const waiting=data.waitlisted===true;
  $("successHeading").textContent=waiting?"⏳ ¡Anotado en lista de espera!":"✓ Equipo inscrito correctamente";
  $("waitlistSuccessInfo").textContent=waiting?
    "Tu equipo está en posición "+data.position+". Todavía no tiene un cupo confirmado. El administrador te podrá admitir cuando quede un lugar.":
    "Tu equipo ya tiene un cupo confirmado.";
  $("teamCodeDescription").textContent=waiting?
    "Guardá este código privado: sirve para consultar tu posición. Si te admiten, el mismo código te permitirá entrar a Mi equipo y ver las salas.":
    "Guardá este código. Lo necesitás para consultar el rival y los datos de sala.";
  show("privatePanelAccess",!waiting);
  $("teamCode").value=data.team_access_code;
  const list=$("playersSuccess");list.replaceChildren();
  for(const p of data.players||[]){
    const li=document.createElement("li");
    li.textContent=(p.role==="suplente"?"🔁 Suplente · ":"Titular · ")+p.nickname+" · ID "+p.id+" · "+p.region;
    list.append(li);
  }
  $("waitlistPrivate").value=data.team_access_code;
  show("waitlistLookup",waiting);
  if(waiting)tell("⏳ Lista de espera confirmada. Posición "+data.position+". Guardá tu código privado.");
  else tell("¡Inscripción confirmada! "+starterRows.length+" titulares y "+substituteRows.length+" suplentes.");
 }catch(e){
  tell(e.message||"Error al inscribir el equipo",true);
  window.turnstile?.reset?.();
 }finally{btn.disabled=false;btn.textContent=tournament&&(tournament.registered>=tournament.max_teams||tournament.waitlist_count>0)?"⏳ Anotarme en lista de espera":"Inscribir equipo";}
});

$("waitlistCheck").onclick=async()=>{
 if(!tournament)return;
 const access=$("waitlistPrivate").value.trim().toUpperCase();
 if(!/^JS-EQ-[A-HJ-NP-Z2-9]{20}$/.test(access)){
  $("waitlistResult").textContent="Ingresá el código privado completo.";
  return;
 }
 $("waitlistCheck").disabled=true;
 try{
  const result=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({action:"waitlist_status",code:tournament.code,team_access_code:access})});
  const data=await result.json();
  if(!result.ok)throw Error(data.error||"No se encontró esta inscripción");
  const status=data.status==="waiting"?
   "⏳ "+data.team+" · Posición actual: "+data.position+". Tu equipo todavía espera un cupo.":
   data.status==="admitted"?
   "✅ ¡"+data.team+" fue admitido! Ya podés utilizar este mismo código en Mi equipo.":
   "❌ La inscripción en espera fue retirada. Consultá con el organizador.";
  $("waitlistResult").textContent=status;
  if(data.status==="admitted")show("privatePanelAccess",true);
 }catch(e){$("waitlistResult").textContent="⚠️ "+e.message;}
 finally{$("waitlistCheck").disabled=false;}
};

// Protección adicional opcional para inscripciones públicas con Cloudflare Turnstile.
if(config.turnstileSiteKey){
 const script=document.createElement("script");
 script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
 script.onload=()=>window.turnstile.render("#captcha",{sitekey:config.turnstileSiteKey});
 document.head.append(script);
}

$("copyTeamCode").onclick=async()=>{
 const code=$("teamCode").value;
 if(!code)return;
 try{await navigator.clipboard.writeText(code);tell("Código privado de equipo copiado.");}
 catch{
  $("teamCode").focus();$("teamCode").select();
  const ok=document.execCommand("copy");
  tell(ok?"Código de equipo copiado.":"Seleccioná y copiá manualmente tu código.",!ok);
 }
};
