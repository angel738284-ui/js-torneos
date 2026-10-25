"use strict";
(function(){
 const $=id=>document.getElementById(id);
 const endpoint=String(window.JS_CONFIG?.supabaseUrl||"").replace(/\/$/,"")+"/functions/v1/torneo";
 let activeCode="";
 const notice=(text,bad=false)=>{
   const el=$("notice");el.textContent=text;
   el.className="status show"+(bad?" error":"");
 };
 async function search(){
   const code=$("publicCode").value.trim().toUpperCase();
   $("publicCode").value=code;
   if(!/^JS-[A-F0-9]{8}$/.test(code))return notice("Ingresá un código de torneo válido. Ejemplo: JS-1234ABCD.",true);
   const button=$("publicFind");button.disabled=true;button.textContent="Buscando…";
   try{
     const url=endpoint+"?code="+encodeURIComponent(code)+"&view=bracket";
     const res=await fetch(url,{cache:"no-store"});
     const data=await res.json();
     if(!res.ok)throw Error(data.error||"No se encontraron las llaves.");
     if(data.code!==code||!Array.isArray(data.matches)||!Array.isArray(data.teams))
       throw Error("El servidor devolvió datos incompletos");
     activeCode=code;
     $("publicTitle").textContent=data.name;
     $("publicMode").textContent=data.mode+" · "+data.max_teams+" equipos · Final "+(Number(data.final_best_of)===1?"1 partida":"mejor de 3");
     $("publicStatus").textContent=data.status==="finished"?"Finalizado":
        data.status==="open"?"Inscripciones abiertas":"Inscripciones cerradas";
     if(data.mode==="BR"){
       $("publicBracket").replaceChildren();
       const info=document.createElement("p");info.className="small";
       info.textContent="🎮 Battle Royale: todos contra todos en UNA sola sala. No existen llaves eliminatorias. Los datos privados están en Mi equipo.";
       $("publicBracket").append(info);
     }else window.JSBracket.render($("publicBracket"),data);
     $("publicContent").classList.remove("hidden");
     notice(data.mode==="BR"?"Este torneo BR no utiliza llaves.":data.rounds>0?"Llaves actualizadas correctamente.":"Las llaves todavía no fueron generadas.");
   }catch(e){
     $("publicContent").classList.add("hidden");
     notice(e.message||"Error de conexión",true);
   }finally{button.disabled=false;button.textContent="Buscar";}
 }
 function scrollByRound(dir){
   const frame=$("publicBracket").querySelector(".champ-scroll");
   if(frame)frame.scrollBy({left:dir*306,behavior:"smooth"});
 }
 $("publicFind").onclick=search;
 $("publicRefresh").onclick=search;
 $("publicPrev").onclick=()=>scrollByRound(-1);
 $("publicNext").onclick=()=>scrollByRound(1);
 $("publicFinal").onclick=()=>{
   const frame=$("publicBracket").querySelector(".champ-scroll");
   if(frame)frame.scrollTo({left:frame.scrollWidth,behavior:"smooth"});
 };
 $("publicCode").onkeydown=event=>{if(event.key==="Enter")search()};
 const params=new URLSearchParams(location.search);
 const code=params.get("codigo");
 if(code){$("publicCode").value=code.toUpperCase();search()}
})();