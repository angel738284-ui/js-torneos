from pathlib import Path
p=Path('torneos.html')
s=p.read_text()
start=s.index('     if(t.mode==="BR"){\n')
end=s.index('     for(const game of t.matches||[]){\n',start)
original=s[start:end]
new='''     if(t.mode==="BR"){
       const br=t.br_room||{status:"not_sent"};
       const mapRooms=Array.isArray(t.br_maps)?t.br_maps:[];
       const modern=mapRooms.length===3&&(mapRooms.some(m=>!!m.sent_at)||!br.sent_at);
       if(modern){
         card.append(make("p","🗺 3 mapas · Bermuda · Purgatorio · Kalahari","tiny"));
         for(const m of mapRooms){
           const name=m.map_name||["Bermuda","Purgatorio","Kalahari"][Number(m.map_number)-1]||"Mapa";
           const frame=make("div",undefined,"item");
           frame.style.cssText="border:1px solid "+(m.status==="active"?"#60cdaa":"#435670")+";border-radius:12px;padding:12px;margin:10px 0";
           frame.append(make("strong","MAPA "+m.map_number+" · "+name));
           const label=m.status==="active"?"🟢 Sala disponible":
             m.status==="closed"?"🔒 Sala cerrada":
             m.status==="finished"?"🏆 Finalizado":"⏳ Esperando publicación";
           frame.append(make("p",label,"tiny"));
           if(m.status==="active"&&m.room_id&&m.room_password){
             const id=make("div","🎮 ID de sala: "+m.room_id,"notice-line");
             const pw=make("div","🔑 Contraseña: "+m.room_password,"notice-line");
             frame.append(id,pw);
           }
           card.append(frame);
         }
         if(br.status==="finished"&&br.winner_name)card.append(make("div","🏆 Campeón: "+br.winner_name,"notice-line"));
       }else{
         const note=br.status==="active"?"🟢 Sala BR habilitada":
           br.status==="finished"?"🏆 Campeón: "+(br.winner_name||"Ganador confirmado"):
           br.status==="closed"?"🔒 Sala BR cerrada":"⏳ Esperando la sala BR";
         card.append(make("div",note,"notice-line"));
         if(br.status==="active"&&br.room_id&&br.room_password)
           card.append(make("div","🎮 ID de sala: "+br.room_id+" · 🔑 Contraseña: "+br.room_password,"notice-line"));
       }
     }
'''
s=s[:start]+new+s[end:]
assert s.count("const mapRooms=Array.isArray(t.br_maps)") == 1
p.write_text(s)
print("TORNEOS_PATCH_OK",len(original),len(new))
