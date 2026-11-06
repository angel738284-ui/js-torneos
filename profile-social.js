/** Logos SVG propios del perfil. Nunca se inserta HTML procedente de usuarios. */
const NS="http://www.w3.org/2000/svg";
const officialHosts={
  instagram:["instagram.com","www.instagram.com"],
  tiktok:["tiktok.com","www.tiktok.com","m.tiktok.com","vm.tiktok.com","vt.tiktok.com"]
};
export function normalizeSocialLink(input,platform){
  if(input===null||input===undefined||String(input).trim()==="")return null;
  const raw=String(input).trim();
  if(raw.length>350)throw Error("El enlace de "+platform+" no puede superar 350 caracteres.");
  let value=raw;
  const handle=raw.match(/^@?([a-zA-Z0-9._]{1,30})$/);
  if(handle){
    if(platform==="tiktok"&&handle[1].length<2)throw Error("Usuario de TikTok demasiado corto.");
    value=platform==="instagram"?"https://www.instagram.com/"+handle[1]+"/":"https://www.tiktok.com/@"+handle[1];
  }else if(/^(?:www\.)?(?:instagram\.com|tiktok\.com|m\.tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)\//i.test(raw)){
    value="https://"+raw;
  }
  let link;
  try{link=new URL(value)}catch{throw Error("Pegá un enlace válido de "+platform+" o escribí @usuario.");}
  if(!officialHosts[platform]?.includes(link.hostname.toLowerCase())||link.protocol!=="https:"||
     link.username||link.password||link.port||link.pathname.length<2)
    throw Error("El enlace debe pertenecer a "+(platform==="instagram"?"Instagram":"TikTok")+".");
  link.search="";link.hash="";
  if(link.toString().length>350)throw Error("El enlace de "+platform+" es demasiado largo.");
  return link.toString();
}
function svgEl(tag,attrs={}){
  const n=document.createElementNS(NS,tag);
  for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));
  return n;
}
function logo(platform){
  const svg=svgEl("svg",{
    viewBox:"0 0 24 24",width:20,height:20,"aria-hidden":"true",focusable:"false"
  });
  if(platform==="instagram"){
    svg.setAttribute("fill","none");
    svg.setAttribute("stroke","currentColor");
    svg.setAttribute("stroke-width","2");
    svg.setAttribute("stroke-linecap","round");
    svg.setAttribute("stroke-linejoin","round");
    svg.append(
      svgEl("rect",{x:2,y:2,width:20,height:20,rx:5}),
      svgEl("circle",{cx:12,cy:12,r:4}),
      svgEl("circle",{cx:18,cy:6,r:1,fill:"currentColor",stroke:"none"})
    );
  }else{
    svg.setAttribute("fill","currentColor");
    svg.append(svgEl("path",{d:"M16.87 0H12.6v16.95a3.57 3.57 0 1 1-3.04-3.53V9.1a8 8 0 1 0 7.31 7.97V8.48a10.4 10.4 0 0 0 6.12 1.96V6.16C19.65 6.15 16.9 3.4 16.87 0z"}));
  }
  return svg;
}
export function renderSocialLinks(container,profile){
  container.replaceChildren();
  for(const platform of ["instagram","tiktok"]){
    const raw=profile?.[platform+"_url"];
    let url;
    try{url=normalizeSocialLink(raw,platform)}catch{continue}
    if(!url)continue;
    const link=document.createElement("a");
    link.className="js-social-link js-social-link--"+platform;
    link.href=url;link.target="_blank";link.rel="noopener noreferrer nofollow";
    link.referrerPolicy="no-referrer";
    link.setAttribute("aria-label","Abrir "+(platform==="instagram"?"Instagram":"TikTok")+" del jugador");
    const emblem=document.createElement("span");
    emblem.className="js-social-icon";emblem.append(logo(platform));
    const label=document.createElement("span");
    label.textContent=platform==="instagram"?"Instagram":"TikTok";
    link.append(emblem,label);
    container.append(link);
  }
  container.hidden=container.children.length===0;
}
