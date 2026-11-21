from pathlib import Path
p=Path.home()/'js-torneos-pages/bomba3d/sounds.js'
s=p.read_text()
s=s.replace(' let ctx=null,noise=null,hiss=null,hissGain=null,lastHiss=0,fuseWasActive=false;',
''' let ctx=null,noise=null,hiss=null,hissGain=null,lastHiss=0,fuseWasActive=false;
 const clips={fuse:null,explosion:null};
 let fuseClip=null,clipGain=null,clipStarted=false;
 async function loadClips(){
  if(!ctx)return;
  for(const [kind,file] of [["fuse","mecha.ogg"],["explosion","explosion.ogg"]]){
   try{
    const response=await fetch("./bomba3d/audio/"+file,{cache:"force-cache"});
    if(!response.ok)continue;
    const data=await response.arrayBuffer();
    clips[kind]=await ctx.decodeAudioData(data);
   }catch{/* Keep original synthesized audio until files are uploaded. */}
  }
 }''')
s=s.replace('    for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;',
'''    for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    void loadClips();''')
s=s.replace(' function setFuseActive(active,progress=1){',
''' function stopFuseClip(){
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
  src.connect(gain);gain.connect(ctx.destination);
  src.start();src.onended=()=>{src.disconnect();gain.disconnect();};
  return true;
 }
 function setFuseActive(active,progress=1){
  if(!active)stopFuseClip();
  if(active&&clips.fuse&&running()){
   if(!fuseClip){
    fuseClip=ctx.createBufferSource();fuseClip.buffer=clips.fuse;fuseClip.loop=true;
    clipGain=ctx.createGain();clipGain.gain.value=.62;
    fuseClip.connect(clipGain);clipGain.connect(ctx.destination);fuseClip.start();
   }
   if(hissGain)hissGain.gain.setTargetAtTime(0,ctx.currentTime,.02);
   return;
  }''')
s=s.replace('  burst({duration:.94,frequency:2500,low:105,volume:.68});',
'''  if(playSample(clips.explosion,.90))return;
  burst({duration:.94,frequency:2500,low:105,volume:.68});''')
s=s.replace('  if(!enabled&&hissGain&&ctx){hissGain.gain.setTargetAtTime(0,ctx.currentTime,.015);fuseWasActive=false;}',
'''  if(!enabled){
   stopFuseClip();
   if(hissGain&&ctx){hissGain.gain.setTargetAtTime(0,ctx.currentTime,.015);fuseWasActive=false;}
  }''')
s=s.replace('   if(document.hidden&&hissGain&&ctx)hissGain.gain.setTargetAtTime(0,ctx.currentTime,.01);',
'''   if(document.hidden)stopFuseClip();
   if(document.hidden&&hissGain&&ctx)hissGain.gain.setTargetAtTime(0,ctx.currentTime,.01);''')
p.write_text(s)
print('external audio loader with existing sound fallback')
