// JS FAMILY: Build a seamless implicit rubber toy surface OFFLINE in Termux.
// Grid marching tetrahedra.  This runs at build time, NOT in the player's browser.
// The asset is our own geometry; no paid models and no runtime generator.
import fs from "node:fs";
import path from "node:path";

const step=.049,xMin=-1.2,yMin=-.10,zMin=-.76;
const nx=Math.ceil(2.4/step)+1,ny=Math.ceil(3.08/step)+1,nz=Math.ceil(1.55/step)+1;
const scalar=new Float32Array(nx*ny*nz);
const idx=(i,j,k)=>(i*ny+j)*nz+k;
function ellipse(x,y,z,cx,cy,cz,rx,ry,rz){
 return (Math.hypot((x-cx)/rx,(y-cy)/ry,(z-cz)/rz)-1)*Math.min(rx,ry,rz);
}
function cap(x,y,z,ax,ay,az,bx,by,bz,ra,rb){
 const dx=bx-ax,dy=by-ay,dz=bz-az;
 const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy+(z-az)*dz)/(dx*dx+dy*dy+dz*dz)));
 return Math.hypot(x-(ax+t*dx),y-(ay+t*dy),z-(az+t*dz))-(ra+(rb-ra)*t);
}
function smooth(a,b,k){
 const h=Math.max(0,k-Math.abs(a-b))/k;
 return Math.min(a,b)-h*h*k*.25;
}
function field(x,y,z){
 let d=ellipse(x,y,z,0,1.18,-.012,.49,.70,.36);
 d=smooth(d,ellipse(x,y,z,0,2.18,0,.555,.565,.51),.17);
 for(const sign of [-1,1]){
  d=smooth(d,cap(x,y,z,sign*.237,.77,-.01,sign*.245,.18,.045,.225,.220),.075);
  const arm=cap(x,y,z,sign*.44,1.52,-.01,sign*.86,.66,.055,.203,.18);
  const palm=ellipse(x,y,z,sign*.86,.61,.08,.198,.196,.207);
  d=smooth(d,smooth(arm,palm,.16),.12);
 }
 return d;
}
for(let i=0;i<nx;i++)
 for(let j=0;j<ny;j++)
  for(let k=0;k<nz;k++)
   scalar[idx(i,j,k)]=field(xMin+i*step,yMin+j*step,zMin+k*step);

const tetra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
const corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
const vertices=[],normals=[],faces=[],edgeCache=new Map();
const count=()=>vertices.length/3;
function vertex(p,q){
 const a=Math.min(p.id,q.id),b=Math.max(p.id,q.id),key=a*scalar.length+b;
 const exists=edgeCache.get(key);if(exists!==undefined)return exists;
 const t=p.value/(p.value-q.value),x=p.x+(q.x-p.x)*t,y=p.y+(q.y-p.y)*t,z=p.z+(q.z-p.z)*t;
 const eps=.01;
 const gx=field(x+eps,y,z)-field(x-eps,y,z);
 const gy=field(x,y+eps,z)-field(x,y-eps,z);
 const gz=field(x,y,z+eps)-field(x,y,z-eps);
 const length=Math.hypot(gx,gy,gz)||1;
 const newId=count();
 vertices.push(x,y,z);normals.push(gx/length,gy/length,gz/length);
 edgeCache.set(key,newId);return newId;
}
function triangle(a,b,c){
 const ax=vertices[a*3],ay=vertices[a*3+1],az=vertices[a*3+2],
 bx=vertices[b*3],by=vertices[b*3+1],bz=vertices[b*3+2],
 cx=vertices[c*3],cy=vertices[c*3+1],cz=vertices[c*3+2];
 const ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az;
 const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
 const gx=normals[a*3]+normals[b*3]+normals[c*3],
 gy=normals[a*3+1]+normals[b*3+1]+normals[c*3+1],
 gz=normals[a*3+2]+normals[b*3+2]+normals[c*3+2];
 if(nx*gx+ny*gy+nz*gz<0)faces.push(a,c,b);else faces.push(a,b,c);
}
for(let i=0;i<nx-1;i++)for(let j=0;j<ny-1;j++)for(let k=0;k<nz-1;k++){
 const cell=corners.map(([di,dj,dk])=>{
  const x=i+di,y=j+dj,z=k+dk;
  return {x:xMin+x*step,y:yMin+y*step,z:zMin+z*step,id:idx(x,y,z),value:scalar[idx(x,y,z)]};
 });
 const min=Math.min(...cell.map(c=>c.value)),max=Math.max(...cell.map(c=>c.value));
 if(min>0||max<0)continue;
 for(const ti of tetra){
  const points=ti.map(u=>cell[u]),inside=points.filter(p=>p.value<0),outside=points.filter(p=>p.value>=0);
  if(inside.length===1)triangle(...outside.map(p=>vertex(inside[0],p)));
  else if(outside.length===1)triangle(...inside.map(p=>vertex(outside[0],p)));
  else if(inside.length===2){
   const a=vertex(inside[0],outside[0]),b=vertex(inside[0],outside[1]),
         c=vertex(inside[1],outside[0]),d=vertex(inside[1],outside[1]);
   triangle(a,b,c);triangle(b,d,c);
  }
 }
}
const nverts=count(),nfaces=faces.length/3;
const size=16+nverts*3*4+nverts*3*4+faces.length*4;
const buffer=Buffer.alloc(size);
buffer.write("JSJB",0,"ascii");buffer.writeUInt32LE(1,4);
buffer.writeUInt32LE(nverts,8);buffer.writeUInt32LE(faces.length,12);
let offset=16;
for(const numbers of [vertices,normals]){
 for(const num of numbers){buffer.writeFloatLE(num,offset);offset+=4;}
}
for(const id of faces){buffer.writeUInt32LE(id,offset);offset+=4;}
const file=path.join(process.cwd(),"bomba3d","seamless_body.bin");
fs.writeFileSync(file,buffer);
console.log("SEAMLESS_TOY_ASSET_BUILT",JSON.stringify({nverts,nfaces,size,file,grid:[nx,ny,nz]}));
