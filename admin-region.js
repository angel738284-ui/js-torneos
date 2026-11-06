"use strict";
// Solo administradores autenticados pueden consultar y aprobar la región.
// Todo permiso se valida de nuevo en la función Edge; nunca se confía en esta interfaz.
(function(){
  const el=id=>document.getElementById(id);
  const input=el("regionLookupId"),search=el("regionLookupBtn"),
    result=el("regionLookupResult"),fields=el("regionApprovalInputs"),
    region=el("regionAdminChoice"),proof=el("regionProofSeen"),
    save=el("regionApproveBtn"),remove=el("regionRevokeBtn"),
    feedback=el("regionAdminFeedback");
  if(!input||!search||!save)return;
  let checked=null;
  const setFeedback=(text,err=false)=>{feedback.textContent=text;feedback.style.color=err?"#ffa5ae":"#91e9c3"};
  function clearChecked(){
    checked=null;
    fields.classList.add("hidden");
    result.textContent="";
    feedback.textContent="";
    proof.checked=false;region.value="";
  }
  input.addEventListener("input",clearChecked);
  async function api(body){
    if(typeof db==="undefined"||!db)throw Error("Iniciá sesión en el panel administrador.");
    const {data:authSession,error}=await db.auth.getSession();
    const jwt=authSession?.session?.access_token;
    if(error||!jwt)throw Error("Tu sesión venció. Volvé a ingresar.");
    const config=typeof cfg==="function"?cfg():window.JS_CONFIG;
    const origin=String(config?.supabaseUrl||"").replace(/\/$/,"");
    if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(origin))
      throw Error("La conexión con Supabase no está configurada.");
    const reply=await fetch(origin+"/functions/v1/torneo",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+jwt},
      body:JSON.stringify(body),
      cache:"no-store"
    });
    let data;
    try{data=await reply.json()}catch{throw Error("El verificador no respondió correctamente.")}
    if(!reply.ok)throw Error(data.error||"La solicitud fue rechazada.");
    return data;
  }
  search.onclick=async()=>{
    const game_id=input.value.trim();
    if(!/^[0-9]{5,16}$/.test(game_id)){setFeedback("Ingresá un ID numérico válido.",true);return}
    if(search.disabled)return;
    search.disabled=true;clearChecked();
    result.textContent="Consultando el apodo de Free Fire…";
    try{
      const data=await api({action:"admin_region_lookup",game_id});
      if(!data?.nickname||data.id!==game_id)throw Error("No se pudo confirmar la identidad del ID.");
      checked={id:game_id,nickname:data.nickname,detected:data.detected_region};
      result.textContent="✅ Apodo verificado: "+data.nickname+" · ID "+game_id+
        "\nRegión del proveedor: "+(data.detected_region==="PENDIENTE"?"no informada":data.detected_region)+
        (data.current_approval?.region?"\nConfirmación manual vigente: "+data.current_approval.region:"");
      fields.classList.remove("hidden");
      if(data.current_approval?.region)region.value=data.current_approval.region;
      if(data.detected_region!=="PENDIENTE"&&!data.current_approval)
        setFeedback("El proveedor ya informa la región. No la modifiques si la captura indica otra.");
    }catch(e){clearChecked();setFeedback("⚠️ "+(e?.message||"No se pudo verificar el ID."),true)}
    finally{search.disabled=false}
  };
  save.onclick=async()=>{
    if(!checked||checked.id!==input.value.trim()){
      setFeedback("Primero consultá el ID y su apodo.",true);return;
    }
    const chosen=region.value;
    if(!chosen){setFeedback("Seleccioná la región que aparece en la captura de Free Fire.",true);return}
    if(!proof.checked){setFeedback("Primero confirmá que revisaste la captura del juego.",true);return}
    if(save.disabled)return;
    const question="¿Confirmás que el ID "+checked.id+" ("+checked.nickname+
      ") pertenece a la región "+chosen+" según la captura de Ajustes de Free Fire?";
    if(typeof askConfirm!=="function"||!(await askConfirm(question)))return;
    save.disabled=true;setFeedback("Guardando la confirmación…");
    try{
      const data=await api({action:"admin_region_approve",game_id:checked.id,region:chosen,evidence_confirmed:true});
      setFeedback("✅ Región "+data.region+" autorizada para "+data.nickname+" durante 90 días. El jugador ya puede volver a verificar su ID en la inscripción.");
      proof.checked=false;
    }catch(e){setFeedback("⚠️ "+(e?.message||"No se pudo autorizar."),true)}
    finally{save.disabled=false}
  };
  remove.onclick=async()=>{
    if(!checked||checked.id!==input.value.trim()){
      setFeedback("Primero consultá el ID.",true);return;
    }
    if(remove.disabled)return;
    if(typeof askConfirm!=="function"||!(await askConfirm("¿Revocar la confirmación manual del ID "+checked.id+"?")))return;
    remove.disabled=true;setFeedback("Revocando confirmación…");
    try{
      await api({action:"admin_region_revoke",game_id:checked.id});
      setFeedback("✅ Aprobación manual revocada.");
      clearChecked();setFeedback("✅ Aprobación manual revocada.");
    }catch(e){setFeedback("⚠️ "+(e?.message||"No se pudo revocar."),true)}
    finally{remove.disabled=false}
  };
})();