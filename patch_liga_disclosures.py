from pathlib import Path
p=Path("liga.js");s=p.read_text()
def once(a,b,k):
 global s
 n=s.count(a)
 if n!=1:raise RuntimeError(k+" expected once, got "+str(n))
 s=s.replace(a,b,1)
once('const expandedPvps=new Set(),expandedAdminPanels=new Set();',
'''const expandedPvps=new Set(),expandedAdminPanels=new Set();
const disclosureStates=new Map();''',"disclosure state")
once('<details class="home-help"><summary>', '<details class="home-help" data-disclosure="home-help"><summary>',"home help")
once('<details class="rival-manual"><summary>', '<details class="rival-manual" data-disclosure="manual-rivals"><summary>',"manual challenge details")
once('<details class="history-match-list"><summary>', '<details class="history-match-list" data-disclosure="historic-pvps"><summary>',"historic pvp details")
once('<details class="rank-duos-details"><summary>', '<details class="rank-duos-details" data-disclosure="duo-rank"><summary>',"rank details")
once(''' $("league-content").innerHTML=fn()+(live.admin&&view==="admin"?adminExtras():"");
 refreshAcceptCountdowns();''',
''' for(const node of document.querySelectorAll("#league-content details[data-disclosure]"))
  disclosureStates.set(node.dataset.disclosure,node.open);
 $("league-content").innerHTML=fn()+(live.admin&&view==="admin"?adminExtras():"");
 for(const node of document.querySelectorAll("#league-content details[data-disclosure]"))
  if(disclosureStates.get(node.dataset.disclosure)===true)node.open=true;
 refreshAcceptCountdowns();''',"persist open disclosures")
# Both logout and account switch should clear retained open panels.
old="expandedPvps.clear();expandedAdminPanels.clear();moreOpen=false;"
if s.count(old)!=2:raise RuntimeError("Expected two session reset points")
s=s.replace(old,"expandedPvps.clear();expandedAdminPanels.clear();disclosureStates.clear();moreOpen=false;")
p.write_text(s)
h=Path("liga.html");html=h.read_text()
assert html.count("liga.js?v=2.1.0")==1
h.write_text(html.replace("liga.js?v=2.1.0","liga.js?v=2.1.1",1))
print("PERSISTENT_EXPANDED_SECTIONS_WITH_REALTIME_UPDATES")
