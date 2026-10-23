"use strict";
(function(){
  function addBold(text,parent){
    // Sólo el estilo *negrita*. Se crean nodos de texto: nunca ejecutamos HTML pegado por usuarios.
    const pattern=/\*([^*\n]+)\*/g;
    let from=0;
    for(const match of text.matchAll(pattern)){
      if(match.index>from)parent.append(document.createTextNode(text.slice(from,match.index)));
      const strong=document.createElement("strong");
      strong.textContent=match[1];
      parent.append(strong);
      from=match.index+match[0].length;
    }
    if(from<text.length)parent.append(document.createTextNode(text.slice(from)));
  }
  function render(destination,raw){
    destination.replaceChildren();
    const source=String(raw||"").replace(/\r\n?/g,"\n").trim();
    if(!source)return;
    for(const original of source.split("\n")){
      const line=original.trim();
      if(!line){const gap=document.createElement("div");gap.className="rule-gap";destination.append(gap);continue;}
      const quote=line.startsWith(">");
      const bullet=/^[-•]\s*/.test(line);
      const content=quote?line.slice(1).trim():bullet?line.replace(/^[-•]\s*/,""):line;
      const node=document.createElement("div");
      node.className=quote?"rule-quote":bullet?"rule-bullet":"rule-line";
      if(quote&&/^REGLAS\b/i.test(content))node.classList.add("rule-main-title");
      if(quote&&/^by\s/i.test(content))node.classList.add("rule-subtitle");
      if(!quote&&/^\*[^*]+\*\s*$/.test(content))node.classList.add("rule-section-title");
      if(!quote&&/^\*[^*]+:\*/.test(content))node.classList.add("rule-keyline");
      if(quote&&/^(solo final|al mejor de\s*\d+|al mejor de 3 solo ultima ronda\(\s*final\s*\))$/i.test(content))node.classList.add("rule-bestof");
      addBold(content,node);
      destination.append(node);
    }
  }
  window.JSRuleFormat=Object.freeze({render});
})();