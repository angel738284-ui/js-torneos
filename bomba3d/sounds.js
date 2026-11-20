/**
 * Web Audio effects for JS FAMILY Bomba Mortal.
 * No external downloads. Audio starts only after a real user gesture,
 * so mobile Chrome autoplay restrictions are respected.
 */
export function createBombSFX(){
 const Ctx=window.AudioContext||window.webkitAudioContext;
 const STORE="js-bomba-sonidos-v1";
 let enabled=true;
 try{enabled=localStorage.getItem(STORE)!=="off";}catch{}
 let ctx=null,noise=null,hiss=null,hissGain=null,lastHiss=0,fuseWasActive=false,output=null;
 const clips={fuse:null,explosion:null};
 let fuseClip=null,clipGain=null,clipStarted=false;
 async function loadClips(){
  if(!ctx)return;
  for(const [kind,file] of [["fuse","mecha-tnt-audible.ogg"],["explosion","explosion.ogg"]]){
   try{
    const response=await fetch("./bomba3d/audio/"+file,{cache:"force-cache"});
    if(!response.ok)continue;
    const data=await response.arrayBuffer();
    clips[kind]=await ctx.decodeAudioData(data);
   }catch{/* Keep original synthesized audio until files are uploaded. */}
  }
 }
 const clamp=x=>Math.max(0,Math.min(1,x));
 function unlock(){
  if(!Ctx||!enabled||document.hidden)return false;
  try{
   if(!ctx){
    ctx=new Ctx();
    output=ctx.createGain();output.connect(ctx.destination);
    output.gain.value=1;
    const seconds=2,rate=ctx.sampleRate;
    noise=ctx.createBuffer(1,Math.round(rate*seconds),rate);
    const data=noise.getChannelData(0);
    // Uniform white noise, reused for the hiss, throw and explosion.
    for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    void loadClips();
   }
   if(ctx.state==="suspended")void ctx.resume().catch(()=>{});
   return true;
  }catch{return false;}
 }
 function running(){return enabled&&ctx&&ctx.state==="running"&&!document.hidden;}
 function burst({duration=.5,frequency=1500,low=160,volume=.45,start=0,type="lowpass"}){
  if(!running())return;
  const t=ctx.currentTime+start;
  const source=ctx.createBufferSource();
  source.buffer=noise;
  const filter=ctx.createBiquadFilter();
  filter.type=type;
  filter.frequency.setValueAtTime(frequency,t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(35,low),t+duration);
  const amp=ctx.createGain();
  amp.gain.setValueAtTime(.0001,t);
  amp.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),t+.015);
  amp.gain.exponentialRampToValueAtTime(.0001,t+duration);
  source.connect(filter);filter.connect(amp);amp.connect(output);
  source.start(t);source.stop(t+duration+.03);
  source.onended=()=>{source.disconnect();filter.disconnect();amp.disconnect();};
 }
 function tone(startHz,endHz,duration,volume,type="sine",start=0){
  if(!running())return;
  const t=ctx.currentTime+start,osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type=type;
  osc.frequency.setValueAtTime(startHz,t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20,endHz),t+duration);
  gain.gain.setValueAtTime(.0001,t);
  gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),t+.012);
  gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
  osc.connect(gain);gain.connect(output);
  osc.start(t);osc.stop(t+duration+.02);
  osc.onended=()=>{osc.disconnect();gain.disconnect();};
 }
 function ensureHiss(){
  if(hiss||!running())return;
  const source=ctx.createBufferSource();source.buffer=noise;source.loop=true;
  const hi=ctx.createBiquadFilter();hi.type="highpass";hi.frequency.value=1100;
  const lo=ctx.createBiquadFilter();lo.type="lowpass";lo.frequency.value=7200;
  const gain=ctx.createGain();gain.gain.value=0;
  source.connect(hi);hi.connect(lo);lo.connect(gain);gain.connect(output);
  source.start();
  hiss={source,hi,lo,gain};hissGain=gain;
 }
 function stopFuseClip(){
  if(fuseClip){
   try{fuseClip.stop();}catch{}
   fuseClip.disconnect();fuseClip=null;
  }
  if(clipGain){clipGain.disconnect();clipGain=null;}
 }
 function playSample(buffer,volume=1){
  if(!running()||!buffer)return false;
  const src=ctx.createBufferSource(),gain=ctx.createGain();
  src.buffer=buffer;gain.gain.value=volume;
  src.connect(gain);gain.connect(output);
  src.start();src.onended=()=>{src.disconnect();gain.disconnect();};
  return true;
 }
 function setFuseActive(active,progress=1){
  if(!active)stopFuseClip();
  if(active&&clips.fuse&&running()){
   if(!fuseClip){
    fuseClip=ctx.createBufferSource();fuseClip.buffer=clips.fuse;fuseClip.loop=true;
    clipGain=ctx.createGain();clipGain.gain.value=0;
    clipGain.gain.setTargetAtTime(.85,ctx.currentTime,.10);
    fuseClip.connect(clipGain);clipGain.connect(output);fuseClip.start();
   }
   if(clipGain)clipGain.gain.setTargetAtTime(.75+.15*(1-clamp(progress)),ctx.currentTime,.15);
   if(hissGain)hissGain.gain.setTargetAtTime(0,ctx.currentTime,.02);
   fuseWasActive=true;
   return;
  }
  if(!running())return;
  const now=ctx.currentTime;
  if(!active&&!fuseWasActive)return;
  if(active)ensureHiss();
  if(!hissGain)return;
  const activeGain=active ? .075+(.16*(1-clamp(progress))) : 0;
  // Throttled automation: doesn't create nodes each frame.
  if(!active||now-lastHiss>.11){
   hissGain.gain.setTargetAtTime(activeGain,now,.045);
   if(active&&hiss)hiss.lo.frequency.setTargetAtTime(3600+2400*(1-clamp(progress)),now,.1);
   lastHiss=now;
  }
  fuseWasActive=Boolean(active);
 }
 function playThrow(){
  if(!running())return;
  setFuseActive(false);
  burst({duration:.32,frequency:4200,low:580,volume:.31,type:"bandpass"});
  tone(540,160,.28,.085,"triangle");
 }
 function playExplosion(){
  if(!running())return;
  setFuseActive(false);
  if(playSample(clips.explosion,.90))return;
  burst({duration:.94,frequency:2500,low:105,volume:.68});
  burst({duration:.46,frequency:800,low:60,volume:.28,start:.025});
  tone(145,42,.85,.42,"sine");
  tone(72,30,.60,.18,"triangle");
 }
 function isEnabled(){return enabled&&Boolean(Ctx);}
 function updateButton(){
  const btn=document.getElementById("bombSoundToggle");
  if(!btn)return;
  btn.disabled=!Ctx;
  btn.setAttribute("aria-pressed",String(isEnabled()));
  btn.textContent=!Ctx?"🔇 Audio no disponible":enabled?"🔊 Sonidos activados":"🔇 Sonidos apagados";
 }
 function setEnabled(value){
  enabled=Boolean(value);
  try{localStorage.setItem(STORE,enabled?"on":"off");}catch{}
  if(!enabled){
   stopFuseClip();
   if(hissGain&&ctx){hissGain.gain.setTargetAtTime(0,ctx.currentTime,.015);fuseWasActive=false;}
  }
  if(enabled)unlock();
  document.dispatchEvent(new CustomEvent("bomb-sound-enabled",{detail:enabled}));
  updateButton();
 }
 function bind(){
  updateButton();
  function updateMix(){if(!output)return;output.gain.value=1;}
  document.addEventListener("bomb-mix-change",updateMix);
  document.getElementById("bombSoundToggle")?.addEventListener("click",()=>{
   setEnabled(!enabled);
  });
  // Mobile browsers need a gesture to start AudioContext; never autoplay.
  for(const event of ["pointerdown","keydown","click"]){
   document.addEventListener(event,()=>{if(enabled)unlock();},{capture:true,passive:true});
  }
  document.addEventListener("visibilitychange",()=>{
   if(document.hidden)stopFuseClip();
   if(document.hidden&&hissGain&&ctx)hissGain.gain.setTargetAtTime(0,ctx.currentTime,.01);
  });
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});
 else bind();
 return {unlock,setFuseActive,playThrow,playExplosion,setEnabled,isEnabled};
}
