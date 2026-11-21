from pathlib import Path
p=Path.home()/'js-torneos-pages/bomba.html'
s=p.read_text()
s=s.replace('.tableStage.shock{animation:stageQuake .48s ease-out}', '.tableStage.shock{animation:stageQuakeStrong .68s cubic-bezier(.24,.72,.38,1) both;transform-origin:center center}')
s=s.replace('@keyframes screenFlash{', '@keyframes stageQuakeStrong{0%,100%{transform:translate(0,0) rotate(0)}8%{transform:translate(-12px,7px) rotate(-.8deg)}17%{transform:translate(11px,-8px) rotate(.8deg)}27%{transform:translate(-9px,-4px) rotate(-.6deg)}39%{transform:translate(8px,6px) rotate(.5deg)}53%{transform:translate(-5px,4px) rotate(-.3deg)}70%{transform:translate(4px,-3px) rotate(.2deg)}85%{transform:translate(-2px,1px)}}\n@keyframes screenFlash{')
s=s.replace(' stage.classList.add("shock");\n setTimeout(()=>{blast.remove();stage.classList.remove("shock");},840);', ' stage.classList.remove("shock");\n void stage.offsetWidth; // restart shake for successive blasts\n stage.classList.add("shock");\n setTimeout(()=>{blast.remove();stage.classList.remove("shock");},840);')
p.write_text(s)
print('camera shake intensified')
