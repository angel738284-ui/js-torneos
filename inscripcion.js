"use strict";
const $=id=>document.getElementById(id);
const show=(id,on)=>$(id).classList.toggle("hidden",!on);
const tell=(text,bad=false)=>{const n=$("notice");n.textContent=text;n.className="status show"+(bad?" error":"");};
let tournament=null;const config=window.JS_CONFIG||{};
const base=String(config.supabaseUrl||"").replace(/\/$/,"");
const endpoint=base+"/functions/v1/torneo";
if(!base)tell("El organizador todavía no configuró la conexión a Supabase.",true);
const params=new URLSearchParams(location.search);const code=params.get("codigo")||"";
if(code){$("code").value=code;setTimeout(loadTournament,100)}
$("find").onclick=loadTournament;
async function loadTournament(){
 let code=$("code").value.trim().toUpperCase();$("code").value=code;
 if(!/^JS-[A-F0-9]{8}$/.test(code))return tell("Código inválido. Ejemplo: JS-A12B34CD",true);
 try{const res=await fetch(endpoint+"?code="+encodeURIComponent(code));const data=await res.json();
 if(!res.ok)throw Error(data.error||"No se pudo buscar el torneo");
 tournament=data;show("tournament",true);show("form",data.status==="open"&&data.registered<data.max_teams);show("success",false);
 $("name").textContent=data.name;$("mode").textContent=data.team_size+" vs "+data.team_size;
 $("slots").textContent=data.registered+" / "+data.max_teams+" equipos";
 $("date").textContent=data.starts_at?"Fecha: "+new Date(data.starts_at).toLocaleString("es-AR"):"Fecha por confirmar";
 $("rules").textContent=data.rules?"Reglas: "+data.rules:"";
 $("players").replaceChildren();
 for(let i=0;i<data.team_size;i++){
  const label=document.createElement("label");label.textContent="ID de Free Fire · Jugador "+(i+1);
  const input=document.createElement("input");input.className="player-id";input.type="text";input.inputMode="numeric";input.maxLength=16;input.autocomplete="off";input.placeholder="UID numérico";input.required=true;input.addEventListener("input",()=>input.value=input.value.replace(/\D/g,""));
  $("players").append(label,input);
 }
 if(data.status!=="open"||data.registered>=data.max_teams)tell("El torneo está cerrado o ya no tiene cupos.",true);
 else tell("Torneo encontrado. Anotá a los "+data.team_size+" jugadores.");
 }catch(e){tournament=null;show("form",false);show("tournament",false);tell(e.message,true)}
}
$("form").addEventListener("submit",async event=>{
 event.preventDefault();if(!tournament)return;
 const team=$("team").value.trim();const ids=[...document.querySelectorAll(".player-id")].map(x=>x.value.trim());
 if(team.length<2||ids.some(id=>!/^[0-9]{5,16}$/.test(id))||new Set(ids).size!==ids.length)return tell("Revisá el nombre y los UID; no pueden repetirse.",true);
 const btn=$("register");btn.disabled=true;btn.textContent="Verificando nombres con Epinby…";
 try{
  const token=window.turnstile?.getResponse?.()||"";
  const res=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code:tournament.code,team_name:team,player_ids:ids,turnstile_token:token})});
  const data=await res.json();if(!res.ok)throw Error(data.error||"No se pudo inscribir el equipo");
  show("form",false);show("success",true);$("teamSuccess").textContent="Equipo: "+team;
  const list=$("playersSuccess");list.replaceChildren();for(const p of data.players||[]){const li=document.createElement("li");li.textContent=p.nickname+" · ID "+p.id+" · "+p.region;list.append(li)}
  tell("¡Inscripción confirmada!");
 }catch(e){tell(e.message,true);window.turnstile?.reset?.();}
 finally{btn.disabled=false;btn.textContent="Inscribir equipo";}
});
// Turnstile requiere una clave pública en config.js y TURNSTILE_SECRET en Supabase.
if(config.turnstileSiteKey){const script=document.createElement("script");script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";script.onload=()=>window.turnstile.render("#captcha",{sitekey:config.turnstileSiteKey});document.head.append(script)}
