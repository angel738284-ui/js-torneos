from pathlib import Path
root=Path.home()/'js-torneos-pages'
old='https://angel738284-ui.github.io/js-torneos/'
files=['inscripcion.html','inscripcion-web-form.js','torneos.html']
for filename in files:
 p=root/filename
 s=p.read_text()
 n=s.count(old)
 assert n>=1, (filename,n)
 s=s.replace(old,'./')
 p.write_text(s)
 print('PORTABLE_LINKS',filename,n)
p=root/'admin.js'
s=p.read_text()
oldLine='const siteRoot=()=>String(currentConfig.siteUrl||location.href.replace(/\\/admin\\.html.*$/,"")).replace(/\\/$/,"");'
assert oldLine in s,'admin root marker missing'
newLine='const siteRoot=()=>String(["jstorneos.com","www.jstorneos.com"].includes(location.hostname)?location.origin:(currentConfig.siteUrl||location.href.replace(/\\/admin\\.html.*$/,""))).replace(/\\/$/,"");'
s=s.replace(oldLine,newLine)
p.write_text(s)
print('DOMAIN_SENSITIVE_ADMIN_LINKS_OK')
