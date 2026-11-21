#!/usr/bin/env python3
"""Produce mobile texture-resolution copy of the EXACT uploaded GLB mesh."""
from pathlib import Path
from PIL import Image
import struct,json,io
source=Path("bomba3d/models/js-rubber-original.glb")
target=Path("bomba3d/models/js-rubber-mobile.glb")
data=source.read_bytes()
assert data[:4]==b"glTF" and struct.unpack_from("<II",data,4)==(2,len(data))
n,magic=struct.unpack_from("<I4s",data,12)
assert magic==b"JSON"
manifest=json.loads(data[20:20+n])
binpos=20+n; bsize,bmagic=struct.unpack_from("<I4s",data,binpos)
assert bmagic==b"BIN\x00"
binary=data[binpos+8:binpos+8+bsize]
# Maintain position/normal/UV/indices bytes exactly and substitute only JPEG textures.
oldViews=manifest["bufferViews"]
newBinary=bytearray()
for v in oldViews:
 offset=v.get("byteOffset",0); blob=binary[offset:offset+v["byteLength"]]
 img=next((x for x in manifest["images"] if x["bufferView"]==oldViews.index(v)),None)
 if img:
  image=Image.open(io.BytesIO(blob)).convert("RGB")
  image.thumbnail((1024,1024),Image.Resampling.LANCZOS)
  stream=io.BytesIO();image.save(stream,format="JPEG",quality=90,optimize=True,subsampling=0)
  blob=stream.getvalue()
  print(img["name"],"resolution",image.size,"bytes",len(blob))
 while len(newBinary)%4:newBinary.append(0)
 v["byteOffset"]=len(newBinary);v["byteLength"]=len(blob)
 newBinary.extend(blob)
while len(newBinary)%4:newBinary.append(0)
manifest["buffers"][0]["byteLength"]=len(newBinary)
jsonbytes=json.dumps(manifest,separators=(",",":"),ensure_ascii=False).encode()
while len(jsonbytes)%4:jsonbytes+=b" "
out=bytearray(struct.pack("<4sII",b"glTF",2,12+8+len(jsonbytes)+8+len(newBinary)))
out.extend(struct.pack("<I4s",len(jsonbytes),b"JSON"));out.extend(jsonbytes)
out.extend(struct.pack("<I4s",len(newBinary),b"BIN\x00"));out.extend(newBinary)
target.write_bytes(out)
assert out[:4]==b"glTF" and struct.unpack_from("<I",out,8)[0]==len(out)
print("GLB_MOBILE",target,len(out),"source",len(data),"ratio",round(len(out)/len(data),2))
