import {createClient} from "https://esm.sh/@supabase/supabase-js@2.45.6";
import {competitiveProfileCard} from "./perfil-competitivo.js?v=1.0.0";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));
const content=document.getElementById("profile-public-content");
const controls=document.getElementById("profile-public-controls");
const config=window.JS_CONFIG||{};
const id=new URLSearchParams(location.search).get("u")||"";
const valid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
async function loadPublicProfile(){
 if(!valid){
  content.textContent="Este enlace no corresponde a un perfil competitivo válido.";
  return;
 }
 try{
  if(!config.supabaseUrl||!config.publishableKey)
   throw Error("No se pudo conectar con JS Torneos.");
  const sb=createClient(config.supabaseUrl,config.publishableKey,{
   auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  });
  const {data,error}=await sb.rpc("js_liga_perfil_publico",{p_user_id:id});
  if(error)throw error;
  if(!data?.ok){
   content.textContent=data?.message||"Este perfil no está disponible.";
   return;
  }
  content.classList.remove("cp-state");
  content.innerHTML=competitiveProfileCard(data,esc);
  controls.hidden=false;
 }catch(e){
  content.textContent="No se pudo cargar este perfil. Probá actualizar la página.";
  console.warn("Competitive profile unavailable:",e?.code||"not-available");
 }
}
document.getElementById("profile-share").addEventListener("click",async()=>{
 const url=location.href;
 try{
  if(navigator.share){
   await navigator.share({title:"Perfil competitivo JS Family",url});
  }else if(navigator.clipboard?.writeText){
   await navigator.clipboard.writeText(url);
   const btn=document.getElementById("profile-share");btn.textContent="✓ Enlace copiado";
  }else window.prompt("Copiá el enlace:",url);
 }catch(e){if(e?.name!=="AbortError")window.prompt("Copiá el enlace:",url);}
});
void loadPublicProfile();
