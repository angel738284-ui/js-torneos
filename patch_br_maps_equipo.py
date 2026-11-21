from pathlib import Path
p=Path('equipo.js')
s=p.read_text()
s=s.replace('data.mode==="BR"?"🎮 Sala general Battle Royale":"⚔️ Mis enfrentamientos"',
            'data.mode==="BR"?"🗺 Mis 3 mapas BR":"⚔️ Mis enfrentamientos"')
start=s.index('   if(data.mode==="BR"){\n')
end=s.index('   }else if(!data.matches.length){\n',start)
original=s[start:end]
new='''   if(data.mode==="BR"){
     const room=data.br_room||{status:"not_sent"};
     const maps=Array.isArray(data.br_maps)?data.br_maps:[];
     const useMaps=maps.length===3&&(maps.some(m=>!!m.sent_at)||!room.sent_at);
     if(useMaps){
       list.append(make("p","Mismo torneo y mismos participantes: 3 salas en orden Bermuda, Purgatorio y Kalahari.","small"));
       for(const m of maps){
         const name=m.map_name||["Bermuda","Purgatorio","Kalahari"][Number(m.map_number)-1]||"Mapa";
         const card=make("div",undefined,"item js-br-room");
         card.style.cssText="border:1px solid "+(m.status==="active"?"#55cfaa":"#3e536a")+";border-radius:14px;padding:14px;margin:12px 0";
         card.append(make("h3","🗺 MAPA "+m.map_number+" · "+name));
         const state=m.status==="active"?"🟢 Sala habilitada":
           m.status==="closed"?"🔒 Sala cerrada":
           m.status==="finished"?"🏆 Torneo finalizado":"⏳ Esperando ID y contraseña";
         card.append(make("p",state,"room-send-status"));
         if(m.status==="active"&&m.room_id&&m.room_password){
           addRow(card,"🎮 ID de sala · "+name,m.room_id,true);
           addRow(card,"🔑 Contraseña · "+name,m.room_password,true);
         }else if(m.status==="pending"){
           card.append(make("p","El organizador publicará esta sala cuando termine el mapa anterior.","small"));
         }
         list.append(card);
       }
       if(room.status==="finished"&&room.winner_name){
         list.append(make("h3","🏆 Campeón: "+room.winner_name));
       }
     }else{
       const card=make("div",undefined,"item js-br-room");
       card.append(make("h3","🎮 Battle Royale · Sala antigua"));
       card.append(make("p","Torneo BR en formato de sala única.","small"));
       const label={active:"🟢 Sala enviada",not_sent:"⏳ Esperando sala general",closed:"🔒 Sala cerrada",finished:"🏆 Torneo finalizado"}[room.status]||"Esperando sala";
       card.append(make("p",label,"room-send-status"));
       if(room.status==="active"&&room.room_id&&room.room_password){
         addRow(card,"ID de sala BR",room.room_id,true);
         addRow(card,"Contraseña para todos",room.room_password,true);
       }
       if(room.status==="finished"&&room.winner_name)card.append(make("h3","🏆 Campeón: "+room.winner_name));
       list.append(card);
     }
'''
s=s[:start]+new+s[end:]
assert s.count('const maps=Array.isArray(data.br_maps)')==1
p.write_text(s)
print('EQUIPO_PATCH_OK',len(original),len(new))
