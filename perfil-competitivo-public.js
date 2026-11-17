import {createClient} from "https://esm.sh/@supabase/supabase-js@2.45.6";
import {competitiveProfileCard} from "./perfil-competitivo.js?v=2.0.0";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));
const content=document.getElementById("profile-public-content");
const controls=document.getElementById("profile-public-controls");
const config=window.JS_CONFIG||{};
const params=new URLSearchParams(location.search);
const teamId=params.get("d")||"";
const valid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId);
async function loadPublicDuo(){
 if(!valid){
  content.textContent=params.has("u")?
   "Este enlace pertenece a una ficha individual anterior. Pedile al dúo que comparta su nuevo perfil 2VS2.":
   "Este enlace no corresponde a un dúo competitivo válido.";
  return;
 }
 try{
  if(!config.supabaseUrl||!config.publishableKey)
   throw Error("No se pudo conectar con JS Torneos.");
  const sb=createClient(config.supabaseUrl,config.publishableKey,{
   auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  });
  const {data,error}=await sb.rpc("js_liga_duo_perfil",{p_team_id:teamId});
  if(error)throw error;
  if(!data?.ok){
   content.textContent=data?.message||"Esta ficha del dúo no está disponible.";
   return;
  }
  content.classList.remove("cp-state");
  content.innerHTML=competitiveProfileCard(data,esc);
  controls.hidden=false;
 }catch(e){
  content.textContent="No pudimos cargar esta ficha. Probá actualizar la página.";
  console.warn("Duo profile unavailable",e?.code||"not-available");
 }
}
document.getElementById("profile-share").addEventListener("click",async()=>{
 const url=location.href;
 try{
  if(navigator.share){
   await navigator.share({title:"Perfil de dúo JS Family 2VS2",url});
  }else if(navigator.clipboard?.writeText){
   await navigator.clipboard.writeText(url);
   document.getElementById("profile-share").textContent="✓ Enlace copiado";
  }else window.prompt("Copiá el enlace:",url);
 }catch(e){if(e?.name!=="AbortError")window.prompt("Copiá el enlace:",url);}
});
void loadPublicDuo();
