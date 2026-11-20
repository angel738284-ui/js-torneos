/* Original arcade sound design: no external copyrighted audio.
   User's supplied fuse and explosion remain in sounds.js. */
export function createArcadeSFX(){
 const Ctx=window.AudioContext||window.webkitAudioContext;
 const STORE="js-bomba-mix-v1";
 const defaults={effects:78,music:35,voices:45};
 let mix={...defaults},ctx=null,master=null,fx=null,bgm=null,voice=null;
 let ambient=null,ambientGain=null,lastSecond=null,lastCountdown=null;
 let lastRound=null,lastWinner=null,lastFall=0,roundStarted=false,lastBeat=-1;
 let musicEnabled=true,nextMelodyAt=0,melodyStep=0;
 const melody=[392,440,523.25,440,349.23,392,329.63,392,440,523.25,587.33,523.25,440,392,349.23,329.63];
 try{const saved=JSON.parse(localStorage.getItem(STORE)||"{}");for(const k of Object.keys(defaults))if(Number.isFinite(saved[k]))mix[k]=Math.max(0,Math.min(100,saved[k]));}catch{}
 const safe=()=>Boolean(ctx&&ctx.state==="running"&&!document.hidden);
 const vol=k=>mix[k]/100;
 function init(){
  if(!Ctx||document.hidden)return false;
  if(!ctx){
   ctx=new Ctx();master=ctx.createGain();master.gain.value=.64;master.connect(ctx.destination);
   fx=ctx.createGain();bgm=ctx.createGain();voice=ctx.createGain();
   fx.connect(master);bgm.connect(master);voice.connect(master);
   setMix();
  }
  if(ctx.state==="suspended")void ctx.resume().catch(()=>{});
  if(!nextMelodyAt)nextMelodyAt=ctx.currentTime+.15;
  return true;
 }
 function setMix(){
  if(!ctx)return;
  fx.gain.value=vol("effects");bgm.gain.value=vol("music");voice.gain.value=vol("voices");
 }
 function save(){try{localStorage.setItem(STORE,JSON.stringify(mix));}catch{}setMix();document.dispatchEvent(new Event("bomb-mix-change"));}
 function osc(hz,end,duration=.2,loud=.12,kind="sine",category="effects",delay=0){
  if(!safe()||vol(category)===0)return;
  const t=ctx.currentTime+delay,o=ctx.createOscillator(),g=ctx.createGain();
  o.type=kind;o.frequency.setValueAtTime(hz,t);
  o.frequency.exponentialRampToValueAtTime(Math.max(25,end),t+duration);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(loud,t+.012);
  g.gain.exponentialRampToValueAtTime(.0001,t+duration);
  o.connect(g);g.connect(category==="music"?bgm:category==="voices"?voice:fx);
  o.start(t);o.stop(t+duration+.025);
  o.onended=()=>{o.disconnect();g.disconnect();};
 }
 function whoosh(){ // pitch-dropping whistle in flight
  osc(1450,190,.43,.24,"sine");osc(840,125,.39,.095,"triangle", "effects",.025);
 }
 function catchBomb(){
  osc(310,95,.14,.24,"triangle");
  osc(520,165,.11,.09,"sine","effects",.018);
 }
 function grunt(){ // small synthesized 'hup' accent, not a voice recording
  if(vol("voices")===0)return;
  osc(245,170,.12,.13,"sawtooth","voices");
  osc(175,110,.13,.08,"triangle","voices",.03);
 }
 function plof(delay=0){
  osc(155,48,.32,.29,"triangle","effects",delay);
  osc(85,38,.37,.18,"sine","effects",delay+.045);
 }
 function beep(index){
  const pitch=index===1?950:index===2?800:660;
  osc(pitch,pitch*.88,.11,.15,"square");
 }
 function countdown(sec,active,roundKey){
  if(!safe()||!active){lastCountdown=null;return;}
  if(roundKey!==lastRound){lastRound=roundKey;lastCountdown=null;lastSecond=null;}
  const remaining=Math.max(0,Math.ceil(sec));
  if(remaining<=5&&remaining>=1&&remaining!==lastCountdown){
   lastCountdown=remaining;
   beep(remaining<=2?1:remaining<=4?2:3);
   if(remaining===1)osc(1100,700,.24,.12,"triangle");
  }
 }
 function playStart(){
  if(!safe())return;
  [0,1,2].forEach((n)=>osc(500+n*130,520+n*130,.12,.14,"square","effects",n*.18));
  osc(900,1500,.4,.18,"triangle","effects",.55);
  // Music begins under the gameplay and gets quieter near detonation.
  if(!ambient){
   ambient=ctx.createOscillator();ambient.type="triangle";ambient.frequency.value=96;
   ambientGain=ctx.createGain();ambientGain.gain.value=0;
   ambient.connect(ambientGain);ambientGain.connect(bgm);ambient.start();
  }
  roundStarted=true;
 }
 function updateMusic(active,remaining){
  if(!safe()||!musicEnabled||vol("music")===0)return;
  // Gentle original chiptune melody, no samples or copyrighted tune.
  // Audio starts only after a tap, as required by mobile browsers.
  if(!nextMelodyAt)nextMelodyAt=ctx.currentTime+.12;
  const spacing=active?.43:.66;
  if(nextMelodyAt<ctx.currentTime-.7)nextMelodyAt=ctx.currentTime+.08;
  let scheduled=0;
  while(nextMelodyAt<ctx.currentTime+.22&&scheduled++<2){
   const note=melody[melodyStep%melody.length];
   const delay=Math.max(0,nextMelodyAt-ctx.currentTime);
   osc(note,note*.995,.27,active?.037:.029,"sine","music",delay);
   if(melodyStep%4===0)osc(note/2,note/2,.48,.018,"triangle","music",delay);
   melodyStep++;nextMelodyAt+=spacing;
  }
 }
 function explosion(){
  if(!safe())return;
  updateMusic(false,0);
  // Cartoon aftermath: a small descending note, then a delayed impact.
  osc(440,125,.22,.08,"triangle","effects",.16);
  plof(.37);
  lastFall=Date.now();
 }
 function victory(){
  if(!safe())return;
  updateMusic(false,0);
  [523,659,784,1047].forEach((hz,i)=>{
   osc(hz,hz*1.02,.3,.17,"triangle","music",i*.16);
   osc(hz/2,hz/2,.35,.055,"sine","music",i*.16);
  });
 }
 function markRound(key,active){
  if(!active){updateMusic(false,0);lastCountdown=null;return;}
  if(lastRound!==key){lastRound=key;lastCountdown=null;playStart();}
 }
 function markWinner(id){
  if(!id){lastWinner=null;return;}
  if(lastWinner!==id){lastWinner=id;victory();}
 }
 function bind(){
  const root=document.getElementById("bombAudioMixer");if(!root)return;
  for(const k of Object.keys(defaults)){
   const input=root.querySelector('[data-mix="'+k+'"]');
   const output=root.querySelector('[data-level="'+k+'"]');
   if(!input)continue;
   input.value=String(mix[k]);if(output)output.textContent=mix[k]+"%";
   input.addEventListener("input",()=>{
    mix[k]=Math.max(0,Math.min(100,Number(input.value)||0));
    if(output)output.textContent=mix[k]+"%";
    save();
   });
  }
  document.getElementById("bombAudioTest")?.addEventListener("click",()=>{
   init();whoosh();catchBomb();victory();
  });
  for(const e of ["pointerdown","keydown"])document.addEventListener(e,init,{capture:true,passive:true});
  const toggle=document.getElementById("bombMusicToggle");
  const sync=()=>{if(toggle){toggle.textContent=musicEnabled?"🎵 Música tranquila: SÍ":"🎵 Música tranquila: NO";toggle.setAttribute("aria-pressed",String(musicEnabled));}};
  try{musicEnabled=localStorage.getItem("js-bomba-calm-music")!=="off";}catch{}
  sync();toggle?.addEventListener("click",()=>{musicEnabled=!musicEnabled;try{localStorage.setItem("js-bomba-calm-music",musicEnabled?"on":"off");}catch{}sync();init();});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&ctx)nextMelodyAt=ctx.currentTime+.15;});
  const musicTick=()=>{updateMusic(false,0);requestAnimationFrame(musicTick);};
  if(typeof requestAnimationFrame==="function")requestAnimationFrame(musicTick);
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
 return {init,whoosh,catchBomb,grunt,plof,beep,countdown,playStart,markRound,markWinner,updateMusic,explosion,getMix:()=>({...mix})};
}
