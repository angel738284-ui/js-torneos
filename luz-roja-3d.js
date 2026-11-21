import * as THREE from './bomba3d/vendor/three.module.js';
import {preloadOriginalModel,createOriginalRubberActor} from './bomba3d/imported.js?v=21';
const $=id=>document.getElementById(id),stage=$('scene'),status=$('status'),light=$('signal'),count=$('alive'),move=$('move'),start=$('start'),sound=$('sound'),hit=$('hit'),left=$('left'),right=$('right');
const scene=new THREE.Scene();scene.background=new THREE.Color('#85c9df');scene.fog=new THREE.Fog('#85c9df',65,220);
const camera=new THREE.PerspectiveCamera(60,1,.1,260);const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=false;stage.append(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xe6faff,0x4e6850,2));const sun=new THREE.DirectionalLight(0xffe7b3,2.2);sun.position.set(-12,25,15);scene.add(sun);
const mat=(color,roughness=1)=>new THREE.MeshStandardMaterial({color,roughness});const grass=mat('#429b68'),track=mat('#d5b98c'),wall=mat('#9dcab8');
function box(w,h,d,m,x,y,z){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);scene.add(mesh);return mesh}
box(38,.1,200,grass,0,-.08,-85);box(26,.07,185,track,0,-.02,-85);box(.6,4,190,wall,-13.5,2,-85);box(.6,4,190,wall,13.5,2,-85);
for(let i=-3;i<=3;i++){box(.08,.04,165,mat('#fff4cf'),i*3.1,0,-83)}
for(let z=-12;z>=-172;z-=14){for(const x of [-17,17]){const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.35,.5,3,8),mat('#735239'));trunk.position.set(x,1.5,z);scene.add(trunk);const crown=new THREE.Mesh(new THREE.SphereGeometry(1.9,9,7),mat('#287d49'));crown.position.set(x,4,z);scene.add(crown)}}
for(let i=0;i<20;i++)box(1.25,.045,1.25,mat(i%2?'#ffffff':'#202a30'),-12+i*1.25,.035,-166);
const doll=new THREE.Group();scene.add(doll);doll.position.set(0,0,-173);
const pink=mat('#e8799c'),skin=mat('#f2d1b2'),hair=mat('#292027'),black=mat('#171e24');
function ball(parent,r,m,x,y,z){const o=new THREE.Mesh(new THREE.SphereGeometry(r,16,12),m);o.position.set(x,y,z);parent.add(o);return o}
const torso=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.7,3,12),pink);torso.position.y=3.1;doll.add(torso);
const headPivot=new THREE.Group();headPivot.position.y=5.5;doll.add(headPivot);
ball(headPivot,1.05,skin,0,.15,0);ball(headPivot,1.08,hair,0,.55,-.3);
for(const x of [-.5,.5])ball(headPivot,.14,black,x,.22,1);
for(const x of [-.9,.9]){ball(doll,.38,skin,x,3.7,0);ball(doll,.4,pink,x,4.1,0)}
for(const x of [-.7,.7]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.28,.3,2,10),skin);leg.position.set(x,1,0);doll.add(leg)}
const song=new Audio("./assets/luz-roja-cancion.ogg");song.preload="auto";song.volume=.8;
let actors=[],playing=false,red=false,pressed=false,clock=0,next=0,last=0,deadline=180,raf=0,enabledSound=true,audioCtx,loading=false;
let lane=0,phase='idle',phaseEnd=0,phaseToken=0,headTarget=0,headVelocity=0,winner=null,lastHit=-100;
const GREEN_FALLBACK=5.8,RED_DURATION=4.2,TURN_DURATION=.55;
function stopSong(){song.pause();try{song.currentTime=0}catch{}}
function startGreen(){
  const token=++phaseToken;red=false;phase='green';headTarget=0;
  light.textContent='🟢 LUZ VERDE';light.className='signal green';
  stopSong();phaseEnd=clock+GREEN_FALLBACK;
  if(enabledSound){const play=song.play();if(play)play.catch(()=>{});}
  // Audio timing is authoritative only when metadata provides a reasonable length.
  // Duración fija: la reproducción del audio nunca puede bloquear el semáforo.
}
// El semáforo depende del reloj del juego, no de eventos del reproductor.
function beginTurn(){if(!playing||phase!=='green')return;stopSong();phase='turn';phaseEnd=clock+TURN_DURATION;headTarget=Math.PI;for(const p of actors){if(p!==actors[0]){p.botMove=false;p.decisionAt=clock+.6}}light.textContent='🟠 ¡FRENÁ!';light.className='signal red';}
function beginRed(){phase='red';red=true;phaseEnd=clock+RED_DURATION;light.textContent='🔴 LUZ ROJA';light.className='signal red';tone(260);}
const skins=['#ef4d62','#2dcab8','#ffd54f','#9c76e7','#f18b43','#57d97a','#45b7ed','#f47cb0'];
function tone(f){if(!enabledSound)return;try{audioCtx??=new AudioContext();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=f;g.gain.value=.05;o.connect(g).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+.12)}catch{}}
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}new ResizeObserver(resize).observe(stage);
function clear(){actors.forEach(a=>{scene.remove(a.actor.root);a.actor.dispose()});actors=[]}
function make(){clear();for(let i=0;i<8;i++){const a=createOriginalRubberActor({bodyColor3d:skins[i],clothesEnabled:true,topStyle:i%2?'hoodie':'shirt',topColor:skins[(i+3)%8],bottomStyle:'pants',bottomColor:'#26334b'});a.root.scale.setScalar(.73);a.root.position.set((i-3.5)*2.7,0,-1);a.root.rotation.y=Math.PI;scene.add(a.root);actors.push({actor:a,z:-1,x:(i-3.5)*2.7,dead:false,won:false,walking:false,pace:9+Math.random()*2,botMove:false,decisionAt:0,downUntil:0,fallStart:0})}}
function end(){phaseToken++;stopSong();playing=false;pressed=false;phase='idle';move.disabled=true;hit.disabled=true;left.disabled=true;right.disabled=true;start.textContent='↻ Jugar otra vez';const me=actors[0];status.textContent=winner?('🏆 Ganó '+(winner===me?'¡VOS!':'el jugador '+(actors.indexOf(winner)+1))):me.dead?'💀 Te vio la muñeca':'⏰ Tiempo terminado';}
function frame(now){
 const dt=Math.min((now-last)/1000,.05);last=now;
 if(playing){
  clock+=dt;
  if(clock>=phaseEnd){if(phase==='green')beginTurn();else if(phase==='turn')beginRed();else if(phase==='red')startGreen();}
  const delta=((headTarget-headPivot.rotation.y+Math.PI*3)%(Math.PI*2))-Math.PI;
  headVelocity=(headVelocity+delta*Math.min(1,dt*15))*.76;
  headPivot.rotation.y+=headVelocity*Math.min(1,dt*12);
  for(let i=0;i<actors.length;i++){
   const p=actors[i];if(p.dead||p.won)continue;if(p.downUntil>clock){p.walking=false;const elapsed=clock-p.fallStart;const tilt=Math.min(1,elapsed/.25);p.actor.root.rotation.z=.95*tilt;p.actor.root.position.y=-.28*tilt;p.actor.root.position.z=p.z;p.actor.root.position.x+=(p.x-p.actor.root.position.x)*Math.min(1,dt*12);continue;}else {p.actor.root.rotation.z+=(0-p.actor.root.rotation.z)*Math.min(1,dt*10);p.actor.root.position.y+=(0-p.actor.root.position.y)*Math.min(1,dt*10);}
   if(i>0&&clock>=p.decisionAt){p.botMove=phase==='green'&&Math.random()>.12;p.decisionAt=clock+.35+Math.random()*.9;}
   const running=i===0?pressed:p.botMove;
   p.walking=running;
   if(running){
    if(phase==='red'){p.dead=true;p.walking=false;p.actor.root.visible=false;if(i===0)status.textContent='💀 ¡Te moviste con luz roja!';tone(130);}
    else {p.z-=dt*(i===0?11:p.pace);if(p.z<=-166){p.z=-166;p.won=true;p.walking=false;if(!winner){winner=p;status.textContent=i===0?'🏆 ¡GANASTE!':'🏆 Ganó el jugador '+(i+1);end();}}}
   }
   p.actor.root.position.z=p.z;p.actor.root.position.x+=(p.x-p.actor.root.position.x)*Math.min(1,dt*12);
  }
  count.textContent=actors.filter(p=>!p.dead&&!p.won).length+' en carrera';
  $('clock').textContent=Math.max(0,Math.ceil(deadline-clock))+' s';
  hit.textContent=clock-lastHit<5?'👊 '+Math.ceil(5-(clock-lastHit))+' s':'👊 EMPUJAR';
  if(playing&&(clock>=deadline||actors.every(p=>p.dead||p.won)))end();
 }
 for(const p of actors)p.actor.update(dt,p.walking&&!p.dead&&!p.won?'walk':'idle',false);
 const me=actors[0],desiredZ=(me?.z??-1)+8;
 camera.position.lerp(new THREE.Vector3(me?.x??0,4.3,desiredZ),.08);
 camera.lookAt(me?.x??0,2,(me?.z??-1)-13);
 renderer.render(scene,camera);raf=requestAnimationFrame(frame);
}
async function begin(){stopSong();if(loading)return;loading=true;start.disabled=true;status.textContent='Cargando personajes 3D…';try{await preloadOriginalModel();make();playing=true;clock=0;pressed=false;winner=null;lastHit=-100;lane=0;deadline=180;headPivot.rotation.y=0;headVelocity=0;startGreen();move.disabled=false;hit.disabled=false;left.disabled=false;right.disabled=false;start.textContent='↻ Reiniciar';status.textContent='Mantené pulsado para correr';}catch(e){console.error(e);status.textContent='No se pudo cargar el modelo 3D. Recargá la página.'}finally{loading=false;start.disabled=false}}
function changeLane(dir){const me=actors[0];if(!playing||!me||me.dead||me.won)return;if(phase==='red'){me.dead=true;me.actor.root.visible=false;status.textContent='💀 ¡Te moviste con luz roja!';tone(130);return;}lane=Math.max(0,Math.min(7,lane+dir));me.x=(lane-3.5)*2.7;}
left.addEventListener('click',()=>changeLane(-1));right.addEventListener('click',()=>changeLane(1));
let touchX=null;stage.addEventListener('touchstart',e=>{touchX=e.changedTouches[0]?.clientX??null},{passive:true});stage.addEventListener('touchend',e=>{if(touchX===null)return;const dx=(e.changedTouches[0]?.clientX??touchX)-touchX;if(Math.abs(dx)>35)changeLane(dx>0?1:-1);touchX=null},{passive:true});
hit.addEventListener('click',()=>{if(!playing||actors[0]?.dead||actors[0]?.won||clock-lastHit<5)return;const me=actors[0];let target=null,dist=3.3;for(const p of actors.slice(1)){if(p.dead||p.won||p.downUntil>clock)continue;const ahead=me.z-p.z,lateral=Math.abs(p.x-me.x);if(ahead>=0&&ahead<dist&&lateral<1.8){target=p;dist=ahead}}if(!target){status.textContent='👊 Ponete detrás de un jugador cercano para empujarlo';return;}lastHit=clock;target.downUntil=clock+2;target.fallStart=clock;target.botMove=false;target.decisionAt=clock+2.2;target.z-=1.4;tone(180);status.textContent='💥 ¡Empujaste al jugador '+(actors.indexOf(target)+1)+'!';});
start.addEventListener('click',begin);move.addEventListener('pointerdown',e=>{if(!playing||actors[0]?.dead||actors[0]?.won)return;e.preventDefault();pressed=true;move.setPointerCapture(e.pointerId)});for(const ev of ['pointerup','pointercancel','lostpointercapture'])move.addEventListener(ev,()=>pressed=false);document.addEventListener('visibilitychange',()=>{pressed=false});sound.addEventListener('click',()=>{enabledSound=!enabledSound;if(!enabledSound)song.pause();else if(playing&&phase==='green'){song.play().catch(()=>{});}sound.textContent=enabledSound?'🔊 Sonido':'🔇 Silencio'});resize();last=performance.now();raf=requestAnimationFrame(frame);
