#!/usr/bin/env python3
"""JS Bomba: create six keyframed skeletal clips preserving the uploaded GLB mesh and textures. Stdlib only."""
import json,struct,math,sys
from pathlib import Path
source=Path(__file__).parent/'js-rubber-original.glb'
output=Path(__file__).parent/'js-rubber-animated.glb'
raw=source.read_bytes()
assert raw[:4]==b'glTF' and struct.unpack_from('<I',raw,4)[0]==2
jn,jt=struct.unpack_from('<I4s',raw,12); assert jt==b'JSON'
g=json.loads(raw[20:20+jn]); at=20+jn
bn,bt=struct.unpack_from('<I4s',raw,at);assert bt==b'BIN\x00'
blob=bytearray(raw[at+8:at+8+bn])
def add(data,kind,component,count,mini=False):
 while len(blob)%4:blob.append(0)
 off=len(blob);blob.extend(data)
 g['bufferViews'].append(dict(buffer=0,byteOffset=off,byteLength=len(data)))
 acc=dict(bufferView=len(g['bufferViews'])-1,componentType=component,count=count,type=kind)
 if mini:
  vals=list(struct.iter_unpack('<f',data));acc['min']=[min(v[0] for v in vals)];acc['max']=[max(v[0] for v in vals)]
 g['accessors'].append(acc);return len(g['accessors'])-1
def smooth(a,b,v):
 t=max(0,min(1,(v-a)/(b-a)));return t*t*(3-2*t)
p=g['meshes'][0]['primitives'][0];pa=g['accessors'][p['attributes']['POSITION']]
view=g['bufferViews'][pa['bufferView']]
off=view.get('byteOffset',0)+pa.get('byteOffset',0)
assert pa['componentType']==5126 and pa['type']=='VEC3'
stride=view.get('byteStride',12)
names=['Hips','Chest','Head','Arm_L','Forearm_L','Arm_R','Forearm_R','Thigh_L','Shin_L','Thigh_R','Shin_R']
H,C,HEAD,AL,FL,AR,FR,TL,SL,TR,SR=range(11)
joints=bytearray(); weights=bytearray()
for i in range(pa['count']):
 x,y,z=struct.unpack_from('<fff',blob,off+i*stride)
 head=smooth(.195,.31,y)
 leg=1-smooth(-.62,-.50,y)
 arm=(1-head)*(1-leg)*smooth(.29,.48,abs(x))*smooth(-.56,-.37,y)*(1-smooth(.10,.24,y))
 body=max(0,1-head-leg-arm)
 wt=[0.]*11
 chest=smooth(-.34,-.12,y)
 wt[H]=body*(1-chest);wt[C]=body*chest;wt[HEAD]=head
 lf=x<=0;fore=smooth(.16,.43,-y)
 wt[AL if lf else AR]=arm*(1-fore)
 wt[FL if lf else FR]=arm*fore
 side=smooth(.025,.12,abs(x));shin=smooth(.73,.85,-y)
 wt[H]+=leg*(1-side)
 wt[TL if lf else TR]=leg*side*(1-shin)
 wt[SL if lf else SR]=leg*side*shin
 ids=sorted(range(11),key=lambda k:wt[k],reverse=True)[:4]
 total=sum(wt[k] for k in ids)
 joints.extend(bytes(ids))
 weights.extend(struct.pack('<4f',*(wt[k]/total for k in ids)))
p['attributes']['JOINTS_0']=add(joints,'VEC4',5121,pa['count'])
p['attributes']['WEIGHTS_0']=add(weights,'VEC4',5126,pa['count'])
positions={'Hips':(0,-.45,0),'Chest':(0,.50,0),'Head':(0,.39,0),
 'Arm_L':(-.38,-.14,0),'Forearm_L':(-.14,-.21,0),
 'Arm_R':(.38,-.14,0),'Forearm_R':(.14,-.21,0),
 'Thigh_L':(-.21,-.16,0),'Shin_L':(0,-.20,0),
 'Thigh_R':(.21,-.16,0),'Shin_R':(0,-.20,0)}
parent=dict(Chest='Hips',Head='Chest',Arm_L='Chest',Forearm_L='Arm_L',
 Arm_R='Chest',Forearm_R='Arm_R',Thigh_L='Hips',Shin_L='Thigh_L',Thigh_R='Hips',Shin_R='Thigh_R')
offset=len(g['nodes']);node={n:offset+i for i,n in enumerate(names)}
for n in names:g['nodes'].append(dict(name=n,translation=list(positions[n])))
for n,pr in parent.items():g['nodes'][node[pr]].setdefault('children',[]).append(node[n])
g['scenes'][g.get('scene',0)]['nodes'].append(node['Hips'])
abspos={}
for n in names:
 b=positions[n];pr=parent.get(n);v=abspos.get(pr,(0,0,0))
 abspos[n]=(b[0]+v[0],b[1]+v[1],b[2]+v[2])
ibms=bytearray()
for n in names:
 x,y,z=abspos[n]
 # matrices are column major, final column is translation -position
 ibms.extend(struct.pack('<16f',1,0,0,0,0,1,0,0,0,0,1,0,-x,-y,-z,1))
b=add(ibms,'MAT4',5126,11)
g['skins']=[dict(name='JS_Bomba_Rig',joints=[node[n] for n in names],skeleton=node['Hips'],inverseBindMatrices=b)]
g['nodes'][0]['skin']=0
def quat(x=0,y=0,z=0):
 cx,sx=math.cos(x/2),math.sin(x/2)
 cy,sy=math.cos(y/2),math.sin(y/2)
 cz,sz=math.cos(z/2),math.sin(z/2)
 return (sx*cy*cz-cx*sy*sz,cx*sy*cz+sx*cy*sz,cx*cy*sz-sx*sy*cz,cx*cy*cz+sx*sy*sz)
def addclip(name,times,rot=None,pos=None):
 ac=dict(name=name,channels=[],samplers=[])
 ti=add(struct.pack('<%sf'%len(times),*times),'SCALAR',5126,len(times),True)
 for kind,data in [('rotation',rot or {}),('translation',pos or {})]:
  for bone,vals in data.items():
   assert len(vals)==len(times),(name,bone)
   values=[a for seq in vals for a in seq]
   typ='VEC4' if kind=='rotation' else 'VEC3'
   oi=add(struct.pack('<%sf'%len(values),*values),typ,5126,len(vals))
   ac['samplers'].append(dict(input=ti,output=oi,interpolation='LINEAR'))
   ac['channels'].append(dict(sampler=len(ac['samplers'])-1,target=dict(node=node[bone],path=kind)))
 g.setdefault('animations',[]).append(ac)
def wave(t,per):return math.sin(t*2*math.pi/per)
ts=[0,.5,1,1.5,2,2.5,3]
addclip('Esperando',ts,{
 'Chest':[quat(z=.012*wave(t,3)) for t in ts],
 'Head':[quat(z=.028*wave(t,3),y=.02*wave(t,3)) for t in ts],
 'Arm_L':[quat(x=.045*wave(t,3),z=.04*wave(t,3)) for t in ts],
 'Arm_R':[quat(x=-.045*wave(t,3),z=-.04*wave(t,3)) for t in ts],
}, {'Hips':[(0,-.45+.008*wave(t,3),0) for t in ts]})
ts=[0,.125,.25,.375,.5,.625,.75,.875,1]
addclip('Caminar',ts,{
 'Thigh_L':[quat(x=.32*wave(t,1)) for t in ts],
 'Thigh_R':[quat(x=-.32*wave(t,1)) for t in ts],
 'Shin_L':[quat(x=.16*max(0,-wave(t,1))) for t in ts],
 'Shin_R':[quat(x=.16*max(0,wave(t,1))) for t in ts],
 'Arm_L':[quat(x=-.2*wave(t,1)) for t in ts],
 'Arm_R':[quat(x=.2*wave(t,1)) for t in ts],
 'Chest':[quat(z=.02*wave(t,1)) for t in ts],
},{'Hips':[(0,-.45+.012*abs(wave(t,1)),0) for t in ts]})
ts=[0,.4,.8,1.2,1.6,2]
addclip('Sostener_Bomba',ts,{
 'Arm_L':[quat(x=-.5+.02*wave(t,2),z=.50) for t in ts],
 'Arm_R':[quat(x=-.5+.02*wave(t,2),z=-.50) for t in ts],
 'Forearm_L':[quat(x=-.27) for _ in ts],
 'Forearm_R':[quat(x=-.27) for _ in ts],
 'Head':[quat(x=-.04+.015*wave(t,2)) for t in ts],
},{'Hips':[(0,-.45+.008*wave(t,2),0) for t in ts]})
ts=[0,.15,.32,.53,.75,.92]
ax=[-.5,-.22,-.90,-1.15,-.30,0]
az=[.50,.3,.4,.18,.04,0]
addclip('Lanzar_Bomba',ts,{
 'Arm_L':[quat(x=a,z=z) for a,z in zip(ax,az)],
 'Arm_R':[quat(x=a,z=-z) for a,z in zip(ax,az)],
 'Forearm_L':[quat(x=a) for a in [-.27,-.32,-.4,-.12,-.08,0]],
 'Forearm_R':[quat(x=a) for a in [-.27,-.32,-.4,-.12,-.08,0]],
 'Chest':[quat(x=a) for a in [0,.1,.14,-.12,-.04,0]],
})
ts=[0,.18,.37,.61,.9]
addclip('Recibir_Bomba',ts,{
 'Arm_L':[quat(x=a,z=z) for a,z in zip([-1.03,-1.14,-.9,-.5,-.5],[.1,.1,.25,.5,.5])],
 'Arm_R':[quat(x=a,z=-z) for a,z in zip([-1.03,-1.14,-.9,-.5,-.5],[.1,.1,.25,.5,.5])],
 'Forearm_L':[quat(x=a) for a in [0,-.05,-.20,-.27,-.27]],
 'Forearm_R':[quat(x=a) for a in [0,-.05,-.20,-.27,-.27]],
})
ts=[0,.16,.38,.68,1.1,1.5,1.8]
addclip('Explotar_Caer',ts,{
 'Hips':[quat(x=a,z=b) for a,b in zip([0,.07,-.15,-.70,-1.32,-1.55,-1.55],[0,.08,-.1,-.05,.04,.04,.04])],
 'Head':[quat(x=a) for a in [0,-.09,.30,.25,-.12,-.12,-.12]],
 'Arm_L':[quat(x=a,z=b) for a,b in zip([0,-.4,-.7,.2,.65,.55,.55],[0,.2,.65,.5,.4,.4,.4])],
 'Arm_R':[quat(x=a,z=-b) for a,b in zip([0,-.4,-.7,.2,.65,.55,.55],[0,.2,.65,.5,.4,.4,.4])],
 'Thigh_L':[quat(x=a) for a in [0,-.1,.2,.25,.2,.15,.15]],
 'Thigh_R':[quat(x=a) for a in [0,.1,.2,.24,.1,-.12,-.12]],
},{'Hips':[(0,h,0) for h in [-.45,-.42,-.4,-.50,-.70,-.80,-.80]]})
while len(blob)%4:blob.append(0)
g['buffers'][0]['byteLength']=len(blob)
g['asset']['generator']='JS Family mobile animated rig 1'
jsondata=json.dumps(g,separators=(',',':'),ensure_ascii=False).encode('utf8')
jsondata+=b' '*((-len(jsondata))%4)
size=12+8+len(jsondata)+8+len(blob)
output.write_bytes(struct.pack('<4sII',b'glTF',2,size)+struct.pack('<I4s',len(jsondata),b'JSON')+jsondata+struct.pack('<I4s',len(blob),b'BIN\x00')+blob)
print('CREATED',output,output.stat().st_size,'vertices',pa['count'],'clips',[(a['name'],len(a['channels'])) for a in g['animations']])
