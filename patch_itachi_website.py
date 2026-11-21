from pathlib import Path
p=Path.home()/'js-torneos-pages/torneos.html'
s=p.read_text()
old='<div class="js-arena-crest"><div class="js-arena-shield">JS</div><b>★</b></div>'
new='''<div class="js-arena-crest js-itachi-cover"><img src="./images/torneos-js-itachi-456.webp" alt="Itachi con traje verde 456, luna roja y logo TORNEOS JS" width="850" height="608" fetchpriority="high" decoding="async"></div>'''
assert s.count(old)==1
s=s.replace(old,new)
s=s.replace('''<div class="js-welcome-kicker">TORNEOS JS · TEMPORADA COMPETITIVA</div>''','''<div class="js-welcome-kicker">FREE FIRE · TEMPORADA COMPETITIVA</div>''')
s=s.replace('''<div class="js-arena-eyebrow"><i></i> COMPETITIVE PLATFORM <span>FREE FIRE</span></div>''','''<div class="js-arena-eyebrow"><i></i> COMPETENCIA OFICIAL DE LA COMUNIDAD <span>FREE FIRE</span></div>''')
assert s.count('arena-login.css?v=1.0.0')==1
s=s.replace('arena-login.css?v=1.0.0','arena-login.css?v=1.1.0')
s=s.replace('</head>','</head>',1)
p.write_text(s)
print('LOGO_IMAGE_INSERTED',s.count('torneos-js-itachi-456.webp'))
