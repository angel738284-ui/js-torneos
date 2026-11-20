/* Touch-friendly visual wardrobe. Existing selects remain the source of truth. */
(function(){
 "use strict";
 const catalog=document.getElementById("wardrobeCatalog");
 if(!catalog)return;
 const categories=[
  {id:"muñeco",icon:"🎮",name:"Muñeco",fields:["wear3d","bodyColor3d"]},
  {id:"arriba",icon:"👕",name:"Arriba",fields:["topStyle","shirt","pattern"]},
  {id:"abajo",icon:"👖",name:"Abajo",fields:["bottomStyle","pants"]},
  {id:"zapatillas",icon:"👟",name:"Zapas",fields:["shoes"]},
  {id:"accesorios",icon:"👑",name:"Accesorios",fields:["accessory"]},
  {id:"efectos",icon:"✨",name:"Efectos",fields:["aura","pose"]}
 ];
 const labels={
  wear3d:"¿Querés vestirlo?",bodyColor3d:"Color del muñeco",
  topStyle:"Elegí una prenda",shirt:"Color de arriba",pattern:"Estampado",
  bottomStyle:"Tipo de prenda",pants:"Color de abajo",shoes:"Zapatillas",
  accessory:"¿Qué le ponemos?",aura:"Aura",pose:"Movimiento"
 };
 const icons={
  wear3d:{no:"🔴",yes:"👕"},topStyle:{
   tee:"👕",hoodie:"🧥",jacket:"🧥",jersey:"🏟️",dress:"👗",crop:"🎽"},
  pattern:{plain:"◻️",stripes:"▤",star:"⭐",number:"4️⃣",bolt:"⚡",heart:"❤️"},
  bottomStyle:{pants:"👖",cargo:"🧰",shorts:"🩳",skirt:"👗",jeans:"👖"},
  shoes:{white:"👟",black:"👟",red:"👟",gold:"👟",neon:"👟",pink:"👟"},
  accessory:{none:"🚫",glasses:"🕶️",crown:"👑",mask:"🥷",cap:"🧢",
   headphones:"🎧",earrings:"💎",bandana:"🎀",horns:"😈"},
  aura:{none:"🚫",cyan:"💠",purple:"🟣",gold:"🌟",fire:"🔥",pink:"💗"},
  pose:{idle:"🧍",wave:"👋",confident:"😎",dance:"🕺"}
 };
 const shoeColors={white:"#f5f5ff",black:"#252b3f",red:"#ff6275",
  gold:"#f4d57a",neon:"#75f8d5",pink:"#ffa6db"};
 const isColor=id=>["bodyColor3d","shirt","pants","shoes"].includes(id);
 let active="arriba";
 const nav=document.createElement("div");nav.className="wardTabs";
 nav.setAttribute("role","tablist");nav.setAttribute("aria-label","Categorías de ropa");
 const panel=document.createElement("div");panel.className="wardCategory";
 panel.id="wardCategoryPanel";panel.setAttribute("role","tabpanel");
 const summary=document.createElement("p");summary.className="wardSummary";summary.id="wardSummary";
 const info=document.createElement("p");info.className="wardInfo";
 info.textContent="Tocá una prenda o un color: el muñeco 3D cambia al instante. Guardá cuando te guste.";
 catalog.append(nav,panel,summary,info);
 for(const cat of categories){
  const tab=document.createElement("button");tab.type="button";
  tab.className="wardTab";tab.dataset.category=cat.id;
  tab.setAttribute("role","tab");tab.setAttribute("aria-controls",panel.id);
  tab.textContent=cat.icon+" "+cat.name;
  tab.addEventListener("click",()=>{active=cat.id;render();});
  nav.append(tab);
 }
 function optionName(field,value){
  const select=document.getElementById(field);
  return select?.querySelector("option[value='"+value+"']")?.textContent||value;
 }
 function updateSummary(){
  const v=id=>document.getElementById(id)?.value;
  const names=[];
  if(v("wear3d")!=="yes")names.push("🔴 Clásico sin ropa");
  else {
   names.push("👕 "+optionName("topStyle",v("topStyle")));
   names.push("👖 "+optionName("bottomStyle",v("bottomStyle")));
   names.push("👟 "+optionName("shoes",v("shoes")));
  }
  if(v("accessory")!=="none")
   names.push("👑 "+optionName("accessory",v("accessory")));
  summary.textContent="Tu look: "+names.join(" · ");
 }
 function sync(){
  for(const tile of panel.querySelectorAll(".wardTile")){
   const select=document.getElementById(tile.dataset.field);
   const chosen=select?.value===tile.dataset.value;
   tile.classList.toggle("chosen",chosen);
   tile.setAttribute("aria-pressed",String(chosen));
  }
  updateSummary();
  const dressed=document.getElementById("wear3d")?.value==="yes";
  panel.classList.toggle("wardClassic",!dressed);
 }
 function pick(field,value){
  const select=document.getElementById(field);
  if(!select||!Array.from(select.options).some(o=>o.value===value))return;
  select.value=value;
  if(["topStyle","shirt","pattern","bottomStyle","pants","shoes"].includes(field)){
   // A garment automatically enables clothing, so it is always visible.
   document.getElementById("wear3d").value="yes";
  }
  select.dispatchEvent(new Event("change",{bubbles:true}));
  sync();
 }
 function render(){
  for(const tab of nav.children){
   const selected=tab.dataset.category===active;
   tab.classList.toggle("active",selected);
   tab.setAttribute("aria-selected",String(selected));
   tab.tabIndex=selected?0:-1;
  }
  panel.replaceChildren();
  const cat=categories.find(c=>c.id===active);
  const title=document.createElement("h3");
  title.textContent=cat.icon+" "+cat.name;panel.append(title);
  for(const field of cat.fields){
   const select=document.getElementById(field);if(!select)continue;
   const block=document.createElement("section");block.className="wardBlock";
   const heading=document.createElement("h4");heading.textContent=labels[field]||field;
   block.append(heading);
   const choices=document.createElement("div");
   choices.className=isColor(field)?"wardChoices wardColors":"wardChoices";
   for(const option of select.options){
    const tile=document.createElement("button");tile.type="button";
    tile.className="wardTile"+(isColor(field)?" wardColor":"");
    tile.dataset.field=field;tile.dataset.value=option.value;
    const name=option.textContent.trim();
    tile.setAttribute("aria-label",name);
    const face=document.createElement("span");face.className="wardThumb";
    if(isColor(field)){
     face.classList.add("wardSwatch");
     face.style.setProperty("--swatch",field==="shoes"?
      shoeColors[option.value]:option.value);
     if(field==="shoes")face.textContent="👟";
    }else{
     face.textContent=icons[field]?.[option.value]||"✨";
    }
    const caption=document.createElement("span");caption.className="wardName";
    caption.textContent=name;
    tile.append(face,caption);
    tile.addEventListener("click",()=>pick(field,option.value));
    choices.append(tile);
   }
   block.append(choices);panel.append(block);
  }
  sync();
 }
 nav.addEventListener("keydown",e=>{
  if(e.key!=="ArrowLeft"&&e.key!=="ArrowRight")return;
  e.preventDefault();
  const n=categories.findIndex(c=>c.id===active);
  const next=(n+(e.key==="ArrowRight"?1:-1)+categories.length)%categories.length;
  active=categories[next].id;render();
  nav.querySelector(".active")?.focus();
 });
 // Changes made by random/reset buttons, identity sync and native selectors.
 window.JSWardrobe={sync,showCategory:id=>{
  if(categories.some(c=>c.id===id)){active=id;render();}
 }};
 render();
 catalog.classList.add("ready");
 document.getElementById("openWardrobe")?.addEventListener("click",()=>{
  document.querySelector(".avatarEditor")?.scrollIntoView({behavior:"smooth",block:"start"});
 });
})();
