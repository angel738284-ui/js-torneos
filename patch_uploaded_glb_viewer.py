from pathlib import Path
page=Path('modelo-js.html')
html=page.read_text()
start=html.index('<script type="module">')
end=html.index('</script>',start)+len('</script>')
new=r'''<script type="module">
import * as THREE from "./bomba3d/vendor/three.module.js";
import {preloadOriginalModel,createOriginalRubberActor} from "./bomba3d/imported.js?v=1";

const stage=document.getElementById("stage");
const wait=document.getElementById("wait");
const feedback=document.getElementById("feedback");
const pointers=new Map();
let renderer,scene,camera,model,current,autoSpin=false,zoom=1,rotY=.19,rotX=-.12,prev=0,raf=0;
try{
 if(!window.WebGLRenderingContext)throw Error("Este navegador no admite WebGL.");
 await preloadOriginalModel();
 scene=new THREE.Scene();
 camera=new THREE.OrthographicCamera(-2,2,2,-2,.1,70);
 camera.position.set(0,1.3,6.8);
 camera.lookAt(0,1.3,0);
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"low-power"});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.4));
 renderer.setClearColor(0,0);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.0;
 stage.insertBefore(renderer.domElement,stage.firstChild);
 scene.add(new THREE.HemisphereLight(0xf4fbff,0x7082a2,1.5));
 const mainLight=new THREE.DirectionalLight(0xffefe1,1.9);
 mainLight.position.set(-4,6,7);scene.add(mainLight);
 const rim=new THREE.DirectionalLight(0xc1d7ff,.75);
 rim.position.set(4,3,-4);scene.add(rim);
 model=new THREE.Group();scene.add(model);
 const platform=new THREE.Mesh(
  new THREE.CylinderGeometry(.72,.8,.085,48),
  new THREE.MeshStandardMaterial({color:"#203751",roughness:.67,metalness:.04}));
 platform.position.y=-.06;scene.add(platform);

 const applyColor=(color)=>{
  if(current){model.remove(current.root);current.dispose();}
  current=createOriginalRubberActor({bodyColor3d:color});
  model.add(current.root);
 };
 applyColor("#f83e50");
 function resize(){
  const width=Math.max(150,stage.clientWidth),height=Math.max(250,stage.clientHeight),aspect=width/height;
  const vsize=3.5/zoom;
  camera.left=-vsize*aspect/2;camera.right=vsize*aspect/2;
  camera.top=vsize/2;camera.bottom=-vsize/2;camera.updateProjectionMatrix();
  renderer.setSize(width,height,false);
 }
 const observer=new ResizeObserver(resize);observer.observe(stage);resize();
 function draw(t){
  raf=requestAnimationFrame(draw);
  if(document.hidden)return;
  if(autoSpin&&t-prev<2000)rotY+=.012;
  prev=t;
  model.rotation.y=rotY;model.rotation.x=rotX;
  renderer.render(scene,camera);
 }
 raf=requestAnimationFrame(draw);
 stage.classList.add("ready");
 feedback.textContent="✅ Es el archivo GLB real que enviaste, con su textura original. Arrastrá para girar.";
 stage.addEventListener("pointerdown",e=>{
  e.preventDefault();stage.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 });
 stage.addEventListener("pointermove",e=>{
  if(!pointers.has(e.pointerId))return;
  e.preventDefault();const old=pointers.get(e.pointerId);
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===1){
   rotY+=(e.clientX-old.x)*.012;
   rotX=Math.max(-.6,Math.min(.6,rotX+(e.clientY-old.y)*.006));
  }
 });
 for(const type of ["pointerup","pointercancel","lostpointercapture"])
  stage.addEventListener(type,e=>pointers.delete(e.pointerId));
 stage.addEventListener("wheel",e=>{
  e.preventDefault();zoom=Math.max(.7,Math.min(1.6,zoom+(e.deltaY<0?.08:-.08)));
  document.getElementById("zoom").value=zoom;resize();
 },{passive:false});
 document.getElementById("zoom").addEventListener("input",e=>{zoom=Number(e.target.value);resize();});
 document.getElementById("reset").addEventListener("click",()=>{
  rotY=.19;rotX=-.12;zoom=1;document.getElementById("zoom").value="1";resize();
 });
 document.getElementById("spin").addEventListener("click",e=>{
  autoSpin=!autoSpin;e.target.classList.toggle("active",autoSpin);
  e.target.textContent=autoSpin?"⏸ Detener giro":"⟳ Girar solo";
 });
 document.querySelectorAll("[data-color]").forEach(b=>b.addEventListener("click",()=>{
  applyColor(b.dataset.color);
  document.querySelectorAll("[data-color]").forEach(c=>c.classList.toggle("active",c===b));
 }));
}catch(err){
 wait.textContent="⚠️ "+err.message;
 feedback.textContent="Probá Chrome y volvé a cargar la página.";
 console.error("JS GLB",err);
}
</script>'''
html=html[:start]+new+html[end:]
html=html.replace('Este es el modelo de cuerpo continuo que creamos para Bomba Mortal. Podés girarlo con el dedo, acercarlo y cambiarle el color, directamente en Android.',
                  'Este es el archivo GLB original que me mandaste, con sus texturas y detalles. Podés girarlo y cambiarle el color directamente desde el celular.')
html=html.replace('🧸 Nuestro muñeco rojo — Vista 3D','🧸 Muñeco original JS — Vista 3D')
html=html.replace('Nuestro muñeco rojo — Vista 3D','Nuestro muñeco original — Vista 3D')
page.write_text(html)
p=Path('bomba.html');s=p.read_text()
old='<script type="module" src="./bomba3d/game.js?v=3"></script>'
assert s.count(old)==1;s=s.replace(old,'<script type="module" src="./bomba3d/game.js?v=4"></script>')
s=s.replace('Los modelos 3D se descargan por atuendo. Si tu celular va lento, usá el modo 2D.',
            'El muñeco clásico usa tu GLB original. Los disfraces siguen disponibles; si tu celular va lento, usá 2D.')
p.write_text(s)
p=Path('bomba3d/imported.js');s=p.read_text()
old='   copy.map=recolorMap(m.map,options.bodyColor3d||defaultRed);'
assert s.count(old)==1
s=s.replace(old,old+'''
   // Metallic=1 was embedded by the image-to-3D converter; soften it for rubber.
   copy.metalness=.04;
   copy.roughness=.49;''')
p.write_text(s)
print("ORIGINAL_GLB_VIEWER_AND_GAME_ASSETS_UPDATED")
