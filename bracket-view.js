"use strict";
// JS Family: bracket renderer shared by administrator and spectator pages.
// Only displays the match / team public metadata handed in by the caller.
(function(){
 const COL=238,GAP=68,STEP=146,H=112,TOP=68;
 const E=(tag,cls,text)=>{
  const n=document.createElement(tag);
  if(cls)n.className=cls;
  if(text!==undefined)n.textContent=String(text);
  return n;
 };
 function coordinate(round,slot){
  return TOP+((slot-0.5)*Math.pow(2,round-1)*STEP);
 }
 function model(rounds,matches){
  const R=Math.max(0,Math.min(5,Number(rounds)||0));
  const rows=Math.pow(2,Math.max(0,R-1));
  const height=TOP+rows*STEP+48;
  const W=R*(COL+GAP)+205;
  const coords=new Map();
  for(const match of matches){
   if(match.round>=1&&match.round<=R&&match.slot>=1){
    coords.set(match.round+":"+match.slot,{
     x:(match.round-1)*(COL+GAP),y:coordinate(match.round,match.slot)
    });
   }
  }
  const edges=[];
  for(const match of matches){
   if(match.round>=R)continue;
   const origin=coords.get(match.round+":"+match.slot);
   const target=coords.get((match.round+1)+":"+Math.ceil(match.slot/2));
   if(origin&&target)edges.push({from:origin,to:target});
  }
  return {rounds:R,height,width:W,coords,edges,step:STEP,col:COL,gap:GAP,top:TOP};
 }
 function render(host,info){
  host.replaceChildren();
  const matches=Array.isArray(info.matches)?info.matches:[];
  const rounds=Number(info.rounds)||0;
  if(rounds<1||!matches.length){
    host.append(E("p","small","Aún no hay llaves. Aparecerán cuando el administrador genere los cruces."));
    return;
  }
  const teams=new Map((info.teams||[]).map(t=>[String(t.id),String(t.name)]));
  const name=id=>id?(teams.get(String(id))||"Equipo pendiente"):"Por definir";
  const layout=model(rounds,matches);
  const canvas=E("div","champ-canvas");
  canvas.style.width=layout.width+"px";
  canvas.style.height=layout.height+"px";
  canvas.setAttribute("aria-label","Cuadro de eliminatorias del torneo");
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("width",String(layout.width));
  svg.setAttribute("height",String(layout.height));
  svg.setAttribute("viewBox","0 0 "+layout.width+" "+layout.height);
  svg.classList.add("champ-connector-lines");
  for(const edge of layout.edges){
   const fromX=edge.from.x+COL,toX=edge.to.x;
   const mid=fromX+(toX-fromX)/2;
   const path=document.createElementNS("http://www.w3.org/2000/svg","path");
   path.setAttribute("d","M"+fromX+" "+edge.from.y+" H"+mid+" V"+edge.to.y+" H"+toX);
   path.setAttribute("fill","none");
   path.setAttribute("stroke","#426e75");
   path.setAttribute("stroke-width","2");
   path.setAttribute("stroke-linejoin","round");
   svg.append(path);
  }
  canvas.append(svg);
  const roundLabels=Array.from({length:layout.rounds},(_,i)=>
    i===layout.rounds-1?"🏆 FINAL":i===layout.rounds-2?"SEMIFINALES":
      i===layout.rounds-3?"CUARTOS":"RONDA "+(i+1));
  for(let r=1;r<=layout.rounds;r++){
   const label=E("div","champ-column-title",roundLabels[r-1]);
   label.style.left=((r-1)*(COL+GAP))+"px";
   canvas.append(label);
  }
  for(const match of matches){
   const pos=layout.coords.get(match.round+":"+match.slot);
   if(!pos)continue;
   const isFinal=match.round===layout.rounds;
   const isBye=match.round===1&&Boolean(match.team_a)&&!match.team_b&&Boolean(match.winner);
   const card=E("div","champ-match");
   card.style.left=pos.x+"px";
   card.style.top=(pos.y-H/2)+"px";
   card.dataset.round=String(match.round);
   card.dataset.slot=String(match.slot);
   if(isFinal)card.classList.add("champ-match-final");
   if(match.winner)card.classList.add("champ-match-done");
   if(isBye)card.classList.add("champ-match-bye");
   const title=E("div","champ-match-header",
     isFinal?"GRAN FINAL · BO3":"PARTIDA "+match.slot+(isBye?" · PASE":""));
   card.append(title);
   for(const [field,letter] of [["team_a","A"],["team_b","B"]]){
    const id=match[field];
    const line=E("div","champ-contender");
    const dot=E("span","champ-team-marker",letter);
    const team=E("span","champ-team-name",id?name(id):isBye?"Pase directo":"Por definir");
    team.title=team.textContent;
    if(match.winner&&id===match.winner)line.classList.add("champ-team-winner");
    if(!id)line.classList.add("champ-team-missing");
    line.append(dot,team);
    if(isFinal&&id){
     const wins=field==="team_a"?match.final_wins_a:match.final_wins_b;
     const count=E("span","champ-team-wins",String(Number(wins)||0));
     line.append(count);
    }else if(match.winner&&id===match.winner){
     line.append(E("span","champ-win-icon","✓"));
    }
    card.append(line);
   }
   if(isFinal&&!match.winner&&match.team_a&&match.team_b){
    const p=E("div","champ-match-footer","Primero en ganar 2 partidas");
    card.append(p);
   }else if(isFinal&&match.winner){
    card.append(E("div","champ-match-footer","🏆 CAMPEÓN"));
   }
   if(info.onMatchSelect){
    card.classList.add("champ-clickable");
    card.tabIndex=0;card.setAttribute("role","button");
    card.setAttribute("aria-label","Abrir "+roundLabels[match.round-1]+", partida "+match.slot);
    card.title="Tocá para administrar la partida";
    const activate=()=>info.onMatchSelect(match);
    card.onclick=activate;
    card.onkeydown=event=>{
      if(event.key==="Enter"||event.key===" "){event.preventDefault();activate()}
    };
   }
   canvas.append(card);
  }
  const last=matches.find(m=>m.round===layout.rounds&&m.slot===1);
  const champ=E("div","champ-trophy");
  champ.style.left=(layout.rounds*(COL+GAP))+"px";
  champ.style.top=(coordinate(layout.rounds,1)-63)+"px";
  const cup=E("div","champ-trophy-icon","🏆");champ.append(cup);
  champ.append(E("div","champ-trophy-caption",last?.winner?"CAMPEÓN":"CAMPEÓN PENDIENTE"));
  champ.append(E("div","champ-trophy-team",last?.winner?name(last.winner):"Por definir"));
  if(last?.winner){
   const a=Number(last.final_wins_a)||0,b=Number(last.final_wins_b)||0;
   if(a+b>0)champ.append(E("div","champ-trophy-score",a+" – "+b+" · Final"));
  }
  canvas.append(champ);
  const frame=E("div","champ-scroll");
  frame.tabIndex=0;frame.setAttribute("aria-label","Llaves visuales, deslizá horizontalmente");
  frame.append(canvas);host.append(frame);
  return {frame,canvas,layout};
 }
 window.JSBracket=Object.freeze({render,model});
})();