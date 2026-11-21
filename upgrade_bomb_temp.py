from pathlib import Path
p=Path('bomba3d/wardrobe.js');s=p.read_text();needle='const mat=(c,opts={})=>new THREE.MeshStandardMaterial({color:c,roughness:.68,metalness:.02,...opts});';replacement='''// Shared procedural woven texture: tiny GPU footprint even with 20 players.
let fabricTexture=null;
function clothTexture(){
 if(fabricTexture)return fabricTexture;
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
 const ctx=canvas.getContext('2d'),img=ctx.createImageData(128,128);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  const i=(y*128+x)*4,grain=((x*17+y*29+x*y*3)%13)-6;
  const v=Math.max(205,Math.min(255,239+(x%4===0?-13:x%4===2?8:0)+(y%4===0?-12:y%4===2?8:0)+grain));
  img.data[i]=img.data[i+1]=img.data[i+2]=v;img.data[i+3]=255;
 }
 ctx.putImageData(img,0,0);
 fabricTexture=new THREE.CanvasTexture(canvas);fabricTexture.colorSpace=THREE.SRGBColorSpace;
 fabricTexture.wrapS=fabricTexture.wrapT=THREE.RepeatWrapping;fabricTexture.anisotropy=2;
 return fabricTexture;
}
const mat=(c,opts={})=>new THREE.MeshStandardMaterial({color:c,roughness:.83,metalness:0,...opts});
const cloth=c=>mat(c,{map:clothTexture(),roughness:.92});''';assert needle in s;s=s.replace(needle,replacement);s=s.replace(' const norm=[];\n const count=',' const norm=[];\n const uv=[];\n const count=');s=s.replace('   norm.push(nx,ny,nz);','   norm.push(nx,ny,nz);\n   uv.push(x*6+3,y*6);');s=s.replace(' g.setAttribute("normal",new THREE.Float32BufferAttribute(norm,3));',' g.setAttribute("normal",new THREE.Float32BufferAttribute(norm,3));\n g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));');s=s.replace(' const main=own(safeColor(a.shirt,"#775de6"));',' const main=cloth(safeColor(a.shirt,"#775de6"));materials.push(main);');s=s.replace(' const pant=own(safeColor(a.pants,"#273751"));',' const pant=cloth(safeColor(a.pants,"#273751"));materials.push(pant);');p.write_text(s)
p=Path('bomba3d/imported.js');s=p.read_text().replace('"./wardrobe.js?v=4"','"./wardrobe.js?v=5"');s=s.replace('  const idleSway=0;','  const breathing=action==="idle"||action==="hold";');s=s.replace('  animatedRig.rotation.z=reduced?0:\n   throwing?','  animatedRig.rotation.z=\n   throwing?');s=s.replace('  animatedRig.rotation.x=reduced?0:throwing?-.14:catching?.12:0;','  animatedRig.rotation.x=throwing?-.14:catching?.12:0;');s=s.replace('  animatedRig.position.y=reduced?0:Math.sin(elapsed*(dancing?7:2.3))*(dancing?.09:.022);','  animatedRig.position.y=dancing?Math.sin(elapsed*7)*.07:0;');s=s.replace('  animatedRig.position.x=reduced?0:Math.sin(elapsed*1.35)*(dancing?.12:.035);','  animatedRig.position.x=dancing?Math.sin(elapsed*1.35)*.09:0;');s=s.replace('  animatedRig.rotation.y=reduced?0:Math.sin(elapsed*1.25)*(dancing?.14:.045);','  animatedRig.rotation.y=dancing?Math.sin(elapsed*1.25)*.10:0;\n  animatedRig.scale.y=breathing?1+Math.sin(elapsed*1.7)*.0035:1;');p.write_text(s)
p=Path('bomba3d/game.js');s=p.read_text().replace('antialias:preview,powerPreference:"low-power"','antialias:true,powerPreference:"low-power"').replace('Math.min(1.25,window.devicePixelRatio||1)','Math.min(preview?1.65:1.45,window.devicePixelRatio||1)');p.write_text(s)
p=Path('bomba.html');s=p.read_text().replace('game.js?v=28','game.js?v=29');p.write_text(s)
