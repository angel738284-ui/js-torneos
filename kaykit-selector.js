(()=>{
const names=['Knight','Rogue','Rogue_Hooded','Mage','Barbarian','Skeleton_Mage','Skeleton_Minion','Skeleton_Rogue','Skeleton_Warrior','Chibi_Frost_Sprite_Coral'];
const labels=['🛡️ Caballero','🗡️ Pícaro','🥷 Pícaro encapuchado','🧙 Mago','🪓 Bárbaro','💀 Mago esqueleto','💀 Esbirro esqueleto','💀 Pícaro esqueleto','💀 Guerrero esqueleto','❄️ Frost Sprite Coral'];
const key='jsfamily-kaykit-character-v1';const select=document.getElementById('kaykit-choice');if(!select)return;
for(let i=0;i<names.length;i++){const o=document.createElement('option');o.value=String(i);o.textContent=labels[i];select.append(o)}
let saved=0;try{saved=Number(localStorage.getItem(key))||0}catch{}select.value=String(Math.max(0,Math.min(9,saved)));
select.addEventListener('change',()=>{const index=Number(select.value);try{localStorage.setItem(key,String(index))}catch{}document.dispatchEvent(new CustomEvent('js-kaykit-changed',{detail:{index}}));const notice=document.getElementById('kaykit-notice');if(notice)notice.textContent='✅ Elegido: '+labels[index]+' · guardado en este dispositivo';});
window.JSKayKitSelection={getIndex:()=>Number(select.value)||0,names};
})();
